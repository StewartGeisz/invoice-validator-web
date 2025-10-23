# Invoice Validation Web App - Deployment Guide

This guide walks you through deploying the Invoice Validation System to Vercel.

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Test Locally**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000`

3. **Build for Production**
   ```bash
   npm run build
   ```

## Deployment to Vercel

### Method 1: Vercel CLI (Recommended)

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy from project directory**
   ```bash
   cd invoice-validator-web
   vercel
   ```

3. **Follow the prompts:**
   - Set up and deploy? **Yes**
   - Which scope? Select your account
   - Link to existing project? **No** (for first deployment)
   - What's your project's name? `invoice-validator-web`
   - In which directory is your code located? `./`

### Method 2: Vercel Dashboard

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Invoice validation web app"
   git branch -M main
   git remote add origin https://github.com/yourusername/invoice-validator-web.git
   git push -u origin main
   ```

2. **Deploy via Vercel Dashboard**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import from GitHub
   - Select your repository
   - Configure build settings (auto-detected)
   - Deploy

## Configuration

### Environment Variables (Optional)
If you want to add real Python validation later:

```bash
# .env.local
PYTHON_VALIDATION_ENDPOINT=your-python-service-url
```

### Current Implementation
- **Frontend**: React/Next.js with TypeScript
- **File Upload**: Drag & drop interface for Excel + PDFs
- **Validation**: Mock validation (demonstrates UI/UX)
- **Results Display**: Interactive results with expandable details

## Features Included

✅ **File Upload Interface**
- Excel spreadsheet upload (.xlsx, .xls)
- Multiple PDF invoice upload
- Drag and drop support
- File validation and preview

✅ **Validation Results Display**
- Summary statistics
- Individual invoice status
- Expandable validation details
- Clear approval/rejection indicators

✅ **Responsive Design**
- Mobile-friendly interface
- Professional styling with Tailwind CSS
- Intuitive user experience

## Next Steps for Production

### 1. Integrate Real Python Validation

Replace the mock API in `/src/app/api/validate/route.ts` with actual Python validation:

```typescript
// Call your Python validation service
const pythonResponse = await fetch('your-python-endpoint', {
  method: 'POST',
  body: formData
});
```

### 2. Add Authentication (Optional)

For enterprise use, add user authentication:
```bash
npm install next-auth
```

### 3. Database Integration (Optional)

Store validation results:
```bash
npm install prisma @prisma/client
```

### 4. Email Notifications

Add automated email sending for approvals/rejections:
```bash
npm install nodemailer
```

## File Structure

```
invoice-validator-web/
├── src/
│   ├── app/
│   │   ├── api/validate/route.ts    # API endpoint
│   │   ├── globals.css              # Styles
│   │   ├── layout.tsx               # Root layout
│   │   └── page.tsx                 # Main page
│   └── components/
│       ├── FileUpload.tsx           # File upload component
│       └── ValidationResults.tsx    # Results display
├── api/
│   └── validate.py                  # Python validation (future)
├── public/                          # Static assets
├── package.json
├── next.config.js                   # Next.js config
├── tailwind.config.ts               # Tailwind config
├── vercel.json                      # Vercel config
└── requirements.txt                 # Python dependencies
```

## Performance Optimization

The app is optimized for:
- **Fast loading** with Next.js 15
- **Efficient file handling** with FormData
- **Responsive UI** with Tailwind CSS
- **Production builds** with static optimization

## Support

For issues or questions:
1. Check the console for error messages
2. Verify file formats (Excel: .xlsx/.xls, PDFs: .pdf)
3. Ensure files are not corrupted
4. Check network connectivity for API calls

## Success Metrics

When deployed successfully, you should see:
- ✅ File upload working smoothly
- ✅ Validation results displaying correctly  
- ✅ Mock data showing approved/rejected invoices
- ✅ Professional interface suitable for business use

This provides the foundation for your automated invoice validation system with a user-friendly web interface!