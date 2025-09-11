// models/EmailLogs.js
import mongoose from "mongoose";

const EmailLogsSchema = new mongoose.Schema(
  {
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      required: true,
    },
    serverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Server",
      required: true,
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
      enum: ["sent", "opened", "failed", "bounced", "processing"],
      default: "sent",
    },
    attempts: {
      type: Number,
      default: 0,
    },
    messageId: {
      type: String,
    },
    metadata: {
      type: Object,
      default: {
        openCount: 0,
        maxOpens: 5,
        opened: false,
        lastOpened: null,
        firstOpened: null,
        serverUsed: null,
        serverPreset: null,
      },
    },
    // Additional fields for analytics
    sentAt: {
      type: Date,
      default: Date.now,
    },
    firstOpenedAt: {
      type: Date,
    },
    lastOpenedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
EmailLogsSchema.index({ contactId: 1 });
EmailLogsSchema.index({ flowId: 1 });
EmailLogsSchema.index({ sentAt: 1 });
EmailLogsSchema.index({ status: 1 });

export default mongoose.models.EmailLogs ||
  mongoose.model("EmailLogs", EmailLogsSchema);
