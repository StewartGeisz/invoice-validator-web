# PDF Invoice Validator

A Vercel-compatible web application that validates PDF invoices against a vendor database. Built with Next.js and designed for serverless deployment.

## Features

- **PDF Text Extraction**: Extracts text from uploaded PDF files
- **Multiple File Support**: Upload and validate multiple PDFs simultaneously
- **Vendor Matching**: Identifies vendors using fuzzy matching algorithms + LLM fallback
- **PO Number Validation**: Validates purchase order numbers against database
- **Date Range Validation**: Checks if invoice dates fall within contract periods using LLM analysis
- **Rate Validation**: Validates amounts against expected rates with 5% tolerance
- **Contact Recommendations**: Suggests appropriate contact person based on validation results
- **Serverless Architecture**: Optimized for Vercel's serverless functions
- **LLM Integration**: Advanced validation using Amplify API with GPT-4o

## How It Works

### Validation Logic

1. **Vendor Identification**
   - Extracts text from PDF using pdf-parse library
   - Performs fuzzy matching against vendor database
   - Falls back to LLM API (if configured) for complex matching

2. **PO Number Validation**
   - Searches for expected PO number in PDF text
   - Uses multiple patterns (exact match, spacing variations, contextual search)
   - Returns pass/fail with detailed reason

3. **Date Validation** 
   - Extracts dates from PDF using regex patterns
   - Checks if any dates fall within the vendor's PO period
   - Supports multiple date formats (MM/DD/YYYY, YYYY-MM-DD, etc.)

4. **Rate Validation**
   - Compares PDF amounts against expected rates (±5% tolerance)
   - Auto-passes if no rate specified (variable rate contracts)
   - Searches for dollar amounts in PDF text

5. **Contact Person Logic**
   - **All validations pass + fixed rate** → Contact Director/Manager
   - **Any validation fails OR variable rate** → Contact Admin/Main Contact

## Deployment to Vercel

### Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Git Repository**: Push your code to GitHub, GitLab, or Bitbucket

### Step 1: Prepare Your Data

1. **Convert Excel to JSON** (already done):
   ```bash
   node convert-excel.js
   ```
   This creates `data/vendor-data.json` with your vendor information.

### Step 2: Deploy to Vercel

#### Option A: Vercel CLI (Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

#### Option B: Git Integration

1. **Push to Git**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/pdf-validator.git
   git push -u origin main
   ```

2. **Connect to Vercel**:
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your Git repository
   - Click "Deploy"

### Step 3: Configure Environment Variables (Optional)

If you want to use the Amplify API for advanced vendor matching:

1. **In Vercel Dashboard**:
   - Go to Project Settings → Environment Variables
   - Add:
     - `AMPLIFY_API_URL`: Your Amplify API endpoint
     - `AMPLIFY_API_KEY`: Your API key

2. **Redeploy** after adding environment variables

### Step 4: Verify Deployment

1. **Access your site** at the Vercel-provided URL (e.g., `your-project.vercel.app`)
2. **Test upload** with one of your sample PDFs
3. **Check validation results**

## Local Development

### Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Convert Excel data** (if not done):
   ```bash
   node convert-excel.js
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Open browser** to [http://localhost:3000](http://localhost:3000)

### Testing

Upload any of these sample PDFs to test:
- `12628 Mid South P26003063.pdf`
- `230006 The Budd Group P26000686.pdf` 
- `25-23487 John Bouchard P25063542.pdf`

## File Structure

```
pdf-invoice-validator/
├── data/
│   └── vendor-data.json          # Converted vendor database
├── lib/
│   └── pdf-validator.js          # Core validation logic
├── pages/
│   ├── api/
│   │   └── validate-pdf.js       # API endpoint for PDF processing
│   ├── _app.js                   # Next.js app wrapper
│   └── index.js                  # Main upload interface
├── styles/
│   └── globals.css               # Tailwind CSS styles
├── convert-excel.js              # Excel to JSON converter
├── next.config.js               # Next.js configuration
├── package.json                 # Dependencies
├── tailwind.config.js           # Tailwind CSS config
└── README.md                    # This file
```

## Vercel-Specific Optimizations

### Serverless Constraints Handled

1. **No File System**: Uses in-memory buffers instead of disk storage
2. **Memory Limits**: Processes PDFs in memory without caching
3. **Timeout Limits**: Reduced API timeouts for serverless functions
4. **Cold Starts**: Optimized imports and lightweight dependencies

### Performance Features

- **Static JSON Data**: Vendor database loaded as static import
- **Efficient PDF Processing**: Streams PDF data without temporary files
- **Minimal Dependencies**: Only essential packages for smaller bundle size
- **Edge Optimization**: Works with Vercel's Edge Runtime

## Troubleshooting

### Common Issues

1. **"No vendor match found"**
   - Check if vendor name appears exactly in your Excel file
   - Verify vendor-data.json was generated correctly
   - Enable LLM API for better matching

2. **"PO validation failed"**
   - Ensure PO number exists in vendor database
   - Check PDF text extraction quality
   - Verify PO number format matches

3. **"Date validation failed"**  
   - Confirm PO Start/End dates in vendor database
   - Check date format in PDF (MM/DD/YYYY, etc.)
   - Ensure dates are within contract period

4. **File upload errors**
   - Verify file is valid PDF format
   - Check file size (10MB limit)
   - Ensure stable internet connection

### Vercel Deployment Issues

1. **Build errors**:
   ```bash
   npm run build  # Test locally first
   ```

2. **Function timeout**:
   - Large PDFs may hit 10-second serverless limit
   - Consider splitting into multiple API calls

3. **Memory errors**:
   - Reduce PDF file size if possible
   - Optimize vendor database size

## License

This project is for internal use only. Contains proprietary vendor data.

## Support

For issues or questions:
1. Check this README
2. Review Vercel deployment logs
3. Test with sample PDFs locally first