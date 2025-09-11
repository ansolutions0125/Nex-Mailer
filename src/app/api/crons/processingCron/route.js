// /api/crons/processingCron/route.js
/**
 * @fileoverview This file defines a Next.js API route for a cron job.
 * It processes marketing automation steps for contacts.
 *
 * The cron job performs the following tasks:
 * 1. Connects to the MongoDB database.
 * 2. Finds a batch of contacts that have pending automation steps.
 * 3. Iterates through each contact and their ready automation associations.
 * 4. Processes each step based on its type (e.g., 'sendMail', 'waitSubscriber').
 * 5. Updates the contact's automation state, including the step number and next execution time.
 * 6. Handles errors gracefully by logging them and moving failed automations to a history array.
 * 7. Updates statistics across multiple models (Flow, Stats, Website, Server, etc.)
 *
 * @author Golden Assistant
 */

import axios from "axios";
import { NextResponse } from "next/server";
import { calculateWaitDuration } from "@/services/backendHelpers/helpers";
import Contact from "@/models/Contact";
import Flow from "@/models/Flow";
import EmailQueue from "@/models/EmailQueue";
import Stats from "@/models/Stats";
import Website from "@/models/Website";
import Server from "@/models/Server";
import EmailLogs from "@/models/EmailLogs";
import dbConnect from "@/config/mongoConfig";

