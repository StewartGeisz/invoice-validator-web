import emailService from './email-service.js';
import { getEmailForEnvironment, getContactEmail } from './email-utils.js';
import vendorData from '../data/vendor-data.json';
import auditLogger from './audit-logger.js';
import fs from 'fs';
import path from 'path';

/**
 * Approval Handler
 * Processes approval/rejection replies from FUM and routes accordingly
 */
class ApprovalHandler {
    constructor() {
        this.vendorData = vendorData.vendorData;
    }

    /**
     * Extract reference ID from email subject or body
     * Format: [Ref: INV-{hash}]
     */
    _extractReferenceId(email) {
        // Check subject first
        const subjectMatch = email.subject?.match(/\[Ref:\s*([^\]]+)\]/);
        if (subjectMatch) {
            return subjectMatch[1];
        }

        // Check body for reference
        const bodyText = email.text || email.html?.replace(/<[^>]*>/g, '') || '';
        const bodyMatch = bodyText.match(/\[Ref:\s*([^\]]+)\]/);
        if (bodyMatch) {
            return bodyMatch[1];
        }

        return null;
    }

    /**
     * Parse approval/rejection from email content
     * Uses exact matching: trim and check for "Approved" or "Rejected" (case-insensitive)
     */
    _parseApprovalDecision(email) {
        const text = (email.text || email.html?.replace(/<[^>]*>/g, '') || '').trim();
        
        // Extract first line or first word for exact matching
        const firstLine = text.split('\n')[0].trim();
        const firstWord = firstLine.split(/\s+/)[0].trim();
        
        // Check for exact match (case-insensitive)
        const normalized = firstWord.toLowerCase();
        
        if (normalized === 'approved') {
            return 'approved';
        } else if (normalized === 'rejected') {
            return 'rejected';
        }

        return null; // Not Approved or Rejected
    }

    /**
     * Load audit log entry by reference ID
     */
    async _loadAuditEntry(referenceId) {
        const logFile = path.join(process.cwd(), 'audit_log', 'logs.json');
        
        if (!fs.existsSync(logFile)) {
            return null;
        }

        try {
            const logs = JSON.parse(fs.readFileSync(logFile, 'utf-8'));
            // Search for entry with matching referenceId (in metadata or top level)
            const entry = logs.find(entry => 
                entry.referenceId === referenceId || 
                entry.metadata?.referenceId === referenceId ||
                entry.id === referenceId
            );
            
            // If not found, try searching in reverse order (most recent first)
            if (!entry && logs.length > 0) {
                // Search recent entries first
                for (let i = logs.length - 1; i >= Math.max(0, logs.length - 50); i--) {
                    const e = logs[i];
                    if (e.referenceId === referenceId || e.metadata?.referenceId === referenceId) {
                        return e;
                    }
                }
            }
            
            return entry || null;
        } catch (error) {
            console.error('Error loading audit entry:', error);
            return null;
        }
    }

    /**
     * Get vendor's Main Contact email
     */
    _getMainContactEmail(vendorName) {
        if (!this.vendorData[vendorName]) {
            return null;
        }

        const vendorInfo = this.vendorData[vendorName];
        const mainContact = vendorInfo.mainContact;

        if (mainContact && mainContact !== null && mainContact !== undefined && mainContact.toString().toLowerCase() !== 'nan') {
            return getContactEmail(mainContact);
        }

        return null;
    }

    /**
     * Process approval/rejection email from FUM
     */
    async processApprovalReply(email) {
        console.log(`\n📬 Processing approval reply from: ${email.from}`);
        console.log(`   Subject: ${email.subject}`);

        // Extract reference ID
        const referenceId = this._extractReferenceId(email);
        if (!referenceId) {
            console.log(`   ⚠️  No reference ID found in email, skipping approval processing`);
            return { processed: false, reason: 'No reference ID found' };
        }

        console.log(`   Reference ID: ${referenceId}`);

        // Parse approval decision
        const decision = this._parseApprovalDecision(email);

        // Load audit entry to get invoice details
        const auditEntry = await this._loadAuditEntry(referenceId);
        if (!auditEntry) {
            console.log(`   ⚠️  Could not find audit entry for reference ID: ${referenceId}`);
            return { processed: false, reason: 'Audit entry not found' };
        }

        const vendorName = auditEntry.vendor;
        const filename = auditEntry.originalFilename;
        const initialSender = auditEntry.metadata?.sourceEmail || null;

        console.log(`   Vendor: ${vendorName}`);
        console.log(`   Invoice: ${filename}`);

        if (decision === 'approved') {
            console.log(`   Decision: APPROVED`);
            return await this._handleFUMApproval(vendorName, filename, referenceId, initialSender, email, auditEntry);
        } else if (decision === 'rejected') {
            console.log(`   Decision: REJECTED`);
            return await this._handleFUMRejection(vendorName, filename, referenceId, initialSender, email);
        } else {
            console.log(`   ⚠️  Invalid reply - must be "Approved" or "Rejected"`);
            return await this._handleInvalidReply(vendorName, filename, referenceId, initialSender, email);
        }
    }

    /**
     * Format validation status for display
     */
    _formatValidationStatus(auditEntry) {
        const poValid = auditEntry.poValidation?.valid;
        const dateValid = auditEntry.dateValidation?.valid;
        const rateValid = auditEntry.rateValidation?.valid;

        const statuses = [];
        if (poValid === true) statuses.push('✅ PO Number: Valid');
        else if (poValid === false) statuses.push('❌ PO Number: Invalid');
        else statuses.push('⚠️ PO Number: Not Checked');

        if (dateValid === true) statuses.push('✅ Date Range: Valid');
        else if (dateValid === false) statuses.push('❌ Date Range: Invalid');
        else statuses.push('⚠️ Date Range: Not Checked');

        if (rateValid === true) statuses.push('✅ Rate: Valid');
        else if (rateValid === false) statuses.push('❌ Rate: Invalid');
        else statuses.push('⚠️ Rate: Not Checked');

        return statuses.join('<br>');
    }

    /**
     * Handle FUM approval - forward to Main Contact with invoice and notify initial sender
     */
    async _handleFUMApproval(vendorName, filename, referenceId, initialSenderEmail, fumEmail, auditEntry) {
        console.log(`   ✅ FUM approved - forwarding to Main Contact...`);

        // Get Main Contact email
        const mainContactEmail = this._getMainContactEmail(vendorName);
        if (!mainContactEmail) {
            console.log(`   ⚠️  No Main Contact found for vendor: ${vendorName}`);
            return { processed: false, reason: 'No Main Contact found' };
        }

        const mainContactName = this.vendorData[vendorName]?.mainContact || 'Main Contact';

        // Get PDF from audit log
        let pdfBuffer = null;
        try {
            pdfBuffer = await auditLogger.getPdfBuffer(auditEntry.id, filename);
            if (!pdfBuffer) {
                console.log(`   ⚠️  PDF not found in audit log, sending email without attachment`);
            }
        } catch (error) {
            console.error(`   ⚠️  Error loading PDF from audit log:`, error.message);
        }

        // Format validation outcome
        const validationStatus = this._formatValidationStatus(auditEntry);
        const overallStatus = auditEntry.overallStatus || 'unknown';

        // Prepare email to Main Contact
        const mainContactHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #4CAF50; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
                    .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
                    .approval-notice { background-color: #e8f5e9; padding: 15px; border-left: 4px solid #4CAF50; margin: 15px 0; }
                    .validation-box { background-color: #fff; padding: 15px; border: 1px solid #ddd; margin: 15px 0; border-radius: 4px; }
                    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>Invoice Approved by FUM - Ready for Your Review</h2>
                </div>
                <div class="content">
                    <p>Dear ${mainContactName},</p>
                    <p>An invoice for <strong>${vendorName}</strong> has been reviewed and <strong>approved by the Financial Unit Manager (FUM)</strong>.</p>
                    
                    <div class="approval-notice">
                        <p><strong>✅ FUM Approval Status:</strong> Approved</p>
                        <p><strong>Invoice File:</strong> ${filename}</p>
                        <p><strong>Reference ID:</strong> ${referenceId}</p>
                        <p><strong>Overall Validation Status:</strong> ${overallStatus}</p>
                    </div>

                    <div class="validation-box">
                        <p><strong>Validation Results:</strong></p>
                        <p>${validationStatus}</p>
                    </div>

                    <p>The invoice is attached to this email and is now ready for your review and final approval. Please confirm work completion and approve for processing in Oracle.</p>
                    
                    <div class="footer">
                        <p>This is an automated message from the Invoice Validation System.</p>
                        <p>Reference: ${referenceId}</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Prepare email options with PDF attachment if available
        const emailOptions = {
            to: mainContactEmail,
            subject: `Invoice Approved by FUM: ${vendorName} - ${filename} [Ref: ${referenceId}]`,
            html: mainContactHtml
        };

        if (pdfBuffer) {
            emailOptions.attachments = [{
                filename: filename,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }];
        }

        // Send to Main Contact
        try {
            await emailService.sendEmail(emailOptions);
            console.log(`   ✅ Forwarded to Main Contact: ${mainContactEmail}${pdfBuffer ? ' (with PDF attachment)' : ''}`);
        } catch (error) {
            console.error(`   ❌ Failed to send to Main Contact:`, error.message);
            return { processed: false, reason: 'Failed to send to Main Contact' };
        }

        // Notify initial sender (admin assistant)
        if (initialSenderEmail) {
            const senderEmail = getEmailForEnvironment(initialSenderEmail);
            const senderHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #2196F3; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
                        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
                        .status-box { background-color: #e3f2fd; padding: 15px; border-left: 4px solid #2196F3; margin: 15px 0; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h2>Update: FUM Approved Invoice</h2>
                    </div>
                    <div class="content">
                        <p>The invoice you forwarded has been <strong>approved by the Financial Unit Manager (FUM)</strong>.</p>
                        
                        <div class="status-box">
                            <p><strong>Vendor:</strong> ${vendorName}</p>
                            <p><strong>Invoice File:</strong> ${filename}</p>
                            <p><strong>Status:</strong> ✅ Approved by FUM</p>
                            <p><strong>Next Step:</strong> Forwarded to Main Contact for final approval</p>
                        </div>

                        <p>You will be notified once the Main Contact approves and the invoice is ready for processing in Oracle.</p>
                    </div>
                </body>
                </html>
            `;

            try {
                await emailService.sendEmail({
                    to: senderEmail,
                    subject: `Update: FUM Approved - ${vendorName} - ${filename}`,
                    html: senderHtml
                });
                console.log(`   ✅ Notified initial sender: ${senderEmail}`);
            } catch (error) {
                console.error(`   ⚠️  Failed to notify initial sender:`, error.message);
                // Don't fail the whole process if this fails
            }
        }

        return { processed: true, decision: 'approved', forwardedTo: mainContactEmail };
    }

    /**
     * Handle FUM rejection - notify initial sender (do NOT send to Main Contact)
     */
    async _handleFUMRejection(vendorName, filename, referenceId, initialSenderEmail, fumEmail) {
        console.log(`   ❌ FUM rejected - notifying initial sender...`);

        if (!initialSenderEmail) {
            console.log(`   ⚠️  No initial sender email found`);
            return { processed: false, reason: 'No initial sender found' };
        }

        const senderEmail = getEmailForEnvironment(initialSenderEmail);
        const rejectionHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #f44336; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
                    .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
                    .rejection-box { background-color: #ffebee; padding: 15px; border-left: 4px solid #f44336; margin: 15px 0; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>Update: Invoice Rejected by FUM</h2>
                </div>
                <div class="content">
                    <p>The invoice you forwarded has been <strong>rejected by the Financial Unit Manager (FUM)</strong>.</p>
                    
                    <div class="rejection-box">
                        <p><strong>Vendor:</strong> ${vendorName}</p>
                        <p><strong>Invoice File:</strong> ${filename}</p>
                        <p><strong>Status:</strong> ❌ Rejected by FUM</p>
                    </div>

                    <p>Please review the invoice and contact the FUM for more details if needed.</p>
                </div>
            </body>
            </html>
        `;

        try {
            await emailService.sendEmail({
                to: senderEmail,
                subject: `Update: FUM Rejected - ${vendorName} - ${filename}`,
                html: rejectionHtml
            });
            console.log(`   ✅ Notified initial sender of rejection: ${senderEmail}`);
            return { processed: true, decision: 'rejected', notified: senderEmail };
        } catch (error) {
            console.error(`   ❌ Failed to notify initial sender:`, error.message);
            return { processed: false, reason: 'Failed to send rejection notification' };
        }
    }

    /**
     * Handle invalid reply - notify FUM that they must reply with "Approved" or "Rejected"
     */
    async _handleInvalidReply(vendorName, filename, referenceId, initialSenderEmail, fumEmail) {
        console.log(`   ⚠️  Invalid reply - sending instruction email to FUM...`);

        // Extract FUM email from the reply
        const fumReplyEmail = this._extractEmailAddress(fumEmail.from);
        if (!fumReplyEmail) {
            console.log(`   ⚠️  Could not extract FUM email from reply`);
            return { processed: false, reason: 'Could not extract FUM email' };
        }

        const fumEmailAddress = getEmailForEnvironment(fumReplyEmail);
        const invalidReplyHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #ff9800; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
                    .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
                    .instruction-box { background-color: #fff3cd; padding: 15px; border-left: 4px solid #ff9800; margin: 15px 0; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>Invalid Reply Format</h2>
                </div>
                <div class="content">
                    <p>Thank you for your reply regarding the invoice for <strong>${vendorName}</strong>.</p>
                    
                    <div class="instruction-box">
                        <p><strong>⚠️ Invalid Reply Format</strong></p>
                        <p>Your reply could not be processed. To approve or reject an invoice, please reply with <strong>exactly one of the following:</strong></p>
                        <ul>
                            <li><strong>Approved</strong> - to approve the invoice</li>
                            <li><strong>Rejected</strong> - to reject the invoice</li>
                        </ul>
                        <p>Please reply to the original email with just "Approved" or "Rejected" (case-insensitive).</p>
                    </div>

                    <div style="margin-top: 20px; padding: 10px; background-color: #f0f0f0; border-radius: 4px;">
                        <p><strong>Invoice Details:</strong></p>
                        <p><strong>Vendor:</strong> ${vendorName}</p>
                        <p><strong>Invoice File:</strong> ${filename}</p>
                        <p><strong>Reference ID:</strong> ${referenceId}</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        try {
            await emailService.sendEmail({
                to: fumEmailAddress,
                subject: `Invalid Reply: Please Reply with "Approved" or "Rejected" [Ref: ${referenceId}]`,
                html: invalidReplyHtml
            });
            console.log(`   ✅ Sent instruction email to FUM: ${fumEmailAddress}`);
            return { processed: true, decision: 'invalid', notified: fumEmailAddress };
        } catch (error) {
            console.error(`   ❌ Failed to send instruction email:`, error.message);
            return { processed: false, reason: 'Failed to send instruction email' };
        }
    }

    /**
     * Extract email address from email sender string
     * Handles formats like "Name <email@domain.com>" or just "email@domain.com"
     */
    _extractEmailAddress(emailString) {
        if (!emailString) {
            return null;
        }

        // Check if it's in the format "Name <email@domain.com>"
        const match = emailString.match(/<(.+?)>/);
        if (match) {
            return match[1];
        }

        // Otherwise, assume the whole string is the email
        // Validate it looks like an email
        if (emailString.includes('@')) {
            return emailString.trim();
        }

        return null;
    }
}

export default new ApprovalHandler();

