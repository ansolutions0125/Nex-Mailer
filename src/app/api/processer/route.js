// app/api/cron/processer/route.js  (Next.js 13+ App Router – JS)
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/config/mongoConfig";
import Contact from "@/models/Contact";
import Flow from "@/models/Flow";
import {
  processWebhookStep,
  processEmailStep,
  processMoveStep,
  processRemoveStep,
  processDeleteStep,
} from "./Steps";
import { getProcessingSettings } from "@/services/getProcessingSettings";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Atomic: move finished automation → history */
async function graduateAutomationToHistory(contactId, automationDoc) {
  const now = new Date();
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1.  Pull from active array
    await Contact.updateOne(
      { _id: contactId },
      { $pull: { activeAutomations: { _id: automationDoc._id } } },
      { session }
    );

    // 2.  Update existing history item (or create if somehow missing)
    const match = {
      _id: contactId,
      'automationHistory.flowId': automationDoc.automationId,
      'automationHistory.customerId': automationDoc.customerId,
    };

    const update = {
      $set: {
        'automationHistory.$.status': 'completed',
        'automationHistory.$.completedAt': now,
        'automationHistory.$.stepsCompleted':
          automationDoc.stepsCompleted ?? automationDoc.currentStep ?? 0,
      },
    };

    const res = await Contact.updateOne(match, update, { session });
    // if no array element matched, push a new one (fallback)
    if (res.matchedCount === 0) {
      const newEntry = {
        flowId: automationDoc.automationId,
        listId: automationDoc.listId,
        customerId: automationDoc.customerId,
        startedAt: automationDoc.startedAt,
        completedAt: now,
        status: 'completed',
        stepsCompleted: automationDoc.stepsCompleted ?? automationDoc.currentStep ?? 0,
      };
      await Contact.updateOne(
        { _id: contactId },
        { $push: { automationHistory: newEntry } },
        { session }
      );
    }

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/** Process one contact + one active automation step */
async function processContactAutomation(contact, automation, settings) {
  try {
    const flow = await Flow.findById(automation.automationId).lean();
    if (!flow) throw new Error(`Flow ${automation.automationId} not found`);

    const step = flow.steps[automation.currentStep];
    let isTerminal = false; // will be true when we finish (success or failure)

    if (!step) {
      isTerminal = true;
    } else {
      // Execute step
      switch (step.stepType) {
        case "sendWebhook":
          if (settings.processWebhookInProcess) {
            await processWebhookStep(contact, automation, step);
          }
          break;
        case "sendMail":
          await processEmailStep(contact, automation, step, flow);
          break;
        case "moveSubscriber":
          await processMoveStep(contact, automation, step);
          isTerminal = true;
          break;
        case "removeSubscriber":
          await processRemoveStep(contact._id, automation, step);
          isTerminal = true;
          break;
        case "deleteSubscriber":
          await processDeleteStep(contact._id, automation);
          isTerminal = true;
          break;
        default:
          throw new Error(`Unknown step type ${step.stepType}`);
      }
    }

    // Advance pointer (or complete)
    const nextStepIndex = automation.currentStep + 1;
    const isLast = nextStepIndex >= flow.steps.length;
    const waitStep = flow.steps[nextStepIndex];

    const update = {
      "activeAutomations.$.currentStep": nextStepIndex,
      "activeAutomations.$.stepsCompleted": nextStepIndex,
      "activeAutomations.$.updatedAt": new Date(),
    };

    if (isLast || isTerminal) {
      update["activeAutomations.$.status"] = "completed";
      update["activeAutomations.$.completedAt"] = new Date();
      update["activeAutomations.$.nextStepAt"] = null;
    } else if (waitStep?.stepType === "waitSubscriber") {
      const delayMs =
        waitStep.waitUnit === "seconds"
          ? waitStep.waitDuration * 1000
          : waitStep.waitUnit === "minutes"
          ? waitStep.waitDuration * 60 * 1000
          : waitStep.waitUnit === "hours"
          ? waitStep.waitDuration * 60 * 60 * 1000
          : waitStep.waitUnit === "days"
          ? waitStep.waitDuration * 24 * 60 * 60 * 1000
          : /* weeks */ waitStep.waitDuration * 7 * 24 * 60 * 60 * 1000;
      update["activeAutomations.$.nextStepAt"] = new Date(Date.now() + delayMs);
    } else {
      update["activeAutomations.$.nextStepAt"] = new Date();
    }

    await Contact.updateOne(
      { _id: contact._id, "activeAutomations._id": automation._id },
      { $set: update }
    );

    // Graduate to history when finished
    if (update["activeAutomations.$.status"] === "completed") {
      await graduateAutomationToHistory(contact._id, automation);
    }
  } catch (err) {
    console.error(
      `Error processing contact ${contact._id} automation ${automation._id}:`,
      err
    );

    const maxAttempts = 3;
    if ((automation.attempts || 0) < maxAttempts) {
      await Contact.updateOne(
        { _id: contact._id, "activeAutomations._id": automation._id },
        {
          $inc: { "activeAutomations.$.attempts": 1 },
          $set: {
            "activeAutomations.$.status": "active",
            "activeAutomations.$.nextStepAt": new Date(
              Date.now() + settings.defaultRetryDelaySeconds * 1000
            ),
          },
        }
      );
    } else {
      await Contact.updateOne(
        { _id: contact._id, "activeAutomations._id": automation._id },
        {
          $set: {
            "activeAutomations.$.status": "failed",
            "activeAutomations.$.completedAt": new Date(),
          },
        }
      );
      // Graduate failed runs too
      await graduateAutomationToHistory(contact._id, automation);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Cron handler                                                       */
/* ------------------------------------------------------------------ */

export async function GET(req) {
  await dbConnect();
  const settings = await getProcessingSettings();
  const now = new Date();

  let processed = 0;
  let hasMore = true;

  while (hasMore) {
    const contacts = await Contact.aggregate([
      {
        $match: {
          "activeAutomations.nextStepAt": { $lte: now },
          "activeAutomations.status": "active",
        },
      },
      { $unwind: "$activeAutomations" },
      {
        $match: {
          "activeAutomations.nextStepAt": { $lte: now },
          "activeAutomations.status": "active",
        },
      },
      { $limit: settings.fetchBatchSizePerProcess },
      {
        $group: {
          _id: "$_id",
          doc: { $first: "$$ROOT" },
          automations: { $push: "$activeAutomations" },
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: ["$doc", { activeAutomations: "$automations" }],
          },
        },
      },
    ]);

    hasMore = contacts.length === settings.fetchBatchSizePerProcess;

    const concurrency = settings.maxConcurrentProcesses || 5;
    const queue = [...contacts];
    const running = [];

    const consume = async () => {
      while (queue.length) {
        const contact = queue.shift();
        for (const automation of contact.activeAutomations) {
          await processContactAutomation(
            contact,
            { ...automation, stepNumber: automation.currentStep },
            settings
          );
          processed++;
          if (!settings.enableFlowParallelism) await sleep(50);
        }
      }
    };

    for (let i = 0; i < concurrency; i++) running.push(consume());
    await Promise.all(running);
  }

  return NextResponse.json({ success: true, processed });
}
