import { NextResponse } from "next/server";
import Template from "@/models/Template";
import Contact from "@/models/Contact";
import Flow from "@/models/Flow";
import Website from "@/models/Website";
import Server from "@/models/Server";
import dbConnect from "@/config/mongoConfig";
import EmailQueue from "@/models/EmailQueue";
import EmailLogs from "@/models/EmailLogs";
import Stats from "@/models/Stats";
import axios from "axios";
import nodemailer from "nodemailer";

// Import the engagement function (you'll need to create this function or import from tracking route)
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
    if (actions.emailOpened && actions.isFirstOpen) engagement.totalEmailsOpened += 1;
    if (actions.emailClicked && actions.isFirstClick) engagement.totalEmailsClicked += 1;

    // Calculate engagement rates
    if (engagement.totalEmailsDelivered > 0) {
      engagement.openRate = Math.min(100, (engagement.totalEmailsOpened / engagement.totalEmailsDelivered) * 100);
    } else {
      engagement.openRate = 0;
    }

    if (engagement.totalEmailsOpened > 0) {
      engagement.clickRate = Math.min(100, (engagement.totalEmailsClicked / engagement.totalEmailsOpened) * 100);
    } else {
      engagement.clickRate = 0;
    }

    // Calculate delivery rate
    const deliveryRate = engagement.totalEmailsSent > 0
      ? Math.min(100, (engagement.totalEmailsDelivered / engagement.totalEmailsSent) * 100)
      : 0;

    // Calculate engagement score
    engagement.engagementScore = Math.min(100, Math.max(0,
      (engagement.openRate * 0.4) +
      (engagement.clickRate * 0.4) +
      (deliveryRate * 0.2)
    ));

    // Round to 2 decimal places
    engagement.openRate = Math.round(engagement.openRate * 100) / 100;
    engagement.clickRate = Math.round(engagement.clickRate * 100) / 100;
    engagement.engagementScore = Math.round(engagement.engagementScore * 100) / 100;

    // Update the contact
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

  } catch (error) {
    console.error('Error updating contact engagement:', error);
  }
}

