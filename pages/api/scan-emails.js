// pages/api/scan-emails.js
import axios from 'axios';
import PDFVendorMatcher from '../../lib/pdf-validator.js';

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

            console.log(`     ... Validation complete for ${attachment.name}.`);
            console.log(JSON.stringify(validationResult, null, 2));
            // TODO: Do something with the result (e.g., save to DB, send notification)
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
