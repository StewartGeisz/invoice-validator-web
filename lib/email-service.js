import Imap from 'imap';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';

/**
 * Email Service for Gmail/Outlook IMAP/SMTP
 * Handles reading emails via IMAP and sending emails via SMTP
 * Supports both Gmail and Outlook.com accounts
 */
class EmailService {
    constructor() {
        // Get password and handle potential quoting/encoding issues
        const rawPassword = process.env.OUTLOOK_PASSWORD || '';
        // Remove quotes if present (some env files add them)
        // Also trim whitespace and newlines
        let password = rawPassword.replace(/^["']|["']$/g, '').trim();
        // Remove any trailing newlines or carriage returns
        password = password.replace(/[\r\n]+$/, '');
        
        // Debug logging (only show first/last chars)
        if (password) {
            console.log(`   🔑 Password loaded: length=${password.length}, preview=${password.substring(0, 2)}...${password.substring(password.length - 2)}`);
        }
        
        // Determine IMAP server based on email domain
        const emailDomain = process.env.OUTLOOK_EMAIL?.split('@')[1] || '';
        let imapHost = process.env.OUTLOOK_IMAP_SERVER;
        let smtpHost = process.env.OUTLOOK_SMTP_SERVER;
        
        if (!imapHost) {
            // Auto-detect based on domain
            if (emailDomain.includes('gmail.com')) {
                imapHost = 'imap.gmail.com';
                smtpHost = smtpHost || 'smtp.gmail.com';
            } else if (emailDomain.includes('outlook.com') || emailDomain.includes('hotmail.com') || emailDomain.includes('live.com')) {
                imapHost = 'outlook.office365.com';
                smtpHost = smtpHost || 'smtp-mail.outlook.com';
            } else {
                imapHost = 'imap.gmail.com'; // Default to Gmail
                smtpHost = smtpHost || 'smtp.gmail.com';
            }
        }
        
        if (!smtpHost) {
            smtpHost = emailDomain.includes('gmail.com') ? 'smtp.gmail.com' : 'smtp-mail.outlook.com';
        }
        
        console.log(`   📧 Using IMAP server: ${imapHost}:993`);
        console.log(`   📧 Using SMTP server: ${smtpHost}:587`);
        
        // Gmail-specific TLS options (simpler than Outlook)
        const tlsOptions = emailDomain.includes('gmail.com') 
            ? { rejectUnauthorized: false } // Gmail uses standard TLS
            : { 
                rejectUnauthorized: false,
                // Outlook servers may require specific cipher suites
                ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384'
            };

        this.imapConfig = {
            user: process.env.OUTLOOK_EMAIL,
            password: password,
            host: imapHost,
            port: 993,
            tls: true,
            tlsOptions: tlsOptions,
            connTimeout: 30000, // 30 seconds
            authTimeout: 30000,
            debug: process.env.NODE_ENV === 'development' ? console.log : undefined,
            enableCompression: false
        };

        this.smtpConfig = {
            host: smtpHost,
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.OUTLOOK_EMAIL,
                pass: password
            },
            connectionTimeout: 30000
        };

        this.transporter = null;
    }

    /**
     * Initialize SMTP transporter
     */
    _getTransporter() {
        if (!this.transporter) {
            this.transporter = nodemailer.createTransport(this.smtpConfig);
        }
        return this.transporter;
    }

    /**
     * Connect to IMAP and fetch unread emails
     * @returns {Promise<Array>} Array of email objects with attachments
     */
    async fetchUnreadEmails() {
        return new Promise((resolve, reject) => {
            console.log(`   🔌 Connecting to IMAP server: ${this.imapConfig.host}:${this.imapConfig.port}`);
            console.log(`   👤 Email: ${this.imapConfig.user}`);
            
            const imap = new Imap(this.imapConfig);
            const emails = [];
            let connectionTimeout;

            imap.once('ready', () => {
                console.log(`   ✅ IMAP connection established`);
                console.log(`   📂 Opening INBOX...`);
                imap.openBox('INBOX', false, (err, box) => {
                    if (err) {
                        console.error(`   ❌ Error opening INBOX:`, err.message);
                        imap.end();
                        return reject(err);
                    }

                    console.log(`   ✅ INBOX opened (${box.messages.total} total messages)`);
                    console.log(`   🔍 Searching for unread emails...`);

                    // Search for unread emails
                    imap.search(['UNSEEN'], (err, results) => {
                        if (err) {
                            console.error(`   ❌ Error searching emails:`, err.message);
                            imap.end();
                            return reject(err);
                        }

                        if (!results || results.length === 0) {
                            console.log(`   ℹ️  No unread emails found`);
                            imap.end();
                            return resolve([]);
                        }

                        console.log(`   📬 Found ${results.length} unread email(s)`);

                        // Fetch email messages
                        const fetch = imap.fetch(results, {
                            bodies: '',
                            struct: true
                        });

                        let processed = 0;

                        fetch.on('message', (msg, seqno) => {
                            const emailData = {
                                uid: results[seqno - 1],
                                subject: '',
                                from: '',
                                date: null,
                                text: '',
                                html: '',
                                attachments: []
                            };

                            msg.on('body', (stream, info) => {
                                let buffer = '';
                                stream.on('data', (chunk) => {
                                    buffer += chunk.toString('utf8');
                                });

                                stream.once('end', () => {
                                    simpleParser(buffer)
                                        .then(parsed => {
                                            emailData.subject = parsed.subject || '';
                                            emailData.from = parsed.from?.text || '';
                                            emailData.date = parsed.date || new Date();
                                            emailData.text = parsed.text || '';
                                            emailData.html = parsed.html || '';

                                            // Extract attachments
                                            if (parsed.attachments && parsed.attachments.length > 0) {
                                                emailData.attachments = parsed.attachments.map(att => ({
                                                    filename: att.filename || 'attachment',
                                                    contentType: att.contentType || 'application/octet-stream',
                                                    content: att.content,
                                                    size: att.size
                                                }));
                                            }

                                            emails.push(emailData);
                                            processed++;

                                            if (processed === results.length) {
                                                imap.end();
                                                resolve(emails);
                                            }
                                        })
                                        .catch(err => {
                                            console.error('Error parsing email:', err);
                                            processed++;
                                            if (processed === results.length) {
                                                imap.end();
                                                resolve(emails);
                                            }
                                        });
                                });
                            });

                            msg.once('attributes', (attrs) => {
                                // Store UID for marking as read later
                                emailData.uid = attrs.uid;
                            });
                        });

                        fetch.once('error', (err) => {
                            imap.end();
                            reject(err);
                        });
                    });
                });
            });

            imap.once('error', (err) => {
                console.error(`   ❌ IMAP connection error:`, err.message);
                if (err.source === 'authentication' || err.textCode === 'AUTHENTICATIONFAILED') {
                    console.error(`\n   ⚠️  AUTHENTICATION FAILED`);
                    console.error(`   This usually means:`);
                    console.error(`   1. Wrong password`);
                    console.error(`   2. Gmail/Outlook require an "App Password" (not regular password)`);
                    console.error(`   3. IMAP is not enabled on the account`);
                    console.error(`\n   To fix:`);
                    console.error(`   1. For Gmail: Go to https://myaccount.google.com/apppasswords`);
                    console.error(`   2. For Outlook: Go to https://account.microsoft.com/security`);
                    console.error(`   3. Enable 2FA if not already enabled`);
                    console.error(`   4. Generate an "App Password"`);
                    console.error(`   5. Use the App Password in .env.local (not your regular password)`);
                    console.error(`   6. Make sure IMAP is enabled in email settings\n`);
                }
                if (connectionTimeout) clearTimeout(connectionTimeout);
                reject(err);
            });

            // Set connection timeout
            connectionTimeout = setTimeout(() => {
                console.error(`   ❌ IMAP connection timeout (30s)`);
                imap.end();
                reject(new Error('IMAP connection timeout'));
            }, 30000);

            imap.once('ready', () => {
                if (connectionTimeout) clearTimeout(connectionTimeout);
            });

            console.log(`   🔄 Attempting IMAP connection...`);
            imap.connect();
        });
    }

    /**
     * Mark email as read (processed)
     * @param {number} uid - Email UID
     */
    async markAsRead(uid) {
        return new Promise((resolve, reject) => {
            const imap = new Imap(this.imapConfig);

            imap.once('ready', () => {
                imap.openBox('INBOX', false, (err) => {
                    if (err) {
                        imap.end();
                        return reject(err);
                    }

                    imap.addFlags(uid, '\\Seen', (err) => {
                        imap.end();
                        if (err) {
                            return reject(err);
                        }
                        resolve();
                    });
                });
            });

            imap.once('error', (err) => {
                reject(err);
            });

            imap.connect();
        });
    }

    /**
     * Send email via SMTP
     * @param {Object} options - Email options
     * @param {string|Array} options.to - Recipient email(s)
     * @param {string} options.subject - Email subject
     * @param {string} options.html - HTML body
     * @param {string} options.text - Plain text body (optional)
     * @param {Array} options.attachments - Array of attachment objects (optional)
     * @returns {Promise<Object>} Send result
     */
    async sendEmail({ to, subject, html, text, attachments = [] }) {
        const transporter = this._getTransporter();

        const mailOptions = {
            from: `"Invoice Validator" <${process.env.OUTLOOK_EMAIL}>`,
            to: Array.isArray(to) ? to.join(', ') : to,
            subject: subject,
            html: html,
            text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
            attachments: attachments.map(att => ({
                filename: att.filename,
                content: att.content,
                contentType: att.contentType
            }))
        };

        try {
            const info = await transporter.sendMail(mailOptions);
            console.log(`Email sent successfully to ${to}:`, info.messageId);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('Error sending email:', error);
            throw error;
        }
    }

    /**
     * Test IMAP connection
     */
    async testConnection() {
        return new Promise((resolve, reject) => {
            const imap = new Imap(this.imapConfig);

            imap.once('ready', () => {
                imap.end();
                resolve(true);
            });

            imap.once('error', (err) => {
                reject(err);
            });

            imap.connect();
        });
    }
}

export default new EmailService();

