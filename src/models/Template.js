import mongoose from "mongoose";

const TemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name for this Template."],
      trim: true,
    },
    html: {
      type: String,
      required: [true, "Please provide the HTML content for this template."],
    },
    subject: {
      type: String,
      required: [true, "Please provide a subject for this template."],
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Template ||
  mongoose.model("Template", TemplateSchema);
