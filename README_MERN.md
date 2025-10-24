# Invoice Validation MERN Stack Application

A modern web application built with MongoDB, Express.js, React, and Node.js for automated PDF invoice validation.

## 🚀 Quick Start

### Option 1: Use the Start Script (Recommended)
```bash
# Double-click the start.bat file or run:
start.bat
```

### Option 2: Manual Start
```bash
# Terminal 1: Start Python Validation API
python python_api.py

# Terminal 2: Start Node.js server and React client
npm run dev
```

## 🌐 Access Points

Once running, the application will be available at:
- **React Frontend**: http://localhost:3000
- **Node.js API**: http://localhost:5000
- **Python Validation API**: http://localhost:5001

## 📁 Project Structure

```
invoice-validation/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── Header.js
│   │   │   ├── FileUpload.js
│   │   │   └── ValidationResults.js
│   │   ├── App.js          # Main React app
│   │   └── index.js        # React entry point
│   └── package.json        # React dependencies
├── server.js              # Express.js API server
├── python_api.py          # Python validation service
├── pdf_vendor_matcher.py  # Core validation logic
├── package.json           # Node.js dependencies
└── start.bat             # Quick start script
```

## 🔧 Technology Stack

### Frontend
- **React 18** - UI library
- **Bootstrap 5** - Styling framework
- **React Dropzone** - File upload handling
- **Axios** - HTTP client
- **Font Awesome** - Icons

### Backend
- **Node.js + Express** - API server
- **Multer** - File upload middleware
- **Python Flask** - Validation service
- **CORS** - Cross-origin requests

### Validation Engine
- **PyPDF2 + pdfplumber** - PDF text extraction
- **Pandas** - Excel data processing
- **OpenAI API (Amplify)** - LLM validation
- **Custom logic** - Business rule validation

## 📋 Features

### 🎯 Validation Checks
1. **Vendor Identification** - Matches company against 85+ supplier database
2. **PO Number Verification** - Ensures PO number appears in document
3. **Date Range Validation** - Checks dates fall within contract periods
4. **Rate Validation** - Validates amounts within ±5% tolerance
5. **Smart Contact Routing** - Determines appropriate contact person

### 🎨 UI Features
- **Drag & Drop Upload** - Modern file upload experience
- **Real-time Validation** - Live processing with loading states
- **Color-coded Results** - Green/red/yellow status indicators
- **Responsive Design** - Works on desktop and mobile
- **Detailed Breakdown** - Comprehensive validation explanations

### 🛡️ Security Features
- **File Type Validation** - PDF files only
- **Size Limits** - 10MB maximum file size
- **Temporary File Cleanup** - Automatic file removal after processing
- **Error Handling** - Graceful error recovery

## 🔄 How It Works

1. **File Upload**: User uploads PDF via drag & drop or file picker
2. **Node.js Processing**: Express server receives file and saves temporarily
3. **Python Validation**: Node.js calls Python API with file path
4. **LLM Analysis**: Python service uses existing validation logic + LLM
5. **Results Display**: React frontend shows comprehensive validation results
6. **Cleanup**: Temporary files are automatically removed

## 📊 Validation Results

### ✅ FULLY VALIDATED
- All checks pass (vendor, PO, dates, rates)
- Fixed rate type
- **Action**: Contact Director/Manager for approval

### ❌ VALIDATION FAILED  
- One or more checks failed
- **Action**: Contact Admin/Main Contact for resolution

### ⚠️ PARTIAL VALIDATION
- Some checks couldn't be performed
- Variable rate types (automatic pass)
- **Action**: Contact Admin/Main Contact as needed

## 🔧 Development Commands

```bash
# Install all dependencies
npm install
cd client && npm install

# Development mode (runs both servers)
npm run dev

# Run only Node.js server
npm run server

# Run only React client
npm run client

# Build React for production
npm run build
```

## 📝 API Endpoints

### Node.js API (Port 5000)
```
GET  /api/health           # Health check
POST /api/validate         # Upload and validate PDF
```

### Python API (Port 5001)
```
GET  /health              # Health check
POST /validate            # Validate PDF by file path
```

## 🐛 Troubleshooting

### Common Issues

**"Python validation service is not running"**
- Make sure `python python_api.py` is running in a separate terminal
- Check that Python dependencies are installed

**"Failed to validate PDF"**
- Ensure Excel file "Service Agreement Table (Rolling).xlsx" exists
- Check that PDF file is not corrupted
- Verify Amplify API credentials in .env file

**Upload button not working**
- Check browser console for JavaScript errors
- Ensure Node.js server is running on port 5000
- Verify CORS configuration

**React app won't start**
- Run `cd client && npm install` to install dependencies
- Check for port conflicts (default: 3000)

### Debug Mode
Start services individually for better error visibility:
```bash
# Python service with debug output
python python_api.py

# Node.js server with logging
npm run server

# React with development tools
cd client && npm start
```

## 🚀 Deployment

For production deployment:
1. Set `NODE_ENV=production`
2. Build React client: `npm run build` 
3. Start Node.js server: `node server.js`
4. Start Python API: `python python_api.py`

## 📞 Support

If you encounter issues:
1. Check the console logs in both terminals
2. Verify all dependencies are installed
3. Ensure Excel data file is present and readable
4. Test with a simple PDF file first

---

**Ready to validate invoices? Run `npm run dev` and navigate to http://localhost:3000**