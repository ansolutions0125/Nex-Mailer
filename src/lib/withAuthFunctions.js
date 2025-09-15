// src/lib/withAuthFunctions.js
import dbConnect from "@/config/mongoConfig";
import { verifyJWT } from "./jwt";
import { computeAdminPermissions } from "./permissions";

import Admin from "@/models/Admin";
import AdminSession from "@/models/AdminSession";
import Customer from "@/models/Customer";
import Session from "@/models/CustomerSession";

export async function adminReqWithAuth(headers) {
  await dbConnect();

  const token = headers.get("mailer-auth-token");
  if (!token) {
    throw {
      statusCode: 401,
      message: "No auth token provided"
    };
  }

  // When verifyJWT() throws an error:
  // 1. The error is caught in the catch block
  // 2. A new Error is created with message "Invalid or expired token" 
  // 3. statusCode 401 is set on the error
  // 4. The error is thrown, stopping execution
  let decoded;
  try {
    decoded = verifyJWT(token);
  } catch (err) {
    throw {
      statusCode: 401,
      message: "Invalid or expired token"
    };
  }

  // Validate JWT structure
  if (!decoded.adminId || !decoded.jti || decoded.typ !== "admin") {
    throw {
      statusCode: 401,
      message: "Invalid token structure"
    };
  }

  // Find admin
  const admin = await Admin.findById(decoded.adminId).lean();
  if (!admin) {
    throw {
      statusCode: 401,
      message: "Admin not found"
    };
  }

  if (!admin.isActive) {
    throw {
      statusCode: 403,
      message: "Admin account is deactivated"
    };
  }

  // Validate session
  const activeSession = await AdminSession.findOne({
    actorType: "admin",
    adminId: admin._id,
    jti: decoded.jti,
    revoked: false,
    endedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!activeSession) {
    throw {
      statusCode: 401,
      message: "No active session found"
    };
  }

  // Update last active
  await AdminSession.updateOne(
    { _id: activeSession._id },
    { $set: { lastActiveAt: new Date() } }
  );

  // Compute permissions
  const permissions = await computeAdminPermissions(admin);

  return {
    admin,
    session: activeSession,
    permissions: permissions.effective,
    perms: permissions, // for backward compatibility
  };
}

export async function customerReqWithAuth(headers) {
  await dbConnect();

  const token = headers.get("mailer-auth-token");
  if (!token) {
    const error = new Error("No auth token provided");
    error.statusCode = 401;
    throw error;
  }

  let decoded;
  try {
    decoded = verifyJWT(token);
  } catch (err) {
    const error = new Error("Invalid or expired token");
    error.statusCode = 401;
    throw error;
  }

  // Validate JWT structure for customer
  if (!decoded.sub || !decoded.sid || decoded.typ !== "customer") {
    const error = new Error("Invalid token structure");
    error.statusCode = 401;
    throw error;
  }

  // Find customer
  const customer = await Customer.findById(decoded.sub).lean();
  if (!customer) {
    const error = new Error("Customer not found");
    error.statusCode = 401;
    throw error;
  }

  if (!customer.isActive) {
    const error = new Error("Customer account is deactivated");
    error.statusCode = 403;
    throw error;
  }

  // Validate session using the correct Session model structure
  const activeSession = await Session.findOne({
    tokenId: decoded.jti || decoded.sid, // handle both possible field names
    actorType: "customer",
    actorId: customer._id,
    isActive: true,
    endDate: { $gt: new Date() },
    revokedAt: null,
  });

  if (!activeSession) {
    const error = new Error("No active session found");
    error.statusCode = 401;
    throw error;
  }

  return { customer, session: activeSession };
}

// Helper function to check permissions
export function requirePermission(authData, permission) {
  if (!authData?.permissions?.includes(permission)) {
    const error = new Error("Insufficient permissions");
    error.statusCode = 403;
    throw error;
  }
  return true;
}

// Helper function to check if user is owner
export function requireOwner(authData) {
  const isOwner =
    authData?.perms?.roleKey === "owner" ||
    authData?.permissions?.includes("*") ||
    authData?.admin?.roleKey === "owner";

  if (!isOwner) {
    const error = new Error("Owner role required");
    error.statusCode = 403;
    throw error;
  }
  return true;
}

/**
 * Throws an Error with .statusCode attached.
 */
function _throw(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

/**
 * Unified request auth that supports **both** admin and customer tokens.
 * It:
 *  1) reads "mailer-auth-token" from headers,
 *  2) decodes the JWT,
 *  3) routes to the correct validator (adminReqWithAuth or customerReqWithAuth),
 *  4) returns a single, normalized object you can branch on.
 *
 * @param {Headers} headers
 * @returns {Promise<AnyAuth>}
 */
export async function anyReqWithAuth(headers) {
  const token = headers.get("mailer-auth-token");
  if (!token) _throw(401, "No auth token provided");

  let decoded;
  try {
    decoded = verifyJWT(token);
  } catch {
    _throw(401, "Invalid or expired token");
  }

  // Prefer explicit "typ" when present, but be tolerant to structure
  const isAdminToken =
    decoded?.typ === "admin" || (decoded?.adminId && decoded?.jti);
  const isCustomerToken =
    decoded?.typ === "customer" || (decoded?.sub && (decoded?.sid || decoded?.jti));

  if (isAdminToken) {
    // Leverage your strict admin auth (DB checks, session validity, lastActive update, permissions)
    const { admin, session, permissions, perms } = await adminReqWithAuth(headers);
    return {
      actorType: "admin",
      tokenType: "admin",
      tokenId: decoded.jti,
      actorId: String(admin._id),
      email: admin.email,
      roleKey: admin.roleKey,
      isActive: !!admin.isActive,
      permissions,
      perms,
      admin,
      session,
      tokenRaw: decoded,
    };
  }

  if (isCustomerToken) {
    // Leverage your strict customer auth (DB checks, session validity)
    const { customer, session } = await customerReqWithAuth(headers);
    return {
      actorType: "customer",
      tokenType: "customer",
      tokenId: decoded.sid || decoded.jti,
      actorId: String(customer._id),
      email: customer.email,
      roleKey: customer.roleKey || "customer",
      isActive: !!customer.isActive,
      permissions: [],      // customers don't use your admin permission system
      perms: undefined,     // keep field for shape parity; not applicable
      customer,
      session,
      tokenRaw: decoded,
    };
  }

  _throw(401, "Unrecognized token type");
}
