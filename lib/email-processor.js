import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import emailService from './email-service.js';
import PDFValidator from './pdf-validator.js';
import auditLogger from './audit-logger.js';
import approvalHandler from './approval-handler.js';
import { getEmailForEnvironment } from './email-utils.js';

/**
 * Email Processor
 * Orchestrates the email processing workflow:
 * 1. Fetch unread emails
 * 2. Extract PDF attachments
 * 3. Validate PDFs
 * 4. Determine contact person
 * 5. Send notification emails
 */
class EmailProcessor {
    constructor() {
        this.validator = new PDFValidator();
        this.processedUids = new Set(); // Track processed emails to avoid duplicates
        
        // Log environment on startup
        const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';
        const envLower = environment.toLowerCase();
        const isDev = envLower === 'dev' || envLower === 'development';
        const envMode = isDev ? 'DEV' : 'PRODUCTION';
        
        console.log('\n' + '='.repeat(60));
        console.log('🔧 ENVIRONMENT CONFIGURATION');
        console.log('='.repeat(60));
        console.log(`Environment Variable: ${environment}`);
        console.log(`Mode: ${envMode}`);
        if (isDev) {
            console.log(`⚠️  All emails will be redirected to: maret.e.rudin-aulenbach@vanderbilt.edu`);
        } else {
            console.log(`✅ Using actual vendor contact emails and email senders`);
        }
        console.log('='.repeat(60) + '\n');
    }

    /**
     * Load email templates
     */
    _loadTemplate(templateName) {
        const templatePath = path.join(process.cwd(), 'lib', 'email-templates', `${templateName}.html`);
        return fs.readFileSync(templatePath, 'utf-8');
    }

