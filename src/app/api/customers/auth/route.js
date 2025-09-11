// app/api/customers/route.js
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import dbConnect from "@/config/mongoConfig";
import Customer from "@/models/Customer";
import Plan from "@/models/Plan";
import Website from "@/models/Website";
import List from "@/models/List";
import Flow from "@/models/Flow";
import Contact from "@/models/Contact";
import EmailLogs from "@/models/EmailLogs";

/** Helpers **/
function billingWindowFromLength(length, now = new Date()) {
  // Anchor to start of day
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  switch (length) {
    case "1month":
      end.setMonth(end.getMonth() + 1);
      break;
    case "3month":
      end.setMonth(end.getMonth() + 3);
      break;
    case "6month":
      end.setMonth(end.getMonth() + 6);
      break;
    case "1year":
      end.setFullYear(end.getFullYear() + 1);
      break;
    default:
      end.setMonth(end.getMonth() + 1);
  }
  return { start, end };
}

async function loadPlanSnapshot(planId) {
  const plan = await Plan.findById(planId).lean();
  if (!plan) return null;
  return {
    name: plan.name,
    price: plan.price,
    currency: plan.currency,
    monthlyEmailLimit: plan.emailLimit,
    features: plan.features || [],
    length: plan.length,
  };
}

async function computeCustomerStats(customerId) {
  // Websites owned by this customer
  const websites = await Website.find({ customerId }).select("_id").lean();
  const websiteIds = websites.map((w) => w._id);

  // Lists under websites
  const lists = await List.find({ websiteId: { $in: websiteIds } }).select("_id").lean();
  const listIds = lists.map((l) => l._id);

  // Automations under these websites
  const totalAutomations = await Flow.countDocuments({ websiteId: { $in: websiteIds } });

  // Lists count
  const totalLists = lists.length;

  // Contacts across all customer lists
  const totalContacts = await Contact.countDocuments({ "listAssociations.listId": { $in: listIds } });

  // Emails sent for flows under these websites
  const flows = await Flow.find({ websiteId: { $in: websiteIds } }).select("_id").lean();
  const flowIds = flows.map((f) => f._id);
  const totalEmailSent = await EmailLogs.countDocuments({ status: "sent", flowId: { $in: flowIds } });

  return { totalEmailSent, totalAutomations, totalLists, totalContacts };
}

// Never leak passwordHash
function sanitizeCustomer(doc) {
  if (!doc) return doc;
  const obj = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  delete obj.passwordHash;
  return obj;
}

/** GET /api/customers
 *    ?_id=... | ?slug=... | list (paginated)
 *    &withStats=true to recompute stats
 *    &expand=plan to populate the current plan document
 */
export async function GET(request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const _id = searchParams.get("_id");
    const slug = searchParams.get("slug");
    const withStats = searchParams.get("withStats") === "true";
    const expand = searchParams.get("expand"); // 'plan'
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "20", 10));
    const skip = (page - 1) * limit;

    if (_id || slug) {
      const filter = _id ? { _id } : { slug };
      const customer = await Customer.findOne(filter).populate(
        expand === "plan" ? [{ path: "planId", model: "Plan" }] : []
      );
      if (!customer) return NextResponse.json({ success: false, message: "Customer not found" }, { status: 404 });

      let data = customer.toObject();
      if (withStats) data.stats = { ...data.stats, ...(await computeCustomerStats(customer._id)) };

      return NextResponse.json({ success: true, data: sanitizeCustomer(data) });
    }

    const [items, totalItems] = await Promise.all([
      Customer.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Customer.countDocuments({}),
    ]);

    return NextResponse.json({
      success: true,
      data: items.map(sanitizeCustomer),
      pagination: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    });
  } catch (error) {
    console.error("GET Customers Error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch customers." }, { status: 500 });
  }
}

/** POST /api/customers
 * Create a customer. If planId is provided, snapshot the plan and seed limits.
 * Accepts profile/auth fields (hashes password) and never returns passwordHash.
 */
