// pages/api/scan-emails.js
import EmailProcessor from '../../lib/email-processor.js';

/**
 * Email Scanning API Endpoint
 * Triggered by Vercel Cron job to process unread emails
 * 
 * For local testing: POST to http://localhost:3000/api/scan-emails
 */
export default async function handler(req, res) {
  // Allow both POST (Vercel Cron) and GET (for local testing)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST or GET for testing.' });
  }

  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  console.log('\n' + '='.repeat(60));
  console.log('📧 EMAIL SCANNING PROCESS STARTED');
  console.log('='.repeat(60));
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Method: ${req.method}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Check environment variables
  const hasEmailConfig = !!(process.env.OUTLOOK_EMAIL && process.env.OUTLOOK_PASSWORD);
  console.log(`Email Config: ${hasEmailConfig ? '✅ Configured' : '❌ Missing (check .env.local)'}`);
  
  if (hasEmailConfig) {
    console.log(`Email: ${process.env.OUTLOOK_EMAIL}`);
    const pwd = process.env.OUTLOOK_PASSWORD || '';
    console.log(`Password length: ${pwd.length}`);
    console.log(`Password preview: ${pwd.substring(0, 4)}...${pwd.substring(pwd.length - 4)}`);
    console.log(`Password has spaces: ${pwd.includes(' ')}`);
    console.log(`Password has newlines: ${pwd.includes('\n') || pwd.includes('\r')}`);
    console.log(`Password starts/ends with quotes: ${pwd.startsWith('"') || pwd.startsWith("'") || pwd.endsWith('"') || pwd.endsWith("'")}`);
    
    // Check if it looks like an App Password
    // Gmail App Passwords are 16 characters (no hyphens)
    // Outlook App Passwords are 16 characters (may have hyphens)
    const emailDomain = process.env.OUTLOOK_EMAIL?.split('@')[1] || '';
    const isGmail = emailDomain.includes('gmail.com');
    
    if (isGmail) {
      // Gmail App Passwords are exactly 16 characters, no hyphens
      if (pwd.length !== 16) {
        console.warn(`⚠️  Warning: Gmail App Passwords are exactly 16 characters. Your password is ${pwd.length} chars.`);
        console.warn(`   Make sure you're using the App Password from https://myaccount.google.com/apppasswords`);
        console.warn(`   NOT your regular Gmail password.`);
      }
    } else {
      // Outlook App Passwords are 16 chars (with or without hyphens)
      if (pwd.length !== 16 && pwd.replace(/-/g, '').length !== 16) {
        console.warn(`⚠️  Warning: Outlook App Passwords are usually 16 characters. Your password is ${pwd.length} chars.`);
        console.warn(`   Make sure you're using the App Password, not your regular password.`);
      }
    }
  }
  
  if (!hasEmailConfig) {
    console.error('❌ Missing email configuration!');
    console.error('Required: OUTLOOK_EMAIL, OUTLOOK_PASSWORD');
    console.error('\n⚠️  IMPORTANT: Gmail/Outlook require an "App Password" for IMAP/SMTP');
    console.error('   See EMAIL_SETUP.md for instructions');
    return res.status(500).json({
      success: false,
      error: 'Email configuration missing. Check environment variables.',
      required: ['OUTLOOK_EMAIL', 'OUTLOOK_PASSWORD'],
      note: 'Outlook.com requires App Passwords for IMAP/SMTP. See OUTLOOK_SETUP.md'
    });
  }

  try {
    console.log('\n🔍 Initializing email processor...');
    const processor = new EmailProcessor();
    
    console.log('📬 Fetching unread emails from inbox...');
    const result = await processor.processUnreadEmails();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('✅ EMAIL SCANNING PROCESS COMPLETED');
    console.log('='.repeat(60));
    console.log(`Processed: ${result.processed} email(s)`);
    console.log(`Total found: ${result.total} email(s)`);
    console.log(`Duration: ${duration}s`);
    console.log('='.repeat(60) + '\n');

    res.status(200).json({
      success: true,
      message: "Email scan completed.",
      processed: result.processed,
      total: result.total,
      duration: `${duration}s`,
      timestamp: timestamp
    });
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.error('\n' + '='.repeat(60));
    console.error('❌ EMAIL SCANNING PROCESS FAILED');
    console.error('='.repeat(60));
    console.error(`Error: ${error.message}`);
    console.error(`Duration: ${duration}s`);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    console.error('='.repeat(60) + '\n');

    res.status(500).json({
      success: false,
      error: error.message || 'Internal Server Error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      duration: `${duration}s`,
      timestamp: timestamp
    });
  }
}
