// api/list/route.js

import dbConnect from "@/config/mongoConfig";
import List from "@/models/List";
import { NextResponse } from "next/server";
import Customer from "@/models/Customer";

export async function GET(request) {
  await dbConnect();

  try {
    const { searchParams } = new URL(request.url);
    const listId = searchParams.get("listId");
    const notConnected = searchParams.get("notConnected");

    let lists;
    if (listId) {
      lists = await List.findById(listId);
      if (!lists) {
        return NextResponse.json(
          { success: false, message: "List not found." },
          { status: 404 }
        );
      }
    } else {
      if (notConnected === "true") {
        lists = await List.find({ automationId: null });
      } else {
        lists = await List.find({});
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
  await dbConnect();

  try {
    const body = await request.json();
    const { automationId, customerId } = body;

    // Normalize automationId: convert empty string to null
    if (automationId === "") {
      body.automationId = null;
    }

    let newList = await List.create(body);

    if (customerId) {
      await Customer.findByIdAndUpdate(customerId, {
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
  await dbConnect();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const body = await request.json();
    const { automationId } = body;
    if (!id) {
      return NextResponse.json(
        { success: false, message: "id is required to update a list." },
        { status: 400 }
      );
    }

    if (automationId === "") {
      body.automationId = null;
    }

    const list = await List.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    if (!list) {
      return NextResponse.json(
        { success: false, message: "List not found." },
        { status: 404 }
      );
    }

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
          { success: false, message: "listIds array is required for bulk delete." },
          { status: 400 }
        );
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
        { success: true, message: `${deletedLists.length} lists deleted successfully.` },
        { status: 200 }
      );
    }

    // Handle single delete
    const deletedList = await List.findByIdAndDelete(listId);

    if (!deletedList) {
      return NextResponse.json(
        { success: false, message: "List not found." },
        { status: 404 }
      );
    }
    if (deletedList.customerId) {
      await Customer.findByIdAndUpdate(deletedList.customerId, {
        $inc: { "stats.totalLists": -1 },
        $pull: { lists: deletedList._id },
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
