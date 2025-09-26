import dbConnect from "@/config/mongoConfig";
import Contact from "@/models/Contact";
import mongoose from "mongoose";
import { anyReqWithAuth } from "@/lib/withAuthFunctions";

export async function DELETE(req) {
  try {
    const authData = await anyReqWithAuth(req.headers);
    const customer = authData?.actorType === "customer" ? authData.customer : null;

    await dbConnect();

    const { contactId, action = "delete", updatedBy = "api" } = await req.json();

    if (!mongoose.isValidObjectId(contactId)) {
      return Response.json({ success: false, message: "Invalid contact ID" }, { status: 400 });
    }

    const contact = await Contact.findById(contactId);
    if (!contact) {
      return Response.json({ success: false, message: "Contact not found" }, { status: 404 });
    }

    const isLinked = contact.connectedCustomerIds.some(
      (id) => id.toString() === customer._id.toString()
    );
    if (!isLinked) {
      return Response.json({ success: false, message: "This contact is not linked to your account" });
    }

    /* ---------------------- SOFT DELETE ---------------------- */
    if (action === "soft_delete") {
      // Mark profile inactive
      let profile = contact.customerProfiles.find(
        (p) => p.customerId.toString() === customer._id.toString()
      );
      if (profile) {
        profile.isActive = false;
        profile.updatedAt = new Date();
      } else {
        contact.customerProfiles.push({
          customerId: customer._id,
          isActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Remove memberships & automations for this customer
      contact.listMemberships = contact.listMemberships.filter(
        (m) => m.customerId.toString() !== customer._id.toString()
      );
      contact.activeAutomations = contact.activeAutomations.filter(
        (a) => a.customerId.toString() !== customer._id.toString()
      );
      contact.automationHistory.forEach((h) => {
        if (h.customerId.toString() === customer._id.toString() && h.status === "active") {
          h.status = "cancelled";
          h.completedAt = new Date();
        }
      });

      contact.history.push({
        customerId: customer._id,
        type: "delete",
        message: `Soft deleted (profile inactive, lists/automations removed)`,
        data: { action: "soft_delete" },
        createdBy: updatedBy,
      });

      await contact.save();
      return Response.json({
        success: true,
        message: "Contact soft deleted for this customer",
        data: contact,
      });
    }

    /* ---------------------- HARD DELETE ---------------------- */
    if (action === "delete") {
      // Remove all references for this customer
      contact.connectedCustomerIds = contact.connectedCustomerIds.filter(
        (id) => id.toString() !== customer._id.toString()
      );
      contact.customerProfiles = contact.customerProfiles.filter(
        (p) => p.customerId.toString() !== customer._id.toString()
      );
      contact.customerEngagements = contact.customerEngagements.filter(
        (e) => e.customerId.toString() !== customer._id.toString()
      );
      contact.listMemberships = contact.listMemberships.filter(
        (m) => m.customerId.toString() !== customer._id.toString()
      );
      contact.activeAutomations = contact.activeAutomations.filter(
        (a) => a.customerId.toString() !== customer._id.toString()
      );
      contact.automationHistory.forEach((h) => {
        if (h.customerId.toString() === customer._id.toString()) {
          h.status = "cancelled";
          h.completedAt = new Date();
        }
      });

      contact.history.push({
        customerId: customer._id,
        type: "delete",
        message: `Hard deleted (unlinked completely for this customer)`,
        data: { action: "delete" },
        createdBy: updatedBy,
      });

      await contact.save();
      return Response.json({
        success: true,
        message: `Contact unlinked for customer ${customer._id}`,
      });
    }

    return Response.json({ success: false, message: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error("Delete contact error:", err);
    return Response.json(
      { success: false, message: "Internal server error", error: err.message },
      { status: 500 }
    );
  }
}
