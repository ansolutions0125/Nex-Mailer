import Template from "@/models/Template";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/config/mongoConfig";

// Create new template
export async function POST(request) {
  await dbConnect();
  try {
    const body = await request.json();

    const template = await Template.create(body);

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  await dbConnect();
  const { searchParams } = new URL(request.url);
  const _id = searchParams.get("_id");
  try {
    if (_id) {
      const template = await Template.findOne({ _id });
      if (!template) {
        return NextResponse.json(
          { success: false, message: "Template not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: template });
    }
    const templates = await Template.find({});

    return NextResponse.json({ success: true, data: templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch templates." },
      { status: 500 }
    );
  }
}

// Update template
export async function PUT(request) {
  const { searchParams } = new URL(request.url);
  const _id = searchParams.get("_id");
  try {
    const body = await request.json();

    // Get the old template first
    const oldTemplate = await Template.findOne({ _id });

    const template = await Template.findOneAndUpdate({ _id }, body, {
      new: true,
      runValidators: true,
    });
    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(template);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Delete template
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const _id = searchParams.get("_id");
  try {
    // Validate that _id is a valid number before attempting delete
    if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
      return NextResponse.json(
        { error: "Invalid _id parameter" },
        { status: 400 }
      );
    }

    const template = await Template.findOneAndDelete({ _id });
    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Template deleted successfully" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
