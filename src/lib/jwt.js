// src/lib/jwt.js
import jwt from "jsonwebtoken";
import crypto from "crypto";

export function getJWTSecret() {
  const s = process.env.MAILER_JWT_SECRET || process.env.JWT_SECRET;
  if (!s) {
    throw new Error(
      "Missing MAILER_JWT_SECRET (or JWT_SECRET) in environment. Set one of them."
    );
  }
  return s;
}

export function signJWT(payload, opts = {}) {
  const { algorithm = "HS256" } = opts;
  if (!payload.expiresIn) {
    throw new Error("expiresIn must be provided in payload");
  }

  // Ensure we have a jti (JWT ID) for session tracking
  if (!payload.jti) {
    payload.jti = crypto.randomUUID();
  }

  // Add issued at time
  payload.iat = Math.floor(Date.now() / 1000);

  return jwt.sign(payload, getJWTSecret(), {
    expiresIn: payload.expiresIn,
    algorithm,
  });
}

export function verifyJWT(token) {
  try {
    // Accept either HS256 or HS512 to be compatible with older tokens
    return jwt.verify(token, getJWTSecret(), {
      algorithms: ["HS256", "HS512"],
    });
  } catch (error) {
    // Re-throw with more specific error messages
    if (error.name === "TokenExpiredError") {
      const err = new Error("Token has expired");
      err.name = "TokenExpiredError";
      throw err;
    }
    if (error.name === "JsonWebTokenError") {
      const err = new Error("Invalid token");
      err.name = "JsonWebTokenError";
      throw err;
    }
    throw error;
  }
}

export function decodeJWT(token) {
  try {
    return jwt.decode(token) || null;
  } catch {
    return null;
  }
}

/**
 * Convenience helpers for your issuers
 */
export function signAdminJWT(payload, opts = {}) {
  // Ensure consistent payload structure
  const adminPayload = {
    adminId: payload.adminId,
    email: payload.email,
    roleKey: payload.roleKey,
    typ: "admin",
    jti: payload.jti || crypto.randomUUID(),
    ...payload, // allow override of above fields if needed
  };

  return signJWT(adminPayload, opts);
}

export function signCustomerJWT(payload, opts = {}) {
  const customerPayload = {
    customerId: payload.customerId,
    email: payload.email,
    roleKey: payload.roleKey,
    typ: "customer",
    jti: payload.jti || crypto.randomUUID(),
    ...payload, // allow override of above fields if needed
  };
  return signJWT(customerPayload, opts);
}

/**
 * Generate a secure random token for magic links, etc.
 */
export function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

/**
 * Validate JWT payload structure for admin tokens
 */
export function validateAdminTokenPayload(payload) {
  const required = ["adminId", "typ", "jti"];
  const missing = required.filter((field) => !payload[field]);

  if (missing.length > 0) {
    throw new Error(
      `Invalid admin token: missing fields ${missing.join(", ")}`
    );
  }

  if (payload.typ !== "admin") {
    throw new Error("Invalid admin token: incorrect type");
  }

  return true;
}

/**
 * Validate JWT payload structure for customer tokens
 */
export function validateCustomerTokenPayload(payload) {
  const required = ["sub", "typ"];
  const missing = required.filter((field) => !payload[field]);

  if (missing.length > 0) {
    throw new Error(
      `Invalid customer token: missing fields ${missing.join(", ")}`
    );
  }

  if (payload.typ !== "customer") {
    throw new Error("Invalid customer token: incorrect type");
  }

  return true;
}
