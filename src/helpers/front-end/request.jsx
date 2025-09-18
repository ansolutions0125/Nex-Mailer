import { AUTH_ERRORS } from "@/presets/AUTH_ERRORS";

// --- Internal state (module-scoped, shared across imports) ---
const inFlight = new Map(); // key -> { promise, startedAt }
const memoryCache = new Map(); // key -> { data, expiry, resolvedAt }

const defaultOptions = {
  cacheTtlMs: 800,
  dedupeWindowMs: 600,
  retries: 2,
  retryBaseMs: 300,
  retryFactor: 2,
  abortOnTimeoutMs: 0,
};

// Stable stringify so payload order doesn't change the key
const stableStringify = (obj) => {
  if (!obj || typeof obj !== "object") return String(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(",")}]`;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
};

const makeKey = ({ url, method, token, payload }) =>
  `${method || "GET"}::${url}::${token || ""}::${stableStringify(payload)}`;

// Simple sleep
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

/** Map server auth errors to AUTH_ERRORS by message + status */
const mapAuthError = (status, message) => {
  if (status !== 401 && status !== 403) return null;
  const byMsg = Object.values(AUTH_ERRORS).find((e) => e.message === message);
  if (byMsg) return byMsg;

  // Fallback by status
  if (status === 401) return AUTH_ERRORS.UNAUTHORIZED;
  if (status === 403) return AUTH_ERRORS.INSUFFICIENT_PERMISSIONS;
  return null;
};

export const fetchWithAuthAdmin = async (req, opts = {}) => {
  const { url, admin, token, method = "GET", payload = null, setAdmin } = req;

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
  if (cached && cached.expiry > now) return cached.data;

  // 2) Share in-flight identical requests
  const inflightEntry = inFlight.get(key);
  if (inflightEntry && now - inflightEntry.startedAt <= dedupeWindowMs) {
    return inflightEntry.promise;
  }

  const headers = {
    "Content-Type": "application/json",
    ...(admin && token && { "mailer-auth-token": token }), // server expects this header
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
        const fetchOptions = { method, headers, signal: controller?.signal };
        if (payload) fetchOptions.body = JSON.stringify(payload);

        const response = await fetch(url, fetchOptions);

        // Retry on transient statuses
        if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
          if (attempt < retries) {
            const backoff = retryBaseMs * Math.pow(retryFactor, attempt++);
            await delay(backoff);
            continue;
          }
        }

        // Parse JSON safely
        const text = await response.text();
        let json;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = { raw: text };
        }

        // Attach authError mapping for 401/403 using server’s messages
        if (response.status === 401 || response.status === 403) {
          const message = json?.message || "";
          const authError = mapAuthError(response.status, message);
          if (authError) json = { ...json, authError };
        }

        // Special admin update handling
        if (url.includes("/api/admin") && method === "PUT" && json) {
          if (!admin || admin._id === json?.data?._id) {
            setAdmin?.(json?.data);
          }
        }

        return json;
      } catch (err) {
        if (err?.name === "AbortError") throw err;
        if (attempt < retries) {
          const backoff = retryBaseMs * Math.pow(retryFactor, attempt++);
          await delay(backoff);
          continue;
        }
        throw err;
      }
    }
  };

  const promise = doFetch()
    .then((data) => {
      if (cacheTtlMs > 0) {
        memoryCache.set(key, { data, expiry: Date.now() + cacheTtlMs, resolvedAt: Date.now() });
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

export const fetchWithAuthCustomer = async (req, opts = {}) => {
  const {
    url,
    customer,
    token,
    method = "GET",
    payload = null,
    setCustomer, // ✅ fix: was setAdmin
  } = req;

  const {
    cacheTtlMs,
    dedupeWindowMs,
    retries,
    retryBaseMs,
    retryFactor,
    abortOnTimeoutMs,
  } = { ...defaultOptions, ...opts };

  if (!url) throw new Error("fetchWithAuthCustomer: url is required"); // ✅ fix: correct helper name

  // Build request key
  const key = makeKey({ url, method, token, payload });
  const now = Date.now();

  // 1) Serve from tiny memory cache (burst suppression)
  const cached = memoryCache.get(key);
  if (cached && cached.expiry > now) return cached.data;

  // 2) Share in-flight identical requests
  const inflightEntry = inFlight.get(key);
  if (inflightEntry && now - inflightEntry.startedAt <= dedupeWindowMs) {
    return inflightEntry.promise;
  }

  const headers = {
    "Content-Type": "application/json",
    ...(customer && token && { "mailer-auth-token": token }), // server expects this header
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
        const fetchOptions = { method, headers, signal: controller?.signal };
        if (payload) fetchOptions.body = JSON.stringify(payload);

        const response = await fetch(url, fetchOptions);

        // Retry on transient statuses
        if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
          if (attempt < retries) {
            const backoff = retryBaseMs * Math.pow(retryFactor, attempt++);
            await delay(backoff);
            continue;
          }
        }

        // Parse JSON safely
        const text = await response.text();
        let json;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = { raw: text };
        }

        // Attach authError mapping for 401/403 using server’s messages
        if (response.status === 401 || response.status === 403) {
          const message = json?.message || "";
          const authError = mapAuthError(response.status, message);
          if (authError) json = { ...json, authError };
        }

        // Special customer update handling (correct route + setter)
        if (url.includes("/api/customers") && method === "PUT" && json) {
          if (!customer || customer._id === json?.data?._id) {
            setCustomer?.(json?.data);
          }
        }

        return json;
      } catch (err) {
        if (err?.name === "AbortError") throw err;
        if (attempt < retries) {
          const backoff = retryBaseMs * Math.pow(retryFactor, attempt++);
          await delay(backoff);
          continue;
        }
        throw err;
      }
    }
  };

  const promise = doFetch()
    .then((data) => {
      if (cacheTtlMs > 0) {
        memoryCache.set(key, { data, expiry: Date.now() + cacheTtlMs, resolvedAt: Date.now() });
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
