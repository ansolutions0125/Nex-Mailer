// app/api/admin/sessions/route.js
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/config/mongoConfig";
import AdminSession from "@/models/AdminSession";
import {
  adminReqWithAuth,
  requireOwner,
  requirePermission,
} from "@/lib/withAuthFunctions";

// helpers
const parseBool = (v, def = false) =>
  v === "true" ? true : v === "false" ? false : def;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** ------------------------------- GET ---------------------------------- **/
export async function GET(request) {
  try {
    await dbConnect();

    // Authenticate user
    const authData = await adminReqWithAuth(request.headers);

    const { searchParams } = new URL(request.url);

    // NEW: flexible inputs
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limitQP = parseInt(searchParams.get("limit") || "20", 10);
    const limit = clamp(Number.isFinite(limitQP) ? limitQP : 20, 1, 100);
    const skip = (page - 1) * limit;

    const adminIdQP = searchParams.get("adminId");
    if (adminIdQP && !mongoose.Types.ObjectId.isValid(adminIdQP)) {
      return NextResponse.json(
        { success: false, message: "Invalid adminId" },
        { status: 400 }
      );
    }

    const status = searchParams.get("status"); // active|revoked|expired|all
    const activeOnly = searchParams.get("activeOnly") === "true"; // BC
    const sortBy = searchParams.get("sortBy") || "startedAt"; // lastActiveAt|startedAt|expiresAt|holder
    const sortDir =
      (searchParams.get("sortDir") || "desc").toLowerCase() === "asc" ? 1 : -1;
    const groupBy = searchParams.get("groupBy") || "holder"; // holder|none
    const emailExact = searchParams.get("search"); // legacy: exact email
    const q = (searchParams.get("q") || "").trim(); // NEW: free-text
    const includeStats = parseBool(searchParams.get("stats"), false);

    const requesterId = String(authData.admin._id);
    const targetAdminId = adminIdQP || requesterId;

    // NEW: clean authorization (owner OR view/manage permission)
    if (targetAdminId !== requesterId) {
      try {
        requireOwner(authData);
      } catch {
        try {
          requirePermission(authData, "admin.viewSessions");
        } catch {
          requirePermission(authData, "admin.manageSessions");
        }
      }
    }

    const baseFilter = { actorType: "admin" };

    // Legacy: exact email search
    if (emailExact) {
      const adminWithEmail = await mongoose
        .model("Admin")
        .findOne({ email: emailExact }, { _id: 1 })
        .lean();
      if (!adminWithEmail) {
        return NextResponse.json({
          success: true,
          data: groupBy === "holder" ? [] : [],
          pagination: { page, totalPages: 0, total: 0, limit },
          ...(includeStats
            ? { stats: { active: 0, revoked24h: 0, expired: 0 } }
            : {}),
        });
      }
      baseFilter.adminId = adminWithEmail._id;
    } else {
      baseFilter.adminId = new mongoose.Types.ObjectId(targetAdminId);
    }

    // Status filter
    const now = new Date();
    const filter = { ...baseFilter };
    if (status === "active" || activeOnly) {
      Object.assign(filter, {
        revoked: false,
        endedAt: null,
        expiresAt: { $gt: now },
      });
    } else if (status === "revoked") {
      Object.assign(filter, { revoked: true });
    } else if (status === "expired") {
      Object.assign(filter, { revoked: false, expiresAt: { $lte: now } });
    }
    // Free-text `q`: ip, userAgent, jti, partial email
    const or = [];
    if (q) {
      const regex = new RegExp(escapeRegex(q), "i");
      or.push({ ip: regex }, { userAgent: regex }, { jti: regex });
      const admins = await mongoose
        .model("Admin")
        .find({ email: regex }, { _id: 1 })
        .lean();
      if (admins.length) {
        or.push({ adminId: { $in: admins.map((a) => a._id) } });
      }
    }
    const finalFilter = or.length ? { $and: [filter, { $or: or }] } : filter;

    // Sorting
    const sortMap = {
      lastActiveAt: { lastActiveAt: sortDir },
      startedAt: { startedAt: sortDir },
      expiresAt: { expiresAt: sortDir },
    };
    const sort = sortMap[sortBy] || sortMap.startedAt;

    // Query
    const [total, items] = await Promise.all([
      AdminSession.countDocuments(finalFilter),
      AdminSession.find(finalFilter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("adminId", "_id firstName lastName email roleKey isActive")
        .lean(),
    ]);

    // If sorting by holder (email), we need to sort after populate
    if (sortBy === "holder") {
      items.sort((a, b) => {
        const ea = (a.adminId?.email || "").toLowerCase();
        const eb = (b.adminId?.email || "").toLowerCase();
        if (ea < eb) return -1 * sortDir;
        if (ea > eb) return 1 * sortDir;
        return 0;
      });
    }

    const totalPages = Math.ceil(total / limit);

    // Grouping
    let data;
    if (groupBy === "holder") {
      const map = new Map();
      for (const s of items) {
        const email = s.adminId?.email;
        if (!email) continue;
        if (!map.has(email))
          map.set(email, { sessionHolder: email, sessions: [] });
        map.get(email).sessions.push(s);
      }
      data = Array.from(map.values());
    } else {
      data = items;
    }

    // Optional stats (for KPI tiles, etc.)
    let stats;
    if (includeStats) {
      const twentyFourAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [activeCount, revoked24h, expiredCount] = await Promise.all([
        AdminSession.countDocuments({
          actorType: "admin",
          adminId: baseFilter.adminId,
          revoked: false,
          endedAt: null,
          expiresAt: { $gt: now },
        }),
        AdminSession.countDocuments({
          actorType: "admin",
          adminId: baseFilter.adminId,
          revoked: true,
          updatedAt: { $gte: twentyFourAgo },
        }),
        AdminSession.countDocuments({
          actorType: "admin",
          adminId: baseFilter.adminId,
          revoked: false,
          expiresAt: { $lte: now },
        }),
      ]);
      stats = { active: activeCount, revoked24h, expired: expiredCount };
    }

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, totalPages, total, limit },
      ...(stats ? { stats } : {}),
    });
  } catch (e) {
    console.error("GET /api/admin/sessions error:", e);
    return NextResponse.json(
      { success: false, message: e.message },
      { status: 500 }
    );
  }
}

