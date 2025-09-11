import { NextResponse } from "next/server";

export async function GET() {
  console.log("Received");

  return NextResponse.json(
    { message: "Success" },
    { status: 200 }
  );
}
