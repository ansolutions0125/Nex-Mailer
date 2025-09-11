// Fixed route.js for email tracking with proper EmailLogs handling
import { NextResponse } from "next/server";
import dbConnect from "@/config/mongoConfig";
import EmailQueue from "@/models/EmailQueue";
import EmailLogs from "@/models/EmailLogs";
import Contact from "@/models/Contact";
import Flow from "@/models/Flow";
import Server from "@/models/Server";

export async function GET(request, { params }) {
  await dbConnect();
  const { emailId } = await params;

  try {
    // Since the email processor now creates EmailLogs FIRST and deletes EmailQueue after sending,
    // we should check EmailLogs FIRST, then EmailQueue as fallback
    
    let emailRecord = await EmailLogs.findById(emailId);
    let isFromEmailLogs = true;

    if (!emailRecord) {
      // Fallback: Check EmailQueue for emails that haven't been sent yet
      emailRecord = await EmailQueue.findById(emailId);
      isFromEmailLogs = false;
      
      if (!emailRecord) {
        // Email not found in either collection, return pixel (email might have been deleted)
        console.log(`Email tracking: Record ${emailId} not found in either collection`);
        return createPixelResponse();
      }
    }

    // Handle tracking based on which collection the record is from
    if (isFromEmailLogs) {
      return handleEmailLogTracking(emailRecord);
    } else {
      return handleEmailQueueTracking(emailRecord);
    }

  } catch (error) {
    console.error('Error tracking email open:', error);
    // Always return pixel even if tracking fails
    return createPixelResponse();
  }
}

// Handle tracking for emails in EmailLogs (sent emails)
async function handleEmailLogTracking(emailLog) {
  try {
    const currentOpenCount = emailLog.metadata?.openCount || 0;
    const maxOpens = emailLog.metadata?.maxOpens || 5;
    const isFirstOpen = currentOpenCount === 0;

    if (currentOpenCount >= maxOpens) {
      console.log(`Email ${emailLog._id} has reached max opens (${maxOpens})`);
      return createGoneResponse();
    }

    // Update the open count in EmailLogs
    await EmailLogs.updateOne(
      { _id: emailLog._id },
      {
        $set: {
          'metadata.opened': true,
          'metadata.lastOpened': new Date(),
          ...(isFirstOpen && { 'metadata.firstOpened': new Date() }),
          status: 'opened',
          lastOpenedAt: new Date(),
          ...(isFirstOpen && { firstOpenedAt: new Date() })
        },
        $inc: { 'metadata.openCount': 1 }
      }
    );

    // Update contact engagement
    if (emailLog.contactId) {
      await updateContactEngagement(emailLog.contactId, {
        emailOpened: true,
        isFirstOpen: isFirstOpen
      });
    }

    // Update server open rate stats (only on first open)
    if (isFirstOpen && emailLog.serverId) {
      await updateServerOpenRate(emailLog.serverId);
    }

    console.log(`Email ${emailLog._id} opened (count: ${currentOpenCount + 1}/${maxOpens})`);
    return createPixelResponse();

  } catch (error) {
    console.error('Error handling EmailLog tracking:', error);
    return createPixelResponse();
  }
}

// Handle tracking for emails still in EmailQueue (should be rare with new flow)
async function handleEmailQueueTracking(emailRecord) {
  try {
    // This should rarely happen with the new flow since emails are moved to EmailLogs after sending
    // But we'll handle it for backwards compatibility
    
    const currentOpenCount = emailRecord.metadata?.openCount || 0;
    const maxOpens = emailRecord.metadata?.maxOpens || 5;

    if (currentOpenCount >= maxOpens) {
      console.log(`EmailQueue record ${emailRecord._id} has reached max opens, should have been moved to EmailLogs`);
      return createGoneResponse();
    }

    // Update the open count in EmailQueue
    await EmailQueue.updateOne(
      { _id: emailRecord._id },
      {
        $set: {
          'metadata.opened': true,
          'metadata.lastOpened': new Date(),
          ...(currentOpenCount === 0 && { 'metadata.firstOpened': new Date() })
        },
        $inc: { 'metadata.openCount': 1 }
      }
    );

    console.log(`EmailQueue record ${emailRecord._id} opened (count: ${currentOpenCount + 1}/${maxOpens}) - should migrate to EmailLogs`);
    return createPixelResponse();

  } catch (error) {
    console.error('Error handling EmailQueue tracking:', error);
    return createPixelResponse();
  }
}

// Helper function to update server open rate
async function updateServerOpenRate(serverId) {
  try {
    const server = await Server.findById(serverId);
    if (!server) return;

    // Calculate new open rate
    const totalSent = server.mailsSent || 0;
    const currentOpenRate = server.openRate || 0;
    const totalOpened = Math.round((currentOpenRate * totalSent) / 100);
    const newTotalOpened = totalOpened + 1;
    const newOpenRate = totalSent > 0 ? (newTotalOpened / totalSent) * 100 : 0;

    await Server.updateOne(
      { _id: serverId },
      {
        $set: {
          openRate: Math.round(newOpenRate * 100) / 100 // Round to 2 decimal places
        }
      }
    );

    console.log(`Updated server ${serverId} open rate: ${newOpenRate.toFixed(2)}%`);
  } catch (error) {
    console.error('Error updating server open rate:', error);
  }
}

