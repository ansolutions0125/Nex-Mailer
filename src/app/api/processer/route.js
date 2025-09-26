import { NextResponse } from "next/server";
import dbConnect from "@/config/mongoConfig";
import { getProcessingSettings } from "@/services/getProcessingSettings";
import Contact from "@/models/Contact";

export async function GET(req) {
  await dbConnect();
  try {
    const {
      fetchBatchSizePerProcess,
      maxConcurrentProcesses,
      retryFailedJobs,
      defaultRetryDelaySeconds,
      enableFlowParallelism,
      enableTracking,
      maxDailyEmailsPerCustomer,
      processWebhookInProcess,
      createNewRoutes,
    } = await getProcessingSettings();

    const now = new Date();

    // Find contacts where any active automation is due
    const contacts = await Contact.find({
      "activeAutomations.nextStepAt": { $lte: now },
      "activeAutomations.status": "active",
    }).limit(fetchBatchSizePerProcess);

    console.log("Due contacts:", contacts.length);

    return NextResponse.json({
      success: true,
      count: contacts.length,
      contacts,
    });
  } catch (error) {
    console.error("Error processing automations:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
