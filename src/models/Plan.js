// models/Plan.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const PlanSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },

    // Store the correct spelling; the API will map input 'slogon' -> 'slogan'
    slogan: { type: String, trim: true },
    description: { type: String, trim: true },

    // Pricing
    price: { type: Number, required: true, min: 0 },        // base price before discount
    discounted: { type: Boolean, default: false },
    discount: { type: Number, default: 0, min: 0, max: 100 }, // percent 0..100
    currency: {
      type: String,
      default: "USD",
      uppercase: true,
      trim: true,
      match: /^[A-Z]{3}$/, // ISO-like 3-letter code
    },

    // Billing length (as you requested)
    length: {
      type: String,
      enum: ["1month", "3month", "6month", "1year"],
      required: true,
    },

    // Quotas & features
    emailLimit: { type: Number, default: 0, min: 0 },
    serverId: { type: Schema.Types.ObjectId, ref: "Server", required: true },
    features: [{ type: String, trim: true }],

    // Operational
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.Plan || mongoose.model("Plan", PlanSchema);
