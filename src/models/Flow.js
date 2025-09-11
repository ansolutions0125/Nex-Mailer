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
    title: {
      type: String,
      required: [true, "Step title is required."],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    stepCount: {
      type: Number,
      required: false,
    },
    sendMailTemplate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Template",
      required: function () {
        return this.stepType === "sendMail";
      },
    },
    webhookUrl: {
      type: String,
      required: function () {
        return this.stepType === "sendWebhook";
      },
      trim: true,
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
          value: { type: String, required: false, trim: true },
          type: { type: String, enum: ["static", "email"], default: "static" },
        },
      ],
      default: [],
      required: function () {
        return this.stepType === "sendWebhook";
      },
    },

    waitDuration: {
      type: Number,
      required: function () {
        return this.stepType === "waitSubscriber";
      },
      min: 1,
    },
    waitUnit: {
      type: String,
      required: function () {
        return this.stepType === "waitSubscriber";
      },
      enum: ["seconds", "minutes", "hours", "days", "weeks", "months"],
    },

    targetListId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false, // Make it optional
      default: null, // Default to null instead of empty string
    },
    listExist: {
      type: Boolean,
      required: false,
    },
  },
  {
    // Add timestamps to the Step sub-document to track creation/update times
    timestamps: true,
  }
);

const FlowSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name for this automation flow."],
      trim: true,
    },
    description: {
      type: String,
      required: false,
      trim: true,
      default: "No description provided.",
    },
    logo: {
      type: String,
      required: false,
      default:
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQmP_C567B99oW1qwIYITjG9hQ6WIA2rHf2eg&s",
    },
    flowId: {
      type: Number,
      unique: true,
      default: () => Math.floor(Math.random() * 100000),
    },
    websiteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Website",
      required: [true, "An automation flow must be associated with a website."],
    },
    listId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "List",
      required: false,
    },
    steps: {
      type: [StepSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    stats: {
      totalUsersProcessed: {
        type: Number,
        default: 0,
      },
      totalWebhooksSent: {
        type: Number,
        default: 0,
      },
      totalEmailsSent: {
        type: Number,
        default: 0,
      },
      totalSubscribersMoved: {
        type: Number,
        default: 0,
      },
      totalSubscribersRemoved: {
        type: Number,
        default: 0,
      },
      totalSubscribersDeleted: {
        type: Number,
        default: 0,
      },
      lastProcessedAt: {
        type: Date,
        default: null,
      },
      averageProcessingTime: {
        type: Number,
        default: 0,
      },
      averageOpenRate: {
        type: Number,
        default: 0,
      },
      averageClickRate: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);
 
export default mongoose.models.Flow || mongoose.model("Flow", FlowSchema);
