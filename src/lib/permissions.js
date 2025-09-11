// lib/auth/permissions.js
import Role from "@/models/Role";

/**
 * Compute effective permissions for an admin document
 * - role.permissions ∪ admin.permissionsExtra − admin.permissionsDenied
 */
export async function computeAdminPermissions(admin) {
  if (!admin) {
    return { base: [], extras: [], denies: [], effective: [] };
  }

  let roleDoc = null;

  if (admin.roleId) {
    roleDoc = await Role.findById(admin.roleId).lean();
  }
  if (!roleDoc && admin.roleKey) {
    roleDoc = await Role.findOne({ key: admin.roleKey.toLowerCase() }).lean();
  }

  const base = Array.isArray(roleDoc?.permissions) ? roleDoc.permissions : [];
  const extras = Array.isArray(admin.permissionsExtra) ? admin.permissionsExtra : [];
  const denies = Array.isArray(admin.permissionsDenied) ? admin.permissionsDenied : [];

  const asSet = new Set([...base, ...extras]);
  for (const d of denies) asSet.delete(d);

  return {
    base,
    extras,
    denies,
    effective: Array.from(asSet),
    roleKey: roleDoc?.key || admin.roleKey || null,
    roleName: roleDoc?.name || null,
  };
}

export function hasPerm(auth, perm) {
  if (!auth?.perms) return false;
  return auth.perms.includes(perm);
}
