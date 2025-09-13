// app/api/admin/route.js
import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import dbConnect from "@/config/mongoConfig";

import Admin from "@/models/Admin";
import AdminSession from "@/models/AdminSession";
import AuthSettings from "@/models/AuthSettings";
import Role from "@/models/Role";
import {
  adminReqWithAuth,
  requirePermission,
  requireOwner,
} from "@/lib/withAuthFunctions";
import { signAdminJWT } from "@/lib/jwt";
import { computeAdminPermissions } from "@/lib/permissions";

async function countActiveAdminSessions(adminId) {
  return AdminSession.countDocuments({
    actorType: "admin",
    adminId,
    revoked: false,
    endedAt: null,
    expiresAt: { $gt: new Date() },
  });
}

async function getLiveAuthSettings() {
  const settings = await AuthSettings.findOne({
    _id: "current",
  }).lean();

  return (
    settings || {
      admin: {
        allowNormalAdminManageAdmins: false,
        providers: {
          emailPassword: true,
          magicLink: true,
        },
        maxActiveSessions: 5,
        enforceSessionLimit: true,
      },
    }
  );
}

const now = () => new Date();
const inDays = (d) => new Date(Date.now() + d * 24 * 3600 * 1000);

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

export async function GET(request) {
  try {
    await dbConnect();

    // Authenticate and authorize
    const authData = await adminReqWithAuth(request.headers);

    console.log(authData);

    // Check if user can view admins (requires admin.view or admin.manageAdmins permission)
    if (authData) {
      requireOwner(authData);
    } else {
      try {
        requirePermission(authData, "admin.view");
      } catch {
        requirePermission(authData, "admin.manageAdmins");
      }
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10", 10));
    const skip = (page - 1) * limit;

    const search = (searchParams.get("search") || "").trim().toLowerCase();

    const filter = {};
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
      ];
    }

    const [items, totalItems] = await Promise.all([
      Admin.find(filter)
        .select("-passwordHash -magicLink.token") // keep responses safe
        .populate("roleId", "name key permissions")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Admin.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      data: items,
      pagination: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    });
  } catch (err) {
    // Map auth errors to proper status codes
    if (err?.statusCode === 401 || err?.statusCode === 403) {
      return NextResponse.json(
        { success: false, message: err.message },
        { status: err.statusCode }
      );
    }
    console.error("GET /api/admin error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to fetch admins" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    await dbConnect();
    const body = await request.json();
    const action = body?.action;

    // 1) Bootstrap first owner if none exists
    if (action === "bootstrapOwner") {
      const ownerExists = await Admin.exists({ roleKey: "owner" });
      if (ownerExists) {
        return NextResponse.json(
          { success: false, message: "Owner already exists" },
          { status: 400 }
        );
      }
      if (!body?.email || !body?.password) {
        return NextResponse.json(
          { success: false, message: "email & password required" },
          { status: 400 }
        );
      }

      // Find or create owner role
      let ownerRole = await Role.findOne({ key: "owner" });
      if (!ownerRole) {
        ownerRole = await Role.create({
          name: "Owner",
          key: "owner",
          description: "Full system access",
          isSystem: true,
          permissions: ["*"], // wildcard for all permissions
        });
      }

      const hash = await bcrypt.hash(body.password, 12);
      const owner = await Admin.create({
        email: body.email.toLowerCase().trim(),
        passwordHash: hash,
        firstName: body.firstName || "First N",
        lastName: body.lastName || "Last N",
        roleId: ownerRole._id,
        roleKey: "owner",
        isActive: true,
      });

      return NextResponse.json(
        { success: true, data: owner, message: "Owner created" },
        { status: 201 }
      );
    }

    // 2) Create admin (requires permission)
    if (action === "signup") {
      const authData = await adminReqWithAuth(request.headers);
      const settings = await getLiveAuthSettings();

      let canManage;

      if (authData) {
        try {
          requireOwner(authData);
          canManage = true;
        } catch {
          try {
            requirePermission(authData, "admin.create");
            canManage = true;
          } catch {
            try {
              requirePermission(authData, "admin.manageAdmins");
              canManage = true;
            } catch {
              canManage =
                settings?.admin?.allowNormalAdminManageAdmins === true;
            }
          }
        }
      }

      if (!canManage) {
        return NextResponse.json(
          {
            success: false,
            message: "Insufficient permissions to create admins",
          },
          { status: 403 }
        );
      }

      const {
        email,
        password,
        firstName,
        lastName,
        phoneNo,
        address,
        country,
        roleKey = "admin",
      } = body || {};

      if (!email || !password) {
        return NextResponse.json(
          { success: false, message: "email & password required" },
          { status: 400 }
        );
      }

      // Find the role
      const role = await Role.findOne({ key: roleKey.toLowerCase() });
      if (!role) {
        return NextResponse.json(
          { success: false, message: "Invalid role specified" },
          { status: 400 }
        );
      }

      const hash = await bcrypt.hash(password, 12);
      const doc = await Admin.create({
        email: email.toLowerCase().trim(),
        passwordHash: hash,
        sessionType: "password",
        firstName,
        lastName,
        phoneNo,
        address,
        country,
        roleId: role._id,
        roleKey: role.key,
        isActive: true,
      });

      return NextResponse.json(
        { success: true, data: doc, message: "Admin created" },
        { status: 201 }
      );
    }

    // 3) Email/password login (session limit enforced)
    if (action === "login") {
      const { email, password } = body || {};
      const user = await Admin.findOne({
        email: String(email || "")
          .toLowerCase()
          .trim(),
      }).populate("roleId", "name key permissions");

      if (!user) {
        return NextResponse.json(
          { success: false, message: "Admin not found or invalid email" },
          { status: 401 }
        );
      }
      if (!user.isActive) {
        return NextResponse.json(
          { success: false, message: "Admin is not active" },
          { status: 403 }
        );
      }

      const isPasswordMatching = await bcrypt.compare(
        String(password || ""),
        user.passwordHash || ""
      );
      if (!isPasswordMatching) {
        return NextResponse.json(
          { success: false, message: "Invalid credentials" },
          { status: 401 }
        );
      }

      const settings = await getLiveAuthSettings();

      // Check session limits
      if (settings?.admin?.enforceSessionLimit) {
        const adminCurrentSessionCount = await countActiveAdminSessions(
          user._id
        );
        if (
          adminCurrentSessionCount >= (settings?.admin?.maxActiveSessions || 5)
        ) {
          const sessions = await AdminSession.find({
            actorType: "admin",
            adminId: user._id,
            revoked: false,
            endedAt: null,
            expiresAt: { $gt: new Date() },
          })
            .sort({ startedAt: -1 })
            .lean();

          return NextResponse.json(
            {
              success: false,
              code: "SESSION_LIMIT_REACHED",
              message:
                "Maximum active sessions reached. Please close one or more sessions to continue.",
              data: { sessions, limit: settings.admin.maxActiveSessions },
            },
            { status: 429 }
          );
        }
      }
      const userAgent = request.headers.get("user-agent") || "";
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0] ||
        request.headers.get("x-real-ip") ||
        "";

      // Create session
      const jti = crypto.randomUUID();
      const session = await AdminSession.create({
        actorType: "admin",
        adminId: user._id,
        jti,
        userAgent,
        ip,
        startedAt: now(),
        lastActiveAt: now(),
        expiresAt: inDays(settings.admin.sessionDuration || 7),
      });

      // Get permissions for JWT
      const permissions = await computeAdminPermissions(user);

      const token = signAdminJWT({
        adminId: user._id,
        email: user.email,
        roleKey: permissions.roleKey,
        jti,
        typ: "admin",
      });

      return NextResponse.json({
        success: true,
        message: "Logged in",
        data: {
          token,
          session: pick(session.toObject(), [
            "_id",
            "jti",
            "startedAt",
            "expiresAt",
          ]),
          admin: {
            ...pick(user.toObject(), [
              "_id",
              "email",
              "firstName",
              "lastName",
              "roleKey",
              "isActive",
              "createdAt",
              "updatedAt",
            ]),
            role: user.roleId,
            permissions: permissions.effective,
          },
        },
      });
    }

    // 4) Request magic link
    if (action === "requestMagicLink") {
      const settings = await getLiveAuthSettings();
      if (!settings.admin?.providers?.magicLink) {
        return NextResponse.json(
          { success: false, message: "Magic link disabled" },
          { status: 403 }
        );
      }

      const { email } = body || {};
      const user = await Admin.findOne({
        email: String(email || "")
          .toLowerCase()
          .trim(),
      });

      if (!user || !user.isActive) {
        // intentionally vague (no account enumeration)
        return NextResponse.json({
          success: true,
          message: "If the email exists, a link has been sent.",
        });
      }

      const token = crypto.randomBytes(24).toString("base64url");
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      user.magicLink = { token, expiresAt, usedAt: null };
      await user.save();

      // TODO: send mail with URL: `${APP_URL}/admin/auth-st?token=${token}&email=${encodeURIComponent(user.email)}`
      return NextResponse.json({
        success: true,
        message: "Magic link generated (send via email in production)",
        data: { token, expiresAt },
      });
    }

    // 5) Magic link login (also enforces session cap)
    if (action === "magicLogin") {
      const settings = await getLiveAuthSettings();
      if (!settings.admin?.providers?.magicLink) {
        return NextResponse.json(
          { success: false, message: "Magic link disabled" },
          { status: 403 }
        );
      }

      const { email, token } = body || {};
      const user = await Admin.findOne({
        email: String(email || "")
          .toLowerCase()
          .trim(),
      }).populate("roleId", "name key permissions");

      if (!user || !user.isActive || !user.magicLink?.token) {
        return NextResponse.json(
          { success: false, message: "Invalid or expired link" },
          { status: 401 }
        );
      }

      const expired =
        !user.magicLink.expiresAt || user.magicLink.expiresAt < new Date();
      if (user.magicLink.token !== token || expired) {
        return NextResponse.json(
          { success: false, message: "Invalid or expired link" },
          { status: 401 }
        );
      }

      if (settings.admin?.enforceSessionLimit) {
        const active = await countActiveAdminSessions(user._id);
        if (active >= (settings.admin?.maxActiveSessions || 5)) {
          const sessions = await AdminSession.find({
            actorType: "admin",
            adminId: user._id,
            revoked: false,
            endedAt: null,
            expiresAt: { $gt: new Date() },
          })
            .sort({ startedAt: -1 })
            .lean();

          return NextResponse.json(
            {
              success: false,
              code: "SESSION_LIMIT_REACHED",
              message:
                "Maximum active sessions reached. Please close one or more sessions to continue.",
              data: { sessions, limit: settings.admin.maxActiveSessions },
            },
            { status: 429 }
          );
        }
      }

      // Consume magic link + create session
      user.magicLink.usedAt = now();
      await user.save();

      const jti = crypto.randomUUID();
      const session = await AdminSession.create({
        actorType: "admin",
        adminId: user._id,
        jti,
        startedAt: now(),
        lastActiveAt: now(),
        expiresAt: inDays(7),
      });

      // Get permissions
      const permissions = await computeAdminPermissions(user);

      const tokenJwt = signAdminJWT({
        adminId: user._id,
        email: user.email,
        roleKey: permissions.roleKey,
        jti,
        typ: "admin",
      });

      return NextResponse.json({
        success: true,
        message: "Logged in via magic link",
        data: {
          token: tokenJwt,
          session: pick(session.toObject(), [
            "_id",
            "jti",
            "startedAt",
            "expiresAt",
          ]),
          admin: {
            ...pick(user.toObject(), [
              "_id",
              "email",
              "firstName",
              "lastName",
              "roleKey",
              "isActive",
              "createdAt",
              "updatedAt",
            ]),
            role: user.roleId,
            permissions: permissions.effective,
          },
        },
      });
    }

    // 6) List current admin sessions (for "session full" flow)
    if (action === "listSessions") {
      const authData = await adminReqWithAuth(request.headers);
      const sessions = await AdminSession.find({
        actorType: "admin",
        adminId: authData.admin._id,
        revoked: false,
        endedAt: null,
        expiresAt: { $gt: new Date() },
      })
        .sort({ startedAt: -1 })
        .lean();
      return NextResponse.json({ success: true, data: { sessions } });
    }

    // 7) Revoke selected sessions (current admin only)
    if (action === "revokeSessions") {
      const authData = await adminReqWithAuth(request.headers);
      const jtis = Array.isArray(body?.jtis) ? body.jtis : [];
      if (!jtis.length) {
        return NextResponse.json(
          { success: false, message: "jtis required" },
          { status: 400 }
        );
      }
      const { modifiedCount } = await AdminSession.updateMany(
        {
          jti: { $in: jtis },
          adminId: authData.admin._id,
          revoked: false,
          endedAt: null,
        },
        { $set: { revoked: true, endedAt: now() } }
      );
      return NextResponse.json({
        success: true,
        message: "Sessions revoked",
        data: { modifiedCount },
      });
    }

    return NextResponse.json(
      { success: false, message: "Unknown action" },
      { status: 400 }
    );
  } catch (e) {
    console.error("POST /api/admin error:", e);

    // Handle auth errors properly
    if (e?.statusCode === 401 || e?.statusCode === 403) {
      return NextResponse.json(
        { success: false, message: e.message },
        { status: e.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, message: e.message || "Failed" },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    await dbConnect();
    const authData = await adminReqWithAuth(request.headers);
    const body = await request.json();
    const action = body?.action;

    const settings = await getLiveAuthSettings();
    let canManage;

    if (authData) {
      try {
        requireOwner(authData);
        canManage = true;
      } catch {
        try {
          requirePermission(authData, "admin.create");
          canManage = true;
        } catch {
          try {
            requirePermission(authData, "admin.manageAdmins");
            canManage = true;
          } catch {
            canManage = settings?.admin?.allowNormalAdminManageAdmins === true;
          }
        }
      }
    }

    if (!canManage) {
      return NextResponse.json(
        { success: false, message: "Insufficient permissions" },
        { status: 403 }
      );
    }

    if (!body.adminId || !mongoose.Types.ObjectId.isValid(body.adminId)) {
      return NextResponse.json(
        { success: false, message: "Valid adminId required" },
        { status: 400 }
      );
    }

    // 1) Assign role
    if (action === "assignRole") {
      const { roleKey } = body;
      if (!roleKey) {
        return NextResponse.json(
          { success: false, message: "roleKey required" },
          { status: 400 }
        );
      }

      const role = await Role.findOne({ key: roleKey.toLowerCase() });
      if (!role) {
        return NextResponse.json(
          { success: false, message: "Role not found" },
          { status: 400 }
        );
      }

      const updated = await Admin.findByIdAndUpdate(
        body.adminId,
        {
          $set: {
            roleId: role._id,
            roleKey: role.key,
          },
        },
        { new: true }
      )
        .populate("roleId", "name key permissions")
        .lean();

      return NextResponse.json({
        success: true,
        data: updated,
        message: "Role assigned",
      });
    }

    // 2) Toggle active
    if (action === "toggleActive") {
      // Prevent self-deactivation
      if (body.adminId === authData?.admin?._id?.toString()) {
        return NextResponse.json(
          { success: false, message: "Cannot deactivate your own account" },
          { status: 400 }
        );
      }

      const admin = await Admin.findById(body.adminId).lean();
      if (!admin) {
        return NextResponse.json(
          { success: false, message: "Admin not found" },
          { status: 404 }
        );
      }

      if (admin.roleKey === "owner") {
        return NextResponse.json(
          { success: false, message: "Cannot modify owner account status" },
          { status: 400 }
        );
      }

      const updated = await Admin.findByIdAndUpdate(
        body.adminId,
        { $set: { isActive: !!body.isActive } },
        { new: true }
      ).lean();

      // If deactivating, revoke all sessions
      if (!body.isActive) {
        await AdminSession.updateMany(
          { adminId: body.adminId, revoked: false, endedAt: null },
          { $set: { revoked: true, endedAt: now() } }
        );
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: "Status updated",
      });
    }

    // 3) Update profile/basic fields
    if (action === "update") {
      const allowed = [
        "firstName",
        "lastName",
        "phoneNo",
        "address",
        "country",
        "sessionType",
      ];
      const updateData = pick(body.updateData || {}, allowed);
      const updated = await Admin.findByIdAndUpdate(
        body.adminId,
        { $set: updateData },
        { new: true }
      ).lean();
      return NextResponse.json({
        success: true,
        data: updated,
        message: "Admin updated",
      });
    }

    // 4) Update permissions (extra grants/denials)
    if (action === "updatePermissions") {
      const { permissionsExtra = [], permissionsDenied = [] } = body;

      const updated = await Admin.findByIdAndUpdate(
        body.adminId,
        {
          $set: {
            permissionsExtra: Array.isArray(permissionsExtra)
              ? permissionsExtra
              : [],
            permissionsDenied: Array.isArray(permissionsDenied)
              ? permissionsDenied
              : [],
          },
        },
        { new: true }
      )
        .populate("roleId", "name key permissions")
        .lean();

      return NextResponse.json({
        success: true,
        data: updated,
        message: "Permissions updated",
      });
    }

    return NextResponse.json(
      { success: false, message: "Unknown action" },
      { status: 400 }
    );
  } catch (e) {
    console.error("PUT /api/admin error:", e);

    if (e?.statusCode === 401 || e?.statusCode === 403) {
      return NextResponse.json(
        { success: false, message: e.message },
        { status: e.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, message: e.message || "Failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    await dbConnect();
    const authData = await adminReqWithAuth(request.headers);
    const { searchParams } = new URL(request.url);
    const _id = searchParams.get("_id");

    if (_id) {
      if (authData) {
        try {
          requireOwner(authData);
        } catch {
          try {
            requirePermission(authData, "admin.manage");
          } catch (error) {
            requirePermission(authData, "roles.delete");
          }
        }
      }
    }

    if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
      return NextResponse.json(
        { success: false, message: "Valid _id required" },
        { status: 400 }
      );
    }

    // Prevent self-deletion
    if (_id === authData.admin._id.toString()) {
      return NextResponse.json(
        { success: false, message: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    const deleted = await Admin.findByIdAndDelete(_id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Admin not found" },
        { status: 404 }
      );
    }

    // Cleanup sessions
    await AdminSession.updateMany(
      { adminId: _id, endedAt: null },
      { $set: { revoked: true, endedAt: new Date() } }
    );

    return NextResponse.json({ success: true, message: "Admin deleted" });
  } catch (e) {
    console.error("DELETE /api/admin error:", e);

    if (e?.statusCode === 401 || e?.statusCode === 403) {
      return NextResponse.json(
        { success: false, message: e.message },
        { status: e.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, message: "Failed to delete" },
      { status: 500 }
    );
  }
}
