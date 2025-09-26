import Stats from "@/models/Stats";

function replaceTemplateVariables(template, contact) {
  if (!template) return "";
  return template.replace(/\{\{\s*(email|fullName)\s*\}\}/g, (match, p1) => {
    switch (p1) {
      case "email":
        return contact.email;
      case "fullName":
        return contact.fullName;
      default:
        return match;
    }
  });
}

/**
 * Processes a 'sendWebhook' step.
 * @param {object} contact - The contact object.
 * @param {object} automation - The automation association.
 * @param {object} step - The webhook step details.
 */
export async function processWebhookStep(contact, automation, step) {
  try {
    const webhookData = {
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
    if (step.queryParams && step.queryParams.length > 0) {
      for (const param of step.queryParams) {
        if (param.type === "email") {
          params[param.key] = contact.email;
        } else {
          params[param.key] = replaceTemplateVariables(param.value, contact);
        }
      }
    }
    const config = {
      method: step.requestMethod || "POST",
      url: step.webhookUrl,
      headers: { "Content-Type": "application/json" },
      timeout: 30000,
    };
    if (step.requestMethod === "GET") {
      config.params = params;
    } else {
      config.data = { ...webhookData, ...params };
    }
    await axios(config);
    console.log(`Webhook sent successfully for contact ${contact._id}`);

    // Update global webhook stats
    await Stats.findOneAndUpdate(
      { _id: "current" },
      { $inc: { totalWebhooksSent: 1 } },
      { new: true, upsert: true }
    );
  } catch (error) {
    console.error(`Webhook failed for contact ${contact._id}:`, error.message);
    throw error;
  }
}

/**
 * Processes a 'sendMail' step by creating an email queue entry.
 * @param {object} contact - The contact object.
 * @param {object} automation - The automation association.
 * @param {object} step - The email step details.
 * @param {object} automation - The parent automation/flow object.
 */
export async function processEmailStep(
  contact,
  automation,
  step,
  automation
) {
  try {
    await EmailQueue.create({
      contactId: contact._id,
      serverId: null,
      flowId: automation.automationId,
      listId: automation.listId || automation.listId,
      stepId: step._id.toString(),
      templateId: step.sendMailTemplate,
      email: contact.email,
      subject: replaceTemplateVariables(
        step.emailSubject || step.title || "No Subject",
        contact
      ),
      variables: new Map([
        ["fullName", contact.fullName || ""],
        ["email", contact.email || ""],
      ]),
      status: "pending",
      nextAttempt: new Date(),
      metadata: {
        automationId: automation.automationId,
        stepNumber: automation.stepNumber,
      },
    });
    console.log(`Email queued successfully for contact ${contact._id}`);

    // Update global email stats
    await Stats.findOneAndUpdate(
      { _id: "current" },
      { $inc: { totalMailSent: 1 } },
      { new: true, upsert: true }
    );
  } catch (error) {
    console.error(
      `Email step failed for contact ${contact._id}:`,
      error.message
    );
    throw error;
  }
}

/**
 * Processes a 'moveSubscriber' step. This is a terminal step.
 * @param {object} contact - The contact object.
 * @param {object} automation - The automation association.
 * @param {object} step - The move step details.
 */
export async function processMoveStep(contact, automation, step) {
  try {
    const listToMoveToId = step.targetListId;
    if (!listToMoveToId) {
      throw new Error("Target list ID not specified for move step.");
    }

    // Log the 'removed' status for the old list
    if (automation.listId) {
      await updateListHistory(contact._id, automation.listId, "removed");
    }

    await updateListHistory(contact._id, listToMoveToId, "added");

    // Atomically update status
    await updateAutomationStatus(contact._id, automation, "completed");

    console.log(
      `Contact ${contact._id} moved to list ${listToMoveToId} and automation completed.`
    );
  } catch (error) {
    console.error(
      `Move step failed for contact ${contact._id}:`,
      error.message
    );
    throw error;
  }
}

/**
 * Processes a 'removeSubscriber' step. This is a terminal step.
 * @param {string} contactId - The contact's ID.
 * @param {object} automation - The automation association.
 * @param {object} step - The remove step details.
 */
export async function processRemoveStep(contactId, automation, step) {
  try {
    const listToRemoveFromId = step.listToRemoveFrom;
    if (!listToRemoveFromId) {
      throw new Error("Target list ID not specified for remove step.");
    }

    // Log the 'removed' status for the list
    await updateListHistory(contactId, listToRemoveFromId, "removed");

    // Atomically update status
    await updateAutomationStatus(contactId, automation, "completed");

    console.log(
      `Contact ${contactId} removed from list ${listToRemoveFromId} and automation completed.`
    );
  } catch (error) {
    console.error(
      `Remove step failed for contact ${contactId}:`,
      error.message
    );
    throw error;
  }
}

/**
 * Processes a 'deleteSubscriber' step. This is a terminal step.
 * @param {string} contactId - The contact's ID.
 * @param {object} automation - The automation association.
 */
export async function processDeleteStep(contactId, automation) {
  try {
    // Soft-delete the contact by setting isActive to false
    await Contact.updateOne({ _id: contactId }, { $set: { isActive: false } });

    // Atomically update status
    await updateAutomationStatus(contactId, automation, "completed");

    // Update global stats for deleted users
    await Stats.findOneAndUpdate(
      { _id: "current" },
      { $inc: { totalUsersDeleted: 1 } },
      { new: true, upsert: true }
    );

    console.log(`Contact ${contactId} soft-deleted and automation completed.`);
  } catch (error) {
    console.error(
      `Delete step failed for contact ${contactId}:`,
      error.message
    );
    throw error;
  }
}
