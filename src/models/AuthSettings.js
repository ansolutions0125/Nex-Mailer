// models/AuthSettings.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const AuthSettingsSchema = new Schema(
  {
    _id: { type: String, default: "current" },

    admin: {
      allowNormalAdminManageAdmins: { type: Boolean, default: false },
      providers: {
        emailPassword: { type: Boolean, default: true },
        magicLink: { type: Boolean, default: true },
      },
      maxActiveSessions: { type: Number, default: 5, min: 1, max: 100 },
      enforceSessionLimit: { type: Boolean, default: true },
    },
  },
  { timestamps: true, _id: false }
);

export default mongoose.models.AuthSettings ||
  mongoose.model("AuthSettings", AuthSettingsSchema);
