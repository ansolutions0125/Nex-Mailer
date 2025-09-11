import mongoose from "mongoose";

const ListSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name for this list."],
      trim: true,
    },
    description: {
      type: String,
      required: false,
      default: "",
    },
    automationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Flow",
      required: false,
      default: null,
    },
    logo: {
      type: String,
      default:
        "https://www.shutterstock.com/image-vector/vector-social-network-button-users-260nw-253724863.jpg",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    websiteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Website",
      required: false,
      default: null,
    },
    stats: {
      type: Object,
      required: false,
      default: {
        totalSubscribers: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

ListSchema.post("save", async function (doc) {
  if (doc.isNew) {
    try {
      const Website = mongoose.model("Website");
      const Stats = mongoose.model("Stats");
      // 1. Update the parent Website document
      await Website.findByIdAndUpdate(doc.websiteId, {
        $push: { lists: doc._id },
        $inc: { "stats.totalLists": 1 },
      });

      // 2. Update the global Stats document
      await Stats.findOneAndUpdate(
        { _id: "current" },
        { $inc: { totalLists: 1 } },
        { new: true, upsert: true }
      );
    } catch (error) {
      console.error(`Error in List post-save hook: ${error.message}`);
    }
  }
});

// Post-delete middleware to update website and global stats
ListSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    try {
      const Website = mongoose.model("Website");
      const Stats = mongoose.model("Stats");
      // 1. Update the parent Website document
      await Website.findByIdAndUpdate(doc.websiteId, {
        $pull: { lists: doc._id },
        $inc: { "stats.totalLists": -1 },
      });

      // 2. Update the global Stats document
      await Stats.findOneAndUpdate(
        { _id: "current" },
        { $inc: { totalLists: -1 } },
        { new: true }
      );
    } catch (error) {
      console.error(`Error in List post-delete hook: ${error.message}`);
    }
  }
});

export default mongoose.models.List || mongoose.model("List", ListSchema);