#!/usr/bin/env python3
"""
Invoice Validation System Demo
Demonstrates the automated validation of Oracle invoices against Excel spreadsheet data
"""

from invoice_validator import InvoiceValidator
import os

def run_demo():
    print("="*80)
    print("AUTOMATED INVOICE VALIDATION SYSTEM - DEMO")
    print("="*80)
    print()
    print("This demo validates Oracle invoices against service agreement data:")
    print("* Checks vendor name matches (Column A)")
    print("* Validates PO numbers (Column AG)")
    print("* Ensures invoice dates fall within PO date ranges (Columns AE & AF)")
    print("* Identifies admin and manager contacts (Columns E & I)")
    print()
    
    # Initialize validator
    validator = InvoiceValidator()
    
    # Find PDF files
    pdf_files = [f for f in os.listdir('.') if f.endswith('.pdf')]
    
    if not pdf_files:
        print("No PDF files found in current directory!")
        return
    
    print(f"Found {len(pdf_files)} invoice PDF files to validate:\n")
    
    results = []
    
    for pdf_file in pdf_files:
        print(f"Processing: {pdf_file}")
        result = validator.validate_invoice(pdf_file)
        results.append(result)
        print("-" * 60)
    
    # Summary report
    print("\n" + "="*80)
    print("FINAL VALIDATION SUMMARY")
    print("="*80)
    
    approved_count = 0
    rejected_count = 0
    
    for result in results:
        status = "APPROVED" if all([
            result['vendor_match'], 
            result['po_match'], 
            result['date_valid']
        ]) else "REJECTED"
        
        if status == "APPROVED":
            approved_count += 1
        else:
            rejected_count += 1
        
        print(f"\n>> {result['filename']}")
        print(f"   Status: {status}")
        print(f"   Admin: {result['admin']}")
        print(f"   Manager: {result['manager']}")
        
        if status == "REJECTED":
            print("   Issues:")
            if not result['vendor_match']:
                vendor = result['validation_details']['vendor']['extracted']
                print(f"     - Vendor '{vendor}' not found in agreements")
            if not result['po_match']:
                po = result['validation_details']['po']['extracted']
                print(f"     - PO '{po}' not found or invalid")
            if not result['date_valid']:
                print(f"     - Date validation failed")
    
    print(f"\n" + "="*80)
    print("PROCESS IMPROVEMENT RESULTS:")
    print(f"[+] {approved_count} invoices APPROVED for processing")
    print(f"[-] {rejected_count} invoices REJECTED (need manual review)")
    print(f"[*] Processing time: ~1 minute (vs 5-10 minutes manual)")
    print(f"[*] Automation achieved for {len(pdf_files)} invoices")
    
    if approved_count > 0:
        print(f"\nNext steps for approved invoices:")
        print(f"1. Send approval emails to managers and admins")
        print(f"2. Await work completion confirmation")
        print(f"3. Process in Oracle system")
    
    if rejected_count > 0:
        print(f"\nRejected invoices require:")
        print(f"1. Manual review by financial unit managers")
        print(f"2. Vendor/PO verification")
        print(f"3. Date range confirmation")

if __name__ == "__main__":
    run_demo()