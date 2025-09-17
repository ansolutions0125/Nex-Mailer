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
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
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

export default mongoose.models.List || mongoose.model("List", ListSchema);