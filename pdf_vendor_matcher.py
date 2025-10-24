#!/usr/bin/env python3
"""
Abstract PDF vendor matching system.
Extracts text from PDFs, builds vendor list from Excel, and uses Amplify API for vendor identification.
"""

import PyPDF2
import pandas as pd
import json
import os
import requests
from typing import List, Dict, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class PDFVendorMatcher:
    def __init__(self, excel_file_path: str):
        """Initialize with path to Excel spreadsheet."""
        self.excel_file_path = excel_file_path
        self.vendor_list = []
        self.vendor_data = {}  # Dictionary to store detailed vendor info
        self.amplify_api_url = os.getenv('AMPLIFY_API_URL')
        self.amplify_api_key = os.getenv('AMPLIFY_API_KEY')
        
        # Load vendor data from Excel
        self._load_vendor_data()
        self._load_rate_data()
    
    def extract_pdf_text(self, pdf_path: str) -> str:
        """Extract all text content from a PDF file using multiple methods."""
        text = ""
        
        # Method 1: Try PyPDF2
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                
                for page in pdf_reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
                
        except Exception as e:
            print(f"PyPDF2 extraction failed: {e}")
        
        # Method 2: Try pdfplumber for better text extraction (if available)
        try:
            import pdfplumber
            with pdfplumber.open(pdf_path) as pdf:
                plumber_text = ""
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        plumber_text += page_text + "\n"
                
                # Use pdfplumber result if it's longer (usually better quality)
                if len(plumber_text) > len(text):
                    text = plumber_text
                    
        except ImportError:
            pass  # pdfplumber not installed, stick with PyPDF2
        except Exception as e:
            print(f"pdfplumber extraction failed: {e}")
        
        # Clean up the text
        if text:
            # Remove excessive whitespace but preserve structure
            lines = []
            for line in text.split('\n'):
                cleaned_line = ' '.join(line.split())
                if cleaned_line:
                    lines.append(cleaned_line)
            text = '\n'.join(lines)
        
        return text.strip()
    
    def _load_vendor_data(self) -> None:
        """Load vendor data including names, PO numbers, and date ranges from Excel."""
        try:
            # Read from the Service Agreements sheet which has the detailed info
            df = pd.read_excel(self.excel_file_path, sheet_name='Service Agreements')
            
            # Extract vendor names for the list
            vendor_column = 'Vendor'  # Based on what we found
            if vendor_column in df.columns:
                vendor_series = df[vendor_column].dropna().astype(str)
                vendors = set(vendor_series.unique())
                self.vendor_list = [v.strip() for v in vendors if v.strip() and v.strip().lower() != 'nan']
                
                # Store detailed vendor data
                for _, row in df.iterrows():
                    vendor_name = str(row[vendor_column]).strip()
                    if vendor_name and vendor_name.lower() != 'nan':
                        self.vendor_data[vendor_name] = {
                            'contract_start': row.get('Contract Start Date'),
                            'contract_end': row.get('Contract End Date'), 
                            'current_po': row.get('Current PO'),
                            'po_start': row.get('PO Start'),
                            'po_end': row.get('PO End')
                        }
                
                print(f"Loaded {len(self.vendor_list)} unique vendors with detailed data")
                print(f"Sample vendor data keys: {list(self.vendor_data.keys())[:5]}")
            else:
                print("Warning: 'Vendor' column not found. Falling back to first sheet.")
                # Fallback to original logic
                self._load_vendor_list_fallback()
            
        except Exception as e:
            print(f"Error loading from Service Agreements sheet: {e}")
            print("Falling back to first sheet...")
            self._load_vendor_list_fallback()
    
    def _load_vendor_list_fallback(self) -> None:
        """Fallback method to load vendor names from first sheet."""
        try:
            df = pd.read_excel(self.excel_file_path)
            
            # Look for vendor name columns
            vendor_columns = []
            for col in df.columns:
                col_lower = str(col).lower()
                if 'supplier' in col_lower or 'vendor' in col_lower:
                    vendor_columns = [col]
                    break
            
            if not vendor_columns:
                vendor_columns = [df.columns[0]]
            
            # Extract unique vendor names
            vendors = set()
            for col in vendor_columns:
                vendor_series = df[col].dropna().astype(str)
                vendors.update(vendor_series.unique())
            
            self.vendor_list = [v.strip() for v in vendors if v.strip() and v.strip().lower() != 'nan']
            
            print(f"Loaded {len(self.vendor_list)} vendors from fallback method")
            
        except Exception as e:
            print(f"Error in fallback vendor loading: {e}")
            self.vendor_list = []
    
    def _load_rate_data(self) -> None:
        """Load rate information from Vendors Rates sheet."""
        try:
            df = pd.read_excel(self.excel_file_path, sheet_name='Vendors Rates')
            
            current_vendor = None
            for i in range(len(df)):
                row = df.iloc[i]
                
                # Check if this row has a vendor name
                if pd.notna(row.iloc[0]) and str(row.iloc[0]).strip():
                    vendor_name = str(row.iloc[0]).strip()
                    if vendor_name != 'nan' and len(vendor_name) > 3:
                        current_vendor = vendor_name
                        
                        # Initialize rate data for this vendor
                        if current_vendor not in self.vendor_data:
                            self.vendor_data[current_vendor] = {}
                        
                        # Look for rate amount (usually in column 2)
                        if pd.notna(row.iloc[2]) and isinstance(row.iloc[2], (int, float)):
                            self.vendor_data[current_vendor]['rate_amount'] = row.iloc[2]
                        
                        # Look for billing cycle information
                        for j in range(1, min(10, len(row))):
                            cell_value = str(row.iloc[j]).strip().lower()
                            if cell_value in ['annual', 'monthly', 'weekly', 'hourly', 'biannual', 'as needed', 'variable']:
                                self.vendor_data[current_vendor]['rate_type'] = cell_value
                                break
            
            rate_vendors = [v for v in self.vendor_data.keys() if 'rate_type' in self.vendor_data[v] or 'rate_amount' in self.vendor_data[v]]
            print(f"Loaded rate data for {len(rate_vendors)} vendors")
            
        except Exception as e:
            print(f"Error loading rate data: {e}")
    
    
    def query_amplify_api(self, pdf_text: str) -> Optional[Dict]:
        """Send PDF text and vendor list to Amplify API for vendor identification."""
        if not self.amplify_api_url or not self.amplify_api_key:
            print("Error: Amplify API URL or key not found in environment variables")
            return None
        
        prompt = f"""You are an expert at identifying company names in invoices and matching them to a supplier database.

TASK: Analyze this invoice/document text and identify which supplier from the provided list is the vendor/company that issued this document.

INVOICE/DOCUMENT TEXT:
{pdf_text}

SUPPLIER DATABASE:
{json.dumps(self.vendor_list, indent=2)}

MATCHING RULES:
1. Look for company names that appear as the sender/issuer of the invoice
2. Match variations like:
   - "Mid-South Instrument Service" → "Mid South Instrument Services Inc."
   - "The Budd Group" → "The Budd Group" 
   - "John Bouchard & Sons" → "John Bouchard & Sons"
3. Ignore differences in:
   - Punctuation (hyphens, periods, commas)
   - Word order variations
   - Legal suffixes (Inc, LLC, Corp, etc.)
   - Articles (The, A, An)
4. Be flexible with partial matches - "Evoqua" should match "Evoqua Water Technologies"
5. Look in headers, letterheads, "From:" fields, company contact info
6. If multiple potential matches, choose the most specific/complete one

IMPORTANT: Only match if you are confident this supplier is the one issuing the invoice/document. Return null if no clear match exists.

Return ONLY valid JSON in this exact format:
{{"vendor": "Exact Name From Supplier List"}} 

OR if no match found:
{{"vendor": null}}"""
        
        try:
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.amplify_api_key}'
            }
            
            messages = [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
            
            payload = {
                "data": {
                    "temperature": 0.5,
                    "max_tokens": 4096,
                    "dataSources": [],
                    "messages": messages,
                    "options": {
                        "ragOnly": False,
                        "skipRag": True,
                        "model": {"id": "gpt-4o"},
                        "prompt": prompt,
                    },
                }
            }
            
            response = requests.post(self.amplify_api_url, headers=headers, data=json.dumps(payload), timeout=30)
            
            if response.status_code == 200:
                response_data = response.json()
                api_response = response_data.get("data", "")
                
                # Print the full LLM output for demonstration
                print(f"\n=== AMPLIFY API LLM OUTPUT ===")
                print(api_response)
                print("=== END LLM OUTPUT ===\n")
                
                
                if api_response:
                    try:
                        # Try to parse the response as JSON
                        vendor_data = json.loads(api_response)
                        return vendor_data
                    except json.JSONDecodeError:
                        # Try to extract JSON from markdown code blocks
                        import re
                        json_match = re.search(r'```(?:json)?\s*(\{[^`]+\})\s*```', api_response)
                        if json_match:
                            try:
                                vendor_data = json.loads(json_match.group(1))
                                return vendor_data
                            except json.JSONDecodeError:
                                pass
                        
                        print(f"API response not valid JSON: {api_response}")
                        return {"vendor": None}
                else:
                    print("Empty response from API")
                    return {"vendor": None}
            else:
                print(f"Amplify API error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"Error querying Amplify API: {e}")
            return None
    
    def process_pdf(self, pdf_path: str, debug: bool = False) -> Dict:
        """Complete workflow: extract PDF text, identify vendor, and validate PO and dates."""
        print(f"\nProcessing PDF: {pdf_path}")
        
        # Step 1: Extract PDF text
        pdf_text = self.extract_pdf_text(pdf_path)
        if not pdf_text:
            return {"error": "Could not extract text from PDF"}
        
        print(f"Extracted {len(pdf_text)} characters from PDF")
        
        if debug:
            print("\n--- PDF TEXT SAMPLE (first 300 chars) ---")
            print(pdf_text[:300] + "..." if len(pdf_text) > 300 else pdf_text)
            print("--- END PDF TEXT SAMPLE ---\n")
        
        # Step 2: Identify vendor using LLM
        if not self.amplify_api_url or not self.amplify_api_key:
            print("Amplify API not configured - cannot match vendors")
            return {"error": "API not configured"}
        
        print("Querying Amplify API for vendor matching...")
        api_response = self.query_amplify_api(pdf_text)
        
        if not api_response or 'vendor' not in api_response or not api_response['vendor']:
            print("No vendor match found")
            return {"vendor": None, "po_valid": None, "date_valid": None, "method": "amplify_api"}
        
        vendor_name = api_response['vendor']
        print(f"Vendor identified: {vendor_name}")
        
        # Step 3: Validate PO number
        print("Validating PO number...")
        po_validation = self.validate_po_number(pdf_text, vendor_name)
        print(f"PO Validation: {po_validation}")
        
        # Step 4: Validate date range
        print("Validating date range...")
        date_validation = self.validate_date_range(pdf_text, vendor_name)
        print(f"Date Validation: {date_validation}")
        
        # Step 5: Validate rate
        print("Validating rate...")
        rate_validation = self.validate_rate(pdf_text, vendor_name)
        print(f"Rate Validation: {rate_validation}")
        
        # Step 6: Determine contact person based on results
        contact_person = self._determine_contact_person(vendor_name, po_validation, date_validation, rate_validation)
        
        # Compile final result
        result = {
            "vendor": vendor_name,
            "method": "amplify_api",
            "po_valid": po_validation.get("po_valid"),
            "po_reason": po_validation.get("reason"),
            "expected_po": po_validation.get("expected_po"),
            "date_valid": date_validation.get("date_valid"),
            "date_reason": date_validation.get("reason"),
            "dates_found": date_validation.get("dates_found", []),
            "valid_dates": date_validation.get("valid_dates", []),
            "rate_valid": rate_validation.get("rate_valid"),
            "rate_reason": rate_validation.get("reason"),
            "rate_type": rate_validation.get("rate_type"),
            "expected_amount": rate_validation.get("expected_amount"),
            "amounts_found": rate_validation.get("amounts_found", []),
            "is_variable_rate": rate_validation.get("is_variable", False),
            "contact_person": contact_person.get("name"),
            "contact_role": contact_person.get("role"),
            "contact_reason": contact_person.get("reason")
        }
        
        return result
    
    def _determine_contact_person(self, vendor_name: str, po_validation: Dict, date_validation: Dict, rate_validation: Dict) -> Dict:
        """Determine who to contact based on validation results."""
        if vendor_name not in self.vendor_data:
            return {"name": "Unknown", "role": "Unknown", "reason": "Vendor not found in database"}
        
        vendor_info = self.vendor_data[vendor_name]
        
        # Check if any validation failed or if rate is variable
        po_failed = po_validation.get("po_valid") is False
        date_failed = date_validation.get("date_valid") is False  
        rate_failed = rate_validation.get("rate_valid") is False
        is_variable_rate = rate_validation.get("is_variable", False)
        
        # If all tests pass AND rate is not variable → contact manager/director
        if not (po_failed or date_failed or rate_failed or is_variable_rate):
            director = vendor_info.get("director") or vendor_info.get("Asst Director / Director")
            if director and str(director).lower() not in ['nan', '']:
                return {
                    "name": director,
                    "role": "Director/Manager", 
                    "reason": "All validations passed and rate is fixed"
                }
        
        # Otherwise → contact admin/main contact
        # Try Main Contact first, then Admin
        main_contact = vendor_info.get("Main Contact") or vendor_info.get("main_contact")
        admin = vendor_info.get("Admin") or vendor_info.get("admin")
        
        contact = main_contact if main_contact and str(main_contact).lower() not in ['nan', ''] else admin
        
        if contact and str(contact).lower() not in ['nan', '']:
            reasons = []
            if po_failed:
                reasons.append("PO validation failed")
            if date_failed:
                reasons.append("date validation failed")
            if rate_failed:
                reasons.append("rate validation failed")
            if is_variable_rate:
                reasons.append("variable rate type")
            
            reason = "Issue requires admin attention: " + ", ".join(reasons) if reasons else "Default admin contact"
            
            return {
                "name": contact,
                "role": "Admin/Main Contact",
                "reason": reason
            }
        
        return {"name": "Unknown", "role": "Unknown", "reason": "No contact information available"}
    
    def validate_po_number(self, pdf_text: str, vendor_name: str) -> Dict:
        """Validate if PO number from spreadsheet appears in PDF text."""
        if vendor_name not in self.vendor_data:
            return {"po_valid": False, "reason": "Vendor not found in database"}
        
        vendor_info = self.vendor_data[vendor_name]
        expected_po = vendor_info.get('current_po')
        
        if not expected_po or pd.isna(expected_po):
            return {"po_valid": None, "reason": "No PO number in database for this vendor"}
        
        # Convert PO to string for text search
        po_str = str(expected_po).strip()
        
        if po_str.lower() in pdf_text.lower():
            return {"po_valid": True, "expected_po": po_str, "reason": "PO number found in PDF"}
        else:
            return {"po_valid": False, "expected_po": po_str, "reason": "PO number not found in PDF"}
    
    def validate_date_range(self, pdf_text: str, vendor_name: str) -> Dict:
        """Validate if any date in PDF falls within vendor's contract date range."""
        if vendor_name not in self.vendor_data:
            return {"date_valid": False, "reason": "Vendor not found in database"}
        
        vendor_info = self.vendor_data[vendor_name]
        contract_start = vendor_info.get('contract_start')
        contract_end = vendor_info.get('contract_end')
        
        # Check if we have valid date range
        if not contract_start or not contract_end or pd.isna(contract_start) or pd.isna(contract_end):
            return {"date_valid": None, "reason": "No contract date range in database for this vendor"}
        
        # Use LLM to extract and validate dates
        return self._validate_dates_with_llm(pdf_text, contract_start, contract_end)
    
    def _validate_dates_with_llm(self, pdf_text: str, contract_start, contract_end) -> Dict:
        """Use LLM to extract dates from PDF and check if they fall within contract range."""
        if not self.amplify_api_url or not self.amplify_api_key:
            return {"date_valid": False, "reason": "API not configured for date validation"}
        
        prompt = f"""You are an expert at extracting dates from invoice documents and validating date ranges.

TASK: Extract all dates from this invoice/document and check if ANY of them fall within the given contract period.

DOCUMENT TEXT:
{pdf_text}

CONTRACT PERIOD:
Start: {contract_start}
End: {contract_end}

INSTRUCTIONS:
1. Extract ALL dates you can find in the document (invoice date, service dates, billing periods, etc.)
2. Convert each date to YYYY-MM-DD format if possible
3. Check if ANY extracted date falls within the contract period (inclusive)
4. Look for dates in formats like: MM/DD/YYYY, DD/MM/YYYY, Month DD YYYY, YYYY-MM-DD, etc.
5. Pay special attention to invoice dates, service period dates, billing dates

Return ONLY valid JSON in this exact format:
{{
  "dates_found": ["YYYY-MM-DD", "YYYY-MM-DD", ...],
  "date_valid": true/false,
  "valid_dates": ["YYYY-MM-DD", ...],
  "reason": "explanation of result"
}}"""

        try:
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.amplify_api_key}'
            }
            
            payload = {
                "data": {
                    "temperature": 0.3,
                    "max_tokens": 2000,
                    "dataSources": [],
                    "messages": [{"role": "user", "content": prompt}],
                    "options": {
                        "ragOnly": False,
                        "skipRag": True,
                        "model": {"id": "gpt-4o"},
                        "prompt": prompt,
                    },
                }
            }
            
            response = requests.post(self.amplify_api_url, headers=headers, data=json.dumps(payload), timeout=30)
            
            if response.status_code == 200:
                response_data = response.json()
                api_response = response_data.get("data", "")
                
                print(f"\n=== DATE VALIDATION LLM OUTPUT ===")
                print(api_response)
                print("=== END DATE VALIDATION OUTPUT ===\n")
                
                if api_response:
                    try:
                        # Try to parse JSON response
                        date_result = json.loads(api_response)
                        return date_result
                    except json.JSONDecodeError:
                        # Try to extract JSON from markdown
                        import re
                        json_match = re.search(r'```(?:json)?\s*(\{[^`]+\})\s*```', api_response)
                        if json_match:
                            try:
                                date_result = json.loads(json_match.group(1))
                                return date_result
                            except json.JSONDecodeError:
                                pass
                        
                        return {"date_valid": False, "reason": "Could not parse LLM response"}
                
            return {"date_valid": False, "reason": "API call failed"}
            
        except Exception as e:
            print(f"Error in date validation: {e}")
            return {"date_valid": False, "reason": f"API error: {e}"}
    
    def validate_rate(self, pdf_text: str, vendor_name: str) -> Dict:
        """Validate rate type and amount from PDF against spreadsheet data."""
        if vendor_name not in self.vendor_data:
            return {"rate_valid": False, "reason": "Vendor not found in database"}
        
        vendor_info = self.vendor_data[vendor_name]
        rate_type = vendor_info.get('rate_type')
        rate_amount = vendor_info.get('rate_amount')
        
        # If no rate data in spreadsheet
        if not rate_type and not rate_amount:
            return {"rate_valid": None, "reason": "No rate data in database for this vendor"}
        
        # If rate type is variable or "as needed", pass automatically
        if rate_type and rate_type.lower() in ['variable', 'as needed']:
            return {
                "rate_valid": True, 
                "rate_type": rate_type,
                "reason": f"Rate type is '{rate_type}' - automatic pass",
                "is_variable": True
            }
        
        # For fixed rates (annual, monthly, etc.), validate amount with LLM
        if rate_type and rate_amount:
            return self._validate_rate_with_llm(pdf_text, rate_type, rate_amount)
        elif rate_amount and not rate_type:
            # Have amount but no type - try to validate amount
            return self._validate_rate_with_llm(pdf_text, "unknown", rate_amount)
        else:
            return {"rate_valid": None, "reason": f"Incomplete rate data - type: {rate_type}, amount: {rate_amount}"}
    
    def _validate_rate_with_llm(self, pdf_text: str, expected_rate_type: str, expected_amount: float) -> Dict:
        """Use LLM to extract and validate rate information from PDF."""
        if not self.amplify_api_url or not self.amplify_api_key:
            return {"rate_valid": False, "reason": "API not configured for rate validation"}
        
        # Calculate 5% tolerance
        tolerance = expected_amount * 0.05
        min_amount = expected_amount - tolerance
        max_amount = expected_amount + tolerance
        
        prompt = f"""You are an expert at extracting billing and rate information from invoice documents.

TASK: Extract rate/amount information from this invoice and validate it against expected values.

DOCUMENT TEXT:
{pdf_text}

EXPECTED RATE INFO:
- Type: {expected_rate_type}
- Amount: ${expected_amount:,.2f}
- Acceptable range: ${min_amount:,.2f} - ${max_amount:,.2f} (±5% tolerance)

INSTRUCTIONS:
1. Look for total amounts, line items, rates, fees, or billing amounts in the document
2. Pay attention to words like "total", "amount due", "invoice amount", "rate", "cost"
3. Extract all numeric amounts you find (convert to numbers)
4. Check if ANY amount falls within the acceptable range
5. Consider different billing periods if rate type is known (monthly, annual, etc.)
6. Look for both individual line items and total amounts

Return ONLY valid JSON in this exact format:
{{
  "amounts_found": [123.45, 678.90, ...],
  "rate_valid": true/false,
  "matching_amounts": [123.45, ...],
  "reason": "explanation of what was found and why it passed/failed"
}}"""

        try:
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.amplify_api_key}'
            }
            
            payload = {
                "data": {
                    "temperature": 0.3,
                    "max_tokens": 2000,
                    "dataSources": [],
                    "messages": [{"role": "user", "content": prompt}],
                    "options": {
                        "ragOnly": False,
                        "skipRag": True,
                        "model": {"id": "gpt-4o"},
                        "prompt": prompt,
                    },
                }
            }
            
            response = requests.post(self.amplify_api_url, headers=headers, data=json.dumps(payload), timeout=30)
            
            if response.status_code == 200:
                response_data = response.json()
                api_response = response_data.get("data", "")
                
                print(f"\n=== RATE VALIDATION LLM OUTPUT ===")
                print(api_response)
                print("=== END RATE VALIDATION OUTPUT ===\n")
                
                if api_response:
                    try:
                        # Try to parse JSON response
                        rate_result = json.loads(api_response)
                        rate_result['expected_amount'] = expected_amount
                        rate_result['expected_type'] = expected_rate_type
                        rate_result['tolerance_range'] = f"${min_amount:,.2f} - ${max_amount:,.2f}"
                        return rate_result
                    except json.JSONDecodeError:
                        # Try to extract JSON from markdown
                        import re
                        json_match = re.search(r'```(?:json)?\s*(\{[^`]+\})\s*```', api_response)
                        if json_match:
                            try:
                                rate_result = json.loads(json_match.group(1))
                                rate_result['expected_amount'] = expected_amount
                                rate_result['expected_type'] = expected_rate_type
                                rate_result['tolerance_range'] = f"${min_amount:,.2f} - ${max_amount:,.2f}"
                                return rate_result
                            except json.JSONDecodeError:
                                pass
                        
                        return {"rate_valid": False, "reason": "Could not parse LLM response"}
                
            return {"rate_valid": False, "reason": "API call failed"}
            
        except Exception as e:
            print(f"Error in rate validation: {e}")
            return {"rate_valid": False, "reason": f"API error: {e}"}

