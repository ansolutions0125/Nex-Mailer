// models/ProcessingSetting.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const ProcessingSettingSchema = new Schema(
  {
    _id: { type: String, default: "current" },

    // Processing
    fetchBatchSizePerProcess: { type: Number, default: 20 },
    maxConcurrentProcesses: { type: Number, default: 5 },
    retryFailedJobs: { type: Boolean, default: true },
    defaultRetryDelaySeconds: { type: Number, default: 60 },
    enableFlowParallelism: { type: Boolean, default: false },

    // Email Delivery
    defaultFromEmail: { type: String, default: "no-reply@example.com" },
    enableTracking: { type: Boolean, default: true },
    maxDailyEmailsPerCustomer: { type: Number, default: 1000 },

    // Webhooks
    processWebhookInProcess: { type: Boolean, default: false },

    // System
    createNewRoutes: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    _id: false,
  }
);

export default mongoose.models.ProcessingSetting ||
  mongoose.model("ProcessingSetting", ProcessingSettingSchema);
