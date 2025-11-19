import fs from 'fs';
import path from 'path';
import emailService from './email-service.js';
import PDFValidator from './pdf-validator.js';
import emailRecipients from '../data/email-recipients.json';
import auditLogger from './audit-logger.js';

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
     * Determine next step recipient based on validation results
     */
    _determineNextStep(validationResult) {
        const { vendor, po_valid, date_valid, rate_valid, is_variable_rate, contact_person, contact_role } = validationResult;

        // If all validations pass and fixed rate -> main contact
        if (po_valid === true && date_valid === true && rate_valid === true && !is_variable_rate) {
            return {
                recipient: emailRecipients.routing.onSuccess.recipient,
                role: 'Main Contact',
                reason: 'Invoice fully validated and ready for approval'
            };
        }

        // If variable rate -> variable rate handler
        if (is_variable_rate) {
            return {
                recipient: emailRecipients.routing.onVariable.recipient,
                role: 'Variable Rate Handler',
                reason: 'Invoice has variable rate requiring manual review'
            };
        }

        // If any validation failed -> admin for review
        return {
            recipient: emailRecipients.routing.onFailure.recipient,
            role: 'Admin',
            reason: 'Invoice failed validation and requires review'
        };
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

                // Log to audit trail
                try {
                    console.log(`      📝 Logging to audit trail...`);
                    await auditLogger.logValidation(
                        validationResult,
                        pdfBuffer,
                        filename,
                        {
                            sourceEmail: email.from,
                            sourceSubject: email.subject,
                            sourceDate: email.date
                        }
                    );
                    console.log(`      ✅ Audit log entry created`);
                } catch (logError) {
                    console.error(`      ⚠️  Failed to log to audit trail:`, logError.message);
                }

                // Only proceed if vendor was identified
                if (!validationResult.vendor) {
                    console.log(`      ⚠️  No vendor identified for ${filename}, skipping email notifications`);
                    continue;
                }

                // Determine next step recipient
                const nextStep = this._determineNextStep(validationResult);
                const overallStatus = this._getStatusText(validationResult).toLowerCase().replace(' ', '-');

                // Prepare template variables
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
                    hasAttachment: 'true'
                };

                const adminVars = {
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
                    nextStepRecipient: nextStep.recipient,
                    nextStepRole: nextStep.role,
                    nextStepReason: nextStep.reason,
                    timestamp: new Date().toLocaleString()
                };

                // Load and render templates
                const contactTemplate = this._loadTemplate('contact-notification');
                const adminTemplate = this._loadTemplate('admin-summary');

                const contactHtml = this._renderTemplate(contactTemplate, contactVars);
                const adminHtml = this._renderTemplate(adminTemplate, adminVars);

                // Send email to contact person (with PDF attachment)
                console.log(`      📧 Sending notification to ${nextStep.recipient}...`);
                try {
                    await emailService.sendEmail({
                        to: nextStep.recipient,
                        subject: `Invoice Validation: ${validationResult.vendor} - ${this._getStatusText(validationResult)}`,
                        html: contactHtml,
                        attachments: [{
                            filename: filename,
                            content: pdfBuffer,
                            contentType: 'application/pdf'
                        }]
                    });
                    console.log(`      ✅ Notification sent to ${nextStep.recipient}`);
                } catch (emailError) {
                    console.error(`      ❌ Failed to send email to ${nextStep.recipient}:`, emailError.message);
                }

                // Send summary email to admin assistant
                console.log(`      📧 Sending summary to admin assistant...`);
                try {
                    await emailService.sendEmail({
                        to: emailRecipients.routing.source.recipient,
                        subject: `Invoice Processed: ${validationResult.vendor} - ${filename}`,
                        html: adminHtml
                    });
                    console.log(`      ✅ Summary sent to admin assistant`);
                } catch (emailError) {
                    console.error(`      ❌ Failed to send summary email:`, emailError.message);
                }

            } catch (error) {
                console.error(`      ❌ Error processing PDF ${pdfAttachment.filename}:`, error.message);
                if (error.stack) {
                    console.error(`      Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
                }
                
                // Send error notification to admin
                console.log(`      📧 Sending error notification...`);
                try {
                    await emailService.sendEmail({
                        to: emailRecipients.routing.source.recipient,
                        subject: `Error Processing Invoice: ${pdfAttachment.filename}`,
                        html: `
                            <p>An error occurred while processing the invoice "${pdfAttachment.filename}":</p>
                            <pre>${error.message}</pre>
                            <p>Please review the email and try again.</p>
                        `
                    });
                    console.log(`      ✅ Error notification sent`);
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
            let errors = 0;

            for (let i = 0; i < emails.length; i++) {
                const email = emails[i];
                console.log(`\n[${i + 1}/${emails.length}] Processing email: "${email.subject}"`);
                console.log(`   From: ${email.from}`);
                console.log(`   UID: ${email.uid}`);
                console.log(`   Attachments: ${email.attachments.length}`);
                
                try {
                    await this.processEmail(email);
                    processed++;
                    console.log(`   ✅ Successfully processed`);
                } catch (error) {
                    errors++;
                    console.error(`   ❌ Error processing email ${email.uid}:`, error.message);
                    if (error.stack) {
                        console.error(`   Stack: ${error.stack.split('\n')[0]}`);
                    }
                }
            }

            console.log(`\n📊 Summary: ${processed} processed, ${errors} errors`);
            return { processed, total: emails.length, errors };
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

