// models/Contact.js
import mongoose from "mongoose";

const ContactSchema = new mongoose.Schema(
  {
    // Basic Contact Information
    fullName: {
      type: String,
      required: [true, "Please provide a full name for the contact."],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please provide an email for the contact."],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/,
        "Please provide a valid email address.",
      ],
    },

    // Contact Status
    isActive: {
      type: Boolean,
      default: true,
    },

    automationAssociations: [
      {
        automationId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Flow",
          required: true,
        },
        stepNumber: {
          type: Number,
          default: 0,
        },
        nextStepTime: {
          type: Date,
          default: null,
        },
        startedAt: {
          type: Date,
          default: () => new Date(),
        },
      },
    ],

    // Multi-List Associations
    listAssociations: [
      {
        listId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "List",
          required: [true, "A list ID is required for each association."],
        },
        status: {
          type: Boolean,
          default: true,
        },
        currentStep: {
          type: Number,
          default: 1,
        },
        subscribedAt: {
          type: Date,
          default: () => new Date().toISOString(),
        },
        unsubscribedAt: {
          type: Date,
          default: null,
        },
        source: {
          type: String,
          enum: ["manual", "import", "api", "form", "automation", "campaign"],
          default: "manual",
        },
        nextStepTime: {
          type: Date,
          default: null,
        },
      },
    ],

    listHistory: [
      {
        listId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "List",
          required: true,
        },
        subscribedAt: {
          type: Date,
        },
        unsubscribedAt: {
          type: Date,
        },
        source: {
          type: String,
          enum: ["manual", "import", "api", "form", "automation", "campaign"],
          default: "manual",
        },
      },
    ],

    // Automation History - Track all automation journeys
    automationHistory: [
      {
        automationId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Flow",
          required: true,
        },
        listId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "List",
          required: true,
        },
        addedAt: {
          type: Date,
          required: true,
        },
        completedAt: {
          type: Date,
          default: null,
        },
        status: {
          type: String,
          enum: ["active", "completed", "paused", "failed", "cancelled"],
          default: "active",
        },
        stepsCompleted: {
          type: Number,
          default: 0,
        },
      },
    ],

    // Engagement History & Analytics
    engagementHistory: {
      totalEmailsSent: {
        type: Number,
        default: 0,
      },
      totalEmailsDelivered: {
        type: Number,
        default: 0,
      },
      totalEmailsOpened: {
        type: Number,
        default: 0,
      },
      totalEmailsClicked: {
        type: Number,
        default: 0,
      },

      // Engagement Rates (calculated fields)
      openRate: {
        type: Number,
        default: 0,
      },
      clickRate: {
        type: Number,
        default: 0,
      },

      // Engagement Score (0-100)
      engagementScore: {
        type: Number,
        default: 50,
        min: 0,
        max: 100,
      },
    },
    websiteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Website",
      index: true,
    },

    location: {
      country: String,
      city: String,
    },
    createdBy: {
      type: String,
      required: false,
      default: "system",
    },

    updatedBy: {
      type: String,
      required: false,
      default: "system",
    },
  },
  {
    timestamps: true,
  }
);
// Pre-save middleware to calculate engagement metrics
ContactSchema.pre("save", async function (next) {
  const engagement = this.engagementHistory;
  if (engagement.totalEmailsDelivered > 0) {
    engagement.openRate =
      (engagement.totalEmailsOpened / engagement.totalEmailsDelivered) * 100;
  }
  if (engagement.totalEmailsOpened > 0) {
    engagement.clickRate =
      (engagement.totalEmailsClicked / engagement.totalEmailsOpened) * 100;
  }
  const deliveryRate =
    engagement.totalEmailsDelivered > 0
      ? (engagement.totalEmailsDelivered / engagement.totalEmailsSent) * 100
      : 0;
  engagement.engagementScore = Math.min(
    100,
    Math.max(
      0,
      engagement.openRate * 0.4 +
        engagement.clickRate * 0.4 +
        deliveryRate * 0.2
    )
  );

  // Populate websiteId from the first list association on a new contact
  if (this.isNew && this.listAssociations.length > 0) {
    // You'll need to import the List model here
    const List = mongoose.model("List");
    const list = await List.findById(this.listAssociations[0].listId).select(
      "websiteId"
    );
    if (list) {
      this.websiteId = list.websiteId;
    }
  }

  next();
});

// Post-save middleware for stat updates
ContactSchema.post("save", async function (doc) {
  if (doc.isNew && doc.websiteId) {
    try {
      const Website = mongoose.model("Website");
      const Stats = mongoose.model("Stats");

      await Website.findByIdAndUpdate(doc.websiteId, {
        $inc: { "stats.totalSubscribers": 1 },
      });
      await Stats.findOneAndUpdate(
        { _id: "current" },
        { $inc: { totalUsers: 1 } },
        { new: true, upsert: true }
      );
    } catch (error) {
      console.error(`Error in Contact post-save hook: ${error.message}`);
    }
  }
});

// Post-delete middleware for stat updates
ContactSchema.post("findOneAndDelete", async function (doc) {
  if (doc && doc.websiteId) {
    try {
      const Website = mongoose.model("Website");
      const Stats = mongoose.model("Stats");

      await Website.findByIdAndUpdate(doc.websiteId, {
        $inc: { "stats.totalSubscribers": -1 },
      });
      await Stats.findOneAndUpdate(
        { _id: "current" },
        { $inc: { totalUsers: -1 } },
        { new: true }
      );
    } catch (error) {
      console.error(`Error in Contact post-delete hook: ${error.message}`);
    }
  }
});

// Indexes for performance
ContactSchema.index({ "listAssociations.listId": 1 });
ContactSchema.index({
  "automationAssociations.automationId": 1,
  "automationAssociations.nextStepTime": 1,
});
ContactSchema.index({ isActive: 1 });

export default mongoose.models.Contact ||
  mongoose.model("Contact", ContactSchema);
