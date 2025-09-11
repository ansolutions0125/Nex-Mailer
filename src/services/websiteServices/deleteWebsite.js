import Website from "@/models/Website";
import Gateway from "@/models/Gateway";
import Flow from "@/models/Flow";
import List from "@/models/List";
import Stats from "@/models/Stats";

export const deleteWebsiteAndDisconnect = async (websiteId) => {
  try {
    // 1. Disconnect all Flows from the Website
    // This finds all flows where websiteId matches and sets that field to null.
    await Flow.updateMany({ websiteId: websiteId }, { $set: { websiteId: null } });

    // 2. Disconnect all Lists from the Website
    // This finds all lists where websiteId matches and sets that field to null.
    await List.updateMany({ websiteId: websiteId }, { $set: { websiteId: null } });

    // 3. Disconnect Gateways from the Website
    // The Gateway schema's `associatedWebsites` field is an array of ObjectIds.
    // We use the `$pull` operator to remove the websiteId from this array.
    await Gateway.updateMany(
      { associatedWebsites: websiteId },
      { $pull: { associatedWebsites: websiteId } }
    );
    
    // Note: The Template schema's `usedBy` field references a "User", not a "Website".
    // Therefore, no action is needed on the Template model during a website deletion.

     await Stats.findOneAndUpdate(
      { _id: 'current' },
      { $inc: { totalWebsites: -1 } },
      { new: true }
    );

    // 4. Finally, delete the Website document itself.
    await Website.findByIdAndDelete(websiteId);

    console.log(`Website ${websiteId} and its dependencies successfully disconnected.`);
    return true;

  } catch (error) {
    console.error(`Error during website cascading deletion: ${error.message}`);
    throw error;
  }
};