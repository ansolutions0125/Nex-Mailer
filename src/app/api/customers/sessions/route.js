// app/api/customers/sessions/route.js
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/config/mongoConfig";
import CustomerSession from "@/models/CustomerSession";
import {
  adminReqWithAuth,
  customerReqWithAuth,
  requireOwner,
  requirePermission,
} from "@/lib/withAuthFunctions";
import Admin from "@/models/Admin";
import Customer from "@/models/Customer";

const isValidId = (v) => mongoose.Types.ObjectId.isValid(v);
const oid = (v) => new mongoose.Types.ObjectId(v);
const now = () => new Date();

/**
 * Build a status predicate that works with BOTH session shapes:
 *  A) Your CustomerSession schema: tokenId, actorId, email, startDate, endDate, isActive, revokedAt
 *  B) Admin-style schema: jti, customerId, startedAt, expiresAt, revoked, endedAt
 */
function statusOr(status) {
  const t = now();
  if (status === "active") {
    return [
      // A) native customer schema
      { isActive: { $ne: false }, revokedAt: null, endDate: { $gt: t } },
      // B) admin-style
      { revoked: false, endedAt: null, expiresAt: { $gt: t } },
    ];
  }
  if (status === "revoked") {
    return [
      // A)
      { revokedAt: { $ne: null } },
      // B)
      { revoked: true },
    ];
  }
  if (status === "expired") {
    return [
      // A)
      { endDate: { $lte: t }, revokedAt: null },
      // B)
      { expiresAt: { $lte: t }, endedAt: null, revoked: { $ne: true } },
    ];
  }
  return null;
}

