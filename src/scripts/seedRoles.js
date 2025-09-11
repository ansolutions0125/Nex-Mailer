// scripts/seedRoles.js
// Run this script to create default roles in your database

import dbConnect from "@/config/mongoConfig";
import Role from "@/models/Role";
import { PERMISSION_GROUPS } from "@/presets/Permissions";
import mongoose from "mongoose";

const defaultRoles = [
  {
    name: "Owner",
    key: "owner",
    description: "Full system access with all permissions",
    isSystem: true,
    addedBy: "System Seeder",
    permissions: PERMISSION_GROUPS["Special"], // wildcard permission grants everything
  },
  {
    name: "Admin",
    key: "admin",
    description: "Administrative access with most permissions",
    isSystem: true,
    addedBy: "System Seeder",
    permissions: [
      ...PERMISSION_GROUPS["Admin Management"].filter((p) =>
        ["admin.view", "admin.manageAdmins"].includes(p)
      ),
      ...PERMISSION_GROUPS["Customer Management"].filter((p) =>
        ["customer.view", "customer.manage"].includes(p)
      ),
      ...PERMISSION_GROUPS["Dashboard & Analytics"].filter((p) =>
        ["dashboard.view"].includes(p)
      ),
      ...PERMISSION_GROUPS["Settings & Configuration"].filter((p) =>
        ["settings.view", "settings.manage"].includes(p)
      ),
      ...PERMISSION_GROUPS["Email & Templates"].filter((p) =>
        ["email.send", "email.view", "templates.manage"].includes(p)
      ),
      ...PERMISSION_GROUPS["Dashboard & Analytics"].filter((p) =>
        ["analytics.view"].includes(p)
      ),
    ],
  },
  {
    name: "Support",
    key: "support",
    description: "Support staff with limited permissions",
    isSystem: true,
    addedBy: "System Seeder",
    permissions: [
      ...PERMISSION_GROUPS["Customer Management"].filter((p) =>
        ["customer.view", "customer.support"].includes(p)
      ),
      ...PERMISSION_GROUPS["Dashboard & Analytics"].filter((p) =>
        ["dashboard.view"].includes(p)
      ),
      ...PERMISSION_GROUPS["Email & Templates"].filter((p) =>
        ["email.view"].includes(p)
      ),
      ...PERMISSION_GROUPS["Dashboard & Analytics"].filter((p) =>
        ["analytics.view"].includes(p)
      ),
    ],
  },
  {
    name: "Read Only",
    key: "readonly",
    description: "Read-only access to most resources",
    isSystem: true,
    addedBy: "System Seeder",
    permissions: [
      ...PERMISSION_GROUPS["Admin Management"].filter((p) =>
        ["admin.view"].includes(p)
      ),
      ...PERMISSION_GROUPS["Customer Management"].filter((p) =>
        ["customer.view"].includes(p)
      ),
      ...PERMISSION_GROUPS["Dashboard & Analytics"].filter((p) =>
        ["dashboard.view"].includes(p)
      ),
      ...PERMISSION_GROUPS["Email & Templates"].filter((p) =>
        ["email.view"].includes(p)
      ),
      ...PERMISSION_GROUPS["Dashboard & Analytics"].filter((p) =>
        ["analytics.view"].includes(p)
      ),
    ],
  },
];

async function seedRoles() {
  try {
    await dbConnect();
    console.log("Connected to database");

    for (const roleData of defaultRoles) {
      const existing = await Role.findOne({ key: roleData.key });

      if (existing) {
        console.log(
          `Role '${roleData.key}' already exists, updating permissions...`
        );
        // Update permissions for existing roles (useful for adding new permissions)
        await Role.findOneAndUpdate(
          { key: roleData.key },
          {
            $set: {
              permissions: roleData.permissions,
              description: roleData.description,
              name: roleData.name,
            },
          }
        );
        console.log(`Updated role: ${roleData.key}`);
      } else {
        await Role.create(roleData);
        console.log(`Created role: ${roleData.key}`);
      }
    }

    console.log("✅ Default roles seeded successfully");

    // Display all roles
    const allRoles = await Role.find({}).lean();
    console.log("\nCurrent roles in database:");
    allRoles.forEach((role) => {
      console.log(
        `- ${role.name} (${role.key}): ${role.permissions.length} permissions`
      );
    });
  } catch (error) {
    console.error("❌ Error seeding roles:", error);
  } finally {
    await mongoose.connection.close();
    console.log("Database connection closed");
  }
}

// Run the seeder
if (import.meta.url === `file://${process.argv[1]}`) {
  seedRoles();
}

export default seedRoles;