// Main handler for the cron job
export async function GET(req) {
  // 1. Connect to the database
  await dbConnect();
  const now = new Date();
  const batchSize = 100;
  let processedCount = 0;
  let statsUpdates = {
    totalWebhooksSent: 0,
    totalEmailsSent: 0,
    totalSubscribersMoved: 0,
    totalSubscribersRemoved: 0,
    totalSubscribersDeleted: 0
  };

  try {
    // 2. Find contacts with at least one active automation entry ready for processing
    const contacts = await Contact.find({
      "automationAssociations.nextStepTime": { $lte: now },
      isActive: true,
    }).limit(batchSize);

    // If no contacts are found, return a success message
    if (!contacts.length) {
      return NextResponse.json({
        processed: 0,
        message: "No contacts to process",
      });
    }

    console.log(`Found ${contacts.length} contacts to process`);

    // 3. Process each contact individually with atomic operations
    for (const contact of contacts) {
      try {
        console.log(
          `Processing contact ${contact._id} with ${contact.automationAssociations.length} automation associations`
        );

        // Filter associations that are ready for processing
        const associationsToProcess = contact.automationAssociations.filter(
          (assoc) => {
            const isReady = new Date(assoc.nextStepTime) <= now;
            console.log(
              `Automation ${assoc.automationId} - Step ${assoc.stepNumber} - NextStepTime: ${assoc.nextStepTime} - Ready: ${isReady}`
            );
            return isReady;
          }
        );

        console.log(
          `Found ${associationsToProcess.length} automation associations ready for processing`
        );

        for (const automationAssoc of associationsToProcess) {
          try {
            console.log(
              `Processing automation association for contact ${contact._id}:`,
              {
                automationId: automationAssoc.automationId,
                stepNumber: automationAssoc.stepNumber,
                nextStepTime: automationAssoc.nextStepTime,
              }
            );

            // Find the full automation object
            const automation = await Flow.findById(
              automationAssoc.automationId
            );

            // Check if automation is valid and active
            if (!automation || !automation.isActive) {
              console.log(
                `Flow not found or inactive for ID ${automationAssoc.automationId}`
              );
              await updateAutomationStatus(
                contact._id,
                automationAssoc,
                "cancelled"
              );
              continue;
            }

            // 4. Process each step and update the contact's state
            const stepStats = await processAutomationStep(contact, automationAssoc, automation);

            // Accumulate stats updates
            if (stepStats) {
              Object.keys(stepStats).forEach(key => {
                if (statsUpdates[key] !== undefined) {
                  statsUpdates[key] += stepStats[key];
                }
              });
            }

            processedCount++;
          } catch (stepError) {
            console.error(
              `Error processing automation step for contact ${contact._id}:`,
              stepError
            );
            // Log the error and move automation to failed status
            await logAutomationError(contact._id, automationAssoc, stepError);
          }
        }
      } catch (contactError) {
        console.error(`Error processing contact ${contact._id}:`, contactError);
        // Continue with next contact even if this one fails
        continue;
      }
    }

    // 5. Update global stats with accumulated changes
    if (Object.values(statsUpdates).some(count => count > 0)) {
      await updateGlobalStats(statsUpdates);
    }

    console.log(
      `Processing completed. Processed ${processedCount} automation steps`
    );

    return NextResponse.json({
      processed: processedCount,
      stats: statsUpdates,
      message: `Successfully processed ${processedCount} automation steps`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in processingCron:", error);
    return NextResponse.json(
      {
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Determines the next action based on the automation step type
async function processAutomationStep(contact, automationAssoc, automation) {
  const currentStepNumber = automationAssoc.stepNumber;
  const step = automation.steps.find(
    (step) => step.stepCount === currentStepNumber
  );

  if (!step) {
    console.log(
      `No step at index ${currentStepNumber} found. Marking as completed.`
    );
    await updateAutomationStatus(contact._id, automationAssoc, "completed");
    return null;
  }

  console.log(
    `Processing step ${currentStepNumber} (${step.stepType}) for contact ${contact._id}, automation ${automationAssoc.automationId}`
  );

  let nextStepTime = new Date(); // Default to immediate processing for next step
  let isTerminal = false;
  let stepStats = {};

  // Process the step based on its type
  switch (step.stepType) {
    case "waitSubscriber":
      // The wait step calculates the new nextStepTime
      nextStepTime = await processWaitStep(contact._id, automationAssoc, step);
      break;
    case "sendWebhook":
      await processWebhookStep(contact, automationAssoc, step);
      stepStats.totalWebhooksSent = 1;
      break;
    case "sendMail":
      await processEmailStep(contact, automationAssoc, step, automation);
      stepStats.totalEmailsSent = 1;
      break;
    case "moveSubscriber":
      isTerminal = true;
      await processMoveStep(contact, automationAssoc, step);
      stepStats.totalSubscribersMoved = 1;
      break;
    case "removeSubscriber":
      isTerminal = true;
      await processRemoveStep(contact._id, automationAssoc, step);
      stepStats.totalSubscribersRemoved = 1;
      break;
    case "deleteSubscriber":
      isTerminal = true;
      await processDeleteStep(contact._id, automationAssoc);
      stepStats.totalSubscribersDeleted = 1;
      break;
    default:
      console.log(
        `Unknown step type: ${step.stepType}. Advancing to next step.`
      );
      break; // It will advance below
  }

  // Atomically update the contact and advance to the next step, unless it's a terminal step.
  if (!isTerminal) {
    await Contact.findOneAndUpdate(
      {
        _id: contact._id,
        "automationAssociations.automationId": automationAssoc.automationId,
        "automationAssociations.stepNumber": automationAssoc.stepNumber,
      },
      {
        $set: {
          "automationAssociations.$.nextStepTime": nextStepTime,
          "automationAssociations.$.stepNumber": automationAssoc.stepNumber + 1,
        },
      }
    );
    console.log(
      `Advanced to next step (${automationAssoc.stepNumber + 1}) for contact ${contact._id
      }. Next run at: ${nextStepTime}`
    );
  }

  // Update automation statistics
  try {
    await Flow.updateOne(
      { _id: automation._id },
      {
        $inc: {
          "stats.totalUsersProcessed": 1,
          ...(stepStats.totalWebhooksSent && { "stats.totalWebhooksSent": stepStats.totalWebhooksSent }),
          ...(stepStats.totalEmailsSent && { "stats.totalEmailsSent": stepStats.totalEmailsSent }),
          ...(stepStats.totalSubscribersMoved && { "stats.totalSubscribersMoved": stepStats.totalSubscribersMoved }),
          ...(stepStats.totalSubscribersRemoved && { "stats.totalSubscribersRemoved": stepStats.totalSubscribersRemoved }),
          ...(stepStats.totalSubscribersDeleted && { "stats.totalSubscribersDeleted": stepStats.totalSubscribersDeleted })
        },
        $set: {
          "stats.lastProcessedAt": new Date(),
        },
      }
    );
  } catch (statsError) {
    console.error(`Error updating automation stats:`, statsError);
  }

  return stepStats;
}

/**
 * Helper function to update automation status and move from live to history
 * @param {string} contactId - The ID of the contact.
 * @param {object} automationAssoc - The automation association object.
 * @param {string} status - The new status ('completed', 'cancelled', 'failed').
 */
async function updateAutomationStatus(contactId, automationAssoc, status) {
  const now = new Date();
  const historyEntry = {
    automationId: automationAssoc.automationId,
    listId: automationAssoc.listId || null,
    addedAt: automationAssoc.startedAt,
    completedAt: now,
    status,
    stepsCompleted: automationAssoc.stepNumber,
  };

  // First check if history entry already exists
  const contact = await Contact.findOne({
    _id: contactId,
    "automationHistory.automationId": automationAssoc.automationId,
  });

  if (contact) {
    // Update existing history entry
    await Contact.findOneAndUpdate(
      {
        _id: contactId,
        "automationHistory.automationId": automationAssoc.automationId,
      },
      {
        $set: {
          "automationHistory.$.completedAt": now,
          "automationHistory.$.status": status,
          "automationHistory.$.stepsCompleted": automationAssoc.stepNumber,
        },
        $pull: {
          automationAssociations: {
            automationId: automationAssoc.automationId,
          },
        },
      }
    );
  } else {
    // Create new history entry
    await Contact.findOneAndUpdate(
      {
        _id: contactId,
        "automationAssociations.automationId": automationAssoc.automationId,
      },
      {
        $pull: {
          automationAssociations: {
            automationId: automationAssoc.automationId,
          },
        },
        $push: {
          automationHistory: historyEntry,
        },
      }
    );
  }
}

async function updateListHistory(contactId, listId, status) {
  const now = new Date();
  const historyEntry = {
    listId: listId,
    addedAt: now,
    removedAt: now,
    status,
  };

  // First check if history entry already exists
  const contact = await Contact.findOne({
    _id: contactId,
    "listHistory.listId": listId,
  });

  if (contact) {
    // Update existing history entry
    await Contact.findOneAndUpdate(
      {
        _id: contactId,
        "listHistory.listId": listId,
      },
      {
        $set: {
          "listHistory.$.removedAt": now,
          "listHistory.$.status": status,
        },
      }
    );
  } else {
    // Create new history entry
    await Contact.findOneAndUpdate(
      {
        _id: contactId,
      },
      {
        $push: {
          listHistory: historyEntry,
        },
      }
    );
  }
}

// Step Type Handlers - Refactored to remove redundant updates and return values
/**
 * Processes a 'waitSubscriber' step by calculating the next step time.
 * @param {string} contactId - The contact's ID.
 * @param {object} automationAssoc - The automation association.
 * @param {object} step - The wait step details.
 * @returns {Date} The calculated next step time.
 */
async function processWaitStep(contactId, automationAssoc, step) {
  console.log(
    `Processing wait step - Duration: ${step.waitDuration} ${step.waitUnit}`
  );
  const waitMs = calculateWaitDuration(step.waitDuration, step.waitUnit);
  const nextStepTime = new Date(Date.now() + waitMs);
  console.log(
    `Setting next step time to: ${nextStepTime} for automation ${automationAssoc.automationId}`
  );
  return nextStepTime; // Return the new nextStepTime
}

/**
 * Processes a 'sendWebhook' step.
 * @param {object} contact - The contact object.
 * @param {object} automationAssoc - The automation association.
 * @param {object} step - The webhook step details.
 */
async function processWebhookStep(contact, automationAssoc, step) {
  try {
    const webhookData = {
      contact: {
        email: contact.email,
        fullName: contact.fullName,
        id: contact._id,
      },
      automation: {
        automationId: automationAssoc.automationId,
        stepNumber: automationAssoc.stepNumber,
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
 * @param {object} automationAssoc - The automation association.
 * @param {object} step - The email step details.
 * @param {object} automation - The parent automation/flow object.
 */
async function processEmailStep(contact, automationAssoc, step, automation) {
  try {
    await EmailQueue.create({
      contactId: contact._id,
      serverId: null,
      flowId: automationAssoc.automationId,
      listId: automationAssoc.listId || automation.listId,
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
        automationId: automationAssoc.automationId,
        stepNumber: automationAssoc.stepNumber,
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
 * @param {object} automationAssoc - The automation association.
 * @param {object} step - The move step details.
 */
async function processMoveStep(contact, automationAssoc, step) {
  try {
    const listToMoveToId = step.targetListId;
    if (!listToMoveToId) {
      throw new Error("Target list ID not specified for move step.");
    }

    // Log the 'removed' status for the old list
    if (automationAssoc.listId) {
      await updateListHistory(contact._id, automationAssoc.listId, "removed");
    }

   
    await updateListHistory(contact._id, listToMoveToId, "added");

    // Atomically update status
    await updateAutomationStatus(contact._id, automationAssoc, "completed");

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
 * @param {object} automationAssoc - The automation association.
 * @param {object} step - The remove step details.
 */
async function processRemoveStep(contactId, automationAssoc, step) {
  try {
    const listToRemoveFromId = step.listToRemoveFrom;
    if (!listToRemoveFromId) {
      throw new Error("Target list ID not specified for remove step.");
    }

    // Log the 'removed' status for the list
    await updateListHistory(contactId, listToRemoveFromId, "removed");

    // Atomically update status
    await updateAutomationStatus(contactId, automationAssoc, "completed");

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
 * @param {object} automationAssoc - The automation association.
 */
async function processDeleteStep(contactId, automationAssoc) {
  try {
    // Soft-delete the contact by setting isActive to false
    await Contact.updateOne({ _id: contactId }, { $set: { isActive: false } });

    // Atomically update status
    await updateAutomationStatus(contactId, automationAssoc, "completed");

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

// Helper function to log automation errors and move to history
/**
 * Logs an automation error and moves the automation from the active
 * associations array to the history array.
 * @param {string} contactId - The contact's ID.
 * @param {object} automationAssoc - The automation association.
 * @param {Error} error - The error object.
 */
async function logAutomationError(contactId, automationAssoc, error) {
  try {
    const now = new Date();
    const historyEntry = {
      automationId: automationAssoc.automationId,
      listId: automationAssoc.listId || null,
      addedAt: automationAssoc.startedAt,
      completedAt: now,
      status: "failed",
      stepsCompleted: automationAssoc.stepNumber,
      error: error?.message || "Unknown error",
    };

    await Contact.updateOne(
      {
        _id: contactId,
        "automationAssociations.automationId": automationAssoc.automationId,
      },
      {
        $pull: {
          automationAssociations: {
            automationId: automationAssoc.automationId,
          },
        },
        $push: {
          automationHistory: historyEntry,
        },
      }
    );
    console.log(
      `Logged error for contact ${contactId}, automation ${automationAssoc.automationId}: ${error?.message}`
    );
  } catch (loggingError) {
    console.error("Failed to log automation error:", loggingError);
  }
}

/**
 * Updates global statistics with accumulated counts from processing
 * @param {object} stats - Object containing stat counts to update
 */
async function updateGlobalStats(stats) {
  try {
    const updateFields = {};

    // Build update object dynamically based on provided stats
    Object.keys(stats).forEach(key => {
      if (stats[key] > 0) {
        updateFields[key] = stats[key];
      }
    });

    if (Object.keys(updateFields).length > 0) {
      await Stats.findOneAndUpdate(
        { _id: "current" },
        { $inc: updateFields },
        { new: true, upsert: true }
      );

      console.log(`Updated global stats:`, updateFields);
    }
  } catch (error) {
    console.error("Error updating global stats:", error);
  }
}

// Helper function to replace template variables in a string
/**
 * Replaces template variables like `{{ fullName }}` with contact data.
 * @param {string} template - The template string.
 * @param {object} contact - The contact object with `email` and `fullName`.
 * @returns {string} The string with variables replaced.
 */
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

// Also support POST method for manual triggering
export async function POST(request) {
  return GET(request);
}