function sanitizeLike(s = "") {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request) {
  try {
    // Authenticate user
    let adminAuthData, customerAuthData, authData;
    try {
      adminAuthData = await adminReqWithAuth(request.headers);
      if (adminAuthData?.customer?._id) {
        authData = adminAuthData;
      }
    } catch (e) {}

    try {
      customerAuthData = await customerReqWithAuth(request.headers);
      if (customerAuthData?.customer?._id) {
        authData = customerAuthData;
      }
    } catch (e) {}

    if (!authData?.customer?._id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const skip = (page - 1) * limit;

    const customerId = searchParams.get("customerId");
    const q = (searchParams.get("q") || "").trim();
    const status = (searchParams.get("status") || "all").toLowerCase();
    const groupBy = (searchParams.get("groupBy") || "holder").toLowerCase();

    const sortBy = (searchParams.get("sortBy") || "").trim() || "startDate";
    const sortDir =
      (searchParams.get("sortDir") || "desc").toLowerCase() === "asc" ? 1 : -1;

    // Check if admin or customer
    const userId = String(authData.customer._id);
    const isAdmin = await Admin.findById(userId);

    // Build ANDed filters
    const AND = [{ actorType: "customer" }];

    if (!isAdmin) {
      // Customer accessing their own sessions
      const customer = await Customer.findById(userId);
      if (!customer) {
        return NextResponse.json(
          { success: false, message: "Unauthorized" },
          { status: 401 }
        );
      }
      AND.push({ actorId: oid(userId) });
    } else {
      // Verify admin permissions
      try {
        requireOwner(authData);
      } catch {
        try {
          requirePermission(authData, "admin.viewSessions");
        } catch {
          requirePermission(authData, "admin.manageSessions");
        }
      }

      // Admin can access all or filtered sessions
      if (customerId) {
        if (!isValidId(customerId)) {
          return NextResponse.json(
            { success: false, message: "Invalid customerId" },
            { status: 400 }
          );
        }
        AND.push({
          $or: [{ actorId: oid(customerId) }, { customerId: oid(customerId) }],
        });
      }
    }

    // Free-text search across key fields (case-insensitive)
    if (q) {
      const rx = new RegExp(sanitizeLike(q), "i");
      AND.push({
        $or: [
          { email: rx },
          { ip: rx },
          { userAgent: rx },
          { tokenId: rx },
          { jti: rx },
        ],
      });
    }

    if (status !== "all") {
      const or = statusOr(status);
      if (or) AND.push({ $or: or });
    }

    const filter = AND.length > 1 ? { $and: AND } : AND[0];

    // Sorting map (cover both shapes)
    const sortMap = {
      holder: "email",
      lastActiveAt: "updatedAt",
      startedAt: "startDate", // admin-style "startedAt" will fall back to "startDate"
      expiresAt: "endDate",
      startDate: "startDate",
      endDate: "endDate",
      updatedAt: "updatedAt",
    };
    const sortKey = sortMap[sortBy] || "startDate";
    const sort = { [sortKey]: sortDir, _id: sortDir };

    const total = await CustomerSession.countDocuments(filter);
    const items = await CustomerSession.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Group by holder (email) unless groupBy=none
    let data;
    if (groupBy === "none") {
      data = items;
    } else {
      const buckets = new Map();
      for (const s of items) {
        const email = (s.email || "unknown").toLowerCase();
        if (!buckets.has(email))
          buckets.set(email, { sessionHolder: email, sessions: [] });
        buckets.get(email).sessions.push(s);
      }
      data = Array.from(buckets.values());
    }

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        total,
        limit,
      },
    });
  } catch (e) {
    console.error("GET /api/customers/sessions error:", e);
    return NextResponse.json(
      { success: false, message: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    // Authenticate user
    let adminAuthData, customerAuthData, authData;
    try {
      adminAuthData = await adminReqWithAuth(request.headers);
      if (adminAuthData?.customer?._id) {
        authData = adminAuthData;
      }
    } catch (e) {}

    try {
      customerAuthData = await customerReqWithAuth(request.headers);
      if (customerAuthData?.customer?._id) {
        authData = customerAuthData;
      }
    } catch (e) {}

    if (!authData?.customer?._id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    await dbConnect();
    const body = await request.json();

    const { sessionIds = [], customerId } = body || {};
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "sessionIds[] required" },
        { status: 400 }
      );
    }

    const ids = sessionIds.filter((id) => isValidId(id)).map((id) => oid(id));

    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, message: "No valid session ids supplied" },
        { status: 400 }
      );
    }

    // Check if admin or customer
    const userId = String(authData.customer._id);
    const isAdmin = await Admin.findById(userId);

    // ANDed filter: target the given ids, customer actor, (optionally) specific customer,
    // and only sessions that are still active/not already ended.
    const AND = [
      { _id: { $in: ids } },
      { actorType: "customer" },
      {
        $or: [
          // A) native customer schema still-active definition
          { revokedAt: null, endDate: { $gt: now() } },
          // B) admin-style still-active definition
          { endedAt: null, revoked: { $ne: true } },
        ],
      },
    ];

    if (!isAdmin) {
      // Customer can only delete their own sessions
      AND.push({ actorId: oid(userId) });
    } else {
      // Admin can delete specific customer's sessions if customerId provided
      if (customerId && isValidId(customerId)) {
        AND.push({
          $or: [{ actorId: oid(customerId) }, { customerId: oid(customerId) }],
        });
      }

      // Verify admin permissions
      try {
        requireOwner(authData);
      } catch {
        requirePermission(authData, "admin.manageSessions");
      }
    }

    const res = await CustomerSession.updateMany(
      { $and: AND },
      {
        $set: {
          // A) native customer schema close-out
          isActive: false,
          revokedAt: now(),
          endDate: now(),
          // B) admin-style close-out
          revoked: true,
          endedAt: now(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: "Sessions terminated",
      data: { modified: res.modifiedCount },
    });
  } catch (e) {
    console.error("DELETE /api/customers/sessions error:", e);
    return NextResponse.json(
      { success: false, message: "Failed to terminate sessions" },
      { status: 500 }
    );
  }
}
