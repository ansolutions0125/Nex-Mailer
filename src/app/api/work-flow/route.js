// next.js 13+ file: /api/work-flow/route.js
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/config/mongoConfig";
import Website from "@/models/Website";
import Stats from "@/models/Stats";
import Gateway from "@/models/Gateway";
import Portal from "@/models/Server";
import Flow from "@/models/Flow";
import List from "@/models/List";

// GET - Retrieve complete flow information with all related data
export async function GET(request) {
  // 1. Establish a connection to the database.
  await dbConnect();

  try {
    // 2. Extract the automationId from the request's search parameters.
    const { searchParams } = new URL(request.url);
    const automationId = searchParams.get("automationId");

    // 3. Validate that the automationId parameter exists.
    if (!automationId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing automation ID",
          message: "Automation ID is required to retrieve flow information",
        },
        { status: 400 }
      );
    }

    // 4. Validate that the automationId is a valid MongoDB ObjectId.
    if (!mongoose.Types.ObjectId.isValid(automationId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid automation ID",
          message: "The provided automation ID is not a valid MongoDB ObjectId.",
        },
        { status: 400 }
      );
    }

    // 5. Find the flow by its ID and populate the related documents.
    // The .populate() method replaces the specified paths in the document
    // with documents from other collections.
    const flow = await Flow.findById(automationId)
      .populate({
        path: "websiteId",
        select: "name miniId" // Only fetch the name and miniId of the website
      })
      .populate({
        path: "listId",
        select: "name miniId" // Only fetch the name and miniId of the list
      });

    // 6. Check if a flow was found.
    if (!flow) {
      return NextResponse.json(
        {
          success: false,
          error: "Flow not found",
          message: `No flow found with ID: ${automationId}`,
        },
        { status: 404 }
      );
    }

    // 7. If successful, return the populated flow data.
    return NextResponse.json({ success: true, data: flow }, { status: 200 });

  } catch (error) {
    // 8. Handle any unexpected errors.
    console.error("Error fetching flow:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        message: "An internal server error occurred.",
      },
      { status: 500 }
    );
  }
}

