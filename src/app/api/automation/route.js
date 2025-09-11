// api/automation/route.js

import dbConnect from "@/config/mongoConfig"; // Adjust path as per your project structure
import Flow from "@/models/Flow"; // Import the new Flow model
import List from "@/models/List"; // Assuming you have a List model
import Website from "@/models/Website"; // Assuming you have a Website model
import mongoose from "mongoose";
import { NextResponse } from "next/server";

// Add error handling for invalid JSON
async function parseRequestBody(request) {
  try {
    return await request.json();
  } catch (error) {
    throw new Error("Invalid JSON in request body");
  }
}

/**
 * Handles GET requests to fetch automation flow(s).
 * Can fetch all flows, a specific flow by its MongoDB _id, or flows associated with a specific websiteId.
 *
 * @param {Request} request The incoming Next.js request object.
 * @returns {NextResponse} The response containing flow data or an error.
 */
export async function GET(request) {
  await dbConnect();

  try {
    const { searchParams } = new URL(request.url);
    const flowMongoId = searchParams.get("automationId"); // MongoDB _id of the flow
    const websiteId = searchParams.get("websiteId");
    const listId = searchParams.get("listId"); // Added to fetch flow by listId

    let flows;
    if (flowMongoId) {
      // If flowMongoId (MongoDB _id) is provided, find a specific flow
      if (!mongoose.Types.ObjectId.isValid(flowMongoId)) {
        return NextResponse.json(
          { success: false, message: "Invalid flow ID format." },
          { status: 400 }
        );
      }
      flows = await Flow.findById(flowMongoId);
      if (!flows) {
        return NextResponse.json(
          { success: false, message: "Flow not found." },
          { status: 404 }
        );
      }
    } else if (websiteId) {
      // If websiteId is provided, find all flows for that website
      if (!mongoose.Types.ObjectId.isValid(websiteId)) {
        return NextResponse.json(
          { success: false, message: "Invalid website ID format." },
          { status: 400 }
        );
      }
      flows = await Flow.find({
        websiteId: new mongoose.Types.ObjectId(websiteId),
      });
    } else if (listId) {
      // If listId is provided, find the flow associated with that list
      if (!mongoose.Types.ObjectId.isValid(listId)) {
        return NextResponse.json(
          { success: false, message: "Invalid list ID format." },
          { status: 400 }
        );
      }
      flows = await Flow.findOne({
        listId: new mongoose.Types.ObjectId(listId),
      });
      if (!flows) {
        return NextResponse.json(
          { success: false, message: "Flow not found for this list." },
          { status: 404 }
        );
      }
    } else {
      // If no specific ID or websiteId, fetch all flows
      flows = await Flow.find({});
    }

    return NextResponse.json({ success: true, data: flows }, { status: 200 });
  } catch (error) {
    console.error("GET Flow Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch flows." },
      { status: 500 }
    );
  }
}

/**
 * Handles POST requests to create a new automation flow.
 *
 * @param {Request} request The incoming Next.js request object.
 * @returns {NextResponse} The response containing the created flow data or an error.
 */
export async function POST(request) {
  await dbConnect();

  try {
    const body = await parseRequestBody(request);
    const { name, websiteId, listId, steps, isActive } = body;

    if (!name || !websiteId) {
      return NextResponse.json(
        {
          success: false,
          message: "Name, website ID, and list ID are required.",
        },
        { status: 400 }
      );
    }
    if (!mongoose.Types.ObjectId.isValid(websiteId)) {
      return NextResponse.json(
        { success: false, message: "Invalid website ID or list ID format." },
        { status: 400 }
      );
    }

    const existingList = await List.findById(listId);
    if (!existingList) {
      return NextResponse.json(
        {
          success: false,
          message: "List not found.",
        },
        { status: 404 }
      );
    }

    if (existingList.automationId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This list is already associated with another automation flow.",
        },
        { status: 409 }
      );
    }

    const newFlow = await Flow.create({
      name,
      websiteId: new mongoose.Types.ObjectId(websiteId),
      listId: listId ? new mongoose.Types.ObjectId(listId) : null,
      steps: steps || [],
      isActive: isActive !== undefined ? isActive : false,
    });

    // Update the List document to link to this automation flow
    await List.findByIdAndUpdate(listId, { automationId: newFlow._id });

    return NextResponse.json({ success: true, data: newFlow }, { status: 201 });
  } catch (error) {
    console.error("POST Flow Error:", error);
    if (error.message === "Invalid JSON in request body") {
      return NextResponse.json(
        { success: false, message: "Invalid JSON in request body" },
        { status: 400 }
      );
    }
    if (error.name === "ValidationError") {
      return NextResponse.json(
        { success: false, message: error.message, errors: error.errors },
        { status: 400 }
      );
    } else if (error.code === 11000) {
      return NextResponse.json(
        {
          success: false,
          message: "A flow with this ID or list association already exists.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create flow." },
      { status: 500 }
    );
  }
}

/**
 * Handles PUT requests to update an existing automation flow.
 *
 * @param {Request} request The incoming Next.js request object.
 * @returns {NextResponse} The response containing the updated flow data or an error.
 */
