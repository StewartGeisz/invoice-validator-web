# Invoice Validation Web Application

## 🚀 Quick Start

1. **Start the application:**
   ```bash
   python app.py
   ```

2. **Open your browser and navigate to:**
   ```
   http://127.0.0.1:5000
   ```

3. **Upload a PDF invoice and get instant validation results!**

## 📋 Features

### What Gets Validated
- ✅ **Vendor Identification**: Matches company name against approved supplier database (85+ vendors)
- ✅ **Purchase Order Number**: Verifies PO number appears in the document 
- ✅ **Date Validation**: Ensures invoice dates fall within contract periods
- ✅ **Rate Validation**: Checks amounts against expected rates with ±5% tolerance
- ✅ **Contact Routing**: Determines appropriate contact person based on validation results

### Smart Contact Logic
- **All tests pass + fixed rate** → Contact Director/Manager
- **Any test fails OR variable rate** → Contact Admin/Main Contact

### Beautiful UI
- **Drag & drop file upload**
- **Real-time validation results**
- **Color-coded status indicators**
- **Detailed validation breakdown**
- **Contact person recommendations**
- **Mobile-responsive design**

## 🎯 Validation Results

The system provides three validation statuses:

### ✅ FULLY VALIDATED
- All checks pass (vendor, PO, dates, rates)
- Fixed rate type
- → Contact Director/Manager for approval

### ❌ VALIDATION FAILED  
- One or more checks failed
- → Contact Admin/Main Contact for resolution

### ⚠️ PARTIAL VALIDATION
- Some checks couldn't be performed (missing data)
- Variable rate types (automatic pass)
- → Contact Admin/Main Contact as needed

## 🔧 Technical Details

### Backend Integration
- Uses existing `PDFVendorMatcher` logic unchanged
- Maintains all validation integrity 
- Real-time processing with LLM validation
- Secure file upload and cleanup

### File Support
- **Input**: PDF files only
- **Processing**: Automatic text extraction with pdfplumber
- **Security**: Temporary file handling with automatic cleanup

### Data Sources
- **Vendor Database**: Service Agreement Table (Rolling).xlsx
- **Rate Information**: Vendors Rates sheet
- **Contact Info**: Admin and Director fields
- **Contract Dates**: Service Agreements sheet

## 🛡️ Error Handling

The application handles:
- Invalid file types
- Corrupted PDFs  
- Missing spreadsheet data
- API failures
- Network issues

## 📱 Usage Examples

1. **Upload invoice PDF**
2. **View comprehensive validation results:**
   - Vendor match status
   - PO number verification
   - Date range compliance  
   - Rate validation with tolerance
   - Contact person recommendation
3. **Take appropriate action based on results**

## 🔄 API Endpoint (Optional)

For programmatic access:
```
POST /api/validate
Content-Type: multipart/form-data
Body: file (PDF)

Returns: JSON validation results
```

## 📊 System Requirements

- Python 3.8+
- Flask web framework
- Existing validation dependencies (PyPDF2, pandas, requests, etc.)
- Modern web browser

---

**Ready to validate invoices? Start the app and navigate to http://127.0.0.1:5000**