    /**
     * Replace template variables
     */
    _renderTemplate(template, variables) {
        let rendered = template;
        
        // Handle conditional blocks first
        rendered = rendered.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, condition, content) => {
            return variables[condition] ? content : '';
        });
        
        // Then replace all variables
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            rendered = rendered.replace(regex, String(value || ''));
        }
        
        return rendered;
    }

    /**
     * Determine overall status text
     */
    _getStatusText(validationResult) {
        const poValid = validationResult.po_valid;
        const dateValid = validationResult.date_valid;
        const rateValid = validationResult.rate_valid;

        if (poValid === false || dateValid === false || rateValid === false) {
            return 'Validation Failed';
        }
        if (poValid === true && dateValid === true && rateValid === true) {
            return 'Validation Passed';
        }
        return 'Partial Validation';
    }

    /**
     * Generate unique reference ID for tracking approvals
     */
    _generateReferenceId(validationResult, filename) {
        const hash = crypto.createHash('md5')
            .update(`${validationResult.vendor}-${filename}-${Date.now()}`)
            .digest('hex')
            .substring(0, 8)
            .toUpperCase();
        return `INV-${hash}`;
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

    /**
     * Format validation status for display
     */
    _formatStatus(valid) {
        if (valid === true) return '✅ Passed';
        if (valid === false) return '❌ Failed';
        return '⚠️ Not Checked';
    }

    /**
     * Process a single email
     */
    async processEmail(email) {
        console.log(`   🔄 Processing email: "${email.subject}" (UID: ${email.uid})`);

        // Skip if already processed
        if (this.processedUids.has(email.uid)) {
            console.log(`   ⏭️  Email UID ${email.uid} already processed, skipping`);
            return;
        }

        // Find PDF attachments
        const pdfAttachments = email.attachments.filter(att => 
            att.contentType === 'application/pdf' || 
            att.filename.toLowerCase().endsWith('.pdf')
        );

        if (pdfAttachments.length === 0) {
            console.log(`   ⚠️  No PDF attachments found in email: "${email.subject}"`);
            console.log(`   📎 Available attachments: ${email.attachments.map(a => a.filename).join(', ') || 'none'}`);
            // Mark as read anyway to avoid reprocessing
            try {
                await emailService.markAsRead(email.uid);
                this.processedUids.add(email.uid);
                console.log(`   ✅ Marked email as read (no PDFs to process)`);
            } catch (err) {
                console.error('   ❌ Error marking email as read:', err.message);
            }
            return;
        }

        console.log(`   📎 Found ${pdfAttachments.length} PDF attachment(s)`);

        // Process each PDF attachment
        for (let i = 0; i < pdfAttachments.length; i++) {
            const pdfAttachment = pdfAttachments[i];
            try {
                const pdfBuffer = Buffer.from(pdfAttachment.content);
                const filename = pdfAttachment.filename;

                console.log(`   📄 [${i + 1}/${pdfAttachments.length}] Processing PDF: ${filename}`);
                console.log(`      Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

                // Validate PDF
                console.log(`      🔍 Validating PDF...`);
                const validationResult = await this.validator.processPdf(pdfBuffer, filename);
                console.log(`      ✅ Validation complete`);
                console.log(`      Vendor: ${validationResult.vendor || 'Not identified'}`);
                console.log(`      PO Valid: ${validationResult.po_valid}`);
                console.log(`      Date Valid: ${validationResult.date_valid}`);
                console.log(`      Rate Valid: ${validationResult.rate_valid}`);

                // Generate reference ID for tracking
                const referenceId = this._generateReferenceId(validationResult, filename);

                // Log to audit trail with reference ID
                try {
                    console.log(`      📝 Logging to audit trail...`);
                    const auditId = await auditLogger.logValidation(
                        validationResult,
                        pdfBuffer,
                        filename,
                        {
                            sourceEmail: email.from,
                            sourceSubject: email.subject,
                            sourceDate: email.date,
                            referenceId: referenceId
                        }
                    );
                    console.log(`      ✅ Audit log entry created (Reference ID: ${referenceId})`);
                } catch (logError) {
                    console.error(`      ⚠️  Failed to log to audit trail:`, logError.message);
                }

                // Only proceed if vendor was identified
                if (!validationResult.vendor) {
                    console.log(`      ⚠️  No vendor identified for ${filename}, skipping email notifications`);
                    continue;
                }

                // Get contact email from validation result
                const contactEmail = validationResult.contact_email;
                if (!contactEmail) {
                    console.log(`      ⚠️  No contact email available for ${validationResult.contact_person}, skipping email notifications`);
                    continue;
                }

                // Get email sender (the person who forwarded the invoice)
                const emailSender = this._extractEmailAddress(email.from);
                const senderEmail = emailSender ? getEmailForEnvironment(emailSender) : getEmailForEnvironment(null);

                const overallStatus = this._getStatusText(validationResult).toLowerCase().replace(' ', '-');
                const isFailure = validationResult.contact_role === 'FUM';

                // Prepare template variables for contact notification
                const contactVars = {
                    contactPerson: validationResult.contact_person || 'Contact',
                    vendorName: validationResult.vendor,
                    overallStatus: overallStatus,
                    statusText: this._getStatusText(validationResult),
                    poStatus: this._formatStatus(validationResult.po_valid),
                    poReason: validationResult.po_reason || 'N/A',
                    dateStatus: this._formatStatus(validationResult.date_valid),
                    dateReason: validationResult.date_reason || 'N/A',
                    rateStatus: this._formatStatus(validationResult.rate_valid),
                    rateReason: validationResult.rate_reason || 'N/A',
                    filename: filename,
                    hasAttachment: 'true',
                    isFailure: isFailure ? 'true' : 'false',
                    referenceId: referenceId
                };

                // Prepare template variables for summary email (to sender)
                const summaryVars = {
                    filename: filename,
                    vendorName: validationResult.vendor,
                    overallStatus: overallStatus,
                    statusText: this._getStatusText(validationResult),
                    poStatus: this._formatStatus(validationResult.po_valid),
                    poReason: validationResult.po_reason || 'N/A',
                    dateStatus: this._formatStatus(validationResult.date_valid),
                    dateReason: validationResult.date_reason || 'N/A',
                    rateStatus: this._formatStatus(validationResult.rate_valid),
                    rateReason: validationResult.rate_reason || 'N/A',
                    nextStepRecipient: contactEmail,
                    nextStepRole: validationResult.contact_role || 'Contact',
                    nextStepReason: validationResult.contact_reason || 'N/A',
                    timestamp: new Date().toLocaleString()
                };

                // Load and render templates
                const contactTemplate = this._loadTemplate('contact-notification');
                const adminTemplate = this._loadTemplate('admin-summary');
                
                const contactHtml = this._renderTemplate(contactTemplate, contactVars);
                const summaryHtml = this._renderTemplate(adminTemplate, summaryVars);
                                
                // Send email to contact person (FUM or Main Contact) with PDF attachment
                console.log(`      📧 Sending notification to ${contactEmail} (${validationResult.contact_role})...`);
                try {
                    await emailService.sendEmail({
                        to: contactEmail,
                        subject: `Invoice Validation: ${validationResult.vendor} - ${this._getStatusText(validationResult)} [Ref: ${referenceId}]`,
                        html: contactHtml,
                        attachments: [{
                            filename: filename,
                            content: pdfBuffer,
                            contentType: 'application/pdf'
                        }]
                    });
                    console.log(`      ✅ Notification sent to ${contactEmail} (Reference ID: ${referenceId})`);
                } catch (emailError) {
                    console.error(`      ❌ Failed to send email to ${contactEmail}:`, emailError.message);
                }

                // Send summary email to the person who forwarded the invoice
                console.log(`      📧 Sending summary to email sender (${senderEmail})...`);
                try {
                    await emailService.sendEmail({
                        to: senderEmail,
                        subject: `Invoice Processed: ${validationResult.vendor} - ${filename}`,
                        html: summaryHtml
                    });
                    console.log(`      ✅ Summary sent to ${senderEmail}`);
                } catch (emailError) {
                    console.error(`      ❌ Failed to send summary email:`, emailError.message);
                }

            } catch (error) {
                console.error(`      ❌ Error processing PDF ${pdfAttachment.filename}:`, error.message);
                if (error.stack) {
                    console.error(`      Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
                }
                
                // Send error notification to the person who forwarded the invoice
                const emailSender = this._extractEmailAddress(email.from);
                const senderEmail = emailSender ? getEmailForEnvironment(emailSender) : getEmailForEnvironment(null);
                
                console.log(`      📧 Sending error notification to ${senderEmail}...`);
                try {
                    await emailService.sendEmail({
                        to: senderEmail,
                        subject: `Error Processing Invoice: ${pdfAttachment.filename}`,
                        html: `
                            <p>An error occurred while processing the invoice "${pdfAttachment.filename}":</p>
                            <pre>${error.message}</pre>
                            <p>Please review the email and try again.</p>
                        `
                    });
                    console.log(`      ✅ Error notification sent to ${senderEmail}`);
                } catch (emailError) {
                    console.error(`      ❌ Failed to send error notification:`, emailError.message);
                }
            }
        }

        // Mark email as read after processing
        console.log(`   📌 Marking email as read...`);
        try {
            await emailService.markAsRead(email.uid);
            this.processedUids.add(email.uid);
            console.log(`   ✅ Email marked as read (UID: ${email.uid})`);
        } catch (err) {
            console.error(`   ❌ Error marking email as read:`, err.message);
        }
    }

    /**
     * Check if email is an approval/rejection reply
     */
    _isApprovalReply(email) {
        // Check if subject contains reference ID pattern
        const hasReferenceId = /\[Ref:\s*[^\]]+\]/.test(email.subject || '');
        
        // Check if it's a reply (Re: or Fwd: in subject)
        const isReply = /^(Re:|Fwd?:|RE:|FWD?:)/i.test(email.subject || '');
        
        // Check if body contains approval/rejection keywords
        const text = (email.text || email.html?.replace(/<[^>]*>/g, '') || '').toLowerCase();
        const hasApprovalKeywords = /approve|approved|approval|reject|rejected|rejection/i.test(text);
        
        return (hasReferenceId || isReply) && hasApprovalKeywords;
    }

    /**
     * Process all unread emails
     */
    async processUnreadEmails() {
        try {
            console.log('\n📥 Connecting to email server...');
            const emails = await emailService.fetchUnreadEmails();
            console.log(`📬 Found ${emails.length} unread email(s)`);

            if (emails.length === 0) {
                console.log('ℹ️  No unread emails to process.');
                return { processed: 0, total: 0, message: 'No unread emails' };
            }

            console.log(`\n📋 Processing ${emails.length} email(s)...`);
            let processed = 0;
            let approvalsProcessed = 0;
            let errors = 0;

            for (let i = 0; i < emails.length; i++) {
                const email = emails[i];
                console.log(`\n[${i + 1}/${emails.length}] Processing email: "${email.subject}"`);
                console.log(`   From: ${email.from}`);
                console.log(`   UID: ${email.uid}`);
                console.log(`   Attachments: ${email.attachments.length}`);
                
                try {
                    // Check if this is an approval/rejection reply
                    if (this._isApprovalReply(email)) {
                        console.log(`   🔍 Detected as approval/rejection reply`);
                        const result = await approvalHandler.processApprovalReply(email);
                        if (result.processed) {
                            approvalsProcessed++;
                            console.log(`   ✅ Approval reply processed`);
                        } else {
                            console.log(`   ⚠️  Approval reply not processed: ${result.reason}`);
                        }
                    } else {
                        // Regular invoice processing
                        await this.processEmail(email);
                        processed++;
                        console.log(`   ✅ Successfully processed`);
                    }
                } catch (error) {
                    errors++;
                    console.error(`   ❌ Error processing email ${email.uid}:`, error.message);
                    if (error.stack) {
                        console.error(`   Stack: ${error.stack.split('\n')[0]}`);
                    }
                }
            }

            console.log(`\n📊 Summary: ${processed} invoices processed, ${approvalsProcessed} approvals processed, ${errors} errors`);
            return { processed, approvalsProcessed, total: emails.length, errors };
        } catch (error) {
            console.error('\n❌ Fatal error in processUnreadEmails:', error);
            console.error('Error details:', error.message);
            if (error.stack) {
                console.error('Stack trace:', error.stack);
            }
            throw error;
        }
    }
}

export default EmailProcessor;

