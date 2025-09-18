// file: /app/presets/AUTH_ERRORS.jsx

export const AUTH_ERRORS = {
  NO_TOKEN: {
    code: "AUTH001",
    statusCode: 401,
    message: "No auth token provided",
  },
  INVALID_TOKEN: {
    code: "AUTH002", 
    statusCode: 401,
    message: "Invalid or expired token",
  },
  INVALID_STRUCTURE: {
    code: "AUTH003",
    statusCode: 401,
    message: "Invalid token structure",
  },
  ADMIN_NOT_FOUND: {
    code: "AUTH004",
    statusCode: 401,
    message: "Admin not found",
  },
  ADMIN_INACTIVE: {
    code: "AUTH005",
    statusCode: 403,
    message: "Admin account is deactivated",
  },
  NO_ACTIVE_SESSION: {
    code: "AUTH006",
    statusCode: 401,
    message: "No active session found",
  },
  CUSTOMER_NOT_FOUND: {
    code: "AUTH007",
    statusCode: 401,
    message: "Customer not found",
  },
  CUSTOMER_INACTIVE: {
    code: "AUTH008",
    statusCode: 403,
    message: "Customer account is deactivated",
  },
  INSUFFICIENT_PERMISSIONS: {
    code: "AUTH009",
    statusCode: 403,
    message: "Insufficient permissions",
  },
  OWNER_REQUIRED: {
    code: "AUTH010",
    statusCode: 403,
    message: "Owner role required",
  },
  UNRECOGNIZED_TOKEN: {
    code: "AUTH011",
    statusCode: 401,
    message: "Unrecognized token type",
  },
  UNAUTHORIZED: {
    code: "AUTH012",
    statusCode: 401,
    message: "Unauthorized",
  },
};