import axios from "axios";
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

    let now = new Date();
    const contacts = await Contact.find({
      "automationAssociations.nextStepTime": { $lte: now },
      isActive: true,
    }).limit(fetchBatchSizePerProcess);

    console.log(contacts);
    return NextResponse.json({
      success: true,
      contacts,
    });
  } catch (error) {
    console.error("Error processing initially:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
