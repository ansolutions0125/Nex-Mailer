// app/api/customers/sessions/route.js
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/config/mongoConfig";
import CustomerSession from "@/models/CustomerSession";
import {
  anyReqWithAuth,
  requireOwner,
  requirePermission,
} from "@/lib/withAuthFunctions";
import Customer from "@/models/Customer";
const bcrypt = require("bcryptjs");

const isValidId = (v) => mongoose.Types.ObjectId.isValid(v);
const oid = (v) => new mongoose.Types.ObjectId(v);
const now = () => new Date();

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
    const authData = await anyReqWithAuth(request.headers);
    if (!authData?.customer?._id && !authData?.admin?._id) {
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
    const userId = String(authData.admin?._id || authData.customer._id);
    const isAdmin = !!authData.admin;

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
    await dbConnect();

    const url = new URL(request.url);
    const { searchParams } = url;

    // Parse body ONCE and reuse
    const body = await request.json().catch(() => ({}));

    // Accept action from body (preferred) or query string (fallback)
    const action = body.action || searchParams.get("action");

    // --- Customer session limit path (re-auth) - similar to admin ---
    if (action === "customer-sessions-limit-reached") {
      // Accept creds from body (preferred) or query string
      const customerEmail = body.email;
      const password = body.password;

      if (!customerEmail || !password) {
        return NextResponse.json(
          { success: false, message: "Email and password required" },
          { status: 400 }
        );
      }

      // Load customer with password for verification
      const customer = await Customer.findOne({ email: customerEmail }).select(
        "email passwordHash firstName lastName"
      );

      if (!customer) {
        return NextResponse.json(
          { success: false, message: "Customer not found" },
          { status: 404 }
        );
      }

      const passwordMatch = await bcrypt.compare(
        String(password),
        String(customer.passwordHash)
      );
      if (!passwordMatch) {
        return NextResponse.json(
          { success: false, message: "Invalid credentials" },
          { status: 401 }
        );
      }

      const { sessionIds = [] } = body;
      if (!Array.isArray(sessionIds) || !sessionIds.length) {
        return NextResponse.json(
          { success: false, message: "No valid sessionIds provided" },
          { status: 400 }
        );
      }

      const ids = sessionIds.filter((id) => isValidId(id)).map((id) => oid(id));
      if (!ids.length) {
        return NextResponse.json(
          { success: false, message: "No valid sessionIds provided" },
          { status: 400 }
        );
      }

      const filter = {
        actorType: "customer",
        $or: [{ actorId: customer._id }, { customerId: customer._id }],
        _id: { $in: ids },
        $or: [
          // A) native customer schema still-active
          { revokedAt: null, endDate: { $gt: now() } },
          // B) admin-style still-active
          { endedAt: null, revoked: { $ne: true } },
        ],
      };

      const res = await CustomerSession.updateMany(filter, {
        $set: {
          // A) native customer schema close-out
          isActive: false,
          revokedAt: now(),
          endDate: now(),
          // B) admin-style close-out
          revoked: true,
          endedAt: now(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Sessions terminated",
        data: { modified: res.modifiedCount },
      });
    }

    // --- Normal authenticated delete path (enhanced logic from admin) ---
    const authData = await anyReqWithAuth(request.headers);
    if (!authData?.customer?._id && !authData?.admin?._id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = String(authData.admin?._id || authData.customer._id);
    const isAdmin = !!authData.admin;
    const currentJti =
      authData?.session?.jti ||
      authData?.jti ||
      request.headers.get("x-session-jti") ||
      null;

    const {
      sessionIds = [],
      customerId,
      revokeAllOthers = false,
      status,
      olderThan,
    } = body || {};

    let targetCustomerId;
    
    if (!isAdmin) {
      // Customer can only manage their own sessions
      targetCustomerId = userId;
    } else {
      // Admin permissions check
      try {
        requireOwner(authData);
      } catch {
        requirePermission(authData, "admin.manageSessions");
      }
      
      // Admin can target specific customer or default to all
      targetCustomerId = customerId && isValidId(customerId) ? customerId : null;
    }

    const baseFilter = {
      actorType: "customer",
      $or: [
        // A) native customer schema still-active
        { revokedAt: null },
        // B) admin-style still-active
        { endedAt: null },
      ],
    };

    // Add customer targeting for non-admin users or when admin specifies customerId
    if (targetCustomerId) {
      baseFilter.$or = [
        { 
          actorId: oid(targetCustomerId),
          $or: [
            { revokedAt: null },
            { endedAt: null },
          ]
        },
        { 
          customerId: oid(targetCustomerId),
          $or: [
            { revokedAt: null },
            { endedAt: null },
          ]
        },
      ];
    }

    // Handle revokeAllOthers (terminate all other sessions except current)
    if (revokeAllOthers) {
      const filter = { 
        ...baseFilter,
        $and: [
          {
            $or: [
              // A) native customer schema active
              { isActive: { $ne: false }, revokedAt: null },
              // B) admin-style active
              { revoked: { $ne: true }, endedAt: null },
            ],
          },
        ],
      };
      
      if (currentJti) {
        filter.$and.push({ 
          $or: [
            { jti: { $ne: currentJti } },
            { tokenId: { $ne: currentJti } },
          ]
        });
      }

      const res = await CustomerSession.updateMany(filter, {
        $set: {
          // A) native customer schema close-out
          isActive: false,
          revokedAt: now(),
          endDate: now(),
          // B) admin-style close-out
          revoked: true,
          endedAt: now(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Other sessions terminated",
        data: { modified: res.modifiedCount },
      });
    }

    // Handle specific session IDs
    if (Array.isArray(sessionIds) && sessionIds.length > 0) {
      const ids = sessionIds.filter((id) => isValidId(id)).map((id) => oid(id));
      if (!ids.length) {
        return NextResponse.json(
          { success: false, message: "No valid sessionIds" },
          { status: 400 }
        );
      }

      const filter = { 
        ...baseFilter, 
        _id: { $in: ids },
        $or: [
          // A) native customer schema still-active
          { revokedAt: null, endDate: { $gt: now() } },
          // B) admin-style still-active
          { endedAt: null, revoked: { $ne: true } },
        ],
      };

      if (currentJti) {
        filter.$and = filter.$and || [];
        filter.$and.push({
          $or: [
            { jti: { $ne: currentJti } },
            { tokenId: { $ne: currentJti } },
          ]
        });
      }

      const res = await CustomerSession.updateMany(filter, {
        $set: {
          // A) native customer schema close-out
          isActive: false,
          revokedAt: now(),
          endDate: now(),
          // B) admin-style close-out
          revoked: true,
          endedAt: now(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Sessions terminated",
        data: { modified: res.modifiedCount },
      });
    }

    // Handle status-based or time-based criteria
    if (status || olderThan) {
      const t = now();
      const filter = { ...baseFilter };
      
      if (status === "active") {
        filter.$and = [
          {
            $or: [
              // A) native customer schema active
              { isActive: { $ne: false }, revokedAt: null, endDate: { $gt: t } },
              // B) admin-style active
              { revoked: { $ne: true }, endedAt: null, expiresAt: { $gt: t } },
            ],
          },
        ];
      } else if (status === "revoked") {
        filter.$and = [
          {
            $or: [
              // A) native customer schema revoked
              { revokedAt: { $ne: null } },
              // B) admin-style revoked
              { revoked: true },
            ],
          },
        ];
      } else if (status === "expired") {
        filter.$and = [
          {
            $or: [
              // A) native customer schema expired
              { endDate: { $lte: t }, revokedAt: null },
              // B) admin-style expired
              { expiresAt: { $lte: t }, endedAt: null, revoked: { $ne: true } },
            ],
          },
        ];
      } else {
        // Default to non-revoked sessions
        filter.$and = [
          {
            $or: [
              // A) native customer schema not revoked
              { revokedAt: null },
              // B) admin-style not revoked
              { revoked: { $ne: true } },
            ],
          },
        ];
      }

      if (olderThan) {
        const ts = new Date(olderThan);
        if (!Number.isNaN(ts.getTime())) {
          filter.$and = filter.$and || [];
          filter.$and.push({
            $or: [
              { startDate: { $lt: ts } },
              { startedAt: { $lt: ts } },
            ],
          });
        }
      }

      if (currentJti) {
        filter.$and = filter.$and || [];
        filter.$and.push({
          $or: [
            { jti: { $ne: currentJti } },
            { tokenId: { $ne: currentJti } },
          ]
        });
      }

      const res = await CustomerSession.updateMany(filter, {
        $set: {
          // A) native customer schema close-out
          isActive: false,
          revokedAt: now(),
          endDate: now(),
          // B) admin-style close-out
          revoked: true,
          endedAt: now(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Sessions terminated by criteria",
        data: { modified: res.modifiedCount },
      });
    }

    return NextResponse.json(
      {
        success: false,
        message:
          "Provide sessionIds[], revokeAllOthers, or { status / olderThan } criteria",
      },
      { status: 400 }
    );
  } catch (e) {
    console.error("DELETE /api/customers/sessions error:", e);
    return NextResponse.json(
      { success: false, message: e.message },
      { status: 500 }
    );
  }
}
