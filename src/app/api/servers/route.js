// /api/servers/route.js | next.js 13+
import { NextResponse } from "next/server";
import dbConnect from "@/config/mongoConfig";
import Server from "@/models/Server";

// POST handler to create a new server
export async function POST(request) {
  try {
    // Connect to the database
    await dbConnect();

    // Get the request body
    const body = await request.json();

    // Create a new server document
    const server = await Server.create(body);

    // Return the created server
    return NextResponse.json({ success: true, data: server }, { status: 201 });
  } catch (error) {
    console.error("Error creating server:", error);
    let errorMessage = "Failed to create server.";
    if (error.name === "ValidationError") {
      errorMessage = Object.values(error.errors)
        .map((val) => val.message)
        .join(", ");
    }
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    );
  }
}

// GET handler to fetch a single server by ID or all servers
export async function GET(request) {
  try {
    // Connect to the database
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      // Find the server document by _id
      const server = await Server.findById(id);

      // If the server is not found, return a 404 response
      if (!server) {
        return NextResponse.json(
          { success: false, error: "Server not found." },
          { status: 404 }
        );
      }

      // Return the found server
      return NextResponse.json(
        { success: true, data: server },
        { status: 200 }
      );
    } else {
      // Return all servers if no ID provided
      const servers = await Server.find({});
      return NextResponse.json(
        { success: true, data: servers },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Error fetching server(s):", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch server(s)." },
      { status: 500 }
    );
  }
}

// PUT handler to update a server by _id
export async function PUT(request) {
  try {
    // Connect to the database
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const body = await request.json();

    // Find the server by _id and update it.
    const updatedServer = await Server.findByIdAndUpdate(id, body, {
      new: true, // Returns the updated document
      runValidators: true, // Run schema validators on update
    });

    // If the server is not found, return a 404 response
    if (!updatedServer) {
      return NextResponse.json(
        { success: false, error: "Server not found." },
        { status: 404 }
      );
    }

    // Return the updated server
    return NextResponse.json(
      { success: true, data: updatedServer },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating server:", error);
    let errorMessage = "Failed to update server.";
    if (error.name === "ValidationError") {
      errorMessage = Object.values(error.errors)
        .map((val) => val.message)
        .join(", ");
    }
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    );
  }
}

export async function DELETE(request) {
  try {
    // Connect to the database
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    // Find and delete the server document by _id
    const deletedServer = await Server.findByIdAndDelete(id);

    // If the server is not found, return a 404 response
    if (!deletedServer) {
      return NextResponse.json(
        { success: false, error: "Server not found." },
        { status: 404 }
      );
    }

    // Return a success message
    return NextResponse.json(
      { success: true, message: "Server deleted successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting server:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete server." },
      { status: 500 }
    );
  }
}
