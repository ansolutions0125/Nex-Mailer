// api/list/route.js

import dbConnect from "@/config/mongoConfig";
import List from "@/models/List";
import { NextResponse } from "next/server";
import Customer from "@/models/Customer";
import { validateAccessBothAdminCustomer } from "@/lib/withAuthFunctions";

export async function GET(request) {
  const authData = validateAccessBothAdminCustomer(request);
  await dbConnect();

  try {
    const { searchParams } = new URL(request.url);
    const listId = searchParams.get("listId");
    const notConnected = searchParams.get("notConnected");

    let lists;
    if (listId) {
      // For customer, only fetch list if it belongs to them
      if (authData?.customer?._id) {
        lists = await List.findOne({
          _id: listId,
          customerId: authData.customer._id,
        }).populate('automationId customerId');
      }

      if (!lists) {
        return NextResponse.json(
          { success: false, message: "List not found." },
          { status: 404 }
        );
      }
    } else {
      // For customer, only fetch their lists
      if (authData?.customer?._id) {
        if (notConnected === "true") {
          lists = await List.find({
            customerId: authData.customer._id,
            automationId: null,
          }).populate('automationId customerId');
        } else {
          lists = await List.find({ customerId: authData.customer._id }).populate('automationId customerId');
        }
      } else {
        if (notConnected === "true") {
          lists = await List.find({ automationId: null }).populate('automationId customerId');
        } else {
          lists = await List.find({}).populate('automationId customerId');
        }
      }
    }

    return NextResponse.json({ success: true, data: lists }, { status: 200 });
  } catch (error) {
    console.error("GET List Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch lists." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const authData = validateAccessBothAdminCustomer(request);

  await dbConnect();

  try {
    const body = await request.json();
    const { automationId, customerId } = body;

    // Set defaults for optional fields
    body.automationId = automationId || null;
    body.customerId = customerId || null;

    // If customer is creating list, set their ID
    if (authData?.customer?._id) {
      body.customerId = authData.customer._id;
    }

    // If admin provides customerId, verify customer exists
    if (authData?.admin?._id && customerId) {
      const customerExists = await Customer.findById(customerId);
      if (!customerExists) {
        return NextResponse.json(
          { success: false, message: "Customer not found" },
          { status: 404 }
        );
      }
    }

    let newList = await List.create(body);

    if (newList.customerId) {
      await Customer.findByIdAndUpdate(newList.customerId, {
        $inc: { "stats.totalLists": 1 },
        $push: { lists: newList._id },
      });
    }

    return NextResponse.json({ success: true, data: newList }, { status: 201 });
  } catch (error) {
    console.error("POST List Error:", error);
    if (error.name === "ValidationError") {
      return NextResponse.json(
        { success: false, message: error.message, errors: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create list." },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  const authData = validateAccessBothAdminCustomer(request);
  await dbConnect();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, message: "list id is required to update a list." },
        { status: 400 }
      );
    }

    // Check if list exists and get ownership info
    const existingList = await List.findById(id);
    if (!existingList) {
      return NextResponse.json(
        { success: false, message: "List not found." },
        { status: 404 }
      );
    }

    // Check permissions and ownership
    if (authData?.customer?._id) {
      // Customer can only update their own lists
      if (
        existingList.customerId?.toString() !== authData.customer._id.toString()
      ) {
        return NextResponse.json(
          { success: false, message: "You can only update your own lists" },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const { automationId, customerId } = body;

    // Prevent customers from changing customerId
    if (
      authData?.customer?._id &&
      customerId &&
      customerId !== authData.customer._id.toString()
    ) {
      return NextResponse.json(
        { success: false, message: "Cannot change list ownership" },
        { status: 403 }
      );
    }

    // If admin is changing customerId, validate the new customer exists
    if (
      authData?.admin?._id &&
      customerId &&
      customerId !== existingList.customerId?.toString()
    ) {
      const customerExists = await Customer.findById(customerId);
      if (!customerExists) {
        return NextResponse.json(
          { success: false, message: "New customer not found" },
          { status: 404 }
        );
      }
    }

    if (automationId === "") {
      body.automationId = null;
    }

    const list = await List.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    return NextResponse.json({ success: true, data: list }, { status: 200 });
  } catch (error) {
    console.error("PUT List Error:", error);
    if (error.name === "ValidationError") {
      return NextResponse.json(
        { success: false, message: error.message, errors: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update list." },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  const authData = validateAccessBothAdminCustomer(request);
  await dbConnect();

  try {
    const { searchParams } = new URL(request.url);
    const listId = searchParams.get("id");

    // Handle bulk delete if request has body
    if (!listId) {
      const body = await request.json();
      const { listIds } = body;

      if (!listIds || !Array.isArray(listIds) || listIds.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "listIds array is required for bulk delete.",
          },
          { status: 400 }
        );
      }

      // For customers, verify they own all the lists they want to delete
      if (authData?.customer?._id) {
        const unauthorizedLists = await List.find({
          _id: { $in: listIds },
          customerId: { $ne: authData.customer._id },
        });
        if (unauthorizedLists.length > 0) {
          return NextResponse.json(
            { success: false, message: "You can only delete your own lists" },
            { status: 403 }
          );
        }
      }

      const deletedLists = await List.find({ _id: { $in: listIds } });
      await List.deleteMany({ _id: { $in: listIds } });

      // Update customer stats for all deleted lists
      for (const list of deletedLists) {
        if (list.customerId) {
          await Customer.findByIdAndUpdate(list.customerId, {
            $inc: { "stats.totalLists": -1 },
            $pull: { lists: list._id },
          });
        }
      }

      return NextResponse.json(
        {
          success: true,
          message: `${deletedLists.length} lists deleted successfully.`,
        },
        { status: 200 }
      );
    }

    // Handle single delete
    const existingList = await List.findById(listId);
    if (!existingList) {
      return NextResponse.json(
        { success: false, message: "List not found." },
        { status: 404 }
      );
    }

    // Check permissions and ownership for single delete
    if (authData?.customer?._id) {
      if (
        existingList.customerId?.toString() !== authData.customer._id.toString()
      ) {
        return NextResponse.json(
          { success: false, message: "You can only delete your own lists" },
          { status: 403 }
        );
      }
    }

    const deletedList = await List.findByIdAndDelete(listId);

    if (deletedList.customerId) {
      await Customer.findByIdAndUpdate(deletedList.customerId, {
        $inc: { "stats.totalLists": -1 },
        $pull: { lists: deletedList._id.toString() },
      });
    }

    return NextResponse.json(
      { success: true, message: "List deleted successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE List Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete list." },
      { status: 500 }
    );
  }
}
