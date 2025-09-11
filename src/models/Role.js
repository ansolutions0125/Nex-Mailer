// models/Role.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const RoleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true }, // "Owner", "Admin", "Support"
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    }, // "owner", "admin"
    description: { type: String, trim: true },
    isSystem: { type: Boolean, default: false }, // prevent deletion of built-ins if you like
    addedBy: { type: String, trim: true },

    // Permission values pulled from PermissionGlobal.value
    permissions: [{ type: String, trim: true }],

    createdBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

RoleSchema.index({ key: 1 }, { unique: true });

export default mongoose.models.Role || mongoose.model("Role", RoleSchema);
