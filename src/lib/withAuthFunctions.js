// src/lib/withAuthFunctions.js
import dbConnect from "@/config/mongoConfig";
import { verifyJWT } from "./jwt";
import { computeAdminPermissions } from "./permissions";

import Admin from "@/models/Admin";
import AdminSession from "@/models/AdminSession";
import Customer from "@/models/Customer";
import Session from "@/models/CustomerSession";
import { NextResponse } from "next/server";

export async function adminReqWithAuth(headers) {
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

  // Validate JWT structure
  if (!decoded.adminId || !decoded.jti || decoded.typ !== "admin") {
    const error = new Error("Invalid token structure");
    error.statusCode = 401;
    throw error;
  }

  // Find admin
  const admin = await Admin.findById(decoded.adminId).lean();
  if (!admin) {
    const error = new Error("Admin not found");
    error.statusCode = 401;
    throw error;
  }

  if (!admin.isActive) {
    const error = new Error("Admin account is deactivated");
    error.statusCode = 403;
    throw error;
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
    const error = new Error("No active session found");
    error.statusCode = 401;
    throw error;
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

// make an function that in takes authData to check if he is owner or if
