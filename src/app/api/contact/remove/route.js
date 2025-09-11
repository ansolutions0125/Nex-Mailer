// file: /api/contact/remove/route.js | next.js 13+ api Route
import dbConnect from "@/config/mongoConfig";
import Contact from "@/models/Contact";
import Website from "@/models/Website";
import Stats from "@/models/Stats";
import mongoose from "mongoose";

/**
 * @desc Handles the deletion of a contact.
 * @route DELETE /api/contact/remove
 * @param {object} req - The request object.
 * @returns {object} The response object with success status and message.
 */
export async function DELETE(req) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const contactId = searchParams.get("contactId");
        const hardDelete = searchParams.get("hardDelete") === "true";

        if (!contactId || !mongoose.isValidObjectId(contactId)) {
            return Response.json(
                { success: false, message: "Valid contact ID is required" },
                { status: 400 }
            );
        }

        if (hardDelete) {
            const contactToDelete = await Contact.findById(contactId);
            if (!contactToDelete) {
                return Response.json(
                    { success: false, message: "Contact not found" },
                    { status: 404 }
                );
            }
            const deletedContact = await Contact.findByIdAndDelete(contactId);
            // Update global stats for a hard-deleted user
            await Stats.findOneAndUpdate(
                { _id: "current" },
                { $inc: { totalUsersDeleted: 1 } },
                { new: true, upsert: true }
            );

            // Since the Contact schema's post-delete hook also updates totalUsers,
            // we don't need to do that here.
            return Response.json({
                success: true,
                message: "Contact permanently deleted",
            });
        } else {
            const contact = await Contact.findByIdAndUpdate(
                contactId,
                { isActive: false },
                { new: true }
            );
            if (!contact) {
                return Response.json(
                    { success: false, message: "Contact not found" },
                    { status: 404 }
                );
            }
            // Update global stats for a soft-deleted user
            await Stats.findOneAndUpdate(
                { _id: "current" },
                { $inc: { totalUsersDeleted: 1 } },
                { new: true, upsert: true }
            );

            // Update website stats for a soft-deleted user
            if (contact.websiteId) {
                await Website.findByIdAndUpdate(contact.websiteId, {
                    $inc: { "stats.totalSubscribers": -1 },
                });
            }
            return Response.json({
                success: true,
                message: "Contact deactivated successfully",
                data: contact,
            });
        }
    } catch (error) {
        console.error("Error deleting contact:", error);
        return Response.json(
            {
                success: false,
                message: "Internal server error",
                error: error.message,
            },
            { status: 500 }
        );
    }
}
