// Quick test script to verify SMTP works (which confirms App Password is correct)
// Run with: node test-smtp.js

import nodemailer from 'nodemailer';
import { readFileSync } from 'fs';

// Simple .env.local parser (since we might not have dotenv)
function loadEnv() {
    try {
        const envContent = readFileSync('.env.local', 'utf8');
        const env = {};
        envContent.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key && valueParts.length > 0) {
                    env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
                }
            }
        });
        return env;
    } catch (err) {
        console.error('Error reading .env.local:', err.message);
        process.exit(1);
    }
}

const env = loadEnv();

const email = env.OUTLOOK_EMAIL;
const password = env.OUTLOOK_PASSWORD;

console.log('Testing SMTP connection...');
console.log('Email:', email);
console.log('Password length:', password?.length);

// Auto-detect server based on email domain
const emailDomain = email?.split('@')[1] || '';
const smtpHost = env.OUTLOOK_SMTP_SERVER || (emailDomain.includes('gmail.com') ? 'smtp.gmail.com' : 'smtp-mail.outlook.com');

console.log('Using SMTP server:', smtpHost);

const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: 587,
    secure: false,
    auth: {
        user: email,
        pass: password
    }
});

transporter.verify((error, success) => {
    if (error) {
        console.error('❌ SMTP verification failed:', error.message);
        console.error('This means the App Password might be incorrect or account has restrictions');
    } else {
        console.log('✅ SMTP verification successful!');
        console.log('This confirms your App Password is correct.');
        console.log('If SMTP works but IMAP doesn\'t, it\'s an IMAP-specific issue.');
    }
    process.exit(error ? 1 : 0);
});

