// /api/contact/route.js - Next.js 13+ API Route
import dbConnect from "@/config/mongoConfig";
import Contact from "@/models/Contact";
import List from "@/models/List";
import Stats from "@/models/Stats";
import Flow from "@/models/Flow";
import Website from "@/models/Website";
import { calculateWaitDuration } from "@/services/backendHelpers/helpers";
import mongoose from "mongoose";

// POST - Create a new contact
export async function POST(req) {
  try {
    console.log("Starting POST request to create/update contact");
    await dbConnect();

    const {
      fullName,
      email,
      listId,
      source = "api",
      createdBy,
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
      if (listId) {
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

        // 📝 Update stats for adding a contact to a list
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
              $inc: { "stats.totalUsersProcessed": 1 }
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
      return Response.json(
        {
          success: false,
          message: "Contact with this email already exists",
          existingContactId: existingContact._id,
        },
        { status: 409 }
      );
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
      // 📝 Since ContactSchema has a post-save hook to update Website and Stats for new contacts,
      // we don't need to do that here.

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
          $inc: { "stats.totalUsersProcessed": 1 }
        });
      }
    }
  
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

// GET - Fetch contacts with filtering and pagination
export async function GET(req) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 10;
    const listId = searchParams.get("listId");
    const isActive = searchParams.get("isActive");
    const search = searchParams.get("search");

    let query = {};
    if (listId && mongoose.isValidObjectId(listId)) {
      query["listAssociations.listId"] = listId;
    }
    if (isActive !== null) {
      query.isActive = isActive === "true";
    }
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    const skip = (page - 1) * limit;

    const contacts = await Contact.find(query)
      .populate({
        path: "listAssociations.listId",
        select: "name",
      })
      .populate({
        path: "automationAssociations.automationId",
        select: "name",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Contact.countDocuments(query);
    return Response.json({
      success: true,
      data: contacts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        total,
        limit,
      },
    });
  } catch (error) {
    console.error("Error fetching contacts:", error);
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

// PUT - Update contact
export async function PUT(req) {
  try {
    await dbConnect();
    const { contactId, fullName, updatedBy, action, listAssociations, data } = await req.json();
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
    let listIds = [];
    if (action === "updateListAssociations") {
      listIds = listAssociations
      return await handleSpecialActions(contact, action, { listIds, ...data });
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

// DELETE - Soft delete contact
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
      // 📝 Update global stats for a hard-deleted user
      await Stats.findOneAndUpdate(
        { _id: "current" },
        { $inc: { totalUsersDeleted: 1 } },
        { new: true, upsert: true }
      );

      // 📝 Since the Contact schema's post-delete hook also updates totalUsers,
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

      await Stats.findOneAndUpdate(
        { _id: "current" },
        { $inc: { totalUsers: -1 } },
        { new: true, upsert: true }
      );
      // 📝 Update global stats for a soft-deleted user
      await Stats.findOneAndUpdate(
        { _id: "current" },
        { $inc: { totalUsersDeleted: 1 } },
        { new: true, upsert: true }
      );

      // 📝 Update website stats for a soft-deleted user
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

// Helper function to handle special actions
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
    listIds = [], // New array parameter for multiple lists
  } = data;
  switch (action) {
    case "updateListAssociations":
      if (!Array.isArray(listIds)) {
        return Response.json(
          { success: false, message: "listIds must be an array" },
          { status: 400 }
        );
      }

      // Validate all list IDs
      const invalidListIds = listIds.filter(id => !mongoose.isValidObjectId(id));
      if (invalidListIds.length > 0) {
        return Response.json(
          { success: false, message: "One or more invalid list IDs provided" },
          { status: 400 }
        );
      }

      // Get current list associations as string IDs for easier comparison
      const currentListIds = contact.listAssociations.map(assoc =>
        assoc.listId.toString()
      );

      const newListIds = listIds.map(id => id.toString());

      // Find lists to remove and add
      const listsToRemove = currentListIds.filter(id => !newListIds.includes(id));
      const listsToAdd = newListIds.filter(id => !currentListIds.includes(id));

      // Step 1: Identify automations connected to lists being removed
      const automationsToCheck = new Set();

      // Get details of lists being removed to check their automations
      const listsBeingRemovedData = await List.find({
        _id: { $in: listsToRemove }
      }).populate("automationId");

      // Collect automation IDs from lists being removed
      listsBeingRemovedData.forEach(list => {
        if (list.automationId) {
          automationsToCheck.add(list.automationId._id.toString());
        }
      });

      // Step 2: Check if these automations are still needed by other lists
      const listsStayingData = await List.find({
        _id: { $in: newListIds }
      }).populate("automationId");

      const stillNeededAutomations = new Set();
      listsStayingData.forEach(list => {
        if (list.automationId) {
          stillNeededAutomations.add(list.automationId._id.toString());
        }
      });

      // Step 3: Identify automations that should be removed (not needed by any remaining lists)
      const automationsToRemove = Array.from(automationsToCheck).filter(
        automationId => !stillNeededAutomations.has(automationId)
      );

      // Step 4: Remove automations that are no longer needed
      for (const automationId of automationsToRemove) {
        // Remove from automationAssociations
        contact.automationAssociations = contact.automationAssociations.filter(
          assoc => assoc.automationId.toString() !== automationId
        );

        // Update automationHistory - mark as removed/cancelled
        const automationHistoryEntry = contact.automationHistory.find(
          history =>
            history.automationId.toString() === automationId &&
            history.status === "active"
        );

        if (automationHistoryEntry) {
          automationHistoryEntry.status = "cancelled";
          automationHistoryEntry.completedAt = new Date();
        }
      }

      // Step 5: Remove lists
      for (const listIdToRemove of listsToRemove) {
        const index = contact.listAssociations.findIndex(
          assoc => assoc.listId.toString() === listIdToRemove
        );

        if (index !== -1) {
          const removedAssociation = contact.listAssociations.splice(index, 1)[0];

          // Update list history
          const existingHistory = contact.listHistory.find(
            history =>
              history.listId.toString() === listIdToRemove &&
              !history.unsubscribedAt
          );

          if (existingHistory) {
            existingHistory.unsubscribedAt = new Date();
          } else {
            contact.listHistory.push({
              listId: listIdToRemove,
              subscribedAt: new Date(),
              unsubscribedAt: new Date(),
              source: "automation"
            });
          }

          // Update list stats
          await List.findByIdAndUpdate(listIdToRemove, {
            $inc: { "stats.totalSubscribers": -1 }
          });
        }
      }

      // Step 6: Add new lists
      const listsToAddData = await List.find({ _id: { $in: listsToAdd } }).populate("automationId");

      for (const newList of listsToAddData) {
        contact.listAssociations.push({
          listId: newList._id,
          subscribedAt: new Date(),
          source: "automation",
        });

        // Update list stats
        await List.findByIdAndUpdate(newList._id, {
          $inc: { "stats.totalSubscribers": 1 }
        });

        // Handle automation if exists
        if (newList.automationId) {
          const existingAutomation = contact.automationAssociations.find(
            assoc => assoc.automationId.toString() === newList.automationId._id.toString()
          );

          if (!existingAutomation) {
            const automationData = {
              automationId: newList.automationId._id,
              stepNumber: 1,
              startedAt: new Date(),
              nextStepTime: new Date(),
            };

            // Handle wait step if it's the first step
            const firstStep = newList.automationId.steps?.find(step => step.stepCount === 1);
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

            contact.automationAssociations.push(automationData);

            // Update automation stats
            await Flow.findByIdAndUpdate(newList.automationId._id, {
              $inc: { "stats.totalUsersProcessed": 1 }
            });
          }

          // Add to automation history (only if not already active)
          const existingActiveAutomation = contact.automationHistory.find(
            history =>
              history.automationId.toString() === newList.automationId._id.toString() &&
              history.status === "active"
          );

          if (!existingActiveAutomation) {
            contact.automationHistory.push({
              automationId: newList.automationId._id,
              listId: newList._id,
              addedAt: new Date(),
              status: "active",
            });
          }
        }

        // Add to list history
        const existingListHistory = contact.listHistory.find(
          history =>
            history.listId.toString() === newList._id.toString() &&
            !history.unsubscribedAt
        );

        if (!existingListHistory) {
          contact.listHistory.push({
            listId: newList._id,
            subscribedAt: new Date(),
            unsubscribedAt: null,
            source: "automation"
          });
        }
      }

      await contact.save();

      return Response.json({
        success: true,
        message: "Contact lists and automations updated successfully",
        data: {
          contact,
          removedAutomations: automationsToRemove,
          addedAutomations: listsToAddData
            .filter(list => list.automationId)
            .map(list => list.automationId._id.toString())
        },
      });


    case "multiListAdd":
      if (!Array.isArray(listIds) || listIds.length === 0) {
        return Response.json(
          { success: false, message: "Valid array of list IDs is required" },
          { status: 400 }
        );
      }

      const invalidIds = listIds.filter(id => !mongoose.isValidObjectId(id));
      if (invalidIds.length > 0) {
        return Response.json(
          { success: false, message: "One or more invalid list IDs provided" },
          { status: 400 }
        );
      }

      const lists = await List.find({ _id: { $in: listIds } }).populate("automationId");
      if (lists.length !== listIds.length) {
        return Response.json(
          { success: false, message: "One or more lists not found" },
          { status: 404 }
        );
      }

      for (const list of lists) {
        const existingAssociation = contact.listAssociations.find(
          assoc => assoc.listId.toString() === list._id.toString()
        );

        if (!existingAssociation) {
          contact.listAssociations.push({
            listId: list._id,
            subscribedAt: new Date(),
            source,
          });

          // Update list stats
          await List.findByIdAndUpdate(list._id, {
            $inc: { "stats.totalSubscribers": 1 },
          });

          // Handle automation if exists
          if (list.automationId) {
            const automation = list.automationId;
            const existingAutomationAssociation = contact.automationAssociations.find(
              assoc => assoc.automationId.toString() === automation._id.toString()
            );

            if (!existingAutomationAssociation) {
              const firstStep = automation.steps.find(step => step.stepCount === 1);
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

              contact.automationAssociations.push(automationData);
              contact.automationHistory.push({
                automationId: automation._id,
                listId: list._id,
                addedAt: new Date(),
                status: "active",
              });

              // Update automation stats
              await Flow.findByIdAndUpdate(automation._id, {
                $inc: { "stats.totalUsersProcessed": 1 }
              });
            }
          }
        }
      }

      await contact.save();
      return Response.json({
        success: true,
        message: "Contact added to multiple lists successfully",
        data: contact,
      });

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
      await contact.save();

      // 📝 Update stats for adding contact to a list
      await List.findByIdAndUpdate(listId, {
        $inc: { "stats.totalSubscribers": 1 },
      });

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
      await contact.save();

      // 📝 Update stats for removing contact from a list
      await List.findByIdAndUpdate(listId, {
        $inc: { "stats.totalSubscribers": -1 },
      });
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
          $inc: { "stats.totalSubscribersMoved": 1 }
        });
      }
      await contact.save();
      return Response.json({
        success: true,
        message: "Contact transferred successfully",
        data: contact,
      });

    case "updateEngagement":
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

      // 📝 Update global stats for emails sent
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
