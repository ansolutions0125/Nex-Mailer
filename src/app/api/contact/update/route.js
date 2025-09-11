// file: /api/contact/update/route.js | next.js 13+ api Route

import dbConnect from "@/config/mongoConfig";
import Contact from "@/models/Contact";
import List from "@/models/List";
import Stats from "@/models/Stats";
import Flow from "@/models/Flow";
import mongoose from "mongoose";

export async function PUT(req) {
    try {
        await dbConnect();
        const { contactId, fullName, updatedBy = "api-system", action, data } = await req.json();

        if (!contactId || !mongoose.isValidObjectId(contactId)) {
            return Response.json(
                { success: false, message: "Valid contact ID is required" },
                { status: 400 }
            );
        }

        const contact = await Contact.findById(contactId);
        if (!contact) {
            return Response.json(
                { success: false, message: "Contact not found" },
                { status: 404 }
            );
        }

        if (action) {
            return await handleSpecialActions(contact, action, data);
        }

        if (fullName) {
            contact.fullName = fullName.trim();
        }

        if (updatedBy) {
            contact.updatedBy = updatedBy;
        }

        await contact.save();
        return Response.json({
            success: true,
            message: "Contact updated successfully",
            data: contact,
        });

    } catch (error) {
        console.error("Error updating contact:", error);
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

async function handleSpecialActions(contact, action, data) {
    const {
        listId,
        newListId,
        source = "api",
        automationId,
        transferredBy = "manual",
        emailsSent,
        emailsDelivered,
        emailsOpened,
        emailsClicked,  
    } = data;

    switch (action) {
        case "addToList":
            if (!listId || !mongoose.isValidObjectId(listId)) {
                return Response.json(
                    { success: false, message: "Valid list ID is required" },
                    { status: 400 }
                );
            }
            const existingAssociation = contact.listAssociations.find(
                (assoc) => assoc.listId.toString() === listId
            );
            if (existingAssociation) {
                return Response.json(
                    { success: false, message: "Contact is already in this list" },
                    { status: 409 }
                );
            }
            contact.listAssociations.push({
                listId,
                subscribedAt: new Date(),
                source,
            });

            // 📝 Update stats for adding contact to a list
            await List.findByIdAndUpdate(listId, {
                $inc: { "stats.totalSubscribers": 1 },
            });

            await contact.save();
            return Response.json({
                success: true,
                message: "Contact added to list successfully",
                data: contact,
            });

        case "removeFromList":
            if (!listId || !mongoose.isValidObjectId(listId)) {
                return Response.json(
                    { success: false, message: "Valid list ID is required" },
                    { status: 400 }
                );
            }
            const associationIndex = contact.listAssociations.findIndex(
                (assoc) => assoc.listId.toString() === listId
            );
            if (associationIndex === -1) {
                return Response.json(
                    { success: false, message: "Contact is not in this list" },
                    { status: 404 }
                );
            }
            const [removedAssociation] = contact.listAssociations.splice(
                associationIndex,
                1
            );
            contact.listHistory.push({
                ...removedAssociation,
                unsubscribedAt: new Date(),
            });

            // 📝 Update stats for removing contact from a list
            await List.findByIdAndUpdate(listId, {
                $inc: { "stats.totalSubscribers": -1 },
            });

            await contact.save();
            return Response.json({
                success: true,
                message: "Contact removed from list successfully",
                data: contact,
            });

        case "transferList":
            if (
                !listId ||
                !newListId ||
                !mongoose.isValidObjectId(listId) ||
                !mongoose.isValidObjectId(newListId)
            ) {
                return Response.json(
                    {
                        success: false,
                        message: "Valid current and new list IDs are required",
                    },
                    { status: 400 }
                );
            }
            const oldAssociationIndex = contact.listAssociations.findIndex(
                (assoc) => assoc.listId.toString() === listId
            );
            if (oldAssociationIndex !== -1) {
                const [oldAssociation] = contact.listAssociations.splice(
                    oldAssociationIndex,
                    1
                );
                contact.listHistory.push({
                    ...oldAssociation,
                    unsubscribedAt: new Date(),
                });

                // 📝 Update stats for the old list
                await List.findByIdAndUpdate(listId, {
                    $inc: { "stats.totalSubscribers": -1 },
                });
            }
            contact.listAssociations.push({
                listId: newListId,
                subscribedAt: new Date(),
                source: "transfer",
            });

            // 📝 Update stats for the new list
            await List.findByIdAndUpdate(newListId, {
                $inc: { "stats.totalSubscribers": 1 },
            });

            if (automationId && mongoose.isValidObjectId(automationId)) {
                contact.automationHistory.push({
                    automationId,
                    listId: newListId,
                    addedAt: new Date(),
                    transferredBy,
                    status: "active",
                });
                // 📝 Update stats for a user transferred to an automation
                await Flow.findByIdAndUpdate(automationId, {
                    $inc: { "stats.totalUsersProcessed": 1 }
                });
            }

            await contact.save();
            return Response.json({
                success: true,
                message: "Contact transferred successfully",
                data: contact,
            });

        case "updateEngagement":
            // 📝 Use $inc for atomic updates to engagement stats
            const updatedContact = await Contact.findByIdAndUpdate(
                contact._id,
                {
                    $inc: {
                        "engagementHistory.totalEmailsSent": emailsSent || 0,
                        "engagementHistory.totalEmailsDelivered": emailsDelivered || 0,
                        "engagementHistory.totalEmailsOpened": emailsOpened || 0,
                        "engagementHistory.totalEmailsClicked": emailsClicked || 0,
                    },
                },
                { new: true }
            );

            // 📝 Update global stats for total emails sent
            await Stats.findOneAndUpdate(
                { _id: "current" },
                {
                    $inc: {
                        totalMailSent: emailsSent || 0
                    }
                },
                { new: true, upsert: true }
            );
            return Response.json({
                success: true,
                message: "Engagement updated successfully",
                data: updatedContact,
            });

        default:
            return Response.json(
                { success: false, message: "Invalid action specified" },
                { status: 400 }
            );
    }
}