// POST - Add new step to existing flow
export async function POST(request) {
  try {
    await dbConnect();

    const body = await request.json();
    const { flowId, stepType, title, description, ...stepData } = body;

    if (!flowId || !stepType || !title) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
          message: "flowId, stepType, and title are required",
        },
        { status: 400 }
      );
    }

    // Find the flow
    const flow = await Flow.findById(flowId);
    if (!flow) {
      return NextResponse.json(
        {
          success: false,
          error: "Flow not found",
          message: "The specified flow does not exist",
        },
        { status: 404 }
      );
    }

    // Validate step-specific requirements
    const validationError = await validateStepData(stepType, stepData);
    if (validationError) {
      return NextResponse.json(validationError, { status: 400 });
    }

    // Create new step
    // After
    const newStep = {
      stepId: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      stepType,
      title: title.trim(),
      description: description?.trim(),
      stepCount: flow.steps.length + 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Conditionally add stepData properties
    Object.keys(stepData).forEach((key) => {
      if (key === "targetListId" && stepData[key] === "") {
        // Skip adding empty targetListId
        return;
      }
      newStep[key] = stepData[key];
    });

    // Verify target list exists if specified
    if (newStep.targetListId && newStep.targetListId.length > 0) {
      const targetList = await List.findById(newStep.targetListId);
      newStep.listExist = !!targetList;

      if (!targetList) {
        return NextResponse.json(
          {
            success: false,
            error: "Target list not found",
            message: "The specified target list does not exist",
          },
          { status: 404 }
        );
      }
    }

    // Add step to flow
    flow.steps.push(newStep);
    flow.updatedAt = new Date();

    await flow.save();

    // Get the newly added step with populated data
    const updatedFlow = await Flow.findById(flow._id).populate(
      "steps.targetListId",
      "name subscriberCount"
    );

    const addedStep = updatedFlow.steps[updatedFlow.steps.length - 1];

    return NextResponse.json(
      {
        success: true,
        data: addedStep,
        message: "Step added successfully",
        flowInfo: {
          flowId: flow.flowId,
          flowName: flow.name,
          totalSteps: flow.steps.length,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error adding step:", error);

    if (error.name === "ValidationError") {
      return NextResponse.json(
        {
          success: false,
          error: "Validation error",
          message: error.message,
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to add step",
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// PUT - Update existing step in flow OR reorder steps
export async function PUT(request) {
  try {
    await dbConnect();

    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const isReorder = searchParams.get("action") === "reorder";

    // Handle reorder request
    if (isReorder || body.action === "reorder" || (body.flowId && body.steps && !body.stepId)) {
      return await handleReorderSteps(body);
    }

    // Handle regular step update
    const { flowId, stepId, stepType, title, description, ...stepData } = body;

    if (!flowId || !stepId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
          message: "flowId and stepId are required",
        },
        { status: 400 }
      );
    }

    // Find the flow - support both MongoDB _id and flowId field
    let flow;
    if (mongoose.Types.ObjectId.isValid(flowId)) {
      flow = await Flow.findById(flowId);
    } else {
      flow = await Flow.findOne({ flowId: parseInt(flowId) });
    }

    if (!flow) {
      return NextResponse.json(
        {
          success: false,
          error: "Flow not found",
          message: "The specified flow does not exist",
        },
        { status: 404 }
      );
    }

    // Find the step
    const stepIndex = flow.steps.findIndex((s) => s.stepId === stepId);
    if (stepIndex === -1) {
      return NextResponse.json(
        {
          success: false,
          error: "Step not found",
          message: "The specified step does not exist in this flow",
        },
        { status: 404 }
      );
    }

    const existingStep = flow.steps[stepIndex];
    const updatedStepType = stepType || existingStep.stepType;

    // Validate step-specific requirements
    const validationError = await validateStepData(updatedStepType, stepData);
    if (validationError) {
      return NextResponse.json(validationError, { status: 400 });
    }

    // Update step data
    const updatedStep = {
      ...existingStep.toObject(),
      ...(stepType && { stepType }),
      ...(title && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() }),
      ...stepData,
      updatedAt: new Date(),
    };

    // Verify target list exists if specified
    if (
      updatedStep.targetListId &&
      updatedStep.targetListId !== existingStep.targetListId
    ) {
      const targetList = await List.findById(updatedStep.targetListId);
      updatedStep.listExist = !!targetList;

      if (!targetList) {
        return NextResponse.json(
          {
            success: false,
            error: "Target list not found",
            message: "The specified target list does not exist",
          },
          { status: 404 }
        );
      }
    }

    // Update the step in the array
    flow.steps[stepIndex] = updatedStep;
    flow.updatedAt = new Date();

    await flow.save();

    // Get updated step with populated data
    const refreshedFlow = await Flow.findById(flow._id).populate(
      "steps.targetListId",
      "name subscriberCount"
    );

    const finalStep = refreshedFlow.steps[stepIndex];

    return NextResponse.json({
      success: true,
      data: finalStep,
      message: "Step updated successfully",
      flowInfo: {
        flowId: flow.flowId,
        flowName: flow.name,
      },
    });
  } catch (error) {
    console.error("Error updating step:", error);

    if (error.name === "ValidationError") {
      return NextResponse.json(
        {
          success: false,
          error: "Validation error",
          message: error.message,
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update step",
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// DELETE - Remove step from flow
export async function DELETE(request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const flowId = searchParams.get("flowId");
    const stepId = searchParams.get("stepId");

    if (!flowId || !stepId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameters",
          message: "Both flowId and stepId are required",
        },
        { status: 400 }
      );
    }

    // Find the flow
    const flow = await Flow.findOne({ flowId: parseInt(flowId) });
    if (!flow) {
      return NextResponse.json(
        {
          success: false,
          error: "Flow not found",
          message: "The specified flow does not exist",
        },
        { status: 404 }
      );
    }

    // Find the step
    const stepIndex = flow.steps.findIndex((s) => s.stepId === stepId);
    if (stepIndex === -1) {
      return NextResponse.json(
        {
          success: false,
          error: "Step not found",
          message: "The specified step does not exist in this flow",
        },
        { status: 404 }
      );
    }

    const deletedStep = flow.steps[stepIndex];

    // Remove the step
    flow.steps.splice(stepIndex, 1);

    // Update step counts for remaining steps
    flow.steps.forEach((step, index) => {
      step.stepCount = index + 1;
    });

    flow.updatedAt = new Date();
    await flow.save();

    return NextResponse.json({
      success: true,
      message: "Step deleted successfully",
      data: {
        deletedStepId: deletedStep.stepId,
        deletedStepTitle: deletedStep.title,
        remainingSteps: flow.steps.length,
      },
      flowInfo: {
        flowId: flow.flowId,
        flowName: flow.name,
        totalSteps: flow.steps.length,
      },
    });
  } catch (error) {
    console.error("Error deleting step:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete step",
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// Helper function to handle step reordering
async function handleReorderSteps(body) {
  try {
    const { flowId, steps } = body;

    if (!flowId || !steps || !Array.isArray(steps)) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
          message: "flowId and steps array are required for reordering",
        },
        { status: 400 }
      );
    }

    // Find the flow - support both MongoDB _id and flowId field
    let flow;
    if (mongoose.Types.ObjectId.isValid(flowId)) {
      flow = await Flow.findById(flowId);
    } else {
      flow = await Flow.findOne({ flowId: parseInt(flowId) });
    }

    if (!flow) {
      return NextResponse.json(
        {
          success: false,
          error: "Flow not found",
          message: "The specified flow does not exist",
        },
        { status: 404 }
      );
    }

    // Validate that all provided steps exist in the flow
    const existingStepIds = flow.steps.map(s => s.stepId);
    const providedStepIds = steps.map(s => s.stepId);

    // Check if all provided stepIds exist
    const invalidStepIds = providedStepIds.filter(id => !existingStepIds.includes(id));
    if (invalidStepIds.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid step IDs",
          message: `The following step IDs do not exist: ${invalidStepIds.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Check if we have the correct number of steps
    if (providedStepIds.length !== existingStepIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: "Incomplete step list",
          message: "All flow steps must be included in the reorder request",
        },
        { status: 400 }
      );
    }

    // Create a map of existing steps for easy lookup
    const stepMap = new Map();
    flow.steps.forEach(step => {
      stepMap.set(step.stepId, step.toObject());
    });

    // Reorder steps according to the provided order and update stepCounts
    const reorderedSteps = steps.map((stepInfo, index) => {
      const existingStep = stepMap.get(stepInfo.stepId);
      if (!existingStep) {
        throw new Error(`Step with ID ${stepInfo.stepId} not found`);
      }

      return {
        ...existingStep,
        stepCount: stepInfo.stepCount || (index + 1), // Use provided stepCount or index + 1
        updatedAt: new Date(),
      };
    });

    // Update the flow with reordered steps
    flow.steps = reorderedSteps;
    flow.updatedAt = new Date();

    await flow.save();

    // Return the updated flow with populated data
    const updatedFlow = await Flow.findById(flow._id)
      .populate("steps.targetListId", "name subscriberCount")
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        flowId: flow.flowId,
        flowName: flow.name,
        steps: updatedFlow.steps.map((step, index) => ({
          ...step,
          stepNumber: index + 1,
          isValid: validateStepCompleteness(step),
        })),
        totalSteps: updatedFlow.steps.length,
      },
      message: "Steps reordered successfully",
    });

  } catch (error) {
    console.error("Error reordering steps:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to reorder steps",
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// Helper function to validate step completeness
function validateStepCompleteness(step) {
  switch (step.stepType) {
    case "sendWebhook":
      return !!(step.webhookUrl && step.requestMethod);

    case "waitSubscriber":
      return !!(step.waitDuration && step.waitUnit && step.waitDuration > 0);

    case "moveSubscriber":
      return !!step.targetListId;

    case "removeSubscriber":
    case "deleteSubscriber":
      return true; // These steps don't require additional data

    default:
      return false;
  }
}

// Helper function to count step types
function getStepTypesCounts(steps) {
  const counts = {
    sendWebhook: 0,
    waitSubscriber: 0,
    moveSubscriber: 0,
    removeSubscriber: 0,
    deleteSubscriber: 0,
  };

  steps.forEach((step) => {
    if (counts.hasOwnProperty(step.stepType)) {
      counts[step.stepType]++;
    }
  });

  return counts;
}

// Helper function to validate step-specific data
async function validateStepData(stepType, stepData) {
  switch (stepType) {
    case "sendWebhook":
      if (!stepData.webhookUrl) {
        return {
          success: false,
          error: "Invalid webhook step",
          message: "webhookUrl is required for sendWebhook type",
        };
      }
      try {
        new URL(stepData.webhookUrl);
      } catch {
        return {
          success: false,
          error: "Invalid webhook URL",
          message: "Please provide a valid webhook URL",
        };
      }
      break;

    case "waitSubscriber":
      if (!stepData.waitDuration || !stepData.waitUnit) {
        return {
          success: false,
          error: "Invalid wait step",
          message:
            "waitDuration and waitUnit are required for waitSubscriber type",
        };
      }
      if (stepData.waitDuration < 1) {
        return {
          success: false,
          error: "Invalid wait duration",
          message: "waitDuration must be at least 1",
        };
      }
      break;

    case "moveSubscriber":
      if (!stepData.targetListId) {
        return {
          success: false,
          error: "Invalid move step",
          message: "targetListId is required for moveSubscriber type",
        };
      }
      // Validate it's a proper ObjectId
      if (!mongoose.Types.ObjectId.isValid(stepData.targetListId)) {
        return {
          success: false,
          error: "Invalid target list ID",
          message: "Please provide a valid list ID",
        };
      }
      break;

    case "removeSubscriber":
    case "deleteSubscriber":
      // No additional validation needed
      break;

    default:
      return {
        success: false,
        error: "Invalid step type",
        message: "Unsupported step type",
      };
  }

  return null; // No validation errors
}