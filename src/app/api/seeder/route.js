// app/api/seeder/route.js
import seedRoles from "@/scripts/seedRoles";
import { NextResponse } from "next/server";

export async function GET(request) {
  await seedRoles();

  return NextResponse.json({
    success: true,
  });
}
