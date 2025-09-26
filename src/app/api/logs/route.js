import { NextResponse } from "next/server";
import dbConnect from "@/config/mongoConfig";
import EmailLogs from "@/models/EmailLogs";
import Contact from "@/models/Contact";
import Server from "@/models/Server";
import Flow from "@/models/Flow";
import Template from "@/models/Template";
import { Types } from "mongoose"; // Import Types for ObjectId validation

const ITEMS_PER_PAGE = 30;

export async function GET(request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);

    // Pagination parameters
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || ITEMS_PER_PAGE;
    const skip = (page - 1) * limit;

    // Input validation for pagination
    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) {
      return NextResponse.json(
        { success: false, error: "Invalid page or limit parameter." },
        { status: 400 }
      );
    }

    // Filter parameters
    const status = searchParams.get("status");
    const flowId = searchParams.get("flowId");
    const serverId = searchParams.get("serverId");
    const contactId = searchParams.get("contactId");
    const listId = searchParams.get("listId");
    const websiteId = searchParams.get("websiteId");
    const email = searchParams.get("email");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const sortBy = searchParams.get("sortBy") || "sentAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const search = searchParams.get("search");

    // Build filter object
    const filter = {};

    // Validate and add filters to the query
    if (status) filter.status = status;
    if (listId) filter.listId = listId;
    if (websiteId) filter.websiteId = websiteId;
    if (email) filter.contactEmail = email;
    if (dateFrom || dateTo) {
      filter.sentAt = {};
      if (dateFrom) filter.sentAt.$gte = new Date(dateFrom);
      if (dateTo) filter.sentAt.$lte = new Date(dateTo);
    }

    // Validate and add ID-based filters with ObjectId check
    if (contactId) {
      if (!Types.ObjectId.isValid(contactId)) {
        return NextResponse.json(
          { success: false, error: "Invalid Contact ID format." },
          { status: 400 }
        );
      }
      const contactExists = await Contact.findOne({
        _id: contactId,
        deleted: { $ne: true },
      });
      if (!contactExists) {
        return NextResponse.json(
          { success: false, error: "Contact ID not found." },
          { status: 404 }
        );
      }
      filter.contactId = contactId;
    }

    if (flowId) {
      if (!Types.ObjectId.isValid(flowId)) {
        return NextResponse.json(
          { success: false, error: "Invalid Flow ID format." },
          { status: 400 }
        );
      }
      const flowExists = await Flow.findById(flowId);
      if (!flowExists) {
        return NextResponse.json(
          { success: false, error: "Flow ID not found." },
          { status: 404 }
        );
      }
      filter.flowId = flowId;
    }

    if (serverId) {
      if (!Types.ObjectId.isValid(serverId)) {
        return NextResponse.json(
          { success: false, error: "Invalid Server ID format." },
          { status: 400 }
        );
      }
      const serverExists = await Server.findById(serverId);
      if (!serverExists) {
        return NextResponse.json(
          { success: false, error: "Server ID not found." },
          { status: 404 }
        );
      }
      filter.serverId = serverId;
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { contactEmail: searchRegex },
        { subject: searchRegex },
        { contactName: searchRegex },
      ];
    }

    // Prepare sort object
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    // Fetch total count for pagination
    const total = await EmailLogs.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    const logs = await EmailLogs.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate({
        path: "contactId",
        select: "fullName email",
      })
      .populate({
        path: "flowId",
        select: "name",
      })
      .populate({
        path: "templateId",
        select: "name",
      })
      .populate({
        path: "serverId",
        select: "name type",
      })
      .lean();

    // Map logs to flatten populated fields
    const formattedLogs = logs.map((log) => ({
      ...log,
      contactName: log.contactId?.fullName || "Unknown",
      contactEmail: log.contactId?.email || "Unknown",
      flowName: log.flowId?.name || "N/A",
      templateName: log.templateId?.name || "N/A",
      serverName: log.serverId?.name || "N/A",
      serverType: log.serverId?.type || "N/A",
      // Calculate time since sent for display
      timeSinceSent: Math.floor(
        (new Date() - new Date(log.sentAt)) / (1000 * 60 * 60)
      ),
    }));

    // Calculate statistics
    const totalEmails = await EmailLogs.countDocuments();
    const openedEmails = await EmailLogs.countDocuments({ status: "opened" });

    const statistics = {
      totalEmails,
      openedEmails,
    };

    const pagination = {
      total,
      limit,
      currentPage: page,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
    };

    return NextResponse.json({
      success: true,
      message: "Email logs retrieved successfully.",
      data: {
        logs: formattedLogs,
        statistics,
        pagination,
      },
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to retrieve email logs. Please try again later.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    await dbConnect();

    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: "Action is required in the request body." },
        { status: 400 }
      );
    }

    switch (action) {
      case "bulkDelete":
        const { logIds: deleteIds } = body;

        if (!Array.isArray(deleteIds) || deleteIds.length === 0) {
          return NextResponse.json(
            {
              success: false,
              error: "logIds array is required for bulkDelete.",
            },
            { status: 400 }
          );
        }

        const deleteResult = await EmailLogs.deleteMany({
          _id: { $in: deleteIds },
        });

        return NextResponse.json({
          success: true,
          message: `Successfully deleted ${deleteResult.deletedCount} logs.`,
          deletedCount: deleteResult.deletedCount,
        });

      case "bulkUpdate":
        const { logIds, newStatus } = body;

        if (!Array.isArray(logIds) || logIds.length === 0) {
          return NextResponse.json(
            {
              success: false,
              error: "logIds array is required for bulkUpdate.",
            },
            { status: 400 }
          );
        }

        if (!newStatus) {
          return NextResponse.json(
            { success: false, error: "newStatus is required for bulkUpdate." },
            { status: 400 }
          );
        }

        const updateResult = await EmailLogs.updateMany(
          { _id: { $in: logIds } },
          { $set: { status: newStatus, updatedAt: new Date() } }
        );

        return NextResponse.json({
          success: true,
          message: `Successfully updated ${updateResult.modifiedCount} logs.`,
          modifiedCount: updateResult.modifiedCount,
        });

      case "cleanup":
        const daysToKeep = parseInt(body.daysToKeep) || 90;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const cleanupResult = await EmailLogs.deleteMany({
          sentAt: { $lt: cutoffDate },
        });

        return NextResponse.json({
          success: true,
          message: `Successfully cleaned up ${cleanupResult.deletedCount} old logs.`,
          deletedCount: cleanupResult.deletedCount,
          cutoffDate,
        });

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action specified." },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in logs POST operation:", error);
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred. Please try again later.",
      },
      { status: 500 }
    );
  }
}
