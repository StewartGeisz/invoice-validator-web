// pages/api/scan-emails.js
import axios from 'axios';
import PDFVendorMatcher from '../../lib/pdf-validator.js';
import emailRecipients from '../../data/email-recipients.json';

const AMPLIFY_API_URL = 'https://prod-api.vanderbilt.ai/microsoft/integrations';

/**
 * Searches for recent emails that have attachments.
 * @returns {Promise<Array>} A list of email messages.
 */
async function searchEmailsWithAttachments() {
  const apiKey = process.env.AMPLIFY_API_KEY;
  if (!apiKey) {
    throw new Error("AMPLIFY_API_KEY environment variable not set.");
  }

  const response = await axios.post(`${AMPLIFY_API_URL}/search_messages`, {
    data: {
      search_query: "hasAttachments:true",
      top: 10 // Process up to 10 emails per run to avoid timeouts
    }
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }
  });

  return response.data.data || [];
}

/**
 * Gets the list of attachments for a given message.
 * @param {string} messageId The ID of the email message.
 * @returns {Promise<Array>} A list of attachment metadata objects.
 */
async function getAttachmentsList(messageId) {
  const apiKey = process.env.AMPLIFY_API_KEY;
  const response = await axios.post(`${AMPLIFY_API_URL}/get_attachments`, {
    data: { message_id: messageId }
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }
  });
  return response.data.data || [];
}

/**
 * Downloads a specific attachment and returns its content as a Buffer.
 * @param {string} messageId The ID of the email message.
 * @param {string} attachmentId The ID of the attachment.
 * @returns {Promise<Buffer|null>} The file content as a Buffer.
 */
async function downloadAttachment(messageId, attachmentId) {
  const apiKey = process.env.AMPLIFY_API_KEY;
  const response = await axios.post(`${AMPLIFY_API_URL}/download_attachment`, {
    data: {
      message_id: messageId,
      attachment_id: attachmentId
    }
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }
  });

  const contentBytes = response.data.data?.contentBytes;
  if (contentBytes) {
    return Buffer.from(contentBytes, 'base64');
  }
  return null;
}

/**
 * Sends a validation result email based on the outcome.
 * This function now handles routing for both the source and the approvers.
 * @param {object} validationResult The result from the PDF validator.
 * @param {string} originalFilename The name of the PDF file.
 */
async function sendNotificationEmails(validationResult, originalFilename) {
  const { vendor, po_valid, date_valid, rate_valid, is_variable_rate } = validationResult;
  const overallSuccess = vendor && po_valid && date_valid && rate_valid && !is_variable_rate;

  let feedbackSubject;
  let feedbackBody;
  let forwardEmail = null;

  if (overallSuccess) {
    // --- Success Case ---
    feedbackSubject = `✅ Invoice Processed for ${vendor}`;
    feedbackBody = `The invoice "${originalFilename}" was successfully validated and has been forwarded for approval.`;
    
    forwardEmail = {
      recipient: emailRecipients.routing.onSuccess.recipient,
      subject: `Invoice Ready for Approval: ${vendor}`,
      body: `The attached invoice "${originalFilename}" has been fully validated and is ready for your approval.`
    };

  } else if (is_variable_rate) {
    // --- Variable Rate Case ---
    feedbackSubject = `⚠️ Invoice Processed for ${vendor}`;
    feedbackBody = `The invoice "${originalFilename}" has a variable rate. It has been forwarded for manual review.`;
    
    forwardEmail = {
      recipient: emailRecipients.routing.onVariable.recipient,
      subject: `Invoice for Review (Variable Rate): ${vendor}`,
      body: `The attached invoice "${originalFilename}" has a variable rate and requires your manual review.`
    };
  } else {
    // --- Failure Case ---
    feedbackSubject = `❌ Action Required: Invoice Failed Validation for ${vendor}`;
    feedbackBody = `The invoice "${originalFilename}" failed validation and has NOT been forwarded for approval. Please review the details below and take appropriate action.`;
    // No forwardEmail in this case.
  }

  // 1. Always send feedback to the source inbox
  const sourceRecipient = emailRecipients.routing.source.recipient;
  feedbackBody += `<br><br>--- Validation Details ---<br><pre>${JSON.stringify(validationResult, null, 2)}</pre>`;
  await sendEmail(sourceRecipient, feedbackSubject, feedbackBody);

  // 2. Conditionally forward to the approver/reviewer
  if (forwardEmail) {
    forwardEmail.body += `<br><br>--- Validation Details ---<br><pre>${JSON.stringify(validationResult, null, 2)}</pre>`;
    await sendEmail(forwardEmail.recipient, forwardEmail.subject, forwardEmail.body);
  }
}

/**
 * Generic email sending utility.
 * @param {string} recipient The email address of the recipient.
 * @param {string} subject The subject of the email.
 * @param {string} body The HTML body of the email.
 */
async function sendEmail(recipient, subject, body) {
  const apiKey = process.env.AMPLIFY_API_KEY;
  if (!recipient) {
    console.error("No recipient defined. Skipping email.");
    return;
  }
  
  console.log(`Sending email to ${recipient} with subject "${subject}"`);
  try {
    await axios.post(`${AMPLIFY_API_URL}/send_email`, {
      data: { to: [recipient], subject, body, importance: "normal" }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });
    console.log(`- Email to ${recipient} sent successfully.`);
  } catch (error) {
    console.error(`- Failed to send email to ${recipient}:`, error.response?.data || error.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // TODO: Add security check to ensure this is triggered by Vercel Cron or a trusted source

  try {
    console.log("Email scanning process started...");
    
    const messages = await searchEmailsWithAttachments();
    console.log(`Found ${messages.length} emails with attachments.`);

    for (const message of messages) {
      const attachments = await getAttachmentsList(message.id);
      console.log(`- Email "${message.subject}" has ${attachments.length} attachment(s).`);

      for (const attachment of attachments) {
        if (attachment.contentType === 'application/pdf' || attachment.name.toLowerCase().endsWith('.pdf')) {
          console.log(`  -- Found PDF: ${attachment.name}. Downloading...`);
          const pdfBuffer = await downloadAttachment(message.id, attachment.id);

          if (pdfBuffer) {
            console.log(`     ... Downloaded ${attachment.name} (${pdfBuffer.length} bytes). Validating...`);
            // TODO: Pass pdfBuffer to the validator
            const validator = new PDFVendorMatcher();
            const validationResult = await validator.processPdf(pdfBuffer);

            // Only send an email if a vendor was successfully identified
            if (validationResult && validationResult.vendor) {
              console.log(`     ... Validation complete for ${attachment.name}.`);
              await sendNotificationEmails(validationResult, attachment.name);
            } else {
              console.log(`     ... Validation skipped for ${attachment.name}: No known vendor identified.`);
            }
          }
        }
      }
    }

    // The core logic will go here.
    // 1. Search for emails with PDF attachments. (Done)
    // 2. Download attachments. (Done)
    // 3. Pass attachments to the validator. (Done)
    // 4. Handle the results.

    console.log("Email scanning process finished.");
    res.status(200).json({ success: true, message: "Email scan completed." });
  } catch (error) {
    console.error('Error during email scan:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}
