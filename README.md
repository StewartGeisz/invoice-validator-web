# PDF Invoice Validator

An intelligent, automated invoice validation system that processes PDF invoices against vendor databases and manages email workflows. Built with Next.js and deployable on Vercel with automated email scanning capabilities.

**🌐 Live Demo:** [stewartvanderbilt.com](https://stewartvanderbilt.com)

This will be supported until christmas for testing purposes but will be closed later

**Email:** invoice.validator.dev@gmail.com

## Product Overview

The PDF Invoice Validator is a comprehensive business automation tool designed to streamline invoice processing workflows. The system automatically scans incoming emails for PDF invoices, validates them against vendor databases, and routes them to appropriate personnel based on validation results. This eliminates manual invoice processing, reduces errors, and ensures compliance with vendor contracts.

## Problem Statement

Manual invoice processing is time-consuming, error-prone, and creates bottlenecks in business operations. Organizations struggle with:

- **Manual Validation**: Hours spent manually checking PO numbers, dates, and amounts
- **Email Overload**: Difficulty managing incoming invoice emails across multiple accounts
- **Routing Errors**: Invoices sent to wrong personnel, causing payment delays
- **Compliance Issues**: Missing validation steps that lead to overpayments or contract violations
- **Scalability**: Unable to handle increasing invoice volumes efficiently

Our solution automates the entire workflow, from email scanning to final routing decisions.

## Features

### Core Validation Engine
- **PDF Text Extraction**: Advanced text extraction from uploaded PDF files using pdf-parse
- **Multiple File Support**: Batch upload and validate multiple PDFs simultaneously
- **Vendor Matching**: Intelligent vendor identification using fuzzy matching algorithms with LLM fallback
- **PO Number Validation**: Comprehensive purchase order number validation against vendor database
- **Date Range Validation**: Contract period compliance checking using LLM analysis
- **Rate Validation**: Amount verification against expected rates with configurable tolerance
- **Contact Routing**: Smart contact person recommendations based on validation results

### Email Automation System
- **Automated Email Scanning**: Continuous monitoring of invoice email accounts via IMAP
- **Email Processing**: Automatic extraction and processing of PDF attachments
- **Intelligent Routing**: Dynamic email forwarding based on validation outcomes
- **Vendor Database Updates**: Excel file upload system for monthly vendor data updates
- **Development Mode**: Safe testing environment with email redirection

### Technical Features  
- **Serverless Architecture**: Optimized for Vercel's serverless functions with auto-scaling
- **LLM Integration**: Advanced validation using Amplify API with GPT-4o for complex cases
- **Real-time Processing**: Immediate validation results with detailed status reporting
- **Debug Information**: Comprehensive logging and debugging tools for troubleshooting
- **Responsive Design**: Mobile-friendly interface built with Tailwind CSS

## Installation

### Prerequisites
- Node.js 18 or higher
- npm or yarn package manager
- Email account with IMAP/SMTP access (Gmail recommended)
- Vercel account (for deployment)

### Local Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd geisz-rudin-aulenbach
   ```

2. **Navigate to source directory:**
   ```bash
   cd src
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Configure environment variables:**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edit `.env.local` and set:
   ```env
   OUTLOOK_EMAIL=your-email@gmail.com
   OUTLOOK_PASSWORD=your-app-password
   ENVIRONMENT=dev
   AMPLIFY_API_URL=your-api-url (optional)
   AMPLIFY_API_KEY=your-api-key (optional)
   ```

   **Demo Credentials Available:**
   ```
   Email: invoice.validator.dev@gmail.com
   Password: gha5GFR3xub1mzt@rxa
   ```

5. **Prepare vendor data (if needed):**
   ```bash
   node convert-excel.js
   ```

6. **Start development server:**
   ```bash
   npm run dev
   ```

7. **Open browser to [http://localhost:3000](http://localhost:3000)**

## Usage

### Web Interface

1. **Upload PDF Invoices:**
   - Navigate to the main interface
   - Select one or multiple PDF files
   - Click "Validate Invoices" to process

2. **Update Vendor Database:**
   - Click the "📊 Update Vendor Data" button (top-right)
   - Upload Excel file with current vendor information
   - System will update the vendor database automatically

3. **Review Results:**
   - View validation status for each invoice
   - Check PO number, date range, and rate validation
   - See recommended contact person for routing
   - Access debug information if needed

### Email Automation

1. **Automated Scanning:**
   - System automatically scans configured email accounts
   - Processes PDF attachments from incoming emails
   - Routes results to appropriate personnel

2. **Manual Email Scanning:**
   - Visit `/api/scan-emails` endpoint for manual scanning
   - Useful for testing or troubleshooting
   - Can be automated with external cron jobs

### Environment Modes

- **Development Mode** (`ENVIRONMENT=dev`): All emails redirect to `maret.e.rudin-aulenbach@vanderbilt.edu`

### To change the recipients of development emails use generate-dev-email-contacts.js with your own email address as shown in the video demo

- **Production Mode** (`ENVIRONMENT=production`): Uses actual vendor contact emails

## Build Instructions

### Local Build

1. **Test build locally:**
   ```bash
   npm run build
   ```

2. **Start production server:**
   ```bash
   npm start
   ```

### Vercel Deployment

#### Method 1: Vercel CLI (Recommended)

# Vercel will not work with the free tier unless you comment out api/scan-emails endpoint as cron-jobs are not compatible with free version.

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login and deploy:**
   ```bash
   vercel login
   vercel --prod
   ```

#### Method 2: Git Integration

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Deploy to Vercel"
   git push origin main
   ```

2. **Connect to Vercel:**
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project" and import your repository
   - Configure environment variables
   - Deploy

### Environment Variables Setup

In Vercel Dashboard → Project Settings → Environment Variables:

```env
OUTLOOK_EMAIL=invoice.validator.dev@gmail.com
OUTLOOK_PASSWORD=gha5GFR3xub1mzt@rxa
ENVIRONMENT=production
AMPLIFY_API_URL=your-amplify-url (optional)
AMPLIFY_API_KEY=your-amplify-key (optional)
```

**Important:** Redeploy after adding environment variables.

## Screenshots and Demo

- **Screenshots**: Located in `./screenshots/` directory
- **Demo Videos**: Located in `./demo-videos/` directory  
- **Live Demo**: Available at [stewartvanderbilt.com](https://stewartvanderbilt.com)

*Email screenshots and screen recordings have been sent as requested for submission.*

## File Structure

```
geisz-rudin-aulenbach/
├── src/
│   ├── data/
│   │   ├── vendor-data.json          # Converted vendor database
│   │   └── email-contacts.json       # Contact information
│   ├── lib/
│   │   ├── pdf-validator.js          # Core validation engine
│   │   ├── email-processor.js        # Email automation
│   │   ├── email-service.js          # SMTP/IMAP handling
│   │   └── validation-methods.js     # Validation algorithms
│   ├── pages/
│   │   ├── api/
│   │   │   ├── validate-pdf.js       # PDF processing endpoint
│   │   │   ├── scan-emails.js        # Email scanning endpoint
│   │   │   └── update-vendor-data.js # Database update endpoint
│   │   ├── _app.js                   # Next.js app wrapper
│   │   └── index.js                  # Main web interface
│   ├── AmplifyAPIIntegrationToolkit/ # LLM integration tools
│   ├── package.json                  # Dependencies
│   └── For_Final_Submission.txt      # Demo credentials
├── screenshots/                      # Application screenshots
├── demo-videos/                      # Demonstration videos
└── README.md                         # This file
```

## Technical Architecture

### Validation Logic Flow

1. **Email Scanning**: IMAP connection monitors inbox for new emails
2. **PDF Extraction**: Automatic detection and extraction of PDF attachments
3. **Vendor Identification**: Fuzzy matching against vendor database with LLM fallback
4. **Multi-Stage Validation**: PO number, date range, and rate validation
5. **Contact Routing**: Logic-based contact person selection:
   - All validations pass + fixed rate → Main Contact
   - Any validation fails OR variable rate → FUM (Follow-Up Manager)
6. **Email Dispatch**: Automated email routing to selected contacts

### Serverless Optimizations

- **No File System Dependencies**: Memory-based PDF processing
- **Efficient Data Loading**: Static JSON imports for fast cold starts  
- **Minimal Bundle Size**: Optimized dependencies for Vercel limits
- **Edge Runtime Compatible**: Works with Vercel's edge computing platform

## Troubleshooting

### Common Issues

1. **Email Connection Failures**
   - Verify email credentials in environment variables
   - Enable "App Passwords" for Gmail accounts
   - Check IMAP/SMTP settings and firewall rules

2. **PDF Processing Errors**
   - Ensure PDFs are text-based (not scanned images)
   - Check file size limits (10MB max for local or vercel, larger handling for deployed version)
   - Verify PDF format integrity

3. **Vendor Matching Issues**
   - Update vendor database via Excel upload
   - Check vendor name spelling in database
   - Enable LLM API for improved matching

4. **Deployment Problems**
   - Test build locally: `npm run build`
   - Verify environment variables in Vercel dashboard
   - Check function timeout limits for large files

### Support

For technical support:
1. Review application logs in Vercel dashboard
2. Test functionality locally with development server
3. Check environment variable configuration
4. Verify vendor database integrity

## License

This project is proprietary software developed for internal business use. Contains sensitive vendor data and business logic.

---

**Development Team**: Geisz, Rudin-Aulenbach  
**Deployment**: [stewartvanderbilt.com](https://stewartvanderbilt.com)  
**Last Updated**: December 2025