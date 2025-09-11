// models/PermissionGlobal.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const PermissionGlobalSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },               // "Can View Websites"
    value: { type: String, required: true, unique: true, trim: true }, // "canViewWebsites"
    route: { type: String, trim: true },                                // "/admin/websites" (optional)
    category: { type: String, trim: true, default: "general" },        // "websites", "contacts", etc.
    description: { type: String, trim: true },
    enabled: { type: Boolean, default: true },

    createdBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

PermissionGlobalSchema.index({ value: 1 }, { unique: true });

export default mongoose.models.PermissionGlobal ||
  mongoose.model("PermissionGlobal", PermissionGlobalSchema);
