// lib/getProcessingSettings.js
import dbConnect from "@/config/mongoConfig";
import ProcessingSetting from "@/models/ProcessingSetting";

/**
 * Fetches the singleton ProcessingSetting document.
 * If not found, it initializes it with defaults.
 */
export async function getProcessingSettings() {
  await dbConnect();
  let settings = await ProcessingSetting.findById("current").lean();

  if (!settings) {
    // Create with defaults (Mongoose will apply defaults)
    settings = await ProcessingSetting.create({ _id: "current" });
    settings = settings.toObject();
  }

  return settings;
}
