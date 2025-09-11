import mongoose from "mongoose";

const StatsSchema = new mongoose.Schema(
  {
    // Document Configuration
    _id: {
      type: String,
      required: true,
      default: "current",
    },

    // User Statistics
    totalUsers: { type: Number, default: 0 },
    totalUsersDeleted: { type: Number, default: 0 },

    // Automation Statistics
    totalAutomations: { type: Number, default: 0 },
    crons: {
      type: Object,
      required: false,
    },

    // System Statistics
    totalRequestsReceived: { type: Number, default: 0 },
    totalWebhooksSent: { type: Number, default: 0 },
    totalWebsites: { type: Number, default: 0 },
    totalGateways: { type: Number, default: 0 },
    totalServers: { type: Number, default: 0 },
    totalLists: { type: Number, default: 0 },
    totalMailSent: { type: Number, default: 0 },

    totalEmailsSent: { type: Number, default: 0 },
    totalEmailsFailed: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    // Remove _id: false since we want to use our custom _id field
  }
);

// Fix the model export to properly check for existing model
const Stats = mongoose.models.Stats || mongoose.model("Stats", StatsSchema);
export default Stats;
