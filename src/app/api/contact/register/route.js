// file: /api/contact/register/route.js | next.js 13+ api Route
import dbConnect from "@/config/mongoConfig";
import Contact from "@/models/Contact";
import List from "@/models/List";
import Stats from "@/models/Stats";
import Flow from "@/models/Flow";
import { calculateWaitDuration } from "@/services/backendHelpers/helpers";
import mongoose from "mongoose";

export async function POST(req) {
    try {
        console.log("Starting POST request to create/update contact");
        await dbConnect();

        const {
            fullName,
            email,
            listId,
            source = "api",
            createdBy = "api",
        } = await req.json();

        console.log("Request payload:", {
            fullName,
            email,
            listId,
            source,
            createdBy,
        });

        if (!fullName?.trim() || !email?.trim()) {
            console.log("Validation failed: Missing fullName or email");
            return Response.json(
                { success: false, message: "Full name and email are required" },
                { status: 400 }
            );
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            console.log("Validation failed: Invalid email format", email);
            return Response.json(
                { success: false, message: "Invalid email format" },
                { status: 400 }
            );
        }

        const existingContact = await Contact.findOne({
            email: email.toLowerCase().trim(),
        });
        console.log(
            "Existing contact check:",
            existingContact ? "Found" : "Not found"
        );

        if (existingContact) {
            if (!listId) {
                // If a listId is not provided for an existing contact, return a success message without adding to a list.
                return Response.json(
                    {
                        success: true,
                        message: "Contact already exists",
                        existingContactId: existingContact._id,
                    },
                    { status: 200 }
                );
            }

            if (!mongoose.isValidObjectId(listId)) {
                console.log("Invalid listId format:", listId);
                return Response.json(
                    { success: false, message: "Invalid list ID format" },
                    { status: 400 }
                );
            }

            const existingListAssociation = existingContact.listAssociations.find(
                (assoc) => assoc.listId.toString() === listId.toString()
            );

            if (existingListAssociation) {
                return Response.json(
                    {
                        success: false,
                        message: "Contact already exists in this list",
                        existingContactId: existingContact._id,
                    },
                    { status: 409 }
                );
            }

            const list = await List.findById(listId).populate("automationId");
            if (!list) {
                return Response.json(
                    { success: false, message: "List not found" },
                    { status: 404 }
                );
            }

            existingContact.listAssociations.push({
                listId,
                subscribedAt: new Date(),
                source,
            });

            // 📝 Update stats for adding an existing contact to a list
            await List.findByIdAndUpdate(listId, {
                $inc: { "stats.totalSubscribers": 1 },
            });

            if (list.automationId) {
                const automation = list.automationId;
                const existingAutomationAssociation =
                    existingContact.automationAssociations.find(
                        (assoc) =>
                            assoc.automationId.toString() === automation._id.toString()
                    );

                if (!existingAutomationAssociation) {
                    const firstStep = automation.steps.find(
                        (step) => step.stepCount === 1
                    );
                    const automationData = {
                        automationId: automation._id,
                        stepNumber: 1,
                        startedAt: new Date(),
                        nextStepTime: new Date(),
                    };

                    if (firstStep?.stepType === "waitSubscriber") {
                        const { waitDuration, waitUnit } = firstStep;
                        if (waitDuration && waitUnit) {
                            const waitMs = calculateWaitDuration(waitDuration, waitUnit);
                            if (waitMs > 0) {
                                automationData.nextStepTime = new Date(Date.now() + waitMs);
                                automationData.stepNumber = 2;
                            }
                        }
                    }
                    existingContact.automationAssociations.push(automationData);

                    // 📝 Update stats for new automation association
                    await Flow.findByIdAndUpdate(automation._id, {
                        $inc: { "stats.totalUsersProcessed": 1 },
                    });
                }

                existingContact.automationHistory.push({
                    automationId: automation._id,
                    listId,
                    addedAt: new Date(),
                    status: "active",
                });
            }
            await existingContact.save();
            return Response.json({
                success: true,
                message: "Contact added to new list successfully",
                data: existingContact,
            });
        }

        console.log("Creating new contact");
        const newContactData = {
            fullName: fullName.trim(),
            email: email.toLowerCase().trim(),
            createdBy,
        };
        if (listId) {
            if (!mongoose.isValidObjectId(listId)) {
                console.log("Invalid listId format for new contact:", listId);
                return Response.json(
                    { success: false, message: "Invalid list ID format" },
                    { status: 400 }
                );
            }
            const list = await List.findById(listId).populate("automationId");
            if (!list) {
                return Response.json(
                    { success: false, message: "List not found" },
                    { status: 404 }
                );
            }

            newContactData.listAssociations = [
                {
                    listId,
                    subscribedAt: new Date(),
                    source,
                },
            ];

            // 📝 Update stats for a new contact in a list
            await List.findByIdAndUpdate(listId, {
                $inc: { "stats.totalSubscribers": 1 },
            });

            if (list.automationId) {
                const automation = list.automationId;
                const firstStep = automation.steps.find((step) => step.stepCount === 1);
                const automationData = {
                    automationId: automation._id,
                    stepNumber: 1,
                    startedAt: new Date(),
                    nextStepTime: new Date(),
                };

                if (firstStep?.stepType === "waitSubscriber") {
                    const { waitDuration, waitUnit } = firstStep;
                    if (waitDuration && waitUnit) {
                        const waitMs = calculateWaitDuration(waitDuration, waitUnit);
                        if (waitMs > 0) {
                            automationData.nextStepTime = new Date(Date.now() + waitMs);
                            automationData.stepNumber = 2;
                        }
                    }
                }

                newContactData.automationAssociations = [automationData];
                newContactData.automationHistory = [
                    {
                        automationId: automation._id,
                        listId,
                        addedAt: new Date(),
                        status: "active",
                    },
                ];

                // 📝 Update stats for a new contact starting an automation
                await Flow.findByIdAndUpdate(automation._id, {
                    $inc: { "stats.totalUsersProcessed": 1 },
                });
            }
        }

        // 📝 Update global stats for total users
        await Stats.findOneAndUpdate(
            { _id: "current" },
            { $inc: { totalUsers: 1 } },
            { new: true, upsert: true }
        );

        const contact = await Contact.create(newContactData);
        console.log("Created new contact:", contact._id);

        return Response.json(
            { success: true, message: "Contact created successfully", data: contact },
            { status: 201 }
        );
    } catch (error) {
        console.error("Error creating contact:", error);
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