export async function POST(request) {
  try {
    await dbConnect();
    const body = await request.json();

    const { slug, planId, planSnapshot, emailLimits } = body;
    const {
      email, firstName, lastName, password, sessionType,
      phoneNo, address, country
    } = body;


    const now = new Date();
    let finalPlanSnapshot = planSnapshot || undefined;
    let limitsPeriod = "1month";
    let initRemaining = 0;

    if (planId && mongoose.Types.ObjectId.isValid(planId)) {
      const snap = await loadPlanSnapshot(planId);
      if (!snap) return NextResponse.json({ success: false, message: "Plan not found" }, { status: 404 });
      finalPlanSnapshot = snap;
      limitsPeriod = snap.length || "1month";
      initRemaining = typeof emailLimits?.remaining === "number" ? emailLimits.remaining : (snap.monthlyEmailLimit || 0);
    } else {
      initRemaining = typeof emailLimits?.remaining === "number" ? emailLimits.remaining : 0;
    }

    const { start, end } = billingWindowFromLength(limitsPeriod, now);
    const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;

    const customer = await Customer.create({
      ...body,
      slug: slug?.trim() || undefined,

      // profile/auth
      email: email?.trim()?.toLowerCase() || undefined,
      firstName: firstName?.trim() || undefined,
      lastName: lastName?.trim() || undefined,
      passwordHash,
      sessionType: sessionType?.trim() || "password",
      phoneNo: phoneNo?.trim() || undefined,
      address: address?.trim() || undefined,
      country: country?.trim() || undefined,

      planId: planId || null,
      planSnapshot: finalPlanSnapshot,

      emailLimits: {
        totalSent: 0,
        remaining: Math.max(0, initRemaining),
        period: limitsPeriod,
        periodStart: start,
        periodEnd: end,
        lastResetAt: now,
      },
    });

    return NextResponse.json({ success: true, data: sanitizeCustomer(customer) }, { status: 201 });
  } catch (error) {
    console.error("POST Customers Error:", error);
    if (error.code === 11000) {
      // could be slug or email
      const dupKey = Object.keys(error?.keyPattern || {})[0] || "unique field";
      return NextResponse.json({ success: false, message: `Duplicate ${dupKey}` }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: "Failed to create customer." }, { status: 500 });
  }
}

/** PUT /api/customers
 *  action:
 *   - "multi"           -> generic update
 *   - "assignPlan"      -> attach plan + snapshot + (optionally) reset limits
 *   - "changePlan"      -> same as assignPlan (alias, for future proration)
 *   - "removePlan"      -> detach plan (keep snapshot for history)
 *   - "syncFromPlan"    -> re-seed limits from current snapshot
 *   - "applyUsage"      -> increment usage (after successful send)
 *   - "resetLimits"     -> reset window + remaining (admin/cron)
 *   - "recalcStats"     -> recompute aggregates and persist to stats
 *   - "updateAuth"      -> email/password/sessionType
 *   - "updateProfile"   -> first/last/phone/address/country
 */
