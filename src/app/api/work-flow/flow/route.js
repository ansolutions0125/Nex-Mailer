// app/api/work-flow/flow/route.js
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/config/mongoConfig";

import Customer from "@/models/Customer";
import Stats from "@/models/Stats";
import Flow from "@/models/Flow";
import List from "@/models/List";

import { validateAccessBothAdminCustomer } from "@/lib/withAuthFunctions";

/**
 * GET /api/work-flow/flow
 *  - ?automationId=<id>  -> returns a single automation with populated customer/list
 *  - pagination: ?page=&limit=
 *  - If caller is a customer, results are auto-scoped to their customerId
 *  - Response (list): { success, data: { automations, pagination } }
 *  - Response (single): { success, data: { automation, connectedList, customerData, stepsCount, steps } }
 */
export async function GET(request) {
  try {
    const authData = await validateAccessBothAdminCustomer(request);
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const automationId = searchParams.get("automationId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const skip = (page - 1) * limit;

    // Single automation by id
    if (automationId) {
      if (!mongoose.Types.ObjectId.isValid(automationId)) {
        return NextResponse.json(
          { success: false, message: "Invalid automation ID format" },
          { status: 400 }
        );
      }

      // Scope for customers: ensure ownership
      const scope = authData.customer?._id
        ? { _id: automationId, customerId: authData.customer._id }
        : { _id: automationId };

      const automation = await Flow.findOne(scope).populate([
        { path: "listId", model: "List", select: "_id name isActive" },
        {
          path: "customerId",
          model: "Customer",
          select: "_id firstName lastName email slug isActive",
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
          automation,
          connectedList: automation.listId
            ? { _id: automation.listId._id, name: automation.listId.name }
            : null,
          customerData: automation.customerId
            ? {
                _id: automation.customerId._id,
                firstName: automation.customerId.firstName,
                lastName: automation.customerId.lastName,
                email: automation.customerId.email,
              }
            : null,
          stepsCount: automation.steps.length,
          steps: automation.steps,
        },
      });
    }

    // List with pagination
    const query = authData.customer?._id
      ? { customerId: authData.customer._id }
      : {};

    const automations = await Flow.find(query)
      .populate([
        { path: "listId", model: "List", select: "_id name isActive" },
        {
          path: "customerId",
          model: "Customer",
          select: "_id firstName lastName email slug isActive",
        },
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalAutomations = await Flow.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(totalAutomations / limit));

    const formattedAutomations = automations.map((automation) => ({
      automation: {
        _id: automation._id,
        name: automation.name,
        logo: automation.logo,
        flowId: automation.flowId, // keep if you’ve been using it; harmless if undefined
        isActive: automation.isActive,
        stats: automation.stats,
        createdAt: automation.createdAt,
        updatedAt: automation.updatedAt,
      },
      connectedList: automation.listId
        ? { _id: automation.listId._id, name: automation.listId.name }
        : null,
      customerData: automation.customerId
        ? {
            _id: automation.customerId._id,
            firstName: automation.customerId.firstName,
            lastName: automation.customerId.lastName,
            email: automation.customerId.email,
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
          totalPages,
          totalItems: totalAutomations,
          itemsPerPage: limit,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("GET Flow Error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/work-flow/flow
 *  - body: { name, description?, customerId?, listId?, logo?, steps?=[] }
 *  - If caller is a customer, customerId is forced to their id
 */
export async function POST(request) {
  
  try {
    const authData = await validateAccessBothAdminCustomer(request);
    await dbConnect();

    const body = await request.json();
    const { name, description, customerId, listId, logo, steps = [] } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, message: "Automation name is required" },
        { status: 400 }
      );
    }

    // Prefer explicit body.customerId for admins; force for customers
    const targetCustomerId = authData.customer?._id || customerId;
    if (!targetCustomerId || !mongoose.Types.ObjectId.isValid(targetCustomerId)) {
      return NextResponse.json(
        { success: false, message: "Valid customer ID is required" },
        { status: 400 }
      );
    }

    // Validate customer exists
    const customer = await Customer.findById(targetCustomerId);
    if (!customer) {
      return NextResponse.json(
        { success: false, message: "Customer not found" },
        { status: 404 }
      );
    }

    const automationData = {
      name: name.trim(),
      description,
      customerId: targetCustomerId,
      listId: listId || null,
      steps,
      isActive: false,
    };
    if (logo) automationData.logo = logo;

    const automation = await new Flow(automationData).save();

    // Customer stats++
    await Customer.findByIdAndUpdate(
      targetCustomerId,
      { $inc: { "stats.totalAutomations": 1 } },
      { new: true }
    );

    // Backlink list -> automation
    if (listId) {
      await List.findByIdAndUpdate(listId, { automationId: automation._id });
    }

    // Global stats
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

    // Populate for response
    const populated = await Flow.findById(automation._id).populate([
      { path: "customerId", model: "Customer", select: "_id firstName lastName email slug isActive" },
      { path: "listId", model: "List", select: "_id name isActive" },
    ]);

    return NextResponse.json(
      {
        success: true,
        message: "Automation created successfully",
        data: {
          automation: populated,
          customerData: populated.customerId,
          connectedList: populated.listId
            ? { _id: populated.listId._id, name: populated.listId.name }
            : null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST Flow Error:", error);
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map((e) => e.message);
      return NextResponse.json(
        { success: false, message: "Validation failed", errors: validationErrors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/work-flow/flow
 *  - body: { automationId, status, updateData }
 *  - status ∈ {"multi","nameChange","statusChange","listIdUpdate"}
 *  - For customers: only allow updates to their own automations
 */
export async function PUT(request) {
  
  try {
    const authData = await validateAccessBothAdminCustomer(request);
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
    const validStatuses = ["multi", "nameChange", "statusChange", "listIdUpdate"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Ownership check for customers
    const scope = authData.customer?._id
      ? { _id: automationId, customerId: authData.customer._id }
      : { _id: automationId };

    const automation = await Flow.findOne(scope);
    if (!automation) {
      return NextResponse.json(
        { success: false, message: "Automation not found" },
        { status: 404 }
      );
    }

    let updateObject = {};
    let responseMessage = "";

    switch (status) {
      case "nameChange": {
        if (!updateData?.name || !updateData.name.trim()) {
          return NextResponse.json(
            { success: false, message: "New name is required for nameChange" },
            { status: 400 }
          );
        }
        updateObject.name = updateData.name.trim();
        responseMessage = "Automation name updated successfully";
        break;
      }
      case "statusChange": {
        if (typeof updateData?.isActive !== "boolean") {
          return NextResponse.json(
            { success: false, message: "isActive boolean value is required for statusChange" },
            { status: 400 }
          );
        }
        updateObject.isActive = updateData.isActive;
        responseMessage = `Automation ${updateData.isActive ? "activated" : "deactivated"} successfully`;
        break;
      }
      case "listIdUpdate": {
        // attach or detach a list backing link
        if (updateData?.listId) {
          if (!mongoose.Types.ObjectId.isValid(updateData.listId)) {
            return NextResponse.json(
              { success: false, message: "Invalid list ID format" },
              { status: 400 }
            );
          }
          const list = await List.findById(updateData.listId);
          if (!list) {
            return NextResponse.json(
              { success: false, message: "List not found" },
              { status: 404 }
            );
          }
          await List.findByIdAndUpdate(updateData.listId, { automationId: automation._id });
          updateObject.listId = updateData.listId;
          responseMessage = "Automation list updated successfully";
        } else {
          // detach
          updateObject.listId = null;
          responseMessage = "Automation list removed successfully";
        }
        break;
      }
      case "multi": {
        if (!updateData || typeof updateData !== "object") {
          return NextResponse.json(
            { success: false, message: "Update data object is required for multi status" },
            { status: 400 }
          );
        }

        // listId explicit handling
        if (Object.prototype.hasOwnProperty.call(updateData, "listId")) {
          if (updateData.listId) {
            if (!mongoose.Types.ObjectId.isValid(updateData.listId)) {
              return NextResponse.json(
                { success: false, message: "Invalid list ID format" },
                { status: 400 }
              );
            }
            const list = await List.findById(updateData.listId);
            if (!list) {
              return NextResponse.json(
                { success: false, message: "List not found" },
                { status: 404 }
              );
            }
            await List.findByIdAndUpdate(updateData.listId, { automationId: automation._id });
            updateObject.listId = updateData.listId;
          } else {
            updateObject.listId = null;
          }
        }

        // customerId reassignment (admin only; customers can’t move ownership)
        if (Object.prototype.hasOwnProperty.call(updateData, "customerId")) {
          if (authData.customer?._id) {
            return NextResponse.json(
              { success: false, message: "Customers cannot change automation ownership" },
              { status: 403 }
            );
          }
          if (updateData.customerId) {
            if (!mongoose.Types.ObjectId.isValid(updateData.customerId)) {
              return NextResponse.json(
                { success: false, message: "Invalid customer ID format" },
                { status: 400 }
              );
            }
            const newCustomer = await Customer.findById(updateData.customerId);
            if (!newCustomer) {
              return NextResponse.json(
                { success: false, message: "Customer not found" },
                { status: 404 }
              );
            }
            // stats: decrement old, increment new
            if (automation.customerId) {
              await Customer.findByIdAndUpdate(automation.customerId, {
                $inc: { "stats.totalAutomations": -1 },
              });
            }
            await Customer.findByIdAndUpdate(updateData.customerId, {
              $inc: { "stats.totalAutomations": 1 },
            });
            updateObject.customerId = updateData.customerId;
          }
        }

        if (Object.prototype.hasOwnProperty.call(updateData, "name")) {
          if (!updateData.name || !updateData.name.trim()) {
            return NextResponse.json(
              { success: false, message: "Invalid name provided" },
              { status: 400 }
            );
          }
          updateObject.name = updateData.name.trim();
        }
        if (Object.prototype.hasOwnProperty.call(updateData, "description")) {
          updateObject.description = (updateData.description || "").trim();
        }
        if (Object.prototype.hasOwnProperty.call(updateData, "isActive")) {
          if (typeof updateData.isActive !== "boolean") {
            return NextResponse.json(
              { success: false, message: "isActive must be a boolean" },
              { status: 400 }
            );
          }
          updateObject.isActive = updateData.isActive;
        }
        if (Object.prototype.hasOwnProperty.call(updateData, "logo")) {
          updateObject.logo = updateData.logo;
        }

        responseMessage = "Automation updated successfully";
        break;
      }
      default:
        // should never happen due to earlier validation
        return NextResponse.json(
          { success: false, message: "Invalid status provided" },
          { status: 400 }
        );
    }

    const updated = await Flow.findByIdAndUpdate(automationId, updateObject, {
      new: true,
      runValidators: true,
    }).populate([
      { path: "customerId", model: "Customer", select: "_id firstName lastName email slug isActive" },
      { path: "listId", model: "List", select: "_id name isActive" },
    ]);

    return NextResponse.json({
      success: true,
      message: responseMessage,
      data: {
        automation: updated,
        customerData: updated.customerId,
        connectedList: updated.listId
          ? { _id: updated.listId._id, name: updated.listId.name }
          : null,
        updatedFields: Object.keys(updateObject),
      },
    });
  } catch (error) {
    console.error("PUT Flow Error:", error);
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map((e) => e.message);
      return NextResponse.json(
        { success: false, message: "Validation failed", errors: validationErrors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/work-flow/flow?automationId=<id>
 *  - For customers: can only delete their own automations
 */
export async function DELETE(request) {
  
  try {
    const authData = await validateAccessBothAdminCustomer(request);
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const automationId = searchParams.get("automationId");

    if (!automationId || !mongoose.Types.ObjectId.isValid(automationId)) {
      return NextResponse.json(
        { success: false, message: "Valid automation ID is required" },
        { status: 400 }
      );
    }

    const scope = authData.customer?._id
      ? { _id: automationId, customerId: authData.customer._id }
      : { _id: automationId };

    const automation = await Flow.findOne(scope);
    if (!automation) {
      return NextResponse.json(
        { success: false, message: "Automation not found" },
        { status: 404 }
      );
    }

    const deletedAutomationData = {
      _id: automation._id,
      name: automation.name,
      flowId: automation.flowId,
      customerId: automation.customerId,
      stepsCount: automation.steps.length,
    };

    // Customer stats--
    if (automation.customerId) {
      await Customer.findByIdAndUpdate(automation.customerId, {
        $inc: { "stats.totalAutomations": -1 },
      });
    }

    // Global stats
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

    // Clear backlink from List if any
    if (automation.listId) {
      await List.findByIdAndUpdate(automation.listId, { automationId: null });
    }

    await Flow.findByIdAndDelete(automationId);

    return NextResponse.json({
      success: true,
      message: "Automation deleted successfully",
      data: { deletedAutomation: deletedAutomationData },
    });
  } catch (error) {
    console.error("DELETE Flow Error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