export async function GET() {
  console.log("Starting email processor...");
  await dbConnect();
  console.log("Database connected");

  const now = new Date();
  const batchSize = 50;
  console.log(`Processing batch of ${batchSize} emails`);

  // Statistics tracking
  let statsUpdates = {
    totalEmailsSent: 0,
    totalEmailsFailed: 0
  };

  try {
    console.log("Fetching pending/failed emails from queue...");
    const emails = await EmailQueue.find({
      status: {
        $in: ["pending", "failed"],
      },
      $or: [
        {
          nextAttempt: {
            $lte: now,
          },
        },
        {
          nextAttempt: {
            $exists: false,
          },
        },
      ],
      $expr: {
        $lt: ["$attempts", "$maxAttempts"],
      },
    })
      .sort({
        createdAt: 1,
      })
      .limit(batchSize);

    console.log(`Found ${emails.length} emails to process`);

    let processedCount = 0;
    let successfulCount = 0;
    let failedCount = 0;

    // Process emails one by one
    for (const email of emails) {
      let server; // Declare server variable here to use in error handling
      let emailLog; // Declare emailLog for cleanup in error handling

      try {
        console.log(`Processing email ID: ${email._id} for ${email.email}`);

        // Update status to processing
        await EmailQueue.updateOne(
          { _id: email._id },
          { $set: { status: "processing", lastAttempt: new Date() } }
        );

        // Get the template
        const template = await Template.findById(email.templateId);
        if (!template) {
          throw new Error("Template not found");
        }

        // Get flow and server information
        const flow = await Flow.findById(email.flowId).select("websiteId");
        if (!flow || !flow.websiteId) {
          throw new Error("Flow not found or missing websiteId");
        }

        const website = await Website.findById(flow.websiteId).select(
          "accessableServer"
        );
        if (!website || !website.accessableServer) {
          throw new Error("Website not found or missing accessableServer");
        }

        console.log(
          `Finding server from website with serverId: ${website.accessableServer}`
        );

        server = await Server.findById(website.accessableServer);
        if (!server) {
          throw new Error("Server not found");
        }

        // Replace placeholders in template
        let finalHtml = template.html;
        if (email.variables) {
          for (const [key, value] of Object.entries(email.variables)) {
            finalHtml = finalHtml.replace(
              new RegExp(`\\{\\{${key}\\}\\}`, "g"),
              value
            );
          }
        }

        // Create email log entry FIRST to get the tracking ID
        emailLog = await EmailLogs.create({
          contactId: email.contactId,
          serverId: server._id,
          flowId: email.flowId,
          listId: email.listId,
          stepId: email.stepId,
          templateId: email.templateId,
          email: email.email,
          subject: email.subject,
          variables: email.variables,
          status: "processing", // Set as processing initially
          attempts: (email.attempts || 0) + 1,
          metadata: {
            serverId: server._id,
            serverUsed: server.name,
            serverPreset: server.presetId,
            openCount: 0,
            maxOpens: 5,
            opened: false,
            lastOpened: null,
            firstOpened: null,
            queueId: email._id, // Store original queue ID for reference
          },
          sentAt: new Date(),
        });

        console.log(`Created EmailLog with ID: ${emailLog._id} for tracking`);

        // Send email using the EmailLogs _id for tracking
        let sendResult;
        if (server.presetId === "elasticMail") {
          sendResult = await sendViaElasticEmail(server, email, finalHtml, emailLog._id);
        } else if (server.presetId === "smtp") {
          sendResult = await sendViaSMTP(server, email, finalHtml, emailLog._id);
        } else {
          throw new Error(`Unsupported server preset: ${server.presetId}`);
        }

        console.log(`Email sent successfully via ${server.presetId}`);

        // Update the EmailLogs record with success status and messageId
        await EmailLogs.updateOne(
          { _id: emailLog._id },
          {
            $set: {
              status: "sent",
              messageId: sendResult.messageId,
              metadata: {
                ...emailLog.metadata,
                ...sendResult.metadata,
              },
            },
          }
        );

        // DELETE email from queue after successful sending
        await EmailQueue.deleteOne({ _id: email._id });
        console.log(`Successfully deleted email ${email._id} from queue, tracking with log ID: ${emailLog._id}`);

        // Update server stats
        await Server.updateOne(
          { _id: server._id },
          { 
            $inc: { 
              mailsSent: 1,
              // Update open rate if we have historical data
              ...(server.mailsSent > 0 && {
                openRate: ((server.openRate * server.mailsSent) + 0) / (server.mailsSent + 1)
              })
            }
          }
        );

        // Update flow statistics
        await Flow.updateOne(
          { _id: email.flowId },
          {
            $inc: {
              "stats.totalEmailsSent": 1,
              "stats.totalUsersProcessed": 1
            },
            $set: {
              "stats.lastProcessedAt": new Date()
            }
          }
        );

        // Update contact engagement if exists
        if (email.contactId) {
          await Contact.updateOne(
            { _id: email.contactId },
            { 
              $inc: { 
                "engagementHistory.totalEmailsSent": 1,
                "engagementHistory.totalEmailsDelivered": 1
              }
            }
          );

          // Also calculate engagement rates
          await updateContactEngagement(email.contactId, {
            emailSent: true,
            emailDelivered: true
          });
        }

        // Update global stats
        statsUpdates.totalEmailsSent++;

        processedCount++;
        successfulCount++;
        console.log(`Successfully sent email to ${email.email}`);

      } catch (error) {
        console.error(`Error processing email ${email._id}:`, error.message);

        // Calculate next retry attempt with exponential backoff
        const currentAttempts = email.attempts || 0;
        const nextAttempt = new Date(
          Date.now() +
            Math.min(
              5 * 60 * 1000 * Math.pow(2, currentAttempts),
              24 * 60 * 60 * 1000
            )
        );

        // Update email status to failed in queue
        await EmailQueue.updateOne(
          { _id: email._id },
          {
            $set: {
              status: "failed",
              lastError: error.message,
              nextAttempt,
              metadata: {
                errorDetails: error.message,
                lastAttempt: new Date(),
                ...(server
                  ? {
                      serverUsed: server.name,
                      serverPreset: server.presetId,
                    }
                  : {}),
              },
            },
            $inc: { attempts: 1 },
          }
        );

        // Update or create failed email log entry
        if (emailLog) {
          // If EmailLog was created, update it to failed status
          await EmailLogs.updateOne(
            { _id: emailLog._id },
            {
              $set: {
                status: "failed",
                lastError: error.message,
                metadata: {
                  ...emailLog.metadata,
                  errorDetails: error.message,
                  failedAt: new Date(),
                },
              },
            }
          );
        } else if (email.contactId && server) {
          // If EmailLog wasn't created yet, create a failed log entry
          await EmailLogs.create({
            contactId: email.contactId,
            serverId: server._id,
            flowId: email.flowId,
            listId: email.listId,
            stepId: email.stepId,
            templateId: email.templateId,
            email: email.email,
            subject: email.subject,
            variables: email.variables,
            status: "failed",
            attempts: (email.attempts || 0) + 1,
            lastError: error.message,
            metadata: {
              errorDetails: error.message,
              serverId: server._id,
              serverUsed: server.name,
              serverPreset: server.presetId,
              queueId: email._id,
            },
            sentAt: new Date(),
          });
        }

        // Update server failure stats if server was found
        if (server) {
          await Server.updateOne(
            { _id: server._id },
            { 
              $inc: { 
                failedRate: 1,
                // Update bounce rate
                bounceRate: ((server.bounceRate * server.mailsSent) + 1) / (server.mailsSent + 1)
              }
            }
          );
        }

        // Update global stats
        statsUpdates.totalEmailsFailed++;

        processedCount++;
        failedCount++;
      }
    }

    // Update global statistics after processing all emails
    if (statsUpdates.totalEmailsSent > 0 || statsUpdates.totalEmailsFailed > 0) {
      await updateGlobalStats(statsUpdates);
    }

    console.log(
      `Email processing complete. Processed ${processedCount} emails (${successfulCount} successful, ${failedCount} failed)`
    );
    
    return NextResponse.json({
      success: true,
      processed: processedCount,
      successful: successfulCount,
      failed: failedCount,
      totalFound: emails.length,
      stats: statsUpdates
    });
  } catch (error) {
    console.error("Error in emailProcessor:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Updates global statistics with accumulated counts from email processing
 * @param {object} stats - Object containing stat counts to update
 */
async function updateGlobalStats(stats) {
  try {
    const updateFields = {};
    
    // Build update object dynamically based on provided stats
    Object.keys(stats).forEach(key => {
      if (stats[key] > 0) {
        updateFields[key] = stats[key];
      }
    });

    if (Object.keys(updateFields).length > 0) {
      await Stats.findOneAndUpdate(
        { _id: "current" },
        { $inc: updateFields },
        { new: true, upsert: true }
      );
      
      console.log(`Updated global email stats:`, updateFields);
    }
  } catch (error) {
    console.error("Error updating global email stats:", error);
  }
}

/**
 * Send email via Elastic Email service with tracking
 * @param {object} server - Server configuration
 * @param {object} email - Email data from queue
 * @param {string} htmlContent - Processed HTML content
 * @param {string} trackingId - EmailLogs _id for tracking pixel
 */
async function sendViaElasticEmail(server, email, htmlContent, trackingId) {
  // Add open tracking pixel using the EmailLogs _id for tracking
  const trackingPixel = `<img src="${process.env.NEXT_PUBLIC_API_URL}/api/track/open/${trackingId}" width="1" height="1" style="display:none;" />`;
  const trackedHtml = htmlContent + trackingPixel;

  const url = "https://api.elasticemail.com/v2/email/send";
  const params = new URLSearchParams();
  params.append("apikey", server.keys.API_KEY);
  params.append("from", server.keys.FROM_EMAIL);
  params.append("fromName", server.keys.FROM_NAME || "");
  params.append("to", email.email);
  params.append("subject", email.subject);
  params.append("bodyHtml", trackedHtml);
  params.append("isTransactional", server.keys.IS_TRANSACTIONAL || "true");
  // Enable open tracking
  params.append("trackOpens", "true");
  params.append(
    "trackingUrl",
    `${process.env.NEXT_PUBLIC_API_URL}/api/track/open/${trackingId}`
  );

  const response = await axios.post(url, params, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    timeout: 10000,
  });

  if (!response.data.success) {
    throw new Error(response.data.error || "Elastic Email API error");
  }

  return {
    messageId: response.data.data?.transactionid || Date.now().toString(),
    metadata: {
      provider: "elasticMail",
      transactionId: response.data.data?.transactionid,
      trackingEnabled: true,
      trackingId: trackingId,
    },
  };
}

/**
 * Send email via SMTP with tracking
 * @param {object} server - Server configuration
 * @param {object} email - Email data from queue
 * @param {string} htmlContent - Processed HTML content
 * @param {string} trackingId - EmailLogs _id for tracking pixel
 */
async function sendViaSMTP(server, email, htmlContent, trackingId) {
  // Add open tracking pixel using the EmailLogs _id for tracking
  const trackingPixel = `<img src="${process.env.NEXT_PUBLIC_API_URL}/api/track/open/${trackingId}" width="1" height="1" style="display:none;" />`;
  const trackedHtml = htmlContent + trackingPixel;

  const transporter = nodemailer.createTransport({
    host: server.keys.HOST,
    port: server.keys.PORT || 587,
    secure: server.keys.SMTP_SECURE || false,
    auth: {
      user: server.keys.USERNAME,
      pass: server.keys.PASSWORD,
    },
    tls: {
      rejectUnauthorized: server.keys.SMTP_REJECT_UNAUTHORIZED !== false,
    },
    connectionTimeout: 10000,
  });

  const mailOptions = {
    from: `"No Reply" <${server.keys.FROM_EMAIL}>`,
    to: email.email,
    subject: email.subject,
    html: trackedHtml,
    headers: {
      // Custom tracking headers
      "X-MC-Track": "opens,clicks",
      "X-MC-GoogleAnalytics": "your-domain.com",
      "X-MC-Tags": "tracked-email",
      "X-Tracking-ID": trackingId,
    },
  };

  const info = await transporter.sendMail(mailOptions);

  return {
    messageId: info.messageId,
    metadata: {
      provider: "smtp",
      envelope: info.envelope,
      accepted: info.accepted,
      trackingEnabled: true,
      trackingId: trackingId,
    },
  };
}