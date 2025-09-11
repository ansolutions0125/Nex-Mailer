// Define available permissions in your system
export const AVAILABLE_PERMISSIONS = {
  // Admin Management
  "admin.view": "View admin list and details",
  "admin.create": "Create new admin accounts",
  "admin.manageAdmins": "Full admin management (create, update, assign roles)",
  "admin.delete": "Delete admin accounts",
  "admin.viewSessions": "View admin sessions",
  "admin.manageSessions": "Manage and revoke admin sessions",

  // Role Management
  "roles.view": "View roles and permissions",
  "roles.create": "Create new roles",
  "roles.manage": "Update and modify roles",
  "roles.delete": "Delete roles",
  canManageRoles: "Can manage roles",
  canManagePermissions: "Can manage permissions",

  // Customer Management
  "customer.view": "View customer list and details",
  "customer.create": "Create new customer accounts",
  "customer.manage": "Full customer management",
  "customer.delete": "Delete customer accounts",
  "customer.support": "Provide customer support",
  "customer.billing": "Access customer billing information",

  // Dashboard & Analytics
  "dashboard.view": "Access main dashboard",
  "dashboard.advanced": "Access advanced dashboard metrics",
  "analytics.view": "View analytics and reports",
  "analytics.export": "Export analytics data",

  // Email & Templates
  "email.view": "View email logs and history",
  "email.send": "Send emails and campaigns",
  "email.manage": "Full email management",
  "templates.view": "View email templates",
  "templates.manage": "Create and edit templates",

  // Settings & Configuration
  "settings.view": "View system settings",
  "settings.manage": "Modify system settings",
  "settings.advanced": "Access advanced system configuration",

  // System & Server Management
  "system.monitor": "Monitor system health and performance",
  "system.logs": "Access system logs",
  "server.manage": "Manage server configurations",

  // Billing & Plans
  "billing.view": "View billing information",
  "billing.manage": "Manage billing and subscriptions",
  "plans.manage": "Manage subscription plans",
  canViewPlans: "Can view plans",
  canManagePlans: "Can manage plans",

  // Automation
  "automation.view": "View automations",
  "automation.manage": "Create and manage automations",

  // API & Integrations
  "api.access": "Access API endpoints",
  "integrations.manage": "Manage third-party integrations",

  // Website Management
  canViewWebsites: "Can view websites",
  canManageWebsites: "Can manage websites",

  // Contact Management
  canViewContacts: "Can view contacts",
  canManageContacts: "Can manage contacts",

  // Special Permissions
  "*": "Full system access (Owner only)",
};

// Group permissions by category for better organization
export const PERMISSION_GROUPS = {
  "Admin Management": [
    "admin.view",
    "admin.create",
    "admin.manageAdmins",
    "admin.delete",
    "admin.viewSessions",
    "admin.manageSessions",
  ],
  "Role Management": [
    "roles.view",
    "roles.create",
    "roles.manage",
    "roles.delete",
    "canManageRoles",
    "canManagePermissions",
  ],
  "Customer Management": [
    "customer.view",
    "customer.create",
    "customer.manage",
    "customer.delete",
    "customer.support",
    "customer.billing",
  ],
  "Dashboard & Analytics": [
    "dashboard.view",
    "dashboard.advanced",
    "analytics.view",
    "analytics.export",
  ],
  "Email & Templates": [
    "email.view",
    "email.send",
    "email.manage",
    "templates.view",
    "templates.manage",
  ],
  "Settings & Configuration": [
    "settings.view",
    "settings.manage",
    "settings.advanced",
  ],
  "System Management": ["system.monitor", "system.logs", "server.manage"],
  "Billing & Plans": [
    "billing.view",
    "billing.manage",
    "plans.manage",
    "canViewPlans",
    "canManagePlans",
  ],
  "Website Management": ["canViewWebsites", "canManageWebsites"],
  "Contact Management": ["canViewContacts", "canManageContacts"],
  Automation: ["automation.view", "automation.manage"],
  "API & Integrations": ["api.access", "integrations.manage"],
  Special: ["*"],
};