export async function PUT(request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { action } = body;

    if (!action) return NextResponse.json({ success: false, message: "action is required" }, { status: 400 });

    switch (action) {
      case "multi": {
        const { customerId, updateData } = body;
        if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
          return NextResponse.json({ success: false, message: "Valid customerId is required" }, { status: 400 });
        }
        if (!updateData || typeof updateData !== "object") {
          return NextResponse.json({ success: false, message: "updateData object is required" }, { status: 400 });
        }
       
        if (updateData.slug) updateData.slug = updateData.slug.trim();

        const updated = await Customer.findByIdAndUpdate(customerId, updateData, { new: true, runValidators: true });
        if (!updated) return NextResponse.json({ success: false, message: "Customer not found" }, { status: 404 });
        return NextResponse.json({ success: true, message: "Customer updated", data: sanitizeCustomer(updated) });
      }

      case "assignPlan":
      case "changePlan": {
        const { customerId, planId, resetLimits = true } = body;
        if (!customerId || !mongoose.Types.ObjectId.isValid(customerId) || !planId || !mongoose.Types.ObjectId.isValid(planId)) {
          return NextResponse.json({ success: false, message: "Valid customerId and planId are required" }, { status: 400 });
        }
        const snap = await loadPlanSnapshot(planId);
        if (!snap) return NextResponse.json({ success: false, message: "Plan not found" }, { status: 404 });

        const now = new Date();
        const { start, end } = billingWindowFromLength(snap.length, now);
        const updates = { planId, planSnapshot: snap };

        if (resetLimits) {
          updates["emailLimits"] = {
            totalSent: 0,
            remaining: Math.max(0, snap.monthlyEmailLimit || 0),
            period: snap.length,
            periodStart: start,
            periodEnd: end,
            lastResetAt: now,
          };
        } else {
          updates["emailLimits.period"] = snap.length;
        }

        const updated = await Customer.findByIdAndUpdate(customerId, { $set: updates }, { new: true });
        if (!updated) return NextResponse.json({ success: false, message: "Customer not found" }, { status: 404 });
        return NextResponse.json({ success: true, message: "Plan assigned", data: sanitizeCustomer(updated) });
      }

      case "removePlan": {
        const { customerId } = body;
        if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
          return NextResponse.json({ success: false, message: "Valid customerId is required" }, { status: 400 });
        }
        const updated = await Customer.findByIdAndUpdate(customerId, { $set: { planId: null } }, { new: true });
        if (!updated) return NextResponse.json({ success: false, message: "Customer not found" }, { status: 404 });
        return NextResponse.json({ success: true, message: "Plan removed", data: sanitizeCustomer(updated) });
      }

      case "syncFromPlan": {
        const { customerId, resetWindow = true } = body;
        if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
          return NextResponse.json({ success: false, message: "Valid customerId is required" }, { status: 400 });
        }
        const customer = await Customer.findById(customerId).lean();
        if (!customer) return NextResponse.json({ success: false, message: "Customer not found" }, { status: 404 });
        const snap = customer.planSnapshot;
        if (!snap) return NextResponse.json({ success: false, message: "Customer has no plan snapshot" }, { status: 400 });

        const now = new Date();
        const updates = {};
        if (resetWindow) {
          const { start, end } = billingWindowFromLength(snap.length || "1month", now);
          updates["emailLimits.remaining"] = Math.max(0, snap.monthlyEmailLimit || 0);
          updates["emailLimits.period"] = snap.length || "1month";
          updates["emailLimits.periodStart"] = start;
          updates["emailLimits.periodEnd"] = end;
          updates["emailLimits.lastResetAt"] = now;
        } else {
          updates["emailLimits.period"] = snap.length || "1month";
        }
        const updated = await Customer.findByIdAndUpdate(customerId, { $set: updates }, { new: true });
        return NextResponse.json({ success: true, message: "Limits synced from plan", data: sanitizeCustomer(updated) });
      }

      case "applyUsage": {
        const { customerId, count = 1 } = body;
        if (!customerId || !mongoose.Types.ObjectId.isValid(customerId) || count <= 0) {
          return NextResponse.json({ success: false, message: "Valid customerId and positive count are required" }, { status: 400 });
        }

        await Customer.updateOne(
          { _id: customerId },
          {
            $inc: {
              "stats.totalEmailSent": count,
              "emailLimits.totalSent": count,
              "emailLimits.remaining": -count,
            },
          }
        );
        // Clamp remaining to >= 0
        await Customer.updateOne({ _id: customerId, "emailLimits.remaining": { $lt: 0 } }, { $set: { "emailLimits.remaining": 0 } });

        const fresh = await Customer.findById(customerId);
        return NextResponse.json({ success: true, message: "Usage applied", data: sanitizeCustomer(fresh) });
      }

      case "resetLimits": {
        const { customerId, monthlyEmailLimit } = body;
        if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
          return NextResponse.json({ success: false, message: "Valid customerId is required" }, { status: 400 });
        }

        const doc = await Customer.findById(customerId).lean();
        if (!doc) return NextResponse.json({ success: false, message: "Customer not found" }, { status: 404 });

        const limit =
          (typeof monthlyEmailLimit === "number" ? monthlyEmailLimit : undefined) ??
          doc?.planSnapshot?.monthlyEmailLimit ??
          0;

        const now = new Date();
        const { start, end } = billingWindowFromLength(doc?.planSnapshot?.length || "1month", now);

        const updated = await Customer.findByIdAndUpdate(
          customerId,
          {
            $set: {
              "emailLimits.remaining": Math.max(0, limit),
              "emailLimits.period": doc?.planSnapshot?.length || "1month",
              "emailLimits.periodStart": start,
              "emailLimits.periodEnd": end,
              "emailLimits.lastResetAt": now,
            },
          },
          { new: true }
        );

        return NextResponse.json({ success: true, message: "Limits reset", data: sanitizeCustomer(updated) });
      }

      case "recalcStats": {
        const { customerId } = body;
        if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
          return NextResponse.json({ success: false, message: "Valid customerId is required" }, { status: 400 });
        }
        const stats = await computeCustomerStats(customerId);
        const updated = await Customer.findByIdAndUpdate(customerId, { $set: { stats } }, { new: true });
        return NextResponse.json({ success: true, message: "Stats recalculated", data: sanitizeCustomer(updated) });
      }

      case "updateAuth": {
        const { customerId, email, password, sessionType } = body;
        if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
          return NextResponse.json({ success: false, message: "Valid customerId is required" }, { status: 400 });
        }
        const update = {};
        if (email !== undefined) update.email = email?.trim()?.toLowerCase() || undefined;
        if (sessionType !== undefined) update.sessionType = String(sessionType).trim();
        if (password) update.passwordHash = await bcrypt.hash(password, 12);
        const updated = await Customer.findByIdAndUpdate(customerId, { $set: update }, { new: true, runValidators: true });
        if (!updated) return NextResponse.json({ success: false, message: "Customer not found" }, { status: 404 });
        return NextResponse.json({ success: true, message: "Auth updated", data: sanitizeCustomer(updated) });
      }

      case "updateProfile": {
        const { customerId, firstName, lastName, phoneNo, address, country } = body;
        if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
          return NextResponse.json({ success: false, message: "Valid customerId is required" }, { status: 400 });
        }
        const update = {};
        if (firstName !== undefined) update.firstName = firstName?.trim() || "";
        if (lastName !== undefined) update.lastName = lastName?.trim() || "";
        if (phoneNo !== undefined) update.phoneNo = phoneNo?.trim() || "";
        if (address !== undefined) update.address = address?.trim() || "";
        if (country !== undefined) update.country = country?.trim() || "";
        const updated = await Customer.findByIdAndUpdate(customerId, { $set: update }, { new: true, runValidators: true });
        if (!updated) return NextResponse.json({ success: false, message: "Customer not found" }, { status: 404 });
        return NextResponse.json({ success: true, message: "Profile updated", data: sanitizeCustomer(updated) });
      }

      default:
        return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("PUT Customers Error:", error);
    return NextResponse.json({ success: false, message: "Failed to update customer." }, { status: 500 });
  }
}

/** DELETE /api/customers?_id=... */
export async function DELETE(request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const _id = searchParams.get("_id");

    if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
      return NextResponse.json({ success: false, message: "Valid _id is required" }, { status: 400 });
    }

    const deleted = await Customer.findByIdAndDelete(_id);
    if (!deleted) return NextResponse.json({ success: false, message: "Customer not found" }, { status: 404 });

    return NextResponse.json({ success: true, message: "Customer deleted" });
  } catch (error) {
    console.error("DELETE Customers Error:", error);
    return NextResponse.json({ success: false, message: "Failed to delete customer." }, { status: 500 });
  }
}
