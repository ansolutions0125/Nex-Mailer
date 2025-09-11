// models/EmailQueue.js
import mongoose from "mongoose";

const EmailQueueSchema = new mongoose.Schema(
  {
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      required: true,
    },
    serverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Server",
      required: false,
    },
    flowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Flow",
      required: true,
    },
    listId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "List",
      required: false,
    },
    stepId: {
      type: String,
      required: true,
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Template",
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    subject: {
      type: String,
      required: true,
    },
    variables: {
      type: Map,
      of: String,
      default: {},
    },
    status: {
      type: String,
      enum: ["pending", "processing", "sent", "failed", "bounced"],
      default: "pending",
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    nextAttempt: {
      type: Date,
    },
    lastAttempt: {
      type: Date,
    },
    lastError: {
      type: String,
    },
    messageId: {
      type: String, // For tracking with email service
    },
    metadata: {
      type: Object,
      default: {
        openCount: 0,
        maxOpens: 5, // Add maxOpens field
        opened: false,
        lastOpened: null,
        firstOpened: null,
        serverUsed: null,
        serverPreset: null,
        serverId: null
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
EmailQueueSchema.index({ status: 1, nextAttempt: 1 });
EmailQueueSchema.index({ contactId: 1 });
EmailQueueSchema.index({ flowId: 1 });
EmailQueueSchema.index({ createdAt: 1 });

export default mongoose.models.EmailQueue ||
  mongoose.model("EmailQueue", EmailQueueSchema);
