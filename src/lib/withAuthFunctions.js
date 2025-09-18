// src/lib/withAuthFunctions.js
import dbConnect from "@/config/mongoConfig";
import { decodeJWT, verifyJWT } from "./jwt";
import { computeAdminPermissions } from "./permissions";

import Admin from "@/models/Admin";
import AdminSession from "@/models/AdminSession";
import Customer from "@/models/Customer";
import Session from "@/models/CustomerSession";
import { AUTH_ERRORS } from "@/presets/AUTH_ERRORS";

export async function adminReqWithAuth(headers) {
  await dbConnect();

  const token = headers.get("mailer-auth-token");
  if (!token) {
    throw AUTH_ERRORS.NO_TOKEN;
  }

  let decoded;
  try {
    decoded = verifyJWT(token);
  } catch (err) {
    throw AUTH_ERRORS.INVALID_TOKEN;
  }

  if (!decoded.adminId || !decoded.jti || decoded.typ !== "admin") {
    throw AUTH_ERRORS.INVALID_STRUCTURE;
  }

  const admin = await Admin.findById(decoded.adminId).lean();
  if (!admin) {
    throw AUTH_ERRORS.ADMIN_NOT_FOUND;
  }

  if (!admin.isActive) {
    throw AUTH_ERRORS.ADMIN_INACTIVE;
  }

  const activeSession = await AdminSession.findOne({
    actorType: "admin",
    adminId: admin._id,
    jti: decoded.jti,
    revoked: false,
    endedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!activeSession) {
    throw AUTH_ERRORS.NO_ACTIVE_SESSION;
  }

  await AdminSession.updateOne(
    { _id: activeSession._id },
    { $set: { lastActiveAt: new Date() } }
  );

  const permissions = await computeAdminPermissions(admin);

  return {
    admin,
    session: activeSession,
    permissions: permissions.effective,
    perms: permissions,
  };
}

export async function customerReqWithAuth(headers) {
  await dbConnect();

  const token = headers.get("mailer-auth-token");
  if (!token) {
    throw AUTH_ERRORS.NO_TOKEN;
  }

  let decoded;
  try {
    decoded = verifyJWT(token);
  } catch (err) {
    throw AUTH_ERRORS.INVALID_TOKEN;
  }

  if (decoded.roleKey !== "customer" || decoded.typ !== "customer") {
    throw AUTH_ERRORS.INVALID_STRUCTURE;
  }

  const customer = await Customer.findById(decoded.customerId).lean();
  if (!customer) {
    throw AUTH_ERRORS.CUSTOMER_NOT_FOUND;
  }

  if (!customer.isActive) {
    throw AUTH_ERRORS.CUSTOMER_INACTIVE;
  }

  const activeSession = await Session.findOne({
    tokenId: decoded.jti || decoded.sid,
    actorType: "customer",
    actorId: customer._id,
    isActive: true,
    endDate: { $gt: new Date() },
    revokedAt: null,
  });

  if (!activeSession) {
    throw AUTH_ERRORS.NO_ACTIVE_SESSION;
  }

  return { customer, session: activeSession };
}

export function requirePermission(authData, permission) {
  if (!authData?.permissions?.includes(permission)) {
    throw AUTH_ERRORS.INSUFFICIENT_PERMISSIONS;
  }
  return true;
}

export function requireOwner(authData) {
  const isOwner =
    authData?.perms?.roleKey === "owner" ||
    authData?.permissions?.includes("*") ||
    authData?.admin?.roleKey === "owner";

  if (!isOwner) {
    throw AUTH_ERRORS.OWNER_REQUIRED;
  }
  return true;
}

export async function anyReqWithAuth(headers) {
  const token = headers.get("mailer-auth-token");
  if (!token) throw AUTH_ERRORS.NO_TOKEN;

  let decoded;
  try {
    decoded = decodeJWT(token);
  } catch {
    throw AUTH_ERRORS.INVALID_TOKEN;
  }

  const isAdminToken =
    decoded?.typ === "admin" || (decoded?.adminId && decoded?.jti);
  const isCustomerToken =
    decoded?.typ === "customer" ||
    (decoded?.sub && (decoded?.sid || decoded?.jti));

  if (isAdminToken) {
    const { admin, session, permissions, perms } = await adminReqWithAuth(
      headers
    );
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
    const { customer, session } = await customerReqWithAuth(headers);
    return {
      actorType: "customer",
      tokenType: "customer",
      tokenId: decoded.sid || decoded.jti,
      actorId: String(customer._id),
      email: customer.email,
      roleKey: customer.roleKey || "customer",
      isActive: !!customer.isActive,
      permissions: [],
      perms: undefined,
      customer,
      session,
      tokenRaw: decoded,
    };
  }

  throw AUTH_ERRORS.UNRECOGNIZED_TOKEN;
}

export async function validateAccessBothAdminCustomer(request) {
  try {
    const authData = await anyReqWithAuth(request.headers);

    if (!authData?.customer?._id && !authData?.admin?._id) {
      throw AUTH_ERRORS.UNAUTHORIZED;
    }

    if (authData.admin?._id) {
      try {
        requireOwner(authData);
      } catch (error) {
        try {
          requirePermission(authData, "customer.view");
        } catch {
          requirePermission(authData, "customer.manage");
        }
      }
    }

    return authData;
  } catch (error) {
    throw {
      code: error.code || "AUTH999",
      statusCode: error.statusCode || 500,
      message: error.message || "Internal server error",
    };
  }
}
