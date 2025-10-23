import pandas as pd
import pdfplumber
import os
import re
from datetime import datetime

class InvoiceValidator:
    def __init__(self, excel_file="Service Agreement Table (Rolling).xlsx", sheet_name="Service Agreements"):
        """Initialize validator with Excel spreadsheet data"""
        self.excel_file = excel_file
        self.sheet_name = sheet_name
        self.df = None
        self.load_excel_data()
    
    def load_excel_data(self):
        """Load and prepare Excel data for validation"""
        try:
            self.df = pd.read_excel(self.excel_file, sheet_name=self.sheet_name)
            print(f"Loaded {len(self.df)} records from {self.sheet_name} sheet")
            print(f"Columns available: {list(self.df.columns)}")
        except Exception as e:
            print(f"Error loading Excel file: {e}")
    
    def extract_pdf_data(self, pdf_path):
        """Extract vendor, PO number, date, and amount from PDF"""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                full_text = ""
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        full_text += page_text + "\n"
            
            # Better vendor extraction patterns
            vendor_name = self.extract_vendor_name(pdf_path, full_text)
            po_number = self.extract_po_number(full_text)
            invoice_date = self.extract_invoice_date(full_text)
            amount = self.extract_amount(full_text)
            
            return {
                'filename': os.path.basename(pdf_path),
                'vendor': vendor_name,
                'po_number': po_number,
                'invoice_date': invoice_date,
                'amount': amount,
                'full_text': full_text[:500]  # First 500 chars for debugging
            }
        except Exception as e:
            print(f"Error extracting data from {pdf_path}: {e}")
            return None
    
    def extract_vendor_name(self, pdf_path, text):
        """Extract vendor name from PDF filename and text"""
        filename = os.path.basename(pdf_path)
        
        # Try to extract from filename first (more reliable)
        # Pattern: "Invoice# Vendor Name P######.pdf"
        filename_match = re.search(r'^\d+\s+(.+?)\s+P\d+\.pdf$', filename, re.IGNORECASE)
        if filename_match:
            vendor_from_filename = filename_match.group(1).strip()
            print(f"Vendor from filename: {vendor_from_filename}")
            return vendor_from_filename
        
        # Pattern for files like "25-23487 John Bouchard P25063542.pdf"
        filename_match2 = re.search(r'^[\d\-]+\s+(.+?)\s+P\d+\.pdf$', filename, re.IGNORECASE)
        if filename_match2:
            vendor_from_filename = filename_match2.group(1).strip()
            print(f"Vendor from filename (pattern 2): {vendor_from_filename}")
            return vendor_from_filename
        
        # Fallback to text extraction - improved patterns
        vendor_patterns = [
            r'JOHN BOUCHARD & SONS CO\.',  # Specific for John Bouchard
            r'([A-Z][A-Z\s&,.-]+CO\.?)',   # Company pattern
            r'(?:FROM|VENDOR|SUPPLIER|COMPANY):\s*(.+?)(?:\n|$)',
            r'^([A-Z][A-Za-z\s&,.-]+)(?:\n|Invoice)',
            r'Bill To\s*\n\s*([A-Za-z\s&,.-]+)',
        ]
        
        for pattern in vendor_patterns:
            match = re.search(pattern, text, re.MULTILINE | re.IGNORECASE)
            if match:
                vendor = match.group(1).strip() if match.lastindex else match.group(0).strip()
                if len(vendor) > 3:  # Reasonable vendor name length
                    print(f"Vendor from text pattern: {vendor}")
                    return vendor
        
        return None
    
    def extract_po_number(self, text):
        """Extract PO number from text"""
        po_patterns = [
            r'P\.?\s*O\.?\s*(?:Number|No\.?|#)?\s*:?\s*([P]?\d{8}(?:[_\-]\d+)?)',
            r'PO\s*#?\s*:?\s*([P]?\d{8}(?:[_\-]\d+)?)',
            r'Purchase Order\s*:?\s*([P]?\d{8}(?:[_\-]\d+)?)',
            r'P\.O\.\s+No\.\s+([P]?\d{8}(?:[_\-]\d+)?)',
            r'([P]\d{8}(?:[_\-]\d+)?)',  # Direct PO pattern like P26003063
        ]
        
        for pattern in po_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                po = match.group(1).strip()
                # Ensure it starts with P if it's just numbers
                if po.isdigit() and len(po) >= 8:
                    po = 'P' + po
                elif not po.startswith('P') and len(po) >= 8:
                    po = 'P' + po
                return po
        
        return None
    
    def extract_invoice_date(self, text):
        """Extract invoice date from text"""
        date_patterns = [
            r'(?:Invoice\s+Date|Date)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})',
            r'Date\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})',
            r'(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})',  # Any date pattern
        ]
        
        for pattern in date_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for date_str in matches:
                try:
                    # Parse date - handle different formats
                    for fmt in ['%m/%d/%Y', '%m-%d-%Y', '%m/%d/%y', '%m-%d-%y']:
                        try:
                            parsed_date = datetime.strptime(date_str, fmt).date()
                            # Only return dates that look like invoice dates (recent, reasonable)
                            if parsed_date.year >= 2020:
                                return parsed_date
                        except ValueError:
                            continue
                except:
                    pass
        
        return None
    
    def extract_amount(self, text):
        """Extract total amount from text"""
        amount_patterns = [
            r'Total\s*(?:Due|Amount)?\s*:?\s*\$?\s*(\d{1,3}(?:,\d{3})*\.?\d{0,2})',
            r'Amount\s*:?\s*\$?\s*(\d{1,3}(?:,\d{3})*\.?\d{0,2})',
            r'\$\s*(\d{1,3}(?:,\d{3})*\.?\d{0,2})\s*$',
        ]
        
        for pattern in amount_patterns:
            matches = re.findall(pattern, text, re.MULTILINE)
            if matches:
                # Take the last/largest amount found (usually the total)
                amounts = []
                for amt_str in matches:
                    try:
                        amt = float(amt_str.replace(',', ''))
                        amounts.append(amt)
                    except:
                        pass
                
                if amounts:
                    return max(amounts)  # Return largest amount found
        
        return None
    
    def validate_vendor(self, extracted_vendor):
        """Check if vendor exists in Excel data"""
        if not extracted_vendor or self.df is None:
            return False, None, None, None
        
        # Column A is 'Vendor', Column E is 'Admin', Column I is 'Main Contact'
        vendor_col = 'Vendor'
        admin_col = 'Admin' 
        manager_col = 'Main Contact'
        
        # Try exact match first
        vendor_matches = self.df[self.df[vendor_col].str.contains(extracted_vendor, case=False, na=False)]
        
        if len(vendor_matches) == 0:
            # Try partial match - check if extracted vendor is contained in any Excel vendor name
            for idx, excel_vendor in enumerate(self.df[vendor_col]):
                if pd.notna(excel_vendor):
                    if extracted_vendor.lower() in excel_vendor.lower() or excel_vendor.lower() in extracted_vendor.lower():
                        vendor_matches = self.df.iloc[[idx]]
                        break
        
        if len(vendor_matches) > 0:
            match = vendor_matches.iloc[0]
            admin = match[admin_col] if pd.notna(match[admin_col]) else "Unknown"
            manager = match[manager_col] if pd.notna(match[manager_col]) else "Unknown"
            return True, match[vendor_col], admin, manager
        
        return False, None, None, None
    
    def validate_po_number(self, extracted_po, vendor_row_data=None):
        """Check if PO number matches Excel data"""
        if not extracted_po or self.df is None:
            return False, None, None, None
        
        # Column AG is 'Current PO'
        po_col = 'Current PO'
        po_start_col = 'PO Start'  # Column AE  
        po_end_col = 'PO End'      # Column AF
        
        # Clean the PO number - remove P prefix for comparison
        clean_extracted_po = extracted_po.replace('P', '').replace('_', '').replace('-', '')
        
        for idx, row in self.df.iterrows():
            excel_po = row[po_col]
            if pd.notna(excel_po):
                clean_excel_po = str(excel_po).replace('P', '').replace('_', '').replace('-', '')
                
                # Check if PO numbers match (with or without suffix)
                if (clean_extracted_po == clean_excel_po or 
                    clean_extracted_po.startswith(clean_excel_po) or
                    clean_excel_po.startswith(clean_extracted_po)):
                    
                    po_start = row[po_start_col] if pd.notna(row[po_start_col]) else None
                    po_end = row[po_end_col] if pd.notna(row[po_end_col]) else None
                    return True, excel_po, po_start, po_end
        
        return False, None, None, None
    
    def validate_date_range(self, invoice_date, po_start, po_end):
        """Check if invoice date falls within PO date range"""
        if not invoice_date or not po_start or not po_end:
            return False, "Missing date information"
        
        try:
            # Convert Excel dates to datetime objects if they're strings
            if isinstance(po_start, str):
                po_start = pd.to_datetime(po_start).date()
            elif hasattr(po_start, 'date'):
                po_start = po_start.date()
                
            if isinstance(po_end, str):
                po_end = pd.to_datetime(po_end).date()
            elif hasattr(po_end, 'date'):
                po_end = po_end.date()
            
            if po_start <= invoice_date <= po_end:
                return True, f"Date {invoice_date} is within range {po_start} to {po_end}"
            else:
                return False, f"Date {invoice_date} is outside range {po_start} to {po_end}"
        except Exception as e:
            return False, f"Date validation error: {e}"
    
    def validate_invoice(self, pdf_path):
        """Complete invoice validation process"""
        print(f"\n{'='*80}")
        print(f"VALIDATING: {os.path.basename(pdf_path)}")
        print(f"{'='*80}")
        
        # Extract data from PDF
        extracted_data = self.extract_pdf_data(pdf_path)
        if not extracted_data:
            return {"status": "ERROR", "message": "Could not extract PDF data"}
        
        print(f"Extracted Data:")
        print(f"  Vendor: {extracted_data['vendor']}")
        print(f"  PO Number: {extracted_data['po_number']}")
        print(f"  Invoice Date: {extracted_data['invoice_date']}")
        print(f"  Amount: ${extracted_data['amount']}")
        
        # Validation results
        results = {
            'filename': extracted_data['filename'],
            'vendor_match': False,
            'po_match': False,
            'date_valid': False,
            'admin': None,
            'manager': None,
            'validation_details': {}
        }
        
        # 1. Validate Vendor
        vendor_valid, matched_vendor, admin, manager = self.validate_vendor(extracted_data['vendor'])
        results['vendor_match'] = vendor_valid
        results['admin'] = admin
        results['manager'] = manager
        results['validation_details']['vendor'] = {
            'extracted': extracted_data['vendor'],
            'matched': matched_vendor,
            'valid': vendor_valid
        }
        
        # 2. Validate PO Number
        po_valid, matched_po, po_start, po_end = self.validate_po_number(extracted_data['po_number'])
        results['po_match'] = po_valid
        results['validation_details']['po'] = {
            'extracted': extracted_data['po_number'],
            'matched': matched_po,
            'valid': po_valid,
            'po_start': po_start,
            'po_end': po_end
        }
        
        # 3. Validate Date Range
        if po_valid and extracted_data['invoice_date']:
            date_valid, date_message = self.validate_date_range(
                extracted_data['invoice_date'], po_start, po_end
            )
            results['date_valid'] = date_valid
            results['validation_details']['date'] = {
                'invoice_date': extracted_data['invoice_date'],
                'valid': date_valid,
                'message': date_message
            }
        else:
            results['validation_details']['date'] = {
                'invoice_date': extracted_data['invoice_date'],
                'valid': False,
                'message': 'Cannot validate date - missing PO or date information'
            }
        
        # Print validation results
        self.print_validation_results(results)
        
        return results
    
    def print_validation_results(self, results):
        """Print formatted validation results"""
        print(f"\nVALIDATION RESULTS:")
        print(f"  Admin: {results['admin']}")
        print(f"  Manager: {results['manager']}")
        print(f"  * Vendor Match: {'PASS' if results['vendor_match'] else 'FAIL'}")
        print(f"  * PO Number Match: {'PASS' if results['po_match'] else 'FAIL'}")
        print(f"  * Date Range Valid: {'PASS' if results['date_valid'] else 'FAIL'}")
        
        overall_status = "APPROVED" if all([
            results['vendor_match'], 
            results['po_match'], 
            results['date_valid']
        ]) else "REJECTED"
        
        print(f"\n  OVERALL STATUS: {overall_status}")
        
        if overall_status == "REJECTED":
            print(f"  Rejection reasons:")
            if not results['vendor_match']:
                print(f"    - Vendor '{results['validation_details']['vendor']['extracted']}' not found")
            if not results['po_match']:
                print(f"    - PO '{results['validation_details']['po']['extracted']}' not found")
            if not results['date_valid']:
                print(f"    - {results['validation_details']['date']['message']}")

def main():
    """Main function to test the validator"""
    validator = InvoiceValidator()
    
    # Find all PDF files
    pdf_files = [f for f in os.listdir('.') if f.endswith('.pdf')]
    
    print("INVOICE VALIDATION SYSTEM")
    print("="*80)
    
    results_summary = []
    
    for pdf_file in pdf_files:
        result = validator.validate_invoice(pdf_file)
        results_summary.append(result)
    
    # Print summary
    print(f"\n{'='*80}")
    print("VALIDATION SUMMARY")
    print(f"{'='*80}")
    
    for result in results_summary:
        status = "APPROVED" if all([
            result['vendor_match'], 
            result['po_match'], 
            result['date_valid']
        ]) else "REJECTED"
        
        print(f"{result['filename']}: {status}")
        print(f"  Admin: {result['admin']}, Manager: {result['manager']}")

if __name__ == "__main__":
    main()