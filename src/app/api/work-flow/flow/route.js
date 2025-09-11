// /api/work-flow/automation/route.js
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/config/mongoConfig";
import Website from "@/models/Website";
import Stats from "@/models/Stats";
import Flow from "@/models/Flow";
import List from "@/models/List";

// GET - Retrieve automation(s) with full data
export async function GET(request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const automationId = searchParams.get("automationId");
    const websiteId = searchParams.get("websiteId");
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 10;
    const skip = (page - 1) * limit;

    // If specific automation ID is requested
    if (automationId) {
      if (!mongoose.Types.ObjectId.isValid(automationId)) {
        return NextResponse.json(
          { success: false, message: "Invalid automation ID format" },
          { status: 400 }
        );
      }

      const automation = await Flow.findById(automationId).populate([
        {
          path: "websiteId",
          model: "Website",
          select: "_id name logo miniId isActive stats",
        },
        {
          path: "listId",
          model: "List",
          select: "_id name miniId isActive",
        },
      ]);

      if (!automation) {
        return NextResponse.json(
          { success: false, message: "Automation not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          automation: automation,
          websiteData: automation.websiteId,
          connectedList: automation.listId
            ? {
                _id: automation.listId._id,
                name: automation.listId.name,
              }
            : null,
          stepsCount: automation.steps.length,
          steps: automation.steps,
        },
      });
    }

    // Build query filter
    let query = {};
    if (websiteId) {
      if (!mongoose.Types.ObjectId.isValid(websiteId)) {
        return NextResponse.json(
          { success: false, message: "Invalid website ID format" },
          { status: 400 }
        );
      }
      query.websiteId = websiteId;
    }

    // Get automations with pagination
    const automations = await Flow.find(query)
      .populate([
        {
          path: "websiteId",
          model: "Website",
          select: "_id name logo miniId isActive",
        },
        {
          path: "listId",
          model: "List",
          select: "_id name miniId isActive",
        },
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const totalAutomations = await Flow.countDocuments(query);
    const totalPages = Math.ceil(totalAutomations / limit);

    // Format response data
    const formattedAutomations = automations.map((automation) => ({
      automation: {
        _id: automation._id,
        name: automation.name,
        logo: automation.logo,
        flowId: automation.flowId,
        isActive: automation.isActive,
        stats: automation.stats,
        createdAt: automation.createdAt,
        updatedAt: automation.updatedAt,
      },
      websiteData: automation.websiteId
        ? {
            _id: automation.websiteId._id,
            name: automation.websiteId.name,
            logo: automation.websiteId.logo,
            miniId: automation.websiteId.miniId,
            isActive: automation.websiteId.isActive,
          }
        : null,
      connectedList: automation.listId
        ? {
            _id: automation.listId._id,
            name: automation.listId.name,
          }
        : null,
      stepsCount: automation.steps.length,
      steps: automation.steps,
    }));

    return NextResponse.json({
      success: true,
      data: {
        automations: formattedAutomations,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalItems: totalAutomations,
          itemsPerPage: limit,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("GET Automation Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

// POST - Create new automation
export async function POST(request) {
  try {
    await dbConnect();

    const body = await request.json();
    const { name, description, websiteId, listId, logo, steps = [] } = body;

    // Validation
    if (!name || name.trim() === "") {
      return NextResponse.json(
        { success: false, message: "Automation name is required" },
        { status: 400 }
      );
    }

    if (!websiteId || !mongoose.Types.ObjectId.isValid(websiteId)) {
      return NextResponse.json(
        { success: false, message: "Valid website ID is required" },
        { status: 400 }
      );
    }

    // Verify website exists
    const website = await Website.findById(websiteId);
    if (!website) {
      return NextResponse.json(
        { success: false, message: "Website not found" },
        { status: 404 }
      );
    }

    // Create automation
    const automationData = {
      name: name.trim(),
      description: description,
      websiteId,
      listId: listId || null,
      steps: steps,
      isActive: false,
    };

    if (logo) {
      automationData.logo = logo;
    }

    const automation = new Flow(automationData);
    await automation.save();

    // Update website's automation array
    await Website.findByIdAndUpdate(
      websiteId,
      {
        $push: { automations: automation._id },
        $inc: { "stats.totalAutomations": 1 },
      },
      { new: true }
    );

    // Update list with automation ID if listId exists
    if (listId) {
      await List.findByIdAndUpdate(
        listId,
        {
          automationId: automation._id,
        },
        { new: true }
      );
    }

    // Update global stats
    await Stats.findOneAndUpdate(
      { _id: "current" },
      {
        $inc: {
          totalAutomations: 1,
          totalAutomationSteps: steps.length,
        },
      },
      { upsert: true, new: true }
    );

    // Populate the created automation
    const populatedAutomation = await Flow.findById(automation._id).populate([
      {
        path: "websiteId",
        model: "Website",
        select: "_id name logo miniId isActive",
      },
      {
        path: "listId",
        model: "List",
        select: "_id name miniId isActive",
      },
    ]);

    return NextResponse.json(
      {
        success: true,
        message: "Automation created successfully",
        data: {
          automation: populatedAutomation,
          websiteData: populatedAutomation.websiteId,
          connectedList: populatedAutomation.listId
            ? {
                _id: populatedAutomation.listId._id,
                name: populatedAutomation.listId.name,
              }
            : null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST Automation Error:", error);

    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message
      );
      return NextResponse.json(
        {
          success: false,
          message: "Validation failed",
          errors: validationErrors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

// PUT - Update automation with status system
export async function PUT(request) {
  try {
    await dbConnect();

    const body = await request.json();
    const { automationId, status, updateData } = body;

    if (!automationId || !mongoose.Types.ObjectId.isValid(automationId)) {
      return NextResponse.json(
        { success: false, message: "Valid automation ID is required" },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { success: false, message: "Status is required" },
        { status: 400 }
      );
    }

    const validStatuses = [
      "multi",
      "nameChange",
      "statusChange",
      "listIdUpdate",
    ];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(
            ", "
          )}`,
        },
        { status: 400 }
      );
    }

    const automation = await Flow.findById(automationId);
    if (!automation) {
      return NextResponse.json(
        { success: false, message: "Automation not found" },
        { status: 404 }
      );
    }

    let updateObject = {};
    let responseMessage = "";

    switch (status) {
      case "nameChange":
        if (!updateData.name || updateData.name.trim() === "") {
          return NextResponse.json(
            { success: false, message: "New name is required for nameChange" },
            { status: 400 }
          );
        }
        updateObject.name = updateData.name.trim();
        responseMessage = "Automation name updated successfully";
        break;

      case "statusChange":
        if (typeof updateData.isActive !== "boolean") {
          return NextResponse.json(
            {
              success: false,
              message: "isActive boolean value is required for statusChange",
            },
            { status: 400 }
          );
        }
        updateObject.isActive = updateData.isActive;
        responseMessage = `Automation ${
          updateData.isActive ? "activated" : "deactivated"
        } successfully`;
        break;

      case "listIdUpdate":
        if (updateData.listId) {
          if (!mongoose.Types.ObjectId.isValid(updateData.listId)) {
            return NextResponse.json(
              { success: false, message: "Invalid list ID format" },
              { status: 400 }
            );
          }

          // Verify list exists
          const list = await List.findById(updateData.listId);
          if (!list) {
            return NextResponse.json(
              { success: false, message: "List not found" },
              { status: 404 }
            );
          }

          // Update list with automation ID if listId exists
          if (updateData.listId) {
            await List.findByIdAndUpdate(
              updateData.listId,
              {
                automationId: automation._id,
              },
              { new: true }
            );
          }

          updateObject.listId = updateData.listId;
          responseMessage = "Automation list updated successfully";
        } else {
          updateObject.listId = null;
          responseMessage = "Automation list removed successfully";
        }
        break;

      case "multi":
        // Handle multiple updates
        if (!updateData || typeof updateData !== "object") {
          return NextResponse.json(
            {
              success: false,
              message: "Update data object is required for multi status",
            },
            { status: 400 }
          );
        }

        // FIXED: Only handle listId if it's explicitly being updated
        if (updateData.hasOwnProperty("listId")) {
          if (updateData.listId) {
            if (!mongoose.Types.ObjectId.isValid(updateData.listId)) {
              return NextResponse.json(
                { success: false, message: "Invalid list ID format" },
                { status: 400 }
              );
            }

            // Verify list exists
            const list = await List.findById(updateData.listId);
            if (!list) {
              return NextResponse.json(
                { success: false, message: "List not found" },
                { status: 404 }
              );
            }
            if (updateData.listId) {
              await List.findByIdAndUpdate(
                updateData.listId,
                {
                  automationId: automation._id,
                },
                { new: true }
              );
            }

            updateObject.listId = updateData.listId;
          } else {
            // Only set to null if explicitly setting listId to null/empty
            updateObject.listId = null;
          }
        }
        // If listId is not in updateData at all, don't touch it

        // FIXED: Only handle listId if it's explicitly being updated
        if (updateData.hasOwnProperty("websiteId")) {
          if (updateData.websiteId) {
            if (!mongoose.Types.ObjectId.isValid(updateData.websiteId)) {
              return NextResponse.json(
                { success: false, message: "Invalid Website ID format" },
                { status: 400 }
              );
            }

            // Verify website exists
            const website = await Website.findById(updateData.websiteId);
            if (!website) {
              return NextResponse.json(
                { success: false, message: "Website not found" },
                { status: 404 }
              );
            }
            if (updateData.websiteId) {
              await Website.findByIdAndUpdate(
                updateData.websiteId,
                {
                  $push: { automations: automation._id },
                  $inc: { "stats.totalAutomations": 1 },
                },
                { new: true }
              );
            }

            updateObject.websiteId = updateData.websiteId;
          } else {
            // Only set to null if explicitly setting websiteId to null/empty
            updateObject.websiteId = null;
          }
        }

        // Validate and process each field
        if (updateData.name !== undefined) {
          if (!updateData.name || updateData.name.trim() === "") {
            return NextResponse.json(
              { success: false, message: "Invalid name provided" },
              { status: 400 }
            );
          }
          updateObject.name = updateData.name.trim();
        }

        if (updateData.description !== undefined) {
          updateObject.description = updateData.description.trim();
        }

        if (updateData.isActive !== undefined) {
          if (typeof updateData.isActive !== "boolean") {
            return NextResponse.json(
              { success: false, message: "isActive must be a boolean" },
              { status: 400 }
            );
          }
          updateObject.isActive = updateData.isActive;
        }

        if (updateData.logo !== undefined) {
          updateObject.logo = updateData.logo;
        }

        responseMessage = "Automation updated successfully";
        break;

      default:
        return NextResponse.json(
          { success: false, message: "Invalid status provided" },
          { status: 400 }
        );
    }

    // Update the automation
    const updatedAutomation = await Flow.findByIdAndUpdate(
      automationId,
      updateObject,
      { new: true, runValidators: true }
    ).populate([
      {
        path: "websiteId",
        model: "Website",
        select: "_id name logo miniId isActive",
      },
      {
        path: "listId",
        model: "List",
        select: "_id name miniId isActive subscriberCount",
      },
    ]);

    return NextResponse.json({
      success: true,
      message: responseMessage,
      data: {
        automation: updatedAutomation,
        websiteData: updatedAutomation.websiteId,
        connectedList: updatedAutomation.listId
          ? {
              _id: updatedAutomation.listId._id,
              name: updatedAutomation.listId.name,
              subscriberCount: updatedAutomation.listId.subscriberCount,
            }
          : null,
        updatedFields: Object.keys(updateObject),
      },
    });
  } catch (error) {
    console.error("PUT Automation Error:", error);

    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message
      );
      return NextResponse.json(
        {
          success: false,
          message: "Validation failed",
          errors: validationErrors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

// DELETE - Remove automation and update subscriber automation history
export async function DELETE(request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const automationId = searchParams.get("automationId");

    if (!automationId || !mongoose.Types.ObjectId.isValid(automationId)) {
      return NextResponse.json(
        { success: false, message: "Valid automation ID is required" },
        { status: 400 }
      );
    }

    const automation = await Flow.findById(automationId);
    if (!automation) {
      return NextResponse.json(
        { success: false, message: "Automation not found" },
        { status: 404 }
      );
    }

    // Store automation data before deletion
    const deletedAutomationData = {
      _id: automation._id,
      name: automation.name,
      flowId: automation.flowId,
      websiteId: automation.websiteId,
      stepsCount: automation.steps.length,
    };

    // Remove automation from website's automations array
    await Website.findByIdAndUpdate(automation.websiteId, {
      $pull: { automations: automationId },
      $inc: { "stats.totalAutomations": -1 },
    });

    // Update global stats
    await Stats.findOneAndUpdate(
      { _id: "current" },
      {
        $inc: {
          totalAutomations: -1,
          totalAutomationSteps: -automation.steps.length,
        },
      },
      { upsert: true }
    );

    // TODO: Update subscriber automation history
    // Note: You'll need to implement this based on your Subscriber model
    // This is a placeholder for the functionality you mentioned
    /*
    await Subscriber.updateMany(
      { "automationHistory.automationId": automationId },
      {
        $set: {
          "automationHistory.$.status": "automation_deleted",
          "automationHistory.$.deletedAt": new Date()
        }
      }
    );
    */

    // Delete the automation
    await Flow.findByIdAndDelete(automationId);

    return NextResponse.json({
      success: true,
      message: "Automation deleted successfully",
      data: {
        deletedAutomation: deletedAutomationData,
        // subscribersUpdated: subscriberUpdateResult.modifiedCount // Uncomment when Subscriber model is implemented
      },
    });
  } catch (error) {
    console.error("DELETE Automation Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
