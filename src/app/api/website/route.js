import { NextResponse } from "next/server";
import dbConnect from "@/config/mongoConfig";
import Website from "@/models/Website";
import Stats from "@/models/Stats";
import Gateway from "@/models/Gateway";
import Flow from "@/models/Flow";
import List from "@/models/List";
import { deleteWebsiteAndDisconnect } from "@/services/websiteServices/deleteWebsite";
import Server from "@/models/Server";

// GET /api/website
// Fetches website(s) by _id or returns all websites (limited to 20)
export async function GET(request) {
  try {
    await dbConnect(); // Connect to the database

    const { searchParams } = new URL(request.url);
    const _id = searchParams.get("_id");

    if (_id) {
      const website = await Website.findById(_id);
      if (!website) {
        return NextResponse.json(
          { success: false, message: "Website not found." },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: website });
    }

    // If no _id, return all websites (limited to 20)
    const websites = await Website.find({}).limit(20);

    return NextResponse.json({ success: true, data: websites });
  } catch (error) {
    console.error("Error fetching websites:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch websites." },
      { status: 500 }
    );
  }
}

// POST /api/website
// Creates a new website
export async function POST(request) {
  try {
    await dbConnect(); // Connect to the database

    const body = await request.json();

    const website = await Website.create(body);

    // Update associations for each collection
    if (body.accessableGateway?.length) {
      await Gateway.updateMany(
        { _id: { $in: body.accessableGateway } },
        { $addToSet: { associatedWebsites: website._id } }
      );
    }

    if (body.accessableAutomation?.length) {
      await Flow.updateMany(
        { _id: { $in: body.accessableAutomation } },
        { $addToSet: { associatedWebsites: website._id } }
      );
    }

    if (body.accessableLists?.length) {
      await List.updateMany(
        { _id: { $in: body.accessableLists } },
        { $addToSet: { associatedWebsites: website._id } }
      );
    }

    // Update Stats to increment totalWebsites
    await Stats.findOneAndUpdate(
      {}, // Empty filter to match any document
      { $inc: { totalWebsites: 1 } }, // Increment totalWebsites by 1
      { upsert: true } // Create if doesn't exist
    );

    return NextResponse.json({ success: true, data: website }, { status: 201 });
  } catch (error) {
    console.error("Error creating website:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return NextResponse.json(
        { success: false, message: messages.join(", ") },
        { status: 400 }
      );
    }
    // Handle duplicate key errors (e.g., _id uniqueness)
    if (error.code === 11000) {
      return NextResponse.json(
        {
          success: false,
          message: "A website with this mini ID already exists.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Failed to create website." },
      { status: 500 }
    );
  }
}

// PUT /api/website
// Updates an existing website by _id
export async function PUT(request) {
  try {
    await dbConnect(); // Connect to the database

    const body = await request.json();
    const { _id, ...updateData } = body;

    if (!_id) {
      return NextResponse.json(
        {
          success: false,
          message: "_id is required for updating a website.",
        },
        { status: 400 }
      );
    }

    // Get existing website data
    const existingWebsite = await Website.findOne({ _id });
    if (!existingWebsite) {
      return NextResponse.json(
        { success: false, message: "Website not found." },
        { status: 404 }
      );
    }

    if (body.accessableAutomation) {
      body.automations = body.accessableAutomation;
      delete body.accessableAutomation;
    }
    if (body.accessableLists) {
      body.lists = body.accessableLists;
      delete body.accessableLists;
    }

    // Update associations if changed
    if (updateData.accessableGateway) {
      // Remove website from old associations
      await Gateway.updateMany(
        { _id: { $in: existingWebsite.accessableGateway } },
        { $pull: { associatedWebsites: existingWebsite._id } }
      );
      // Add to new associations
      await Gateway.updateMany(
        { _id: { $in: updateData.accessableGateway } },
        { $addToSet: { associatedWebsites: existingWebsite._id } }
      );
    }

    if (updateData.accessableServer) {
      // Remove website from old server if exists
      if (existingWebsite.accessableServer) {
        await Server.updateOne(
          { _id: existingWebsite.accessableServer },
          { $pull: { associatedWebsites: existingWebsite._id } }
        );
      }
      // Add to new server
      await Server.updateOne(
        { _id: updateData.accessableServer },
        { $addToSet: { associatedWebsites: existingWebsite._id } }
      );
    }

    if (updateData.accessableAutomation) {
      await Flow.updateMany(
        { _id: { $in: existingWebsite.accessableAutomation } },
        { $pull: { associatedWebsites: existingWebsite._id } }
      );
      await Flow.updateMany(
        { _id: { $in: updateData.accessableAutomation } },
        { $addToSet: { associatedWebsites: existingWebsite._id } }
      );
    }

    if (updateData.accessableLists) {
      await List.updateMany(
        { _id: { $in: existingWebsite.accessableLists } },
        { $pull: { associatedWebsites: existingWebsite._id } }
      );
      await List.updateMany(
        { _id: { $in: updateData.accessableLists } },
        { $addToSet: { associatedWebsites: existingWebsite._id } }
      );
    }

    const website = await Website.findOneAndUpdate({ _id }, updateData, {
      new: true,
      runValidators: true,
    });

    return NextResponse.json({ success: true, data: website });
  } catch (error) {
    console.error("Error updating website:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return NextResponse.json(
        { success: false, message: messages.join(", ") },
        { status: 400 }
      );
    }
    if (error.code === 11000) {
      return NextResponse.json(
        {
          success: false,
          message: "A website with this mini ID already exists.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Failed to update website." },
      { status: 500 }
    );
  }
}

// DELETE /api/website
// Deletes a website by _id
export async function DELETE(request) {
  try {
    await dbConnect(); // Connect to the database

    const { searchParams } = new URL(request.url);
    const _id = searchParams.get("_id");

    if (!_id) {
      return NextResponse.json(
        {
          success: false,
          message: "_id is required for deleting a website.",
        },
        { status: 400 }
      );
    }

    await deleteWebsiteAndDisconnect(_id);

    return NextResponse.json({
      success: true,
      message: "Website deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting website:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete website." },
      { status: 500 }
    );
  }
}
