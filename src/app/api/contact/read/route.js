// file: api/contact/read
import dbConnect from "@/config/mongoConfig";
import Contact from "@/models/Contact";
import { anyReqWithAuth } from "@/lib/withAuthFunctions";
import mongoose from "mongoose";

export async function GET(req) {
  try {
    const authData = await anyReqWithAuth(req.headers);
    const customer =
      authData?.actorType === "customer" ? authData.customer : null;

    await dbConnect();

    if (!customer?._id) {
      return Response.json(
        { success: false, message: "Customer not found" },
        { status: 404 }
      );
    }

    /* ---------------------- Query Params ---------------------- */
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(
      1,
      Math.min(100, parseInt(searchParams.get("limit") || "20", 10))
    );
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortDir = (searchParams.get("sortDir") || "desc") === "asc" ? 1 : -1;
    const search = (searchParams.get("search") || "").trim();
    const isActiveParam = searchParams.get("isActive"); // "true"|"false"|null

    /* ---------------------- Base Filter ----------------------- */
    const customerId = new mongoose.Types.ObjectId(customer._id);
    const filter = { connectedCustomerIds: customerId };

    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: "i" } },
        { "customerProfiles.fullName": { $regex: search, $options: "i" } },
      ];
    }

    // Add isActive filter directly to the query if present
    if (isActiveParam === "true" || isActiveParam === "false") {
      filter.customerProfiles = {
        $elemMatch: {
          customerId: customerId,
          isActive: isActiveParam === "true",
        },
      };
    }

    const total = await Contact.countDocuments(filter);

    const pipeline = [
      { $match: filter },
      {
        $addFields: {
          // Find the profile for the current customer
          profile: {
            $ifNull: [
              {
                $first: {
                  $filter: {
                    input: "$customerProfiles",
                    as: "p",
                    cond: { $eq: ["$$p.customerId", customerId] },
                  },
                },
              },
              {}, // Default empty object if no profile found
            ],
          },
          // Find the engagement for the current customer
          engagement: {
            $ifNull: [
              {
                $first: {
                  $filter: {
                    input: "$customerEngagements",
                    as: "e",
                    cond: { $eq: ["$$e.customerId", customerId] },
                  },
                },
              },
              // Default engagement object
              {
                totalSent: 0,
                totalDelivered: 0,
                totalOpened: 0,
                totalClicked: 0,
                openRate: 0,
                clickRate: 0,
                engagementScore: 50,
              },
            ],
          },
          // Filter other arrays for the current customer
          lists: {
            $filter: {
              input: "$listMemberships",
              as: "m",
              cond: { $eq: ["$$m.customerId", customerId] },
            },
          },
          automations: {
            $filter: {
              input: "$automationHistory",
              as: "h",
              cond: { $eq: ["$$h.customerId", customerId] },
            },
          },
          history: {
            $filter: {
              input: "$history",
              as: "h",
              cond: { $eq: ["$$h.customerId", customerId] },
            },
          },
        },
      },
      {
        $lookup: {
          from: "flows", // The collection name for the Flow model
          localField: "automations.flowId",
          foreignField: "_id",
          as: "populatedFlows",
        },
      },
      {
        $addFields: {
          automations: {
            $map: {
              input: "$automations",
              as: "item",
              in: {
                $mergeObjects: [
                  "$$item",
                  {
                    flowId: {
                      $first: {
                        $filter: {
                          input: "$populatedFlows",
                          as: "flow",
                          cond: { $eq: ["$$flow._id", "$$item.flowId"] },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: "lists", // The collection name for the List model
          localField: "lists.listId",
          foreignField: "_id",
          as: "populatedLists",
        },
      },
      {
        $addFields: {
          lists: {
            $map: {
              input: "$lists",
              as: "item",
              in: {
                $mergeObjects: [
                  "$$item",
                  {
                    listId: {
                      $first: {
                        $filter: {
                          input: "$populatedLists",
                          as: "list",
                          cond: { $eq: ["$$list._id", "$$item.listId"] },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      // Project the final shape
      {
        $project: {
          email: 1,
          fullName: { $ifNull: ["$profile.fullName", ""] },
          isActive: { $ifNull: ["$profile.isActive", true] },
          location: { $ifNull: ["$profile.location", {}] },
          tags: { $ifNull: ["$profile.tags", []] },
          engagement: 1,
          lists: 1,
          automations: 1,
          history: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      { $sort: { [sortBy]: sortDir } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ];

    const data = await Contact.aggregate(pipeline);

    return Response.json({
      success: true,
      data: data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    console.error("Read contacts error:", err);
    return Response.json(
      { success: false, message: "Internal server error", error: err.message },
      { status: 500 }
    );
  }
}
