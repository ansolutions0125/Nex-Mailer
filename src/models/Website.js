import mongoose from "mongoose";
import Gateway from "./Gateway";

const WebsiteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name for this website."],
      trim: true,
    },
    logo: {
      type: String,
      required: false,
    },
    sendWebhookUrl: {
      type: String,
      required: false,
    },
    receiveWebhookUrl: {
      type: String,
      required: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
    },
    accessableServer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Server",
      required: false,
    },
    lists: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "List",
        required: false,
      },
    ],
    accessableGateway: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Gateway",
        required: false,
      },
    ],
    automations: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Flow",
        required: false,
      },
    ],
    stats: {
      type: Object,
      required: false,
      default: {
        totalSubscribers: 0, // Changed to 0 for proper incrementing
        totalAutomations: 0, // Changed to 0 for proper incrementing
        totalLists: 0, // Changed to 0 for proper incrementing
        lastActivity: "",
      },
    },
  },
  {
    timestamps: true,
  }
);
// A single consolidated post-save middleware
WebsiteSchema.post("save", async function (doc) {
  try {
    if (doc.isNew) {
      const Stats = mongoose.model("Stats");

      // Increment global stats for the new website
      await Stats.findOneAndUpdate(
        { _id: "current" },
        { $inc: { totalWebsites: 1 } },
        { new: true, upsert: true }
      );

      // Update gateways to add the new website's ID
      if (doc.accessableGateway && doc.accessableGateway.length > 0) {
        await Gateway.updateMany(
          { _id: { $in: doc.accessableGateway } },
          { $push: { associatedWebsites: doc._id } }
        );
      }

      // No action needed for templates, as they reference users, not websites
      // The templates array on the Website document is sufficient for the link.
    }
  } catch (error) {
    console.error(`Error in Website post-save hook: ${error.message}`);
  }
});

export default mongoose.models.Website ||
  mongoose.model("Website", WebsiteSchema);
