// api/list/route.js

import dbConnect from "@/config/mongoConfig";
import List from "@/models/List";
import Website from "@/models/Website"; // Add Website model import
import { NextResponse } from "next/server";
import mongoose from "mongoose";

export async function GET(request) {
  await dbConnect();

  try {
    const { searchParams } = new URL(request.url);
    const listId = searchParams.get("listId");
    const websiteId = searchParams.get("websiteId");
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
    } else if (websiteId) {
      if (!mongoose.Types.ObjectId.isValid(websiteId)) {
        return NextResponse.json(
          { success: false, message: "Invalid website ID format." },
          { status: 400 }
        );
      }

      lists = await List.find({ websiteId: websiteId });

      if (!lists || lists.length === 0) {
        return NextResponse.json(
          { success: true, data: [], message: "No lists found for this website." },
          { status: 200 }
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
    const { websiteId, automationId } = body;

    // Normalize automationId: convert empty string to null
    if (automationId === "") {
      body.automationId = null;
    }

    if (websiteId === "") {
      body.websiteId = null;
    }

    let newList = await List.create(body);

    if (websiteId) {
      await Website.findByIdAndUpdate(websiteId, {
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

    if (!listId) {
      return NextResponse.json(
        { success: false, message: "listId is required to delete a list." },
        { status: 400 }
      );
    }

    const deletedList = await List.findByIdAndDelete(listId);

    if (!deletedList) {
      return NextResponse.json(
        { success: false, message: "List not found." },
        { status: 404 }
      );
    }

    // Update website stats and remove list reference
    await Website.findByIdAndUpdate(deletedList.websiteId, {
      $inc: { "stats.totalLists": -1 },
      $pull: { lists: deletedList._id },
    });

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
