// file: /app/helpers/front-end/request.jsx

// --- Internal state (module-scoped, shared across imports) ---
const inFlight = new Map(); // key -> { promise, startedAt }
const memoryCache = new Map(); // key -> { data, expiry, resolvedAt }

const defaultOptions = {
  cacheTtlMs: 800,        // serve from short cache to collapse bursts
  dedupeWindowMs: 600,    // ignore duplicates that arrive very quickly
  retries: 2,             // retry on 429/5xx
  retryBaseMs: 300,       // backoff base
  retryFactor: 2,         // exponential factor
  abortOnTimeoutMs: 0,    // 0 = disabled; set e.g. 15000 to enable
};

// Stable stringify so payload order doesn’t change the key
const stableStringify = (obj) => {
  if (!obj || typeof obj !== "object") return String(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(",")}]`;
  return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
};

const makeKey = ({ url, method, token, payload }) =>
  `${method || "GET"}::${url}::${token || ""}::${stableStringify(payload)}`;

// Simple sleep
const delay = (ms) => new Promise(res => setTimeout(res, ms));

export const fetchWithAuthAdmin = async (req, opts = {}) => {
  const {
    url,
    admin,
    token,
    method = "GET",
    payload = null,
    setAdmin,
  } = req;

  const {
    cacheTtlMs,
    dedupeWindowMs,
    retries,
    retryBaseMs,
    retryFactor,
    abortOnTimeoutMs,
  } = { ...defaultOptions, ...opts };

  if (!url) throw new Error("fetchWithAuthAdmin: url is required");

  // Build request key
  const key = makeKey({ url, method, token, payload });
  const now = Date.now();

  // 1) Serve from tiny memory cache (burst suppression)
  const cached = memoryCache.get(key);
  if (cached && cached.expiry > now) {
    return cached.data;
  }

  // 2) Share in-flight identical requests
  const inflightEntry = inFlight.get(key);
  if (inflightEntry) {
    // If another identical request started very recently, just share it
    if (now - inflightEntry.startedAt <= dedupeWindowMs) {
      return inflightEntry.promise;
    }
  }

  const headers = {
    "Content-Type": "application/json",
    ...(admin && token && { "mailer-auth-token": token })
  };

  const controller = abortOnTimeoutMs ? new AbortController() : null;
  const timeoutId = abortOnTimeoutMs
    ? setTimeout(() => controller.abort(), abortOnTimeoutMs)
    : null;

  const doFetch = async () => {
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const fetchOptions = {
          method,
          headers,
          signal: controller?.signal,
        };
        if (payload) fetchOptions.body = JSON.stringify(payload);

        const response = await fetch(url, fetchOptions);

        // Retry on transient statuses
        if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
          if (attempt < retries) {
            const backoff = retryBaseMs * Math.pow(retryFactor, attempt);
            attempt++;
            await delay(backoff);
            continue;
          }
        }

        // Parse JSON safely
        let json;
        const text = await response.text();
        try { json = text ? JSON.parse(text) : null; }
        catch { json = { raw: text }; }

        // Optionally throw on non-OK if you want
        // if (!response.ok) {
        //   const err = new Error(`HTTP ${response.status}`);
        //   err.response = json;
        //   throw err;
        // }

        // Special admin update handling
        if (url.includes("/api/admin") && method === "PUT" && json) {
          if (!admin || admin._id === json?.data?._id) {
            setAdmin?.(json?.data);
          }
        }

        return json;
      } catch (err) {
        // Abort errors or network issues
        const isAbort = err?.name === "AbortError";
        if (isAbort) throw err;

        // Retry network errors
        if (attempt < retries) {
          const backoff = retryBaseMs * Math.pow(retryFactor, attempt);
          attempt++;
          await delay(backoff);
          continue;
        }
        throw err;
      }
    }
  };

  const promise = doFetch()
    .then((data) => {
      // put in tiny cache to collapse immediate duplicates
      if (cacheTtlMs > 0) {
        memoryCache.set(key, {
          data,
          expiry: Date.now() + cacheTtlMs,
          resolvedAt: Date.now(),
        });
      }
      return data;
    })
    .finally(() => {
      inFlight.delete(key);
      if (timeoutId) clearTimeout(timeoutId);
    });

  inFlight.set(key, { promise, startedAt: now });
  return promise;
};
