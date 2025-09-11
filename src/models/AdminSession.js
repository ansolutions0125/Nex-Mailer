// models/AdminSession.js
import mongoose from "mongoose";
const { Schema } = mongoose;

/**
 * Tracks sessions for admins (and optionally customers if you extend it).
 * JWTs include jti which maps to this session record.
 */
const AdminSessionSchema = new Schema(
  {
    actorType: {
      type: String,
      enum: ["admin", "customer"],
      required: true,
      default: "admin",
    },
    adminId: { type: Schema.Types.ObjectId, ref: "Admin" },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },

    jti: { type: String, required: true, unique: true }, // JWT ID
    userAgent: { type: String },
    ip: { type: String },

    startedAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    endedAt: { type: Date },

    revoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// fast lookups for active sessions
AdminSessionSchema.index({
  actorType: 1,
  adminId: 1,
  revoked: 1,
  endedAt: 1,
  expiresAt: 1,
});

export default mongoose.models.AdminSession ||
  mongoose.model("AdminSession", AdminSessionSchema);
