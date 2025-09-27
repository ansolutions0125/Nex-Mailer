// models/Steps.js
import Contact from "@/models/Contact";
import EmailQueue from "@/models/EmailQueue";
import Stats from "@/models/Stats";
import axios from "axios";

/* ---------------------------------------------------------- */
/* Template variable replacement                              */
/* ---------------------------------------------------------- */
function replaceTemplateVariables(template, contact) {
  if (!template) return "";
  return template.replace(/\{\{\s*(email|fullName)\s*\}\}/g, (_, key) => {
    return key === "email" ? contact.email : contact.fullName || "";
  });
}

/* ---------------------------------------------------------- */
/* History helpers  (only touch real fields)                  */
/* ---------------------------------------------------------- */
async function updateAutomationStatus(contactId, automationAssoc, status) {
  const now = new Date();
  const historyEntry = {
    flowId: automationAssoc.automationId,
    listId: automationAssoc.listId || null,
    customerId: automationAssoc.customerId,
    startedAt: automationAssoc.startedAt,
    completedAt: now,
    status,
    stepsCompleted:
      automationAssoc.stepNumber ?? automationAssoc.currentStep ?? 0,
  };

  await Contact.updateOne(
    { _id: contactId },
    { $push: { automationHistory: historyEntry } }
  );
}

/* ---------------------------------------------------------- */
/* STEP PROCESSORS                                            */
/* ---------------------------------------------------------- */

export async function processWebhookStep(contact, automation, step) {
  try {
    const payload = {
      contact: {
        email: contact.email,
        fullName: contact.fullName,
        id: contact._id,
      },
      automation: {
        automationId: automation.automationId,
        stepNumber: automation.stepNumber,
      },
      timestamp: new Date().toISOString(),
    };

    const params = {};
    (step.queryParams || []).forEach((p) => {
      params[p.key] =
        p.type === "email"
          ? contact.email
          : replaceTemplateVariables(p.value, contact);
    });

    const cfg = {
      method: step.requestMethod || "POST",
      url: step.webhookUrl,
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    };
    cfg[step.requestMethod === "GET" ? "params" : "data"] = {
      ...payload,
      ...params,
    };

    await axios(cfg);
    await Stats.findOneAndUpdate(
      { _id: "current" },
      { $inc: { totalWebhooksSent: 1 } },
      { upsert: true }
    );
  } catch (err) {
    console.error(`Webhook failed for contact ${contact._id}:`, err.message);
    throw err;
  }
}

export async function processEmailStep(contact, automation, step, flow) {
  try {
    /* ---------- 1.  Decide WHICH customer is running this automation ---------- */
    const customerId = automation.customerId || flow.customerId; // both exist – pick one
    if (!customerId) throw new Error("No customer linked to this automation");

    /* ---------- 2.  Get plan → serverId ---------- */
    const plan = await mongoose.model("Plan").findOne({ customerId }).lean(); // PlanSchema has customerId
    let serverId = null;
    if (plan?.serverId) {
      serverId = plan.serverId; // customer-specific server
    } else {
      // Fallback: first global server (or null – queue worker can still pick later)
      const srv = await mongoose.model("Server").findOne().lean();
      serverId = srv?._id || null;
    }

    /* ---------- 3.  Write queue row ---------- */
    await EmailQueue.create({
      contactId: contact._id,
      serverId, // ← chosen above
      flowId: automation.automationId,
      listId: automation.listId || flow.listId,
      stepId: step._id.toString(),
      templateId: step.sendMailTemplate,
      email: contact.email,
      subject: replaceTemplateVariables(
        step.emailSubject || step.title || "No Subject",
        contact
      ),
      variables: new Map([
        ["fullName", contact.fullName || ""],
        ["email", contact.email],
      ]),
      status: "pending",
      nextAttempt: new Date(),
      metadata: {
        automationId: automation.automationId,
        stepNumber: automation.stepNumber,
      },
    });

    await Stats.findOneAndUpdate(
      { _id: "current" },
      { $inc: { totalMailSent: 1 } },
      { upsert: true }
    );
  } catch (err) {
    console.error(`Email step failed for contact ${contact._id}:`, err.message);
    throw err;
  }
}

export async function processMoveStep(contact, automation, step) {
  const listToMoveToId = step.targetListId;
  if (!listToMoveToId)
    throw new Error("Target list ID not specified for move step.");

  // (Optional) Add real list-membership update here in the future
  await updateAutomationStatus(contact._id, automation, "completed");
}

export async function processRemoveStep(contactId, automation, step) {
  const listToRemoveFromId = step.listToRemoveFrom;
  if (!listToRemoveFromId)
    throw new Error("Target list ID not specified for remove step.");

  // (Optional) Add real list-removal here in the future
  await updateAutomationStatus(contactId, automation, "completed");
}

export async function processDeleteStep(contactId, automation) {
  await Contact.updateOne({ _id: contactId }, { $set: { isActive: false } });
  await updateAutomationStatus(contactId, automation, "completed");
  await Stats.findOneAndUpdate(
    { _id: "current" },
    { $inc: { totalUsersDeleted: 1 } },
    { upsert: true }
  );
}
