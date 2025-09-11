// app/api/admin/permissions/route.js
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/config/mongoConfig";

import Role from "@/models/Role";
import Admin from "@/models/Admin";
import {
  adminReqWithAuth,
  requirePermission,
  requireOwner,
} from "@/lib/withAuthFunctions";
import { computeAdminPermissions } from "@/lib/permissions";
import {
  AVAILABLE_PERMISSIONS,
  PERMISSION_GROUPS,
} from "@/presets/Permissions";

export async function GET(request) {
  try {
    await dbConnect();

    const authData = await adminReqWithAuth(request.headers);
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "list";

    if (authData) {
      try {
        requireOwner(authData);
      } catch {
        try {
          requirePermission(authData, "roles.view");
        } catch (error) {
          requirePermission(authData, "roles.mange");
        }
      }
    }

    // 1) List all available permissions
    if (action === "list") {
      return NextResponse.json({
        success: true,
        data: {
          permissions: AVAILABLE_PERMISSIONS,
          groups: PERMISSION_GROUPS,
          total: Object.keys(AVAILABLE_PERMISSIONS).length,
        },
      });
    }

    // 2) Get permissions for a specific admin
    if (action === "getAdminPermissions") {
      const adminId = searchParams.get("adminId");

      if (!adminId || !mongoose.Types.ObjectId.isValid(adminId)) {
        return NextResponse.json(
          { success: false, message: "Valid adminId required" },
          { status: 400 }
        );
      }

      const admin = await Admin.findById(adminId).populate("roleId");
      if (!admin) {
        return NextResponse.json(
          { success: false, message: "Admin not found" },
          { status: 404 }
        );
      }

      const permissions = await computeAdminPermissions(admin);

      return NextResponse.json({
        success: true,
        data: {
          admin: {
            _id: admin._id,
            email: admin.email,
            name: admin.name,
          },
          permissions: permissions,
        },
        message: "Admin permissions retrieved successfully",
      });
    }

    // 3) Get permission usage across all roles
    if (action === "usage") {
      if (authData) {
        try {
          requireOwner(authData);
        } catch {
          try {
            requirePermission(authData, "roles.view");
          } catch (error) {
            requirePermission(authData, "roles.mange");
          }
        }
      }

      const roles = await Role.find({}).lean();
      const permissionUsage = {};

      // Initialize usage counts
      Object.keys(AVAILABLE_PERMISSIONS).forEach((perm) => {
        permissionUsage[perm] = {
          description: AVAILABLE_PERMISSIONS[perm],
          roles: [],
          count: 0,
        };
      });

      // Count usage in roles
      roles.forEach((role) => {
        role.permissions.forEach((perm) => {
          if (permissionUsage[perm]) {
            permissionUsage[perm].roles.push({
              id: role._id,
              name: role.name,
              key: role.key,
              isSystem: role.isSystem,
            });
            permissionUsage[perm].count++;
          }
        });
      });

      // Get admin count with extra permissions
      const adminsWithExtra = await Admin.find({
        $or: [
          { permissionsExtra: { $exists: true, $not: { $size: 0 } } },
          { permissionsDenied: { $exists: true, $not: { $size: 0 } } },
        ],
      })
        .select("email name permissionsExtra permissionsDenied roleKey")
        .lean();

      return NextResponse.json({
        success: true,
        data: {
          permissionUsage,
          adminsWithOverrides: adminsWithExtra,
          totalRoles: roles.length,
          totalPermissions: Object.keys(AVAILABLE_PERMISSIONS).length,
        },
      });
    }

    // 4) Validate permissions array
    if (action === "validate") {
      const permissions = searchParams.get("permissions");

      if (!permissions) {
        return NextResponse.json(
          { success: false, message: "permissions parameter required" },
          { status: 400 }
        );
      }

      let permArray;
      try {
        permArray = JSON.parse(permissions);
      } catch {
        return NextResponse.json(
          { success: false, message: "permissions must be valid JSON array" },
          { status: 400 }
        );
      }

      if (!Array.isArray(permArray)) {
        return NextResponse.json(
          { success: false, message: "permissions must be an array" },
          { status: 400 }
        );
      }

      const validation = {
        valid: [],
        invalid: [],
        warnings: [],
      };

      permArray.forEach((perm) => {
        if (typeof perm !== "string") {
          validation.invalid.push({
            permission: perm,
            reason: "Must be a string",
          });
        } else if (perm === "*") {
          validation.valid.push(perm);
          validation.warnings.push({
            permission: perm,
            message: "Wildcard permission grants all access",
          });
        } else if (AVAILABLE_PERMISSIONS[perm]) {
          validation.valid.push(perm);
        } else {
          validation.invalid.push({
            permission: perm,
            reason: "Unknown permission",
          });
        }
      });

      return NextResponse.json({
        success: true,
        data: {
          validation,
          isValid: validation.invalid.length === 0,
          summary: {
            total: permArray.length,
            valid: validation.valid.length,
            invalid: validation.invalid.length,
            warnings: validation.warnings.length,
          },
        },
      });
    }

    return NextResponse.json(
      { success: false, message: "Unknown action" },
      { status: 400 }
    );
  } catch (err) {
    if (err?.statusCode === 401 || err?.statusCode === 403) {
      return NextResponse.json(
        { success: false, message: err.message },
        { status: err.statusCode }
      );
    }
    console.error("GET /api/admin/permissions error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to fetch permissions" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    await dbConnect();

    const authData = await adminReqWithAuth(request.headers);
    const body = await request.json();
    const { action, adminId } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, message: "action required" },
        { status: 400 }
      );
    }

    // 1) Bulk permission check for multiple admins
    if (action === "bulkCheck") {
      const { adminIds, permission } = body;

      if (!Array.isArray(adminIds) || !permission) {
        return NextResponse.json(
          { success: false, message: "adminIds array and permission required" },
          { status: 400 }
        );
      }

      requirePermission(authData, "admin.view");

      const admins = await Admin.find({
        _id: { $in: adminIds },
      }).populate("roleId");

      const results = await Promise.all(
        admins.map(async (admin) => {
          const permissions = await computeAdminPermissions(admin);
          return {
            adminId: admin._id,
            email: admin.email,
            name: admin.name,
            hasPermission:
              permissions.effective.includes(permission) ||
              permissions.effective.includes("*"),
            roleKey: permissions.roleKey,
          };
        })
      );

      return NextResponse.json({
        success: true,
        data: {
          permission,
          results,
          summary: {
            total: results.length,
            hasPermission: results.filter((r) => r.hasPermission).length,
            denied: results.filter((r) => !r.hasPermission).length,
          },
        },
      });
    }

    // 2) Grant extra permissions to admin
    if (action === "grantExtra") {
      const { permissions } = body;

      if (!adminId || !Array.isArray(permissions)) {
        return NextResponse.json(
          { success: false, message: "adminId and permissions array required" },
          { status: 400 }
        );
      }

      requirePermission(authData, "admin.manageAdmins");

      // Only owners can grant sensitive permissions
      if (permissions.includes("*") || permissions.includes("roles.manage")) {
        requireOwner(authData);
      }

      // Validate all permissions exist
      const invalidPerms = permissions.filter((p) => !AVAILABLE_PERMISSIONS[p]);
      if (invalidPerms.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Invalid permissions: ${invalidPerms.join(", ")}`,
          },
          { status: 400 }
        );
      }

      const admin = await Admin.findByIdAndUpdate(
        adminId,
        { $addToSet: { permissionsExtra: { $each: permissions } } },
        { new: true }
      ).populate("roleId");

      if (!admin) {
        return NextResponse.json(
          { success: false, message: "Admin not found" },
          { status: 404 }
        );
      }

      const updatedPermissions = await computeAdminPermissions(admin);

      return NextResponse.json({
        success: true,
        data: {
          admin: {
            _id: admin._id,
            email: admin.email,
            name: admin.name,
          },
          permissions: updatedPermissions,
          grantedPermissions: permissions,
        },
        message: "Extra permissions granted successfully",
      });
    }

    // 3) Deny specific permissions for admin
    if (action === "denyPermissions") {
      const { permissions } = body;

      if (!adminId || !Array.isArray(permissions)) {
        return NextResponse.json(
          { success: false, message: "adminId and permissions array required" },
          { status: 400 }
        );
      }

      requirePermission(authData, "admin.manageAdmins");

      const admin = await Admin.findByIdAndUpdate(
        adminId,
        { $addToSet: { permissionsDenied: { $each: permissions } } },
        { new: true }
      ).populate("roleId");

      if (!admin) {
        return NextResponse.json(
          { success: false, message: "Admin not found" },
          { status: 404 }
        );
      }

      const updatedPermissions = await computeAdminPermissions(admin);

      return NextResponse.json({
        success: true,
        data: {
          admin: {
            _id: admin._id,
            email: admin.email,
            name: admin.name,
          },
          permissions: updatedPermissions,
          deniedPermissions: permissions,
        },
        message: "Permissions denied successfully",
      });
    }

    // 4) Reset admin permissions (remove all overrides)
    if (action === "resetOverrides") {
      if (!adminId) {
        return NextResponse.json(
          { success: false, message: "adminId required" },
          { status: 400 }
        );
      }

      requirePermission(authData, "admin.manageAdmins");

      const admin = await Admin.findByIdAndUpdate(
        adminId,
        {
          $unset: {
            permissionsExtra: 1,
            permissionsDenied: 1,
          },
        },
        { new: true }
      ).populate("roleId");

      if (!admin) {
        return NextResponse.json(
          { success: false, message: "Admin not found" },
          { status: 404 }
        );
      }

      const updatedPermissions = await computeAdminPermissions(admin);

      return NextResponse.json({
        success: true,
        data: {
          admin: {
            _id: admin._id,
            email: admin.email,
            name: admin.name,
          },
          permissions: updatedPermissions,
        },
        message: "Permission overrides reset successfully",
      });
    }

    return NextResponse.json(
      { success: false, message: "Unknown action" },
      { status: 400 }
    );
  } catch (err) {
    if (err?.statusCode === 401 || err?.statusCode === 403) {
      return NextResponse.json(
        { success: false, message: err.message },
        { status: err.statusCode }
      );
    }
    console.error("POST /api/admin/permissions error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err.message || "Failed to process permissions",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    await dbConnect();

    const authData = await adminReqWithAuth(request.headers);
    const body = await request.json();
    const { action, adminId } = body;

    if (!action || !adminId) {
      return NextResponse.json(
        { success: false, message: "action and adminId required" },
        { status: 400 }
      );
    }

    requirePermission(authData, "admin.manageAdmins");

    // 1) Set exact extra permissions (replace existing)
    if (action === "setExtraPermissions") {
      const { permissions } = body;

      if (!Array.isArray(permissions)) {
        return NextResponse.json(
          { success: false, message: "permissions array required" },
          { status: 400 }
        );
      }

      // Only owners can set sensitive permissions
      if (permissions.includes("*") || permissions.includes("roles.manage")) {
        requireOwner(authData);
      }

      // Validate permissions
      const invalidPerms = permissions.filter((p) => !AVAILABLE_PERMISSIONS[p]);
      if (invalidPerms.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Invalid permissions: ${invalidPerms.join(", ")}`,
          },
          { status: 400 }
        );
      }

      const admin = await Admin.findByIdAndUpdate(
        adminId,
        { $set: { permissionsExtra: permissions } },
        { new: true }
      ).populate("roleId");

      if (!admin) {
        return NextResponse.json(
          { success: false, message: "Admin not found" },
          { status: 404 }
        );
      }

      const updatedPermissions = await computeAdminPermissions(admin);

      return NextResponse.json({
        success: true,
        data: {
          admin: {
            _id: admin._id,
            email: admin.email,
            name: admin.name,
          },
          permissions: updatedPermissions,
        },
        message: "Extra permissions updated successfully",
      });
    }

    // 2) Set exact denied permissions (replace existing)
    if (action === "setDeniedPermissions") {
      const { permissions } = body;

      if (!Array.isArray(permissions)) {
        return NextResponse.json(
          { success: false, message: "permissions array required" },
          { status: 400 }
        );
      }

      const admin = await Admin.findByIdAndUpdate(
        adminId,
        { $set: { permissionsDenied: permissions } },
        { new: true }
      ).populate("roleId");

      if (!admin) {
        return NextResponse.json(
          { success: false, message: "Admin not found" },
          { status: 404 }
        );
      }

      const updatedPermissions = await computeAdminPermissions(admin);

      return NextResponse.json({
        success: true,
        data: {
          admin: {
            _id: admin._id,
            email: admin.email,
            name: admin.name,
          },
          permissions: updatedPermissions,
        },
        message: "Denied permissions updated successfully",
      });
    }

    // 3) Remove specific extra permissions
    if (action === "removeExtraPermissions") {
      const { permissions } = body;

      if (!Array.isArray(permissions)) {
        return NextResponse.json(
          { success: false, message: "permissions array required" },
          { status: 400 }
        );
      }

      const admin = await Admin.findByIdAndUpdate(
        adminId,
        { $pullAll: { permissionsExtra: permissions } },
        { new: true }
      ).populate("roleId");

      if (!admin) {
        return NextResponse.json(
          { success: false, message: "Admin not found" },
          { status: 404 }
        );
      }

      const updatedPermissions = await computeAdminPermissions(admin);

      return NextResponse.json({
        success: true,
        data: {
          admin: {
            _id: admin._id,
            email: admin.email,
            name: admin.name,
          },
          permissions: updatedPermissions,
        },
        message: "Extra permissions removed successfully",
      });
    }

    // 4) Remove specific denied permissions
    if (action === "removeDeniedPermissions") {
      const { permissions } = body;

      if (!Array.isArray(permissions)) {
        return NextResponse.json(
          { success: false, message: "permissions array required" },
          { status: 400 }
        );
      }

      const admin = await Admin.findByIdAndUpdate(
        adminId,
        { $pullAll: { permissionsDenied: permissions } },
        { new: true }
      ).populate("roleId");

      if (!admin) {
        return NextResponse.json(
          { success: false, message: "Admin not found" },
          { status: 404 }
        );
      }

      const updatedPermissions = await computeAdminPermissions(admin);

      return NextResponse.json({
        success: true,
        data: {
          admin: {
            _id: admin._id,
            email: admin.email,
            name: admin.name,
          },
          permissions: updatedPermissions,
        },
        message: "Denied permissions removed successfully",
      });
    }

    return NextResponse.json(
      { success: false, message: "Unknown action" },
      { status: 400 }
    );
  } catch (err) {
    if (err?.statusCode === 401 || err?.statusCode === 403) {
      return NextResponse.json(
        { success: false, message: err.message },
        { status: err.statusCode }
      );
    }
    console.error("PUT /api/admin/permissions error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err.message || "Failed to update permissions",
      },
      { status: 500 }
    );
  }
}
