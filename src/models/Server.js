import mongoose from "mongoose";

const ServerSchema = new mongoose.Schema(
  {
    presetId: {
      type: String,
      required: true,
    },
    logo: {
      type: String,
      required: false,
      default:
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQmP_C567B99oW1qwIYITjG9hQ6WIA2rHf2eg&s", // Add explicit default
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minLength: 1,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },

    description: {
      type: String,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    keys: {
      type: Object,
      required: true,
    },

    mailsSent: {
      type: Number,
      default: 0,
    },

    openRate: {
      type: Number,
      default: 0,
    },

    bounceRate: {
      type: Number,
      default: 0,
    },

    failedRate: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Server || mongoose.model("Server", ServerSchema);
