// models/Contact.js
import mongoose from "mongoose";
import validator from "validator";

const { Schema } = mongoose;

/* ------------------------- Subdocuments ------------------------- */

// Per-customer profile (identity + state)
const CustomerProfileSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    fullName: { type: String, trim: true }, // per-customer display name
    isActive: { type: Boolean, default: true }, // can be deactivated by this customer
    location: {
      country: { type: String, trim: true },
      city: { type: String, trim: true },
    },
    tags: [{ type: String, trim: true }], // customer-specific tags/segments
    createdAt: { type: Date, default: () => new Date() },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

// Per-customer engagement overlay
const CustomerEngagementSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    totalSent: { type: Number, default: 0 },
    totalDelivered: { type: Number, default: 0 },
    totalOpened: { type: Number, default: 0 },
    totalClicked: { type: Number, default: 0 },
    openRate: { type: Number, default: 0 },
    clickRate: { type: Number, default: 0 },
    engagementScore: { type: Number, default: 50, min: 0, max: 100 },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

// Current list memberships
const ListMembershipSchema = new Schema(
  {
    listId: { type: Schema.Types.ObjectId, ref: "List", required: true },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    isSubscribed: { type: Boolean, default: true },
    subscribedAt: { type: Date, default: () => new Date() },
    unsubscribedAt: { type: Date, default: null },
    source: {
      type: String,
      enum: ["manual", "import", "api", "form", "automation", "campaign"],
      default: "manual",
    },
  },
  { _id: false }
);

// Automation participation (active + history)
const AutomationHistorySchema = new Schema(
  {
    flowId: { type: Schema.Types.ObjectId, ref: "Flow", required: true },
    listId: { type: Schema.Types.ObjectId, ref: "List", required: true },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["active", "completed", "paused", "failed", "cancelled"],
      default: "active",
    },
    stepsCompleted: { type: Number, default: 0 },
  },
  { _id: false }
);

// Active Automations (active)
const ActiveAutomationsSchema = new Schema({
  automationId: { type: Schema.Types.ObjectId, ref: "Flow", required: true },
  listId: { type: Schema.Types.ObjectId, ref: "List", required: true }, // The list this automation was triggered from
  customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
  startedAt: { type: Date, required: true },
  completedAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ["active", "completed", "paused", "failed", "cancelled", "waiting"],
    default: "active",
  },
  stepsCompleted: { type: Number, default: 0 },
  currentStep: { type: Number, default: 0 }, // Index of the current step in the flow's steps array
  nextStepAt: { type: Date, default: null }, // When the next step should be processed (for wait steps)
});

// General history log (always customer-scoped)
const HistorySchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    type: { type: String, required: true }, // subscription, automation, update, delete
    message: { type: String },
    data: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: () => new Date() },
    createdBy: { type: String, default: "system" },
  },
  { _id: false }
);

// Custom fields for future-proofing (customer-specific)
const CustomFieldSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    key: { type: String, trim: true },
    value: Schema.Types.Mixed,
  },
  { _id: false }
);

/* ------------------------- Main Schema ------------------------- */

const ContactSchema = new Schema(
  {
    // 🔑 Global identity (cannot clash)
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (value) => validator.isEmail(value),
        message: "Please provide a valid email address.",
      },
    },

    // Global "do not contact" flag (e.g. GDPR/Unsubscribe from all customers)
    globalOptOut: { type: Boolean, default: false },

    // Which customers have access to this contact
    connectedCustomerIds: [{ type: Schema.Types.ObjectId, ref: "Customer" }],

    // Per-customer overlays
    customerProfiles: { type: [CustomerProfileSchema], default: [] },
    customerEngagements: { type: [CustomerEngagementSchema], default: [] },

    // Lists + automations
    listMemberships: { type: [ListMembershipSchema], default: [] },
    automationHistory: { type: [AutomationHistorySchema], default: [] },
    activeAutomations: { type: [ActiveAutomationsSchema], default: [] },

    // Audit logs + custom fields
    history: { type: [HistorySchema], default: [] },
    customFields: { type: [CustomFieldSchema], default: [] },

    createdBy: { type: String, default: "system" },
    updatedBy: { type: String, default: "system" },
  },
  { timestamps: true }
);

/* ------------------------- Indexes ------------------------- */

ContactSchema.index({ email: 1 }, { unique: true });
ContactSchema.index({ connectedCustomerIds: 1 });
ContactSchema.index({ "customerProfiles.customerId": 1 });
ContactSchema.index({ "customerEngagements.customerId": 1 });
ContactSchema.index({
  "listMemberships.listId": 1,
  "listMemberships.customerId": 1,
}); // For finding contacts in a specific list for a customer
ContactSchema.index({
  "automationHistory.flowId": 1,
  "automationHistory.customerId": 1,
}); // For finding contacts that have gone through a specific automation for a customer
ContactSchema.index({
  "activeAutomations.automationId": 1,
  "activeAutomations.customerId": 1,
  "activeAutomations.status": 1,
}); // For finding active automations for a customer

export default mongoose.models.Contact ||
  mongoose.model("Contact", ContactSchema);
