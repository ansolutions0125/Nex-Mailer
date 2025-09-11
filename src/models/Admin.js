// models/Admin.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const AdminSchema = new Schema(
  {
    // Identity
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },

    // Contact
    phoneNo: { type: String, trim: true },
    address: { type: String, trim: true },
    country: { type: String, trim: true },

    // Auth
    sessionType: {
      type: String,
      enum: ["password", "magic", "sso"],
      default: "password",
    },
    passwordHash: { type: String }, // bcrypt hash

    // Single Role (only one)
    roleId:   { type: Schema.Types.ObjectId, ref: "Role", default: null },
    roleKey:  { type: String, trim: true, lowercase: true, default: "admin" }, // stable fallback

    // Per-admin permission overrides
    permissionsExtra:  [{ type: String, trim: true }], // explicit grants
    permissionsDenied: [{ type: String, trim: true }], // explicit denials

    // State
    isActive: { type: Boolean, default: true },

    // Magic-link flow (short-lived)
    magicLink: {
      token: { type: String },
      expiresAt: { type: Date },
      usedAt: { type: Date },
    },
  },
  { timestamps: true }
);

export default mongoose.models.Admin || mongoose.model("Admin", AdminSchema);