export async function PUT(request) {
  await dbConnect();

  try {
    const { searchParams } = new URL(request.url);
    const flowMongoId = searchParams.get("miniId");

    // Validate flow ID
    if (!flowMongoId) {
      return NextResponse.json(
        { success: false, message: "Flow ID is required." },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await parseRequestBody(request);
    const { listId, originalListId, steps, ...updateData } = body;

    // Validate steps if present
    if (steps && Array.isArray(steps)) {
      const stepsValidation = validateSteps(steps);
      if (!stepsValidation.isValid) {
        return NextResponse.json(
          {
            success: false,
            message: "Steps validation failed",
            errors: stepsValidation.errors,
          },
          { status: 400 }
        );
      }
    }

    // Check for list ID conflicts if changing list
    if (listId && originalListId && listId !== originalListId) {
      const existingFlow = await Flow.findOne({
        listId: new mongoose.Types.ObjectId(listId),
        // _id: { $ne: new mongoose.Types.ObjectId(flowMongoId) }
      });

      if (existingFlow) {
        return NextResponse.json(
          {
            success: false,
            message: "This list is already associated with another flow.",
          },
          { status: 409 }
        );
      }
    }

    // Prepare update fields
    const updateFields = {
      ...updateData,
      updatedAt: new Date(),
    };

    // Convert IDs to ObjectId
    if (listId) updateFields.listId = new mongoose.Types.ObjectId(listId);
    if (updateData.websiteId) {
      updateFields.websiteId = new mongoose.Types.ObjectId(
        updateData.websiteId
      );
    }

    // Clean and process steps if provided
    if (steps) {
      updateFields.steps = steps.map((step) => ({
        ...step,
        targetListId: step.targetListId
          ? new mongoose.Types.ObjectId(step.targetListId)
          : null,
        sendMailTemplateId: step.sendMailTemplateId
          ? new mongoose.Types.ObjectId(step.sendMailTemplateId)
          : null,
        // Clean other ObjectId fields as needed
        ...(step.listId && {
          listId: new mongoose.Types.ObjectId(step.listId),
        }),
      }));
    }

    // Perform the update
    const updatedFlow = await Flow.findByIdAndUpdate(
      flowMongoId,
      { $set: updateFields },
      {
        new: true,
        runValidators: true,
        populate: [
          { path: "listId", select: "name _id" },
          { path: "websiteId", select: "name _id domain" },
        ],
      }
    );

    if (!updatedFlow) {
      return NextResponse.json(
        { success: false, message: "Flow not found." },
        { status: 404 }
      );
    }

    // Update list associations if list was changed
    if (listId && originalListId && listId !== originalListId) {
      await Promise.all([
        // Remove from old list
        List.findByIdAndUpdate(originalListId, {
          $unset: { automationId: 1 },
        }),
        // Add to new list
        List.findByIdAndUpdate(listId, {
          automationId: updatedFlow._id,
        }),
      ]);
    }

    return NextResponse.json(
      {
        success: true,
        data: updatedFlow,
        message: "Flow updated successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("PUT Flow Error:", error);

    // Handle specific error types
    if (error.message === "Invalid JSON in request body") {
      return NextResponse.json(
        { success: false, message: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    if (error.name === "ValidationError") {
      const errors = {};
      for (const field in error.errors) {
        errors[field] = error.errors[field].message;
      }
      return NextResponse.json(
        { success: false, message: "Validation failed", errors },
        { status: 400 }
      );
    }

    if (error.name === "CastError") {
      return NextResponse.json(
        { success: false, message: "Invalid data format" },
        { status: 400 }
      );
    }

    if (error.code === 11000) {
      return NextResponse.json(
        { success: false, message: "Duplicate key error" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper function to validate steps
function validateSteps(steps) {
  const errors = [];

  if (!Array.isArray(steps)) {
    return { isValid: false, errors: ["Steps must be an array"] };
  }

  steps.forEach((step, index) => {
    if (!step.stepType) {
      errors.push(`Step ${index + 1}: stepType is required`);
    }
    if (!step.title) {
      errors.push(`Step ${index + 1}: title is required`);
    }
    // Add more validations as needed
  });

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : null,
  };
}

/**
 * Handles DELETE requests to remove an automation flow.
 * Requires the flow's MongoDB _id in the query parameters.
 *
 * @param {Request} request The incoming Next.js request object.
 * @returns {NextResponse} The response indicating success or an error.
 */
export async function DELETE(request) {
  await dbConnect();

  try {
    const { searchParams } = new URL(request.url);
    const flowMongoId = searchParams.get("automationId"); // MongoDB _id of the flow to delete

    if (!flowMongoId) {
      return NextResponse.json(
        { success: false, message: "Flow ID is required to delete a flow." },
        { status: 400 }
      );
    }
    if (!mongoose.Types.ObjectId.isValid(flowMongoId)) {
      return NextResponse.json(
        { success: false, message: "Invalid flow ID format." },
        { status: 400 }
      );
    }

    const deletedFlow = await Flow.findByIdAndDelete(flowMongoId);

    if (!deletedFlow) {
      return NextResponse.json(
        { success: false, message: "Flow not found." },
        { status: 404 }
      );
    }

    // Remove the automationId from the associated list
    if (deletedFlow.listId) {
      await List.findByIdAndUpdate(deletedFlow.listId, {
        $unset: { automationId: 1 },
      });
    }

    return NextResponse.json(
      { success: true, message: "Flow deleted successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE Flow Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete flow." },
      { status: 500 }
    );
  }
}
