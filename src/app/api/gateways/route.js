// app/api/gateways/route.js
import dbConnect from "@/config/mongoConfig";
import Gateway from "@/models/Gateway";
import Stats from "@/models/Stats";
import Website from "@/models/Website";
import { NextResponse } from "next/server";

export async function GET(request) {
  await dbConnect();

  try {
    const { searchParams } = new URL(request.url);
    const miniId = searchParams.get("miniId");

    let gateways;
    if (miniId) {
      gateways = await Gateway.findOne({ miniId: parseInt(miniId, 10) });
      if (!gateways) {
        return NextResponse.json(
          { success: false, message: "Gateway not found." },
          { status: 404 }
        );
      }
    } else {
      gateways = await Gateway.find({}).sort({ createdAt: -1 }); // Sort by newest first
    }

    return NextResponse.json(
      { success: true, data: gateways },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching gateways:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch gateways.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  await dbConnect();

  try {
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { success: false, message: "Gateway name is required" },
        { status: 400 }
      );
    }

    const gatewayData = {
      name: body.name.trim(),
      logo: body.logo?.trim() || "",
      description: body.description?.trim() || "",
      isActive: body.isActive !== undefined ? body.isActive : true,
      associatedWebsites: Array.isArray(body.associatedWebsites) ? body.associatedWebsites : [],
      keys: body.keys || {},
    };

    console.log("Creating gateway with data:", gatewayData);

    const gateway = await Gateway.create(gatewayData);

    if (gatewayData.associatedWebsites.length > 0) {
      const websiteUpdates = gatewayData.associatedWebsites.map(websiteId => 
        Website.findOneAndUpdate(
          { _id: websiteId },
          {
            $addToSet: { accessableGateway: gateway._id },
            $set: { "stats.lastActivity": new Date().toISOString() },
          },
          { new: true, runValidators: true }
        ).catch(err => {
          console.error(`Error updating website ${websiteId}:`, err);
          return null;
        })
      );

      await Promise.all(websiteUpdates);
    }

    await Stats.findOneAndUpdate(
      {},
      { $inc: { totalGateways: 1 } },
      { upsert: true }
    );

    return NextResponse.json({ success: true, data: gateway }, { status: 201 });
  } catch (error) {
    console.error("Error creating gateway:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return NextResponse.json(
        { success: false, message: messages.join(", ") },
        { status: 400 }
      );
    } else if (error.code === 11000) {
      return NextResponse.json(
        {
          success: false,
          message: "A gateway with this name or miniId already exists.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        message: "Failed to create gateway.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  await dbConnect();

  try {
    const body = await request.json();
    const miniId = body.miniId;

    if (!miniId) {
      return NextResponse.json(
        {
          success: false,
          message: "miniId is required for updating a gateway.",
        },
        { status: 400 }
      );
    }

    const updateData = {
      name: body.name?.trim(),
      logo: body.logo?.trim() || "",
      description: body.description?.trim() || "",
      isActive: body.isActive !== undefined ? body.isActive : true,
      associatedWebsites: Array.isArray(body.associatedWebsites) ? body.associatedWebsites : [],
      keys: body.keys || {},
    };

    const existingGateway = await Gateway.findOne({ miniId: parseInt(miniId, 10) });
    if (!existingGateway) {
      return NextResponse.json(
        { success: false, message: "Gateway not found." },
        { status: 404 }
      );
    }

    // Update websites that are no longer associated
    const removedWebsites = existingGateway.associatedWebsites.filter(
      id => !updateData.associatedWebsites.includes(id.toString())
    );

    if (removedWebsites.length > 0) {
      await Website.updateMany(
        { _id: { $in: removedWebsites } },
        { $pull: { accessableGateway: existingGateway._id } }
      );
    }

    // Update newly associated websites
    const newWebsites = updateData.associatedWebsites.filter(
      id => !existingGateway.associatedWebsites.includes(id)
    );

    if (newWebsites.length > 0) {
      await Website.updateMany(
        { _id: { $in: newWebsites } },
        { 
          $addToSet: { accessableGateway: existingGateway._id },
          $set: { "stats.lastActivity": new Date().toISOString() }
        }
      );
    }

    const gateway = await Gateway.findOneAndUpdate(
      { miniId: parseInt(miniId, 10) },
      updateData,
      { new: true, runValidators: true }
    );

    return NextResponse.json({ success: true, data: gateway }, { status: 200 });
  } catch (error) {
    console.error("Error updating gateway:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return NextResponse.json(
        { success: false, message: messages.join(", ") },
        { status: 400 }
      );
    } else if (error.code === 11000) {
      return NextResponse.json(
        {
          success: false,
          message: "A gateway with this name or miniId already exists.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        message: "Failed to update gateway.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  await dbConnect();

  try {
    const { searchParams } = new URL(request.url);
    const miniId = searchParams.get("miniId");

    if (!miniId) {
      return NextResponse.json(
        {
          success: false,
          message: "miniId is required for deleting a gateway.",
        },
        { status: 400 }
      );
    }

    const gateway = await Gateway.findOneAndDelete({ miniId: parseInt(miniId, 10) });

    if (!gateway) {
      return NextResponse.json(
        { success: false, message: "Gateway not found." },
        { status: 404 }
      );
    }

    await Website.updateMany(
      { accessableGateway: gateway._id },
      { $pull: { accessableGateway: gateway._id } }
    );

    await Stats.findOneAndUpdate(
      {},
      [
        {
          $set: {
            totalGateways: {
              $max: [{ $subtract: ["$totalGateways", 1] }, 0]
            }
          }
        }
      ],
      { upsert: true }
    );

    return NextResponse.json(
      { success: true, message: "Gateway deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting gateway:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete gateway.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

