// /api/work-flow/steps/route.js
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/config/mongoConfig";
import Flow from "@/models/Flow";
import List from "@/models/List";
import Template from "@/models/Template";

// GET - Retrieve steps from a flow
export async function GET(request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const flowId = searchParams.get("flowId");
    const stepId = searchParams.get("stepId");

    if (!flowId) {
      return NextResponse.json(
        { success: false, message: "Flow ID is required" },
        { status: 400 }
      );
    }

    // Validate flowId format
    if (!mongoose.Types.ObjectId.isValid(flowId)) {
      return NextResponse.json(
        { success: false, message: "Invalid Flow ID format" },
        { status: 400 }
      );
    }

    const flow = await Flow.findById(flowId).populate([
      {
        path: "listId",
        model: "List",
      },
    ]);

    if (!flow) {
      return NextResponse.json(
        { success: false, message: "Flow not found" },
        { status: 404 }
      );
    }

    // If stepId is provided, return specific step
    if (stepId) {
      const step = flow.steps.id(stepId);
      if (!step) {
        return NextResponse.json(
          { success: false, message: "Step not found" },
          { status: 404 }
        );
      }

      // Populate additional data for specific step types
      let enrichedStep = step.toObject();

      if (step.stepType === "moveSubscriber" && step?.targetListId) {
        try {
          const targetList = await List.findById(step?.targetListId);
          enrichedStep.targetList = targetList;
        } catch (error) {
          console.warn("Could not populate target list:", error.message);
        }
      }

      if (step.stepType === "sendMail" && step.sendMailTemplate) {
        try {
          const template = await Template.findById(step.sendMailTemplate);
          enrichedStep.template = template;
        } catch (error) {
          console.warn("Could not populate email template:", error.message);
        }
      }

      return NextResponse.json({
        success: true,
        data: enrichedStep,
      });
    }

    // Return all steps with enriched data
    const enrichedSteps = await Promise.all(
      flow.steps.map(async (step) => {
        let enrichedStep = step.toObject();

        if (step.stepType === "moveSubscriber" && step?.targetListId) {
          try {
            const targetList = await List.findById(step?.targetListId);
            enrichedStep.targetList = targetList;
          } catch (error) {
            console.warn("Could not populate target list:", error.message);
          }
        }

        if (step.stepType === "sendMail" && step.sendMailTemplate) {
          try {
            const template = await Template.findById(step.sendMailTemplate);
            enrichedStep.template = template;
          } catch (error) {
            console.warn("Could not populate email template:", error.message);
          }
        }

        return enrichedStep;
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        flow: {
          _id: flow._id,
          name: flow.name,
          flowId: flow.flowId,
          isActive: flow.isActive,
        },
        steps: enrichedSteps,
      },
    });
  } catch (error) {
    console.error("GET Steps Error:", error);
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

// POST - Create a new step
export async function POST(request) {
  try {
    await dbConnect();

    const body = await request.json();
    const { flowId, step } = body;

    // Basic validation
    if (!flowId || !step) {
      return NextResponse.json(
        { success: false, message: "Flow ID and step data are required" },
        { status: 400 }
      );
    }

    // Validate flowId format
    if (!mongoose.Types.ObjectId.isValid(flowId)) {
      return NextResponse.json(
        { success: false, message: "Invalid Flow ID format" },
        { status: 400 }
      );
    }

    // Clean the step data - remove empty fields that aren't required
    const cleanedStep = cleanStepData(step);

    // Validate step data based on step type
    const validationError = validateStepData(cleanedStep);
    if (validationError) {
      return NextResponse.json(
        { success: false, message: validationError },
        { status: 400 }
      );
    }

    // Find the flow and validate it exists
    const flow = await Flow.findById(flowId);
    if (!flow) {
      return NextResponse.json(
        { success: false, message: "Flow not found" },
        { status: 404 }
      );
    }

    // Validate references for specific step types
    if (cleanedStep.stepType === "moveSubscriber") {
      if (!cleanedStep.targetListId) {
        return NextResponse.json(
          {
            success: false,
            message: "Target list ID is required for moveSubscriber step",
          },
          { status: 400 }
        );
      }

      if (!mongoose.Types.ObjectId.isValid(cleanedStep.targetListId)) {
        return NextResponse.json(
          { success: false, message: "Invalid target list ID format" },
          { status: 400 }
        );
      }

      const targetList = await List.findById(cleanedStep.targetListId);
      if (!targetList) {
        return NextResponse.json(
          { success: false, message: "Target list not found" },
          { status: 404 }
        );
      }
      cleanedStep.isActive = true;
    }

    if (cleanedStep.stepType === "sendMail") {
      if (!cleanedStep.sendMailTemplate) {
        return NextResponse.json(
          {
            success: false,
            message: "Email template is required for sendMail step",
          },
          { status: 400 }
        );
      }

      if (!mongoose.Types.ObjectId.isValid(cleanedStep.sendMailTemplate)) {
        return NextResponse.json(
          { success: false, message: "Invalid template ID format" },
          { status: 400 }
        );
      }

      const template = await Template.findById(cleanedStep.sendMailTemplate);
      if (!template) {
        return NextResponse.json(
          { success: false, message: "Email template not found" },
          { status: 404 }
        );
      }
    }

    // Set step count based on current steps length
    cleanedStep.stepCount = flow.steps.length + 1;
    cleanedStep._id = new mongoose.Types.ObjectId(); // Generate a new ID for the step

    // Add the step to the flow
    flow.steps.push(cleanedStep);
    await flow.save();

    const newStep = flow.steps[flow.steps.length - 1];

    return NextResponse.json(
      {
        success: true,
        message: "Step created successfully",
        data: newStep,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST Step Error:", error);

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

// Helper function to clean step data
function cleanStepData(step) {
  const cleaned = { ...step };

  // Remove empty strings from optional fields
  const optionalFields = [
    "description",
    "webhookUrl",
    "requestBody",
    "sendMailSubject",
    "targetListId",
    "sendMailTemplate",
  ];

  optionalFields.forEach((field) => {
    if (cleaned[field] === "") {
      delete cleaned[field];
    }
  });

  // Remove empty arrays
  if (cleaned.requestHeaders && cleaned.requestHeaders.length === 0) {
    delete cleaned.requestHeaders;
  }

  // Set sendMailTemplate from sendMailTemplate for sendMail step type
  if (cleaned.stepType === "sendMail" && cleaned.sendMailTemplate) {
    cleaned.sendMailTemplate = cleaned.sendMailTemplate;
  }

  return cleaned;
}

// PUT - Update an existing step
export async function PUT(request) {
  try {
    await dbConnect();

    const body = await request.json();
    const { flowId, stepId, stepData } = body;

    if (!flowId || !stepId || !stepData) {
      return NextResponse.json(
        {
          success: false,
          message: "Flow ID, step ID, and step data are required",
        },
        { status: 400 }
      );
    }

    // Validate IDs format
    if (!mongoose.Types.ObjectId.isValid(flowId)) {
      return NextResponse.json(
        { success: false, message: "Invalid Flow ID format" },
        { status: 400 }
      );
    }

    console.log(stepData);

    // Validate step data based on step type
    const validationError = validateStepData(stepData);
    if (validationError) {
      return NextResponse.json(
        { success: false, message: validationError },
        { status: 400 }
      );
    }

    const flow = await Flow.findById(flowId);
    if (!flow) {
      return NextResponse.json(
        { success: false, message: "Flow not found" },
        { status: 404 }
      );
    }

    const step = flow.steps.id(stepId);
    if (!step) {
      return NextResponse.json(
        { success: false, message: "Step not found" },
        { status: 404 }
      );
    }

    // Validate references for specific step types
    if (stepData.stepType === "moveSubscriber" && stepData?.targetListId) {
      if (!mongoose.Types.ObjectId.isValid(stepData?.targetListId)) {
        return NextResponse.json(
          { success: false, message: "Invalid target list ID format" },
          { status: 400 }
        );
      }

      const targetList = await List.findById(stepData?.targetListId);
      if (!targetList) {
        return NextResponse.json(
          { success: false, message: "Target list not found" },
          { status: 404 }
        );
      }
      stepData.listExist = true;
    }

    if (stepData.stepType === "sendMail" && stepData.sendMailTemplate) {
      if (!mongoose.Types.ObjectId.isValid(stepData.sendMailTemplate)) {
        return NextResponse.json(
          { success: false, message: "Invalid template ID format" },
          { status: 400 }
        );
      }

      const template = await Template.findById(stepData.sendMailTemplate);
      if (!template) {
        return NextResponse.json(
          { success: false, message: "Email template not found" },
          { status: 404 }
        );
      }
    }

    if (stepData.stepCount !== step.stepCount) {
      step.stepCount = stepData.stepCount;
    } else {
      stepData.stepCount = step.stepCount;
    }

    // Preserve the original stepCount

    // Update step properties
    Object.assign(step, stepData);
    await flow.save();

    return NextResponse.json({
      success: true,
      message: "Step updated successfully",
      data: step,
    });
  } catch (error) {
    console.error("PUT Step Error:", error);

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

// DELETE - Remove a step
export async function DELETE(request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const flowId = searchParams.get("flowId");
    const stepId = searchParams.get("stepId");

    if (!flowId || !stepId) {
      return NextResponse.json(
        { success: false, message: "Flow ID and step ID are required" },
        { status: 400 }
      );
    }

    // Validate flowId format
    if (!mongoose.Types.ObjectId.isValid(flowId)) {
      return NextResponse.json(
        { success: false, message: "Invalid Flow ID format" },
        { status: 400 }
      );
    }

    const flow = await Flow.findById(flowId);
    if (!flow) {
      return NextResponse.json(
        { success: false, message: "Flow not found" },
        { status: 404 }
      );
    }

    const stepIndex = flow.steps.findIndex(
      (step) => step._id.toString() === stepId
    );
    if (stepIndex === -1) {
      return NextResponse.json(
        { success: false, message: "Step not found" },
        { status: 404 }
      );
    }

    // Remove the step
    const deletedStep = flow.steps[stepIndex];
    flow.steps.splice(stepIndex, 1);

    // Recalculate step counts for remaining steps
    flow.steps.forEach((step, index) => {
      step.stepCount = index + 1;
    });

    await flow.save();

    return NextResponse.json({
      success: true,
      message: "Step deleted successfully",
      data: {
        deletedStep: deletedStep,
        remainingSteps: flow.steps.length,
      },
    });
  } catch (error) {
    console.error("DELETE Step Error:", error);
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

// Utility function to validate step data based on step type
function validateStepData(step) {
  const { stepType } = step;

  if (!stepType) {
    return "Step type is required";
  }

  const validStepTypes = [
    "sendWebhook",
    "waitSubscriber",
    "moveSubscriber",
    "removeSubscriber",
    "deleteSubscriber",
    "sendMail",
  ];

  if (!validStepTypes.includes(stepType)) {
    return `Invalid step type. Must be one of: ${validStepTypes.join(", ")}`;
  }

  if (!step.title || step.title.trim() === "") {
    return "Step title is required";
  }

  // Step-specific validations
  switch (stepType) {
    case "sendWebhook":
      if (!step.webhookUrl || step.webhookUrl.trim() === "") {
        return "Webhook URL is required for sendWebhook step";
      }
      if (
        step.requestMethod &&
        !["GET", "POST", "PUT", "DELETE"].includes(step.requestMethod)
      ) {
        return "Invalid request method. Must be GET, POST, PUT, or DELETE";
      }
      if (
        step.retryAttempts !== undefined &&
        (step.retryAttempts < 0 || !Number.isInteger(step.retryAttempts))
      ) {
        return "Retry attempts must be a non-negative integer";
      }
      if (
        step.retryAfterSeconds !== undefined &&
        (step.retryAfterSeconds < 0 ||
          !Number.isInteger(step.retryAfterSeconds))
      ) {
        return "Retry after seconds must be a non-negative integer";
      }
      if (step.queryParams && Array.isArray(step.queryParams)) {
        for (const param of step.queryParams) {
          if (!param.key || param.key.trim() === "") {
            return "Query parameter key is required";
          }
          if (param.type && !["static", "email"].includes(param.type)) {
            return "Query parameter type must be 'static' or 'email'";
          }
        }
      }
      break;

    case "waitSubscriber":
      if (!step.waitDuration || Number(step.waitDuration) < 1) {
        return "Wait duration must be a positive integer";
      }
      if (!step.waitUnit) {
        return "Wait unit is required for waitSubscriber step";
      }
      if (
        !["seconds", "minutes", "hours", "days", "weeks", "months"].includes(
          step.waitUnit
        )
      ) {
        return "Invalid wait unit. Must be minutes, hours, days, weeks, or months";
      }
      // No validation for targetListId since it's not relevant for this step type
      break;

    case "sendMail":
      if (!step.sendMailTemplate) {
        return "Email template is required for sendMail step";
      }
      break;

    case "moveSubscriber":
      // targetListId validation is handled in the main functions
      if (!step.targetListId) {
        return "TargetListId is required for wait step";
      }
      break;

    case "removeSubscriber":
    case "deleteSubscriber":
      // These step types don't have additional required fields
      break;
  }

  return null; // No validation errors
}