def main():
    """Main function to test the PDF vendor matcher."""
    excel_path = "Service Agreement Table (Rolling).xlsx"
    
    # Initialize matcher
    matcher = PDFVendorMatcher(excel_path)
    
    # Print loaded vendors for verification
    print("Loaded vendors:")
    for i, vendor in enumerate(matcher.vendor_list[:10]):  # Show first 10
        print(f"  {i+1}. {vendor}")
    if len(matcher.vendor_list) > 10:
        print(f"  ... and {len(matcher.vendor_list) - 10} more")
    
    # Test with available PDFs
    pdf_files = [f for f in os.listdir('.') if f.endswith('.pdf')]
    
    if not pdf_files:
        print("\nNo PDF files found in current directory")
        return
    
    # Process each PDF (with debug for first PDF only)
    for i, pdf_file in enumerate(pdf_files):
        result = matcher.process_pdf(pdf_file, debug=(i == 0))
        
        print("\n" + "="*60)
        print(f"VALIDATION RESULTS for {pdf_file}")
        print("="*60)
        
        if 'error' in result:
            print(f"[ERROR] {result['error']}")
            continue
        
        # Vendor identification
        if result.get('vendor'):
            print(f"[PASS] VENDOR: {result['vendor']}")
        else:
            print("[FAIL] VENDOR: No match found")
            continue
        
        # PO validation
        po_valid = result.get('po_valid')
        if po_valid is True:
            print(f"[PASS] PO NUMBER: Valid ({result.get('expected_po')})")
        elif po_valid is False:
            print(f"[FAIL] PO NUMBER: Invalid - Expected {result.get('expected_po')} but not found")
        else:
            print(f"[WARN] PO NUMBER: {result.get('po_reason', 'Unknown')}")
        
        # Date validation  
        date_valid = result.get('date_valid')
        if date_valid is True:
            valid_dates = result.get('valid_dates', [])
            print(f"[PASS] DATES: Valid - Found dates within contract period: {valid_dates}")
        elif date_valid is False:
            dates_found = result.get('dates_found', [])
            print(f"[FAIL] DATES: Invalid - Found dates: {dates_found}")
            print(f"        Reason: {result.get('date_reason', 'Unknown')}")
        else:
            print(f"[WARN] DATES: {result.get('date_reason', 'Unknown')}")
        
        # Rate validation
        rate_valid = result.get('rate_valid')
        if rate_valid is True:
            if result.get('is_variable_rate'):
                print(f"[PASS] RATE: Variable rate type - automatic pass")
            else:
                expected = result.get('expected_amount')
                found = result.get('amounts_found', [])
                print(f"[PASS] RATE: Valid - Expected ${expected:,.2f}, Found amounts: {found}")
        elif rate_valid is False:
            expected = result.get('expected_amount')
            found = result.get('amounts_found', [])
            print(f"[FAIL] RATE: Invalid - Expected ${expected:,.2f}, Found amounts: {found}")
            print(f"        Reason: {result.get('rate_reason', 'Unknown')}")
        else:
            print(f"[WARN] RATE: {result.get('rate_reason', 'Unknown')}")
        
        # Contact person
        contact = result.get('contact_person')
        role = result.get('contact_role')
        contact_reason = result.get('contact_reason')
        if contact and contact != 'Unknown':
            print(f"[CONTACT] {role}: {contact}")
            print(f"          Reason: {contact_reason}")
        else:
            print(f"[WARN] CONTACT: {contact_reason}")
        
        # Overall status
        all_passed = (po_valid is True and date_valid is True and rate_valid is True)
        any_failed = (po_valid is False or date_valid is False or rate_valid is False)
        
        if all_passed:
            print("\n[SUCCESS] OVERALL: INVOICE FULLY VALIDATED")
        elif any_failed:
            print("\n[FAILED] OVERALL: INVOICE VALIDATION FAILED")
        else:
            print("\n[PARTIAL] OVERALL: PARTIAL VALIDATION (some checks couldn't be performed)")
        
        print("="*60)

if __name__ == "__main__":
    main()