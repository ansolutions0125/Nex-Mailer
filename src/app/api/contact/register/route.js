import dbConnect from "@/config/mongoConfig";
import Contact from "@/models/Contact";
import List from "@/models/List";
import Flow from "@/models/Flow";
import Stats from "@/models/Stats";
import { calculateWaitDuration } from "@/services/backendHelpers/helpers";
import { anyReqWithAuth } from "@/lib/withAuthFunctions";

export async function POST(req) {
  try {
    const authData = await anyReqWithAuth(req.headers);
    const customer =
      authData?.actorType === "customer" ? authData.customer : null;
    await dbConnect();

    if (!customer?._id) {
      return Response.json(
        { success: false, message: "Customer not found" },
        { status: 404 }
      );
    }

    const {
      fullName,
      first_name,
      last_name,
      email,
      listId,
      source = "api",
      createdBy = "api",
    } = await req.json();

    const resolvedFullName =
      fullName ||
      (first_name && last_name ? `${first_name} ${last_name}` : null);

    if (!resolvedFullName || !email?.trim()) {
      return Response.json(
        { success: false, message: "Name and email are required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email?.trim())) {
      return Response.json(
        { success: false, message: "Invalid email format" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    let contact = await Contact.findOne({ email: normalizedEmail });

    // ─── Existing contact ───
    if (contact) {
      // Link customer
      if (
        !contact.connectedCustomerIds.some(
          (id) => id.toString() === customer._id.toString()
        )
      ) {
        contact.connectedCustomerIds.push(customer._id);
      }

      // Upsert profile
      let profile = contact.customerProfiles.find(
        (p) => p.customerId.toString() === customer._id.toString()
      );
      if (!profile) {
        contact.customerProfiles.push({
          customerId: customer._id,
          fullName: resolvedFullName,
          isActive: true,
        });
      } else {
        profile.fullName = resolvedFullName;
        profile.isActive = true;
        profile.updatedAt = new Date();
      }

      // Upsert engagement record
      if (
        !contact.customerEngagements.some(
          (e) => e.customerId.toString() === customer._id.toString()
        )
      ) {
        contact.customerEngagements.push({ customerId: customer._id });
      }

      // Optional: subscribe to list
      if (listId) {
        await handleListAndAutomation(
          contact,
          listId,
          customer._id,
          source,
          createdBy
        );
      }

      await contact.save();
      return Response.json({
        success: true,
        message: "Contact updated successfully",
        data: contact,
      });
    }

    // ─── New contact ───
    const newContactData = {
      email: normalizedEmail,
      connectedCustomerIds: [customer._id],
      customerProfiles: [
        {
          customerId: customer._id,
          fullName: resolvedFullName,
          isActive: true,
        },
      ],
      customerEngagements: [{ customerId: customer._id }],
      history: [],
      activeAutomations: [], // ✅ FIXED
      automationHistory: [], // ✅ FIXED
    };

    if (listId) {
      const list = await List.findById(listId).populate("automationId");
      if (list) {
        newContactData.listMemberships = [
          {
            listId,
            customerId: customer._id,
            isSubscribed: true,
            subscribedAt: new Date(),
            source,
          },
        ];
        newContactData.history.push({
          customerId: customer._id,
          type: "subscription",
          message: `Subscribed to list ${listId}`,
          data: { listId },
          createdBy,
        });

        if (list.automationId) {
          const { activeData, historyData } = buildAutomationData(
            list.automationId,
            list._id,
            customer._id
          );
          newContactData.activeAutomations.push(activeData);
          newContactData.automationHistory.push(historyData);
        }
      }
    }

    await Stats.findOneAndUpdate(
      { _id: "current" },
      { $inc: { totalUsers: 1 } },
      { upsert: true }
    );

    contact = await Contact.create(newContactData);
    return Response.json(
      { success: true, message: "Contact created successfully", data: contact },
      { status: 201 }
    );
  } catch (err) {
    console.error("Register contact error:", err);
    return Response.json(
      { success: false, message: "Internal server error", error: err.message },
      { status: 500 }
    );
  }
}

/**
 * Build automation entry for both activeAutomations & automationHistory
 */
function buildAutomationData(flow, listId, customerId) {
  const firstStep = flow.steps.find((s) => s.stepCount === 1);

  // Active automations entry
  const activeData = {
    automationId: flow._id,
    listId,
    customerId,
    startedAt: new Date(),
    status: "active",
    stepsCompleted: 0,
    currentStep: 1,
    nextStepAt: null,
  };

  if (firstStep?.stepType === "waitSubscriber") {
    const waitMs = calculateWaitDuration(
      firstStep.waitDuration,
      firstStep.waitUnit
    );
    if (waitMs > 0) {
      activeData.nextStepAt = new Date(Date.now() + waitMs);
    }
  }

  // Automation history entry (requires flowId instead of automationId)
  const historyData = {
    flowId: flow._id,
    listId,
    customerId,
    startedAt: activeData.startedAt,
    status: "active",
    stepsCompleted: 0,
  };

  return { activeData, historyData };
}

/**
 * Handle list subscription + automation linking for existing contacts
 */
async function handleListAndAutomation(
  contact,
  listId,
  customerId,
  source,
  createdBy
) {
  const list = await List.findById(listId).populate("automationId");
  if (!list) return;

  const existing = contact.listMemberships.find(
    (m) =>
      m.listId.toString() === listId &&
      m.customerId.toString() === customerId.toString()
  );
  if (existing) return;

  contact.listMemberships.push({
    listId,
    customerId,
    isSubscribed: true,
    subscribedAt: new Date(),
    source,
  });
  contact.history.push({
    customerId,
    type: "subscription",
    message: `Subscribed to list ${listId}`,
    data: { listId },
    createdBy,
  });

  if (list.automationId) {
    const { activeData, historyData } = buildAutomationData(
      list.automationId,
      list._id,
      customerId
    );
    contact.activeAutomations.push(activeData);
    contact.automationHistory.push(historyData);
  }
}
