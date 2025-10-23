# Automated Invoice Validation System

## Overview

This system automates the validation of Oracle invoices against Excel spreadsheet data, reducing manual processing time from 5-10 minutes per invoice to under 1 minute, while eliminating validation errors.

## What It Does

The system validates three key criteria for each invoice:

1. **Vendor Name Match** (Column A) - Ensures the vendor exists in service agreements
2. **Purchase Order Number Match** (Column AG) - Validates PO numbers against current agreements  
3. **Invoice Date Range** (Columns AE & AF) - Confirms invoice date falls within PO start/end dates

For each validation, the system also identifies:
- **Admin** (Column E) - The administrative assistant who processes invoices
- **Manager** (Column I) - The manager who oversees the work

## Files Included

- `invoice_validator.py` - Main validation engine
- `demo_script.py` - Demonstration script showing results
- `Service Agreement Table.xlsx` - Excel spreadsheet with validation data
- Example invoice PDFs for testing

## Requirements

```bash
pip install pandas openpyxl pdfplumber
```

## Usage

### Basic Validation
```python
python invoice_validator.py
```

### Demo with Summary Report
```python
python demo_script.py
```

## Results Example

From the test run:

```
================================================================================
FINAL VALIDATION SUMMARY
================================================================================

>> 12628 Mid South P26003063.pdf
   Status: APPROVED
   Admin: Kathy Carney
   Manager: Ben Swaffer

>> 230006 The Budd Group P26000686.pdf
   Status: APPROVED  
   Admin: Telitha Collier
   Manager: Robert Frazier

>> 25-23487 John Bouchard P25063542.pdf
   Status: REJECTED
   Admin: Amy Corlew
   Manager: Mike McDonner
   Issues:
     - PO 'P25003990' not found or invalid
     - Date validation failed
```

## Process Impact

- **2 of 3 invoices** automatically approved for processing
- **Processing time**: ~1 minute (vs 5-10 minutes manual)  
- **Error reduction**: Eliminates human validation mistakes
- **Workflow automation**: Identifies correct admin and manager contacts

## Next Steps for Integration

### Approved Invoices
1. Send approval emails to managers and admins
2. Await work completion confirmation  
3. Process in Oracle system

### Rejected Invoices  
1. Manual review by financial unit managers
2. Vendor/PO verification
3. Date range confirmation

## Technical Details

### PDF Data Extraction
- Extracts vendor names from filenames and PDF text
- Identifies PO numbers using multiple regex patterns
- Parses invoice dates in various formats
- Finds invoice amounts from totals

### Excel Validation
- Loads data from "Service Agreements" sheet
- Matches vendors with fuzzy string matching
- Validates PO numbers with suffix handling
- Checks date ranges against PO start/end dates

### Error Handling
- Graceful handling of malformed PDFs
- Fallback patterns for data extraction
- Clear error reporting for failed validations

This system provides the foundation for the full automated invoice validation workflow described in the PRD."# invoice-validator-web" 
