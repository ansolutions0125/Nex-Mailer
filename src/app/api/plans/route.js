// app/api/plans/route.js
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/config/mongoConfig";
import Plan from "@/models/Plan";

// helpers
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const computeEffectivePrice = (plan) => {
  const base = Number(plan.price || 0);
  const pct = plan.discounted ? Number(plan.discount || 0) : 0;
  const eff = base * (1 - pct / 100);
  return round2(eff < 0 ? 0 : eff);
};

// GET /api/plans
//   - ?_id=... | ?name=... | list with pagination
//   - &active=true|false (filter by isActive)
export async function GET(request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const _id = searchParams.get("_id");
    const name = searchParams.get("name");
    const active = searchParams.get("active");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "20", 10));
    const skip = (page - 1) * limit;

    if (_id || name) {
      const filter = _id ? { _id } : { name };
      const plan = await Plan.findOne(filter).lean();
      if (!plan) {
        return NextResponse.json(
          { success: false, message: "Plan not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        data: { ...plan, effectivePrice: computeEffectivePrice(plan) },
      });
    }

    const query = {};
    if (active === "true") query.isActive = true;
    if (active === "false") query.isActive = false;

    const [items, totalItems] = await Promise.all([
      Plan.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Plan.countDocuments(query),
    ]);

    const data = items.map((p) => ({
      ...p,
      effectivePrice: computeEffectivePrice(p),
    }));

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    });
  } catch (error) {
    console.error("GET Plans Error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch plans." },
      { status: 500 }
    );
  }
}

// POST /api/plans
export async function POST(request) {
  try {
    await dbConnect();
    const body = await request.json();

    // Validate
    if (!body.name || !body.length) {
      return NextResponse.json(
        { success: false, message: "name and length are required" },
        { status: 400 }
      );
    }
    if (typeof body.price !== "number" || body.price < 0) {
      return NextResponse.json(
        { success: false, message: "price must be a non-negative number" },
        { status: 400 }
      );
    }
    if (body.discounted) {
      if (
        typeof body.discount !== "number" ||
        body.discount < 0 ||
        body.discount > 100
      ) {
        return NextResponse.json(
          { success: false, message: "discount must be between 0 and 100" },
          { status: 400 }
        );
      }
    } else {
      body.discount = 0;
    }
    if (
      body.emailLimit != null &&
      (typeof body.emailLimit !== "number" || body.emailLimit < 0)
    ) {
      return NextResponse.json(
        { success: false, message: "emailLimit must be a non-negative number" },
        { status: 400 }
      );
    }
    if (body.currency && !/^[A-Z]{3}$/.test(body.currency)) {
      return NextResponse.json(
        { success: false, message: "currency must be a 3-letter code" },
        { status: 400 }
      );
    }

    const plan = await Plan.create({
      name: body.name.trim(),
      slogan: body.slogan?.trim(),
      description: body.description?.trim(),
      price: body.price,
      discounted: Boolean(body.discounted),
      discount: body.discount || 0,
      currency: (body.currency || "USD").toUpperCase(),
      length: body.length, // "1month" | "3month" | "6month" | "1year"
      emailLimit: body.emailLimit || 0,
      features: Array.isArray(body.features) ? body.features.map(String) : [],
      serverId: body.serverId, // Add serverId to the plan creation
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    });

    const res = plan.toObject();
    res.effectivePrice = computeEffectivePrice(res);
    return NextResponse.json({ success: true, data: res }, { status: 201 });
  } catch (error) {
    console.error("POST Plans Error:", error);
    if (error.code === 11000) {
      return NextResponse.json(
        { success: false, message: "A plan with this name already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Failed to create plan." },
      { status: 500 }
    );
  }
}

// PUT /api/plans
export async function PUT(request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { planId, ...update } = body;

    if (!planId || !mongoose.Types.ObjectId.isValid(planId)) {
      return NextResponse.json(
        { success: false, message: "Valid planId is required" },
        { status: 400 }
      );
    }

    if (update.slogon && !update.slogan) {
      update.slogan = update.slogon;
      delete update.slogon;
    }
    if (
      update.price !== undefined &&
      (typeof update.price !== "number" || update.price < 0)
    ) {
      return NextResponse.json(
        { success: false, message: "price must be a non-negative number" },
        { status: 400 }
      );
    }
    if (update.discounted !== undefined && !update.discounted)
      update.discount = 0;
    if (
      update.discount !== undefined &&
      (update.discount < 0 || update.discount > 100)
    ) {
      return NextResponse.json(
        { success: false, message: "discount must be between 0 and 100" },
        { status: 400 }
      );
    }
    if (
      update.emailLimit !== undefined &&
      (typeof update.emailLimit !== "number" || update.emailLimit < 0)
    ) {
      return NextResponse.json(
        { success: false, message: "emailLimit must be a non-negative number" },
        { status: 400 }
      );
    }
    if (update.currency && !/^[A-Z]{3}$/.test(update.currency)) {
      return NextResponse.json(
        { success: false, message: "currency must be a 3-letter code" },
        { status: 400 }
      );
    }
    if (
      update.length &&
      !["1month", "3month", "6month", "1year"].includes(update.length)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "length must be one of 1month, 3month, 6month, 1year",
        },
        { status: 400 }
      );
    }

    if (update.name) update.name = update.name.trim();
    if (update.slogan) update.slogan = update.slogan.trim();
    if (update.description) update.description = update.description.trim();
    if (update.currency) update.currency = update.currency.toUpperCase();
    if (Array.isArray(update.features))
      update.features = update.features.map(String);

    // Add serverId to the update
    if (update.serverId) update.serverId = update.serverId;

    const updated = await Plan.findByIdAndUpdate(planId, update, {
      new: true,
      runValidators: true,
    }).lean();
    if (!updated)
      return NextResponse.json(
        { success: false, message: "Plan not found" },
        { status: 404 }
      );

    return NextResponse.json({
      success: true,
      message: "Plan updated successfully",
      data: { ...updated, effectivePrice: computeEffectivePrice(updated) },
    });
  } catch (error) {
    console.error("PUT Plans Error:", error);
    if (error.code === 11000) {
      return NextResponse.json(
        { success: false, message: "A plan with this name already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Failed to update plan." },
      { status: 500 }
    );
  }
}

// DELETE /api/plans?_id=<id>
export async function DELETE(request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const _id = searchParams.get("_id");

    if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
      return NextResponse.json(
        { success: false, message: "Valid _id is required" },
        { status: 400 }
      );
    }

    const deleted = await Plan.findByIdAndDelete(_id);
    if (!deleted)
      return NextResponse.json(
        { success: false, message: "Plan not found" },
        { status: 404 }
      );

    return NextResponse.json({
      success: true,
      message: "Plan deleted successfully",
    });
  } catch (error) {
    console.error("DELETE Plans Error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete plan." },
      { status: 500 }
    );
  }
}
