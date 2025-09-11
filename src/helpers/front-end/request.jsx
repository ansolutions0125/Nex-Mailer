// file: /app/helpers/front-end/request.jsx | next.js 13+

// Rate limiting configuration
const rateLimit = {
  requests: new Map(), // Store request counts
  windowMs: 60000, // 1 minute window
  maxRequests: 50, // Max requests per window
  duplicateRequests: new Map(), // Track duplicate requests
};

export const fetchWithAuthAdmin = async (req) => {
  const { url, admin, token, method = "GET", payload = null, setAdmin } = req;

  // Rate limiting check
  const now = Date.now();
  const clientId = admin?._id || "anonymous";
  const clientRequests = rateLimit.requests.get(clientId) || [];

  // Clean old requests outside window
  const validRequests = clientRequests.filter(
    (timestamp) => now - timestamp < rateLimit.windowMs
  );

  // Check if limit exceeded
  if (validRequests.length >= rateLimit.maxRequests) {
    throw new Error("Rate limit exceeded. Please try again later.");
  }

  // Check for duplicate requests
  const requestKey = `${url}-${method}-${token}`;
  const duplicateKey = `${clientId}-${requestKey}`;
  const duplicateCount = rateLimit.duplicateRequests.get(duplicateKey) || 0;

  if (duplicateCount >= 3) {
    throw new Error(
      "Too many duplicate requests. Please try a different request."
    );
  }

  // Add current request
  validRequests.push(now);
  rateLimit.requests.set(clientId, validRequests);

  // Increment duplicate request counter
  rateLimit.duplicateRequests.set(duplicateKey, duplicateCount + 1);

  // Reset duplicate counter after window expires
  setTimeout(() => {
    rateLimit.duplicateRequests.delete(duplicateKey);
  }, rateLimit.windowMs);

  const headers = {
    "Content-Type": "application/json",
    "mailer-auth-token": admin && token ? token : "token not provided",
  };

  try {
    const fetchOptions = {
      method,
      headers,
    };

    if (payload) {
      fetchOptions.body = JSON.stringify(payload);
    }

    const response = await fetch(url, fetchOptions);

    let Response = await response.json();

    // Check if URL is /api/admin and validate admin._id
    if (url.includes("/api/admin") && method === "PUT" && Response) {
      console.log("RES", Response);
      if (!admin || admin._id === Response?.data?._id) {
        console.log("THIS REQ WAS BY MY OWN UPDATE ");
        setAdmin(Response?.data);
      }
    }

    return Response;
  } catch (error) {
    console.error("Error in fetchWithAuthAdmin:", error);
    throw error;
  }
};
