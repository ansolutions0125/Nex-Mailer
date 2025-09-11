// app/api/admin/roles/route.js
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

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

export async function GET(request) {
  try {
    await dbConnect();

    // Authenticate user
    const authData = await adminReqWithAuth(request.headers);

    if (authData) {
      requireOwner(authData);
    } else {
      try {
        requirePermission(authData, "roles.view");
      } catch {
        requirePermission(authData, "roles.manage");
      }
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "50", 10));
    const skip = (page - 1) * limit;

    const search = (searchParams.get("search") || "").trim();
    const includeSystem = searchParams.get("includeSystem") === "true";

    // Build filter
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { key: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }
    if (!includeSystem) {
      filter.isSystem = { $ne: true };
    }

    const [items, totalItems] = await Promise.all([
      Role.find(filter)
        .populate("createdBy", "name email")
        .populate("updatedBy", "name email")
        .sort({ isSystem: -1, name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Role.countDocuments(filter),
    ]);

    // Add usage count for each role
    const rolesWithUsage = await Promise.all(
      items.map(async (role) => {
        const usageCount = await Admin.countDocuments({ roleId: role._id });
        return {
          ...role,
          usageCount,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: rolesWithUsage,
      pagination: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    });
  } catch (err) {
    if (err?.statusCode === 401 || err?.statusCode === 403) {
      return NextResponse.json(
        { success: false, message: err.message },
        { status: err.statusCode }
      );
    }
    console.error("GET /api/admin/roles error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to fetch roles" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    await dbConnect();

    const authData = await adminReqWithAuth(request.headers);
    const body = await request.json();
    const action = body?.action || "create";

    // Check permissions based on action
    if (action === "create") {
      if (authData) {
        try {
          requireOwner(authData);
        } catch {
          try {
            requirePermission(authData, "roles.create");
          } catch {
            requirePermission(authData, "roles.manage");
          }
        }
      }
    }

    // 1) Create new role
    if (action === "create") {
      const { name, key, description, permissions = [], addedBy } = body;

      if (!name || !key) {
        return NextResponse.json(
          { success: false, message: "name and key are required" },
          { status: 400 }
        );
      }

      // Validate key format (lowercase, no spaces, alphanumeric + underscore/dash)
      const keyRegex = /^[a-z0-9_-]+$/;
      if (!keyRegex.test(key)) {
        return NextResponse.json(
          {
            success: false,
            message:
              "key must be lowercase alphanumeric with underscores/dashes only",
          },
          { status: 400 }
        );
      }

      // Check if key already exists
      const existingRole = await Role.findOne({ key: key.toLowerCase() });
      if (existingRole) {
        return NextResponse.json(
          { success: false, message: "A role with this key already exists" },
          { status: 409 }
        );
      }

      // Validate permissions array
      if (!Array.isArray(permissions)) {
        return NextResponse.json(
          { success: false, message: "permissions must be an array" },
          { status: 400 }
        );
      }

      // Only owners can create roles with wildcard permissions
      if (permissions.includes("*") || permissions.includes("roles.manage")) {
        requireOwner(authData);
      }

      const role = await Role.create({
        name: name.trim(),
        key: key.toLowerCase().trim(),
        description: description?.trim() || "",
        permissions: permissions.filter((p) => p && typeof p === "string"),
        isSystem: false,
        createdBy: authData.admin._id,
        updatedBy: authData.admin._id,
        addedBy: addedBy || "unknown",
      });

      return NextResponse.json(
        {
          success: true,
          data: role,
          message: "Role created successfully",
        },
        { status: 201 }
      );
    }

    // 2) Duplicate existing role
    if (action === "duplicate") {
      requirePermission(authData, "roles.create");

      const { roleId, newName, newKey } = body;

      if (!roleId || !newName || !newKey) {
        return NextResponse.json(
          {
            success: false,
            message: "roleId, newName, and newKey are required",
          },
          { status: 400 }
        );
      }

      const sourceRole = await Role.findById(roleId);
      if (!sourceRole) {
        return NextResponse.json(
          { success: false, message: "Source role not found" },
          { status: 404 }
        );
      }

      // Check if new key already exists
      const existingRole = await Role.findOne({ key: newKey.toLowerCase() });
      if (existingRole) {
        return NextResponse.json(
          { success: false, message: "A role with this key already exists" },
          { status: 409 }
        );
      }

      // Only owners can duplicate roles with sensitive permissions
      if (
        sourceRole.permissions.includes("*") ||
        sourceRole.permissions.includes("roles.manage")
      ) {
        requireOwner(authData);
      }

      const duplicatedRole = await Role.create({
        name: newName.trim(),
        key: newKey.toLowerCase().trim(),
        description: `Copy of ${sourceRole.name}`,
        permissions: [...sourceRole.permissions],
        isSystem: false,
        createdBy: authData.admin._id,
        updatedBy: authData.admin._id,
      });

      return NextResponse.json(
        {
          success: true,
          data: duplicatedRole,
          message: "Role duplicated successfully",
        },
        { status: 201 }
      );
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
    console.error("POST /api/admin/roles error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Failed to create role" },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    await dbConnect();

    const authData = await adminReqWithAuth(request.headers);
    const body = await request.json();
    const { roleId, action = "update" } = body;

    if (!roleId || !mongoose.Types.ObjectId.isValid(roleId)) {
      return NextResponse.json(
        { success: false, message: "Valid roleId required" },
        { status: 400 }
      );
    }

    const role = await Role.findById(roleId);
    if (!role) {
      return NextResponse.json(
        { success: false, message: "Role not found" },
        { status: 404 }
      );
    }

    if (role) {
      if (authData) {
        try {
          requireOwner(authData);
        } catch {
          try {
            requirePermission(authData, "roles.manage");
          } catch (error) {
            requirePermission(authData, "roles.delete");
          }
        }
      }
    }
    // Protect system roles - only owners can modify them
    if (role.isSystem) {
      requireOwner(authData);
    }

    // 1) Update role details
    if (action === "update") {
      const allowedFields = ["name", "description", "permissions"];
      const updateData = pick(body.updateData || {}, allowedFields);

      // Validate permissions if provided
      if (updateData.permissions) {
        if (!Array.isArray(updateData.permissions)) {
          return NextResponse.json(
            { success: false, message: "permissions must be an array" },
            { status: 400 }
          );
        }

        // Only owners can assign wildcard or role management permissions
        if (
          updateData.permissions.includes("*") ||
          updateData.permissions.includes("roles.manage")
        ) {
          requireOwner(authData);
        }

        updateData.permissions = updateData.permissions.filter(
          (p) => p && typeof p === "string"
        );
      }

      // Add audit fields
      updateData.updatedBy = authData.admin._id;

      const updatedRole = await Role.findByIdAndUpdate(
        roleId,
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate("createdBy updatedBy", "name email");

      return NextResponse.json({
        success: true,
        data: updatedRole,
        message: "Role updated successfully",
      });
    }

    // 2) Add permissions
    if (action === "addPermissions") {
      const { permissions } = body;

      if (!Array.isArray(permissions) || permissions.length === 0) {
        return NextResponse.json(
          { success: false, message: "permissions array required" },
          { status: 400 }
        );
      }

      // Only owners can add sensitive permissions
      if (permissions.includes("*") || permissions.includes("roles.manage")) {
        requireOwner(authData);
      }

      const updatedRole = await Role.findByIdAndUpdate(
        roleId,
        {
          $addToSet: { permissions: { $each: permissions } },
          $set: { updatedBy: authData.admin._id },
        },
        { new: true }
      );

      return NextResponse.json({
        success: true,
        data: updatedRole,
        message: "Permissions added successfully",
      });
    }

    // 3) Remove permissions
    if (action === "removePermissions") {
      const { permissions } = body;

      if (!Array.isArray(permissions) || permissions.length === 0) {
        return NextResponse.json(
          { success: false, message: "permissions array required" },
          { status: 400 }
        );
      }

      const updatedRole = await Role.findByIdAndUpdate(
        roleId,
        {
          $pullAll: { permissions },
          $set: { updatedBy: authData.admin._id },
        },
        { new: true }
      );

      return NextResponse.json({
        success: true,
        data: updatedRole,
        message: "Permissions removed successfully",
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
    console.error("PUT /api/admin/roles error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Failed to update role" },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    await dbConnect();

    const authData = await adminReqWithAuth(request.headers);
    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get("roleId");

    if (!roleId || !mongoose.Types.ObjectId.isValid(roleId)) {
      return NextResponse.json(
        { success: false, message: "Valid roleId required" },
        { status: 400 }
      );
    }

    const role = await Role.findById(roleId);
    if (!role) {
      return NextResponse.json(
        { success: false, message: "Role not found" },
        { status: 404 }
      );
    }
    
    if (role) {
      if (authData) {
        try {
          requireOwner(authData);
        } catch {
          try {
            requirePermission(authData, "roles.manage");
          } catch (error) {
            requirePermission(authData, "roles.delete");
          }
        }
      }
    }

    // Protect system roles
    if (role.isSystem) {
      return NextResponse.json(
        { success: false, message: "Cannot delete system roles" },
        { status: 403 }
      );
    }

    // Check if role is in use
    const usageCount = await Admin.countDocuments({ roleId: roleId });
    if (usageCount > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot delete role. It is assigned to ${usageCount} admin(s). Please reassign them first.`,
          data: { usageCount },
        },
        { status: 409 }
      );
    }

    await Role.findByIdAndDelete(roleId);

    return NextResponse.json({
      success: true,
      message: "Role deleted successfully",
    });
  } catch (err) {
    if (err?.statusCode === 401 || err?.statusCode === 403) {
      return NextResponse.json(
        { success: false, message: err.message },
        { status: err.statusCode }
      );
    }
    console.error("DELETE /api/admin/roles error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to delete role" },
      { status: 500 }
    );
  }
}
