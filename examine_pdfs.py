import pdfplumber
import os
import re

def extract_pdf_data(pdf_path):
    """Extract key data from PDF invoice"""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            full_text = ""
            for page in pdf.pages:
                full_text += page.extract_text() + "\n"
        
        print(f"\n{'='*60}")
        print(f"PDF: {os.path.basename(pdf_path)}")
        print(f"{'='*60}")
        print("Full text extracted:")
        print(full_text[:1000] + "..." if len(full_text) > 1000 else full_text)
        
        # Extract key information using regex patterns
        vendor_patterns = [
            r'(?:Vendor|Supplier|Company):\s*(.+)',
            r'Bill To:\s*(.+)',
            r'From:\s*(.+)',
        ]
        
        po_patterns = [
            r'(?:P\.?O\.?|Purchase Order|PO)\s*(?:Number|No\.?|#)?\s*:?\s*([A-Z]?\d+[_\-]?\d*)',
            r'([P]\d{8}_?\d*)',
        ]
        
        date_patterns = [
            r'(?:Invoice Date|Date):\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})',
            r'(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})',
        ]
        
        amount_patterns = [
            r'\$?\s*(\d{1,3}(?:,\d{3})*\.?\d{0,2})',
            r'Total:\s*\$?\s*(\d{1,3}(?:,\d{3})*\.?\d{0,2})',
        ]
        
        # Find vendor
        vendor = None
        for pattern in vendor_patterns:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                vendor = match.group(1).strip()
                break
        
        # Find PO number
        po_number = None
        for pattern in po_patterns:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                po_number = match.group(1).strip()
                break
        
        # Find dates
        dates = []
        for pattern in date_patterns:
            matches = re.findall(pattern, full_text, re.IGNORECASE)
            dates.extend(matches)
        
        # Find amounts
        amounts = []
        for pattern in amount_patterns:
            matches = re.findall(pattern, full_text, re.IGNORECASE)
            amounts.extend(matches)
        
        extracted_data = {
            'vendor': vendor,
            'po_number': po_number,
            'dates': dates[:5],  # First 5 dates found
            'amounts': amounts[:5],  # First 5 amounts found
        }
        
        print(f"\nExtracted Data:")
        print(f"Vendor: {extracted_data['vendor']}")
        print(f"PO Number: {extracted_data['po_number']}")
        print(f"Dates found: {extracted_data['dates']}")
        print(f"Amounts found: {extracted_data['amounts']}")
        
        return extracted_data
        
    except Exception as e:
        print(f"Error processing {pdf_path}: {e}")
        return None

def examine_all_pdfs():
    """Examine all PDF files in the directory"""
    pdf_files = [f for f in os.listdir('.') if f.endswith('.pdf')]
    
    print("PDF Invoice Analysis")
    print("="*60)
    
    for pdf_file in pdf_files:
        extract_pdf_data(pdf_file)

if __name__ == "__main__":
    examine_all_pdfs()