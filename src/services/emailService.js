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
 