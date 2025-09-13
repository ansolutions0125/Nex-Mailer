// app/api/admin/auth/settings/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/config/mongoConfig";
import AuthSettings from "@/models/AuthSettings";
import {
  adminReqWithAuth,
  requireOwner,
  requirePermission,
} from "@/lib/withAuthFunctions";

export async function GET() {
  await dbConnect();
  const doc =
    (await AuthSettings.findById("current").lean()) ||
    (await AuthSettings.create({
      _id: "current",
      admin: {
        sessionDuration: 5,
        enforceSessionDuration: true,
        allowNormalAdminManageAdmins: false,
        providers: { emailPassword: true, magicLink: true },
        maxActiveSessions: 5,
        enforceSessionLimit: true,
      },
    }).then((d) => d.toObject()));
  return NextResponse.json({ success: true, data: doc });
}

export async function PUT(request) {
  await dbConnect();
  // Authenticate user
  const authData = await adminReqWithAuth(request.headers);

  if (authData.admin._id) {
    if (authData) {
      requireOwner(authData);
    } else {
      try {
        requirePermission(authData, "roles.manage");
      } catch {
        requirePermission(authData, "admin.manageAdmins");
      }
    }
  }

  const body = await request.json();
  const update = {};

  if (body.admin) {
    update.admin = {
      sessionDuration:
        typeof body.admin.sessionDuration === "number"
          ? Math.max(body.admin.sessionDuration, 1)
          : undefined,
      enforceSessionDuration:
        body.admin.enforceSessionDuration !== undefined
          ? !!body.admin.enforceSessionDuration
          : undefined,
      allowNormalAdminManageAdmins:
        body.admin.allowNormalAdminManageAdmins !== undefined
          ? !!body.admin.allowNormalAdminManageAdmins
          : undefined,
      providers: {
        emailPassword:
          body.admin.providers?.emailPassword !== undefined
            ? !!body.admin.providers.emailPassword
            : undefined,
        magicLink:
          body.admin.providers?.magicLink !== undefined
            ? !!body.admin.providers.magicLink
            : undefined,
      },
      maxActiveSessions:
        typeof body.admin.maxActiveSessions === "number"
          ? Math.min(Math.max(body.admin.maxActiveSessions, 1), 100)
          : undefined,
      enforceSessionLimit:
        body.admin.enforceSessionLimit !== undefined
          ? !!body.admin.enforceSessionLimit
          : undefined,
    };
    // remove undefined keys
    Object.keys(update.admin.providers).forEach(
      (k) =>
        update.admin.providers[k] === undefined &&
        delete update.admin.providers[k]
    );
    Object.keys(update.admin).forEach(
      (k) => update.admin[k] === undefined && delete update.admin[k]
    );
  }

  const doc = await AuthSettings.findByIdAndUpdate(
    "current",
    { $set: update },
    { new: true, upsert: true }
  ).lean();
  return NextResponse.json({ success: true, data: doc });
}
