// models/Customer.js
import mongoose from "mongoose";
const { Schema } = mongoose;

/** Email quota / usage (no hooks) */
const EmailLimitsSchema = new Schema(
  {
    totalSent: { type: Number, default: 0, min: 0 },
    remaining: { type: Number, default: 0, min: 0 },

    // Align with plan.length; route sets/resets this
    period: {
      type: String,
      enum: ["1month", "3month", "6month", "1year", "none"],
      default: "1month",
    },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    lastResetAt: { type: Date },
  },
  { _id: false }
);


/** Aggregated counters for dashboards */
const CustomerStatsSchema = new Schema(
  {
    totalEmailSent: { type: Number, default: 0 },
    totalAutomations: { type: Number, default: 0 },
    totalLists: { type: Number, default: 0 },
    totalContacts: { type: Number, default: 0 },
  },
  { _id: false }
);

const CustomerSchema = new Schema(
  {
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },
    isActive: { type: Boolean, default: true },
    // ---- Profile & Auth ----
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    passwordHash: { type: String }, // store only the hash
    sessionType: { type: String, default: "password", trim: true },
    phoneNo: { type: String, trim: true },
    address: { type: String, trim: true },
    country: { type: String, trim: true },

    // ---- Plan link & snapshot ----
    planId: { type: Schema.Types.ObjectId, ref: "Plan", default: null },

    // ---- Quota + Stats ----
    emailLimits: { type: EmailLimitsSchema, default: () => ({}) },
    stats: { type: CustomerStatsSchema, default: () => ({}) },
    
    // ---- Optional associations (owner) ----
    lists: [{ type: Schema.Types.ObjectId, ref: "List", index: true }],
    templates: [{ type: Schema.Types.ObjectId, ref: "Template", index: true }],
    servers: [{ type: Schema.Types.ObjectId, ref: "Server", index: true }],

    team: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export default mongoose.models.Customer ||
  mongoose.model("Customer", CustomerSchema);
