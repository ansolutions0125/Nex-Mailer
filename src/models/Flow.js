// models/Flow.js
import mongoose from "mongoose";

const StepSchema = new mongoose.Schema(
  {
    stepType: {
      type: String,
      required: [true, "Step type is required."],
      enum: [
        "sendWebhook",
        "waitSubscriber",
        "moveSubscriber",
        "removeSubscriber",
        "deleteSubscriber",
        "sendMail",
      ],
    },
    title: { type: String, required: [true, "Step title is required."], trim: true },
    description: { type: String, trim: true },
    stepCount: { type: Number },

    // sendMail
    sendMailTemplate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Template",
      required: function () {
        return this.stepType === "sendMail";
      },
    },

    // sendWebhook
    webhookUrl: {
      type: String,
      trim: true,
      required: function () {
        return this.stepType === "sendWebhook";
      },
    },
    requestMethod: {
      type: String,
      enum: ["GET", "POST", "PUT", "DELETE"],
      default: "POST",
      required: function () {
        return this.stepType === "sendWebhook";
      },
    },
    retryAttempts: {
      type: Number,
      default: 0,
      min: 0,
      required: function () {
        return this.stepType === "sendWebhook";
      },
    },
    retryAfterSeconds: {
      type: Number,
      default: 3,
      min: 0,
      required: function () {
        return this.stepType === "sendWebhook";
      },
    },
    queryParams: {
      type: [
        {
          key: { type: String, required: true, trim: true },
          value: { type: String, trim: true },
          type: { type: String, enum: ["static", "email"], default: "static" },
        },
      ],
      default: [],
      required: function () {
        return this.stepType === "sendWebhook";
      },
    },

    // waitSubscriber
    waitDuration: {
      type: Number,
      min: 1,
      required: function () {
        return this.stepType === "waitSubscriber";
      },
    },
    waitUnit: {
      type: String,
      enum: ["seconds", "minutes", "hours", "days", "weeks", "months"],
      required: function () {
        return this.stepType === "waitSubscriber";
      },
    },

    // list move/remove/delete steps
    targetListId: { type: mongoose.Schema.Types.ObjectId, default: null },
    listExist: { type: Boolean },
  },
  { timestamps: true }
);

const FlowSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Please provide a name for this automation flow."], trim: true },
    description: { type: String, trim: true, default: "No description provided." },
    logo: {
      type: String,
      default:
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQmP_C567B99oW1qwIYITjG9hQ6WIA2rHf2eg&s",
    },

    // OWNER — changed to Customer (removed Website entirely)
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: [true, "An automation flow must be associated with a customer."],
      index: true,
    },

    // Optional association to a List
    listId: { type: mongoose.Schema.Types.ObjectId, ref: "List" },

    // Steps
    steps: { type: [StepSchema], default: [] },

    // Status
    isActive: { type: Boolean, default: false },

    // Stats
    stats: {
      totalUsersProcessed: { type: Number, default: 0 },
      totalWebhooksSent: { type: Number, default: 0 },
      totalEmailsSent: { type: Number, default: 0 },
      totalSubscribersMoved: { type: Number, default: 0 },
      totalSubscribersRemoved: { type: Number, default: 0 },
      totalSubscribersDeleted: { type: Number, default: 0 },
      lastProcessedAt: { type: Date, default: null },
      averageProcessingTime: { type: Number, default: 0 },
      averageOpenRate: { type: Number, default: 0 },
      averageClickRate: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export default mongoose.models.Flow || mongoose.model("Flow", FlowSchema);
