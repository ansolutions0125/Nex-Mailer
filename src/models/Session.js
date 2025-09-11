// models/Session.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const SessionSchema = new Schema(
  {
    // JWT unique identifier (from the token 'jti' claim)
    tokenId: { type: String, required: true, unique: true, index: true },

    // Who is this session for?
    actorType: { type: String, enum: ["admin", "customer"], required: true },

    // Reference by id and also store readable email
    actorId: { type: Schema.Types.ObjectId, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },

    // lifecycle
    isActive: { type: Boolean, default: true },
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date, required: true },
    revokedAt: { type: Date },

    // diagnostics
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

export default mongoose.models.Session ||
  mongoose.model("Session", SessionSchema);