/** ------------------------------ DELETE -------------------------------- **/
export async function DELETE(request) {
  try {
    await dbConnect();

    const authData = await adminReqWithAuth(request.headers);
    const body = await request.json().catch(() => ({}));

    const requesterId = String(authData.admin._id);
    const currentJti =
      authData?.session?.jti ||
      authData?.jti ||
      request.headers.get("x-session-jti") ||
      null;

    const {
      sessionIds = [],
      adminId, // optional: target scope
      revokeAllOthers = false,
      status, // optional: 'active' | 'revoked' | 'expired'
      olderThan, // optional ISO string: revoke sessions started before this date
    } = body || {};

    const targetAdminId =
      adminId && mongoose.Types.ObjectId.isValid(adminId)
        ? adminId
        : requesterId;

    // Authorization for terminating another admin's sessions
    if (targetAdminId !== requesterId) {
      try {
        requireOwner(authData);
      } catch {
        requirePermission(authData, "admin.manageSessions");
      }
    }

    const baseFilter = {
      actorType: "admin",
      adminId: new mongoose.Types.ObjectId(targetAdminId),
      endedAt: null, // only sessions not already ended
    };

    // A) Revoke all others
    if (revokeAllOthers) {
      const filter = { ...baseFilter, revoked: false };
      if (currentJti) filter.jti = { $ne: currentJti };
      const res = await AdminSession.updateMany(filter, {
        $set: { revoked: true, endedAt: new Date() },
      });
      return NextResponse.json({
        success: true,
        message: "Other sessions terminated",
        data: { modified: res.modifiedCount },
      });
    }

    // B) Revoke explicit sessionIds
    if (Array.isArray(sessionIds) && sessionIds.length > 0) {
      const ids = sessionIds.filter((id) =>
        mongoose.Types.ObjectId.isValid(id)
      );
      if (!ids.length) {
        return NextResponse.json(
          { success: false, message: "No valid sessionIds" },
          { status: 400 }
        );
      }
      const filter = { ...baseFilter, _id: { $in: ids } };
      if (currentJti) filter.jti = { $ne: currentJti };
      const res = await AdminSession.updateMany(filter, {
        $set: { revoked: true, endedAt: new Date() },
      });
      return NextResponse.json({
        success: true,
        message: "Sessions terminated",
        data: { modified: res.modifiedCount },
      });
    }

    // C) Revoke by criteria (status / olderThan)
    if (status || olderThan) {
      const now = new Date();
      const filter = { ...baseFilter };
      if (status === "active") {
        Object.assign(filter, { revoked: false, expiresAt: { $gt: now } });
      } else if (status === "revoked") {
        Object.assign(filter, { revoked: true });
      } else if (status === "expired") {
        Object.assign(filter, { revoked: false, expiresAt: { $lte: now } });
      } else {
        // default guard
        Object.assign(filter, { revoked: false });
      }
      if (olderThan) {
        const ts = new Date(olderThan);
        if (!Number.isNaN(ts.getTime())) {
          filter.startedAt = { $lt: ts };
        }
      }
      if (currentJti) filter.jti = { $ne: currentJti };
      const res = await AdminSession.updateMany(filter, {
        $set: { revoked: true, endedAt: new Date() },
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
    console.error("DELETE /api/admin/sessions error:", e);
    return NextResponse.json(
      { success: false, message: e.message },
      { status: 500 }
    );
  }
}