// Helper function to update contact engagement with proper calculation
async function updateContactEngagement(contactId, actions = {}) {
  try {
    const contact = await Contact.findById(contactId);
    if (!contact) {
      console.log(`Contact ${contactId} not found for engagement update`);
      return;
    }

    // Get current engagement stats from schema
    const engagement = contact.engagementHistory || {
      totalEmailsSent: 0,
      totalEmailsDelivered: 0,
      totalEmailsOpened: 0,
      totalEmailsClicked: 0,
      openRate: 0,
      clickRate: 0,
      engagementScore: 50
    };

    // Update counters based on actions
    if (actions.emailSent) engagement.totalEmailsSent += 1;
    if (actions.emailDelivered) engagement.totalEmailsDelivered += 1;
    if (actions.emailOpened) {
      // Only increment on first open to avoid inflating numbers
      if (actions.isFirstOpen) {
        engagement.totalEmailsOpened += 1;
      }
    }
    if (actions.emailClicked) {
      // Only increment on first click to avoid inflating numbers
      if (actions.isFirstClick) {
        engagement.totalEmailsClicked += 1;
      }
    }

    // Calculate engagement rates based on your schema
    // Open Rate = (emails opened / emails delivered) * 100
    if (engagement.totalEmailsDelivered > 0) {
      engagement.openRate = Math.min(100, (engagement.totalEmailsOpened / engagement.totalEmailsDelivered) * 100);
    } else {
      engagement.openRate = 0;
    }

    // Click Rate = (emails clicked / emails opened) * 100
    if (engagement.totalEmailsOpened > 0) {
      engagement.clickRate = Math.min(100, (engagement.totalEmailsClicked / engagement.totalEmailsOpened) * 100);
    } else {
      engagement.clickRate = 0;
    }

    // Calculate delivery rate
    const deliveryRate = engagement.totalEmailsSent > 0
      ? Math.min(100, (engagement.totalEmailsDelivered / engagement.totalEmailsSent) * 100)
      : 0;

    // Calculate engagement score (0-100)
    // Weighted formula: 40% open rate + 40% click rate + 20% delivery rate
    engagement.engagementScore = Math.min(100, Math.max(0,
      (engagement.openRate * 0.4) +
      (engagement.clickRate * 0.4) +
      (deliveryRate * 0.2)
    ));

    // Round to 2 decimal places for cleaner data
    engagement.openRate = Math.round(engagement.openRate * 100) / 100;
    engagement.clickRate = Math.round(engagement.clickRate * 100) / 100;
    engagement.engagementScore = Math.round(engagement.engagementScore * 100) / 100;

    // Update the contact with calculated engagement
    await Contact.updateOne(
      { _id: contactId },
      {
        $set: {
          'engagementHistory.totalEmailsSent': engagement.totalEmailsSent,
          'engagementHistory.totalEmailsDelivered': engagement.totalEmailsDelivered,
          'engagementHistory.totalEmailsOpened': engagement.totalEmailsOpened,
          'engagementHistory.totalEmailsClicked': engagement.totalEmailsClicked,
          'engagementHistory.openRate': engagement.openRate,
          'engagementHistory.clickRate': engagement.clickRate,
          'engagementHistory.engagementScore': engagement.engagementScore,
          lastEngagementUpdate: new Date()
        }
      }
    );

    console.log(`Updated engagement for contact ${contactId}:`, {
      totalEmailsSent: engagement.totalEmailsSent,
      totalEmailsDelivered: engagement.totalEmailsDelivered,
      totalEmailsOpened: engagement.totalEmailsOpened,
      totalEmailsClicked: engagement.totalEmailsClicked,
      openRate: engagement.openRate,
      clickRate: engagement.clickRate,
      engagementScore: engagement.engagementScore
    });

  } catch (error) {
    console.error('Error updating contact engagement:', error);
  }
}

// Helper function to create pixel buffer
function createPixelBuffer() {
  return Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
  );
}

// Helper function to create pixel headers
function createPixelHeaders() {
  return {
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Access-Control-Allow-Origin': '*'
  };
}

// Helper function to create pixel response
function createPixelResponse() {
  const pixel = createPixelBuffer();
  return new NextResponse(pixel, {
    headers: createPixelHeaders()
  });
}

// Helper function to create gone response
function createGoneResponse() {
  const pixel = createPixelBuffer();
  return new NextResponse(pixel, {
    status: 410, // Gone
    headers: createPixelHeaders()
  });
}

export { updateContactEngagement };