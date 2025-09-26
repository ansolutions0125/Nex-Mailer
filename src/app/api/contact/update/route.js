import dbConnect from "@/config/mongoConfig";
import Contact from "@/models/Contact";
import List from "@/models/List";
import Flow from "@/models/Flow";
import mongoose from "mongoose";
import { calculateWaitDuration } from "@/services/backendHelpers/helpers";
import { anyReqWithAuth } from "@/lib/withAuthFunctions";

export async function PATCH(req) {
  try {
    const authData = await anyReqWithAuth(req.headers);
    const customer =
      authData?.actorType === "customer" ? authData.customer : null;

    await dbConnect();

    const {
      action,
      contactId,
      listId,
      fullName,
      currentListId,
      newListId,
      source = "api",
      updatedBy = "api",
    } = await req.json();

    if (!mongoose.isValidObjectId(contactId)) {
      return Response.json(
        { success: false, message: "Invalid contact ID" },
        { status: 400 }
      );
    }

    const contact = await Contact.findById(contactId);
    if (!contact)
      return Response.json(
        { success: false, message: "Contact not found" },
        { status: 404 }
      );

    const linked = contact.connectedCustomerIds.some(
      (id) => id.toString() === customer._id.toString()
    );
    if (!linked) {
      return Response.json({
        success: false,
        message: "This contact is not linked to your account",
      });
    }

    switch (action) {
      /* ------------------------- CHANGE NAME ------------------------- */
      case "change_name": {
        if (!fullName?.trim()) {
          return Response.json(
            { success: false, message: "Full name is required" },
            { status: 400 }
          );
        }

        let profile = contact.customerProfiles.find(
          (p) => p.customerId.toString() === customer._id.toString()
        );
        if (!profile) {
          contact.customerProfiles.push({
            customerId: customer._id,
            fullName: fullName.trim(),
            isActive: true,
          });
        } else {
          profile.fullName = fullName.trim();
          profile.updatedAt = new Date();
        }

        contact.history.push({
          customerId: customer._id,
          type: "update",
          message: "Changed contact name",
          data: { fullName },
          createdBy: updatedBy,
        });
        break;
      }

      /* ------------------------- ADD TO LIST ------------------------- */
      case "add_to_list": {
        if (!mongoose.isValidObjectId(listId)) {
          return Response.json(
            { success: false, message: "Invalid list ID" },
            { status: 400 }
          );
        }
        const list = await List.findById(listId).populate("automationId");
        if (!list)
          return Response.json(
            { success: false, message: "List not found" },
            { status: 404 }
          );

        const exists = contact.listMemberships.find(
          (m) =>
            m.listId.toString() === listId &&
            m.customerId.toString() === customer._id.toString()
        );
        if (exists) {
          return Response.json(
            { success: false, message: "Already subscribed" },
            { status: 409 }
          );
        }

        contact.listMemberships.push({
          listId,
          customerId: customer._id,
          isSubscribed: true,
          subscribedAt: new Date(),
          source,
        });
        contact.listHistory.push({
          listId,
          customerId: customer._id,
          subscribedAt: new Date(),
          source,
        });
        contact.history.push({
          customerId: customer._id,
          type: "subscription",
          message: `Subscribed to list ${listId}`,
          data: { listId },
          createdBy: updatedBy,
        });

        if (list.automationId) {
          await addAutomation(contact, list, customer._id, updatedBy);
        }
        break;
      }

      /* ---------------------- UNSUBSCRIBE FROM LIST ---------------------- */
      case "unsubscribe_from_list": {
        if (!mongoose.isValidObjectId(listId)) {
          return Response.json(
            { success: false, message: "Invalid list ID" },
            { status: 400 }
          );
        }

        const membershipsToRemove = contact.listMemberships.filter(
          (m) =>
            m.listId.toString() === listId &&
            m.customerId.toString() === customer._id.toString()
        );
        if (membershipsToRemove.length === 0) {
          return Response.json(
            { success: false, message: "Not subscribed to this list" },
            { status: 409 }
          );
        }

        // Remove memberships
        contact.listMemberships = contact.listMemberships.filter(
          (m) =>
            !(
              m.listId.toString() === listId &&
              m.customerId.toString() === customer._id.toString()
            )
        );

        // Archive to history
        membershipsToRemove.forEach((m) =>
          contact.listHistory.push({
            listId,
            customerId: customer._id,
            subscribedAt: m.subscribedAt,
            unsubscribedAt: new Date(),
            source: m.source,
          })
        );

        // Remove active automations tied to this list
        const beforeCount = contact.activeAutomations.length;
        contact.activeAutomations = contact.activeAutomations.filter(
          (a) =>
            !(
              a.customerId.toString() === customer._id.toString() &&
              a.listId?.toString() === listId
            )
        );
        const cancelledCount = beforeCount - contact.activeAutomations.length;

        // Cancel automation history
        contact.automationHistory.forEach((h) => {
          if (
            h.customerId.toString() === customer._id.toString() &&
            h.listId.toString() === listId &&
            h.status === "active"
          ) {
            h.status = "cancelled";
            h.completedAt = new Date();
          }
        });

        contact.history.push({
          customerId: customer._id,
          type: "subscription",
          message: `Unsubscribed from list ${listId} (cancelled ${cancelledCount} automations)`,
          data: { listId },
          createdBy: updatedBy,
        });
        break;
      }

      /* ------------------------- CHANGE LIST ------------------------- */
      case "change_list": {
        if (
          !mongoose.isValidObjectId(currentListId) ||
          !mongoose.isValidObjectId(newListId)
        ) {
          return Response.json(
            { success: false, message: "Invalid list IDs" },
            { status: 400 }
          );
        }

        // Remove current membership
        contact.listMemberships = contact.listMemberships.filter(
          (m) =>
            !(
              m.listId.toString() === currentListId &&
              m.customerId.toString() === customer._id.toString()
            )
        );
        contact.listHistory.push({
          listId: currentListId,
          customerId: customer._id,
          unsubscribedAt: new Date(),
          source: "change_list",
        });

        // Add new membership
        contact.listMemberships.push({
          listId: newListId,
          customerId: customer._id,
          isSubscribed: true,
          subscribedAt: new Date(),
          source,
        });
        contact.listHistory.push({
          listId: newListId,
          customerId: customer._id,
          subscribedAt: new Date(),
          source,
        });

        contact.history.push({
          customerId: customer._id,
          type: "subscription",
          message: `Moved from list ${currentListId} → ${newListId}`,
          data: { currentListId, newListId },
          createdBy: updatedBy,
        });

        const newList = await List.findById(newListId).populate("automationId");
        if (newList?.automationId) {
          await addAutomation(contact, newList, customer._id, updatedBy);
        }
        break;
      }

      default:
        return Response.json(
          { success: false, message: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    await contact.save();
    return Response.json({
      success: true,
      message: `Contact updated successfully (${action})`,
      data: contact,
    });
  } catch (err) {
    console.error("Update contact error:", err);
    return Response.json(
      { success: false, message: "Internal server error", error: err.message },
      { status: 500 }
    );
  }
}

async function addAutomation(contact, list, customerId, createdBy) {
  const automation = list.automationId;
  const alreadyActive = contact.activeAutomations.find(
    (a) =>
      a.flowId.toString() === automation._id.toString() &&
      a.customerId.toString() === customerId.toString()
  );
  if (alreadyActive) return;

  const firstStep = automation.steps.find((s) => s.stepCount === 1);
  const automationData = {
    flowId: automation._id,
    listId: list._id,
    customerId,
    currentStep: 1,
    startedAt: new Date(),
    scheduledAt: new Date(),
  };
  if (firstStep?.stepType === "waitSubscriber") {
    const waitMs = calculateWaitDuration(
      firstStep.waitDuration,
      firstStep.waitUnit
    );
    if (waitMs > 0) {
      automationData.scheduledAt = new Date(Date.now() + waitMs);
      automationData.currentStep = 2;
    }
  }

  contact.activeAutomations.push(automationData);
  contact.automationHistory.push({ ...automationData, status: "active" });
  contact.history.push({
    customerId,
    type: "automation",
    message: `Joined automation ${automation._id}`,
    data: { automationId: automation._id, listId: list._id },
    createdBy,
  });

  await Flow.findByIdAndUpdate(automation._id, {
    $inc: { "stats.totalUsersProcessed": 1 },
  });
}
