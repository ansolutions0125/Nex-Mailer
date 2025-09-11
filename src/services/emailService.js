const axios = require('axios');

export async function sendEmailViaElasticEmail({ apiKey, toEmail, fromEmail, subject, bodyHtml }) {
    const url = "https://api.elasticemail.com/v2/email/send";
    
    const params = new URLSearchParams();
    params.append('apikey', apiKey);
    params.append('from', fromEmail);
    params.append('to', toEmail);
    params.append('subject', subject);
    params.append('bodyHtml', bodyHtml);
    params.append('isTransactional', 'true');

    try {
        const response = await axios.post(url, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (response.data.success) {
            return {
                success: true,
                messageId: response.data.data?.transactionid || Date.now().toString(),
                metadata: {
                    provider: 'elasticMail',
                    transactionId: response.data.data?.transactionid
                }
            };
        } else {
            throw new Error(response.data.error || 'Unknown Elastic Email API error');
        }
    } catch (error) {
        if (error.response) {
            throw new Error(`Elastic Email API error: ${error.response.status} - ${error.response.data.error || error.response.statusText}`);
        } else {
            throw new Error(`Elastic Email connection error: ${error.message}`);
        }
    }
}

// // File: services/sendEmailFunction.js
// // A generic function to send emails using multiple providers (Elastic Email, SMTP)

// import axios from "axios";

// // Helper function for replacing placeholders
// const replacePlaceholders = (template, placeholders) => {
//   console.log("[DEBUG] Starting replacePlaceholders function");
//   if (!template) {
//     console.log("[DEBUG] Empty template provided, returning empty string");
//     return "";
//   }
//   const data =
//     typeof placeholders === "object" && placeholders !== null
//       ? placeholders
//       : {};
//   console.log("[DEBUG] Replacing placeholders in template with data:", data);
//   console.log("[DEBUG] Template before replacement:", template);
//   const result = template.replace(/\${(.*?)}/g, (_, key) => {
//     console.log("[DEBUG] Replacing placeholder key:", key);
//     return data[key.trim()] || "";
//   });
//   console.log("[DEBUG] Template after replacement:", result);
//   return result;
// };

// // Basic email validation regex
// const validateEmail = (email) => {
//   console.log("[DEBUG] Starting email validation for:", email);
//   const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//   const isValid = re.test(String(email).toLowerCase());
//   console.log("[DEBUG] Email validation result:", isValid);
//   return isValid;
// };

// /**
//  * Send email via Elastic Email API
//  */
// const sendViaElasticEmail = async (emailData, config) => {
//   console.log("[DEBUG] Starting Elastic Email send process");
//   console.log("[DEBUG] Email data received:", emailData);
//   console.log("[DEBUG] Config received:", {
//     ...config,
//     apiKey: '***'
//   });

//   const params = new URLSearchParams();
//   params.append("apikey", config.apiKey);
//   params.append("subject", emailData.subject);
//   params.append("from", config.fromEmail);
//   params.append("fromName", config.fromName || config.fromEmail);
//   params.append("to", emailData.to);
//   params.append("bodyHtml", emailData.htmlContent);
//   params.append("isTransactional", config.isTransactional ? "true" : "false");

//   // Fix: Convert to an array, filter, and then convert back to an object for logging
//   console.log("[DEBUG] Params prepared for Elastic Email:",
//     Object.fromEntries(
//       Array.from(params.entries()).filter(([key]) => key !== 'apikey')
//     )
//   );

//   if (config.tracking) {
//     console.log("[DEBUG] Adding tracking parameters");
//     params.append("trackOpens", "true");
//     params.append("trackClicks", "true");
//   }

//   const url = "https://api.elasticemail.com/v2/email/send";

//   console.log("[DEBUG] Making Elastic Email API request to:", url);
//   const response = await axios.post(url, params, {
//     headers: {
//       'Content-Type': 'application/x-www-form-urlencoded',
//     },
//     timeout: 30000,
//   });

//   console.log("[DEBUG] Elastic Email API Response:", response.data);

//   if (response.data && response.data.success === false) {
//     console.error("[DEBUG] Elastic Email API returned success:false", response.data);
//     throw new Error(response.data.error || 'Elastic Email sending failed');
//   }

//   const result = {
//     success: true,
//     message: `Email successfully sent via Elastic Email to ${emailData.to}`,
//     messageId: response.data.MessageID || response.data.transactionid || response.data.data,
//     provider: 'elastic-email',
//     data: response.data
//   };

//   console.log("[DEBUG] Returning successful result:", result);
//   return result;
// };


// async function sendEmailViaElasticEmail(apiKey, toEmail, fromEmail, subject, bodyHtml) {
//     const url = "https://api.elasticemail.com/v2/email/send";
    
//     const params = new URLSearchParams();
//     params.append('apikey', apiKey);
//     params.append('from', fromEmail);
//     params.append('to', toEmail);
//     params.append('subject', subject);
//     params.append('bodyHtml', bodyHtml);
//     params.append('isTransactional', 'true');

//     try {
//         const response = await axios.post(url, params, {
//             headers: {
//                 'Content-Type': 'application/x-www-form-urlencoded'
//             }
//         });

//         if (response.data.success) {
//             return { success: true, message: "Email sent successfully" };
//         } else {
//             return { success: false, message: `API error: ${response.data.error || 'Unknown error'}` };
//         }
//     } catch (error) {
//         if (error.response) {
//             return { success: false, message: `HTTP error: ${error.response.status} - ${error.response.statusText}` };
//         } else {
//             return { success: false, message: `Exception occurred: ${error.message}` };
//         }
//     }
// }

// /**
//  * Send email via SMTP (requires nodemailer)
//  */
// const sendViaSMTP = async (emailData, config) => {
//   console.log("[DEBUG] Starting SMTP send process");
//   console.log("[DEBUG] Email data received:", emailData);
//   console.log("[DEBUG] SMTP config received:", {
//     ...config,
//     auth: {
//       user: config.auth.user,
//       pass: '***'
//     }
//   });

//   // Import nodemailer dynamically
//   console.log("[DEBUG] Importing nodemailer");
//   const nodemailer = await import("nodemailer");

//   console.log("[DEBUG] Creating SMTP transporter");
//   const transporter = nodemailer.createTransport({
//     host: config.host,
//     port: config.port,
//     secure: config.secure,
//     auth: {
//       user: config.auth.user,
//       pass: config.auth.pass,
//     },
//     connectionTimeout: 30000,
//     socketTimeout: 30000,
//     greetingTimeout: 30000,
//   });

//   // Verify SMTP connection
//   console.log("[DEBUG] Verifying SMTP connection");
//   await transporter.verify();
//   console.log("[DEBUG] SMTP server connection verified");

//   const mailOptions = {
//     from: `"${config.fromName || config.fromEmail}" <${config.fromEmail}>`,
//     to: emailData.to,
//     subject: emailData.subject,
//     html: emailData.htmlContent,
//   };
//   console.log("[DEBUG] Mail options prepared:", { ...mailOptions,
//     html: '(content)'
//   });

//   console.log("[DEBUG] Sending mail via SMTP");
//   const result = await transporter.sendMail(mailOptions);
//   console.log("[DEBUG] SMTP email sent successfully:", result);

//   const response = {
//     success: true,
//     message: `Email successfully sent via SMTP to ${emailData.to}`,
//     messageId: result.messageId,
//     provider: 'smtp',
//     metadata: result
//   };

//   console.log("[DEBUG] Returning successful result:", response);
//   return response;
// };

// /**
//  * @param {object} options
//  * @param {string} options.to - Recipient's email address.
//  * @param {string} options.subject - Email subject.
//  * @param {string} options.htmlTemplate - HTML template with placeholders.
//  * @param {object} options.placeholders - Key-value pairs for template replacement.
//  * @param {object} options.serverConfig - Configuration object for the email provider.
//  * @param {string} options.serverConfig.type - 'elasticMail' or 'smtp'.
//  */
// export const sendEmail = async ({
//   to,
//   subject,
//   htmlTemplate,
//   placeholders,
//   serverConfig
// }) => {
//   console.log("[DEBUG] Starting unified sendEmail function");

//   if (!validateEmail(to)) {
//     throw new Error(`Invalid email address: ${to}`);
//   }

//   const htmlContent = replacePlaceholders(htmlTemplate, placeholders);
//   if (!htmlContent) {
//     throw new Error("Email template is empty after placeholder replacement");
//   }

//   const emailData = {
//     to,
//     subject,
//     htmlContent
//   };

//   if (serverConfig.type === "elasticMail") {
//     return sendViaElasticEmail(emailData, serverConfig);
//   } else if (serverConfig.type === "smtp") {
//     return sendViaSMTP(emailData, serverConfig);
//   } else {
//     throw new Error(`Unsupported email service type: ${serverConfig.type}`);
//   }
// };

// // Export helper functions for potential external use
// export {
//   replacePlaceholders,
//   validateEmail
// };


// // services/emailService.js

