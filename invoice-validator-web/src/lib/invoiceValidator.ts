// TypeScript version of our invoice validator
// This will be used server-side with the built-in Excel file

import * as XLSX from 'xlsx';
import { promises as fs } from 'fs';
import path from 'path';

interface ValidationResult {
  filename: string;
  vendor_match: boolean;
  po_match: boolean;
  date_valid: boolean;
  admin: string | null;
  manager: string | null;
  overall_status: 'APPROVED' | 'REJECTED';
  extracted_data: {
    vendor: string | null;
    po_number: string | null;
    invoice_date: string | null;
    amount: number | null;
  };
  validation_details: {
    vendor: {
      extracted: string | null;
      matched: string | null;
      valid: boolean;
    };
    po: {
      extracted: string | null;
      matched: string | null;
      valid: boolean;
      po_start: string | null;
      po_end: string | null;
    };
    date: {
      invoice_date: string | null;
      valid: boolean;
      message: string;
    };
  };
}

interface ExcelRow {
  Vendor: string;
  Admin: string;
  'Main Contact': string;
  'Current PO': string;
  'PO Start': any;
  'PO End': any;
}

export class InvoiceValidator {
  private excelData: ExcelRow[] = [];
  
  constructor() {
    this.loadExcelData();
  }
  
  private async loadExcelData() {
    try {
      const excelPath = path.join(process.cwd(), 'src', 'data', 'Service Agreement Table.xlsx');
      const fileBuffer = await fs.readFile(excelPath);
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const worksheet = workbook.Sheets['Service Agreements'];
      
      if (!worksheet) {
        console.error('Service Agreements sheet not found');
        return;
      }
      
      this.excelData = XLSX.utils.sheet_to_json(worksheet) as ExcelRow[];
      console.log(`Loaded ${this.excelData.length} records from Excel`);
    } catch (error) {
      console.error('Error loading Excel data:', error);
    }
  }
  
  extractVendorName(filename: string, text: string): string | null {
    // Extract from filename first (most reliable)
    const filenameMatch = filename.match(/^\d+\s+(.+?)\s+P\d+\.pdf$/i);
    if (filenameMatch) {
      return filenameMatch[1].trim();
    }
    
    const filenameMatch2 = filename.match(/^[\d\-]+\s+(.+?)\s+P\d+\.pdf$/i);
    if (filenameMatch2) {
      return filenameMatch2[1].trim();
    }
    
    // Fallback to text patterns
    const patterns = [
      /JOHN BOUCHARD & SONS CO\./i,
      /([A-Z][A-Z\s&,.-]+CO\.?)/,
      /(?:FROM|VENDOR|SUPPLIER|COMPANY):\s*(.+?)(?:\n|$)/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const vendor = match[1]?.trim() || match[0].trim();
        if (vendor.length > 3) {
          return vendor;
        }
      }
    }
    
    return null;
  }
  
  extractPONumber(text: string): string | null {
    const patterns = [
      /P\.?\s*O\.?\s*(?:Number|No\.?|#)?\s*:?\s*([P]?\d{8}(?:[_\-]\d+)?)/i,
      /PO\s*#?\s*:?\s*([P]?\d{8}(?:[_\-]\d+)?)/i,
      /P\.O\.\s+No\.\s+([P]?\d{8}(?:[_\-]\d+)?)/i,
      /([P]\d{8}(?:[_\-]\d+)?)/g,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let po = match[1].trim();
        if (/^\d{8}/.test(po)) {
          po = 'P' + po;
        } else if (!/^P/.test(po) && po.length >= 8) {
          po = 'P' + po;
        }
        return po;
      }
    }
    
    return null;
  }
  
  extractInvoiceDate(text: string): string | null {
    const patterns = [
      /(?:Invoice\s+Date|Date)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g,
    ];
    
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const dateStr of matches) {
          const formats = ['MM/dd/yyyy', 'MM-dd-yyyy', 'MM/dd/yy', 'MM-dd-yy'];
          for (const fmt of formats) {
            try {
              const date = new Date(dateStr);
              if (date.getFullYear() >= 2020) {
                return date.toISOString().split('T')[0];
              }
            } catch {
              continue;
            }
          }
        }
      }
    }
    
    return null;
  }
  
  extractAmount(text: string): number | null {
    const patterns = [
      /Total\s*(?:Due|Amount)?\s*:?\s*\$?\s*(\d{1,3}(?:,\d{3})*\.?\d{0,2})/i,
      /Amount\s*:?\s*\$?\s*(\d{1,3}(?:,\d{3})*\.?\d{0,2})/i,
    ];
    
    const amounts: number[] = [];
    
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const amtStr of matches) {
          try {
            const amt = parseFloat(amtStr.replace(/,/g, ''));
            if (!isNaN(amt)) {
              amounts.push(amt);
            }
          } catch {
            continue;
          }
        }
      }
    }
    
    return amounts.length > 0 ? Math.max(...amounts) : null;
  }
  
  validateVendor(extractedVendor: string | null): {
    valid: boolean;
    matched: string | null;
    admin: string | null;
    manager: string | null;
  } {
    if (!extractedVendor || this.excelData.length === 0) {
      return { valid: false, matched: null, admin: null, manager: null };
    }
    
    // Try exact match first
    let vendorMatches = this.excelData.filter(row => 
      row.Vendor && row.Vendor.toLowerCase().includes(extractedVendor.toLowerCase())
    );
    
    if (vendorMatches.length === 0) {
      // Try partial match
      vendorMatches = this.excelData.filter(row => {
        if (!row.Vendor) return false;
        return extractedVendor.toLowerCase().includes(row.Vendor.toLowerCase()) ||
               row.Vendor.toLowerCase().includes(extractedVendor.toLowerCase());
      });
    }
    
    if (vendorMatches.length > 0) {
      const match = vendorMatches[0];
      return {
        valid: true,
        matched: match.Vendor,
        admin: match.Admin || null,
        manager: match['Main Contact'] || null,
      };
    }
    
    return { valid: false, matched: null, admin: null, manager: null };
  }
  
  validatePONumber(extractedPO: string | null): {
    valid: boolean;
    matched: string | null;
    po_start: string | null;
    po_end: string | null;
  } {
    if (!extractedPO || this.excelData.length === 0) {
      return { valid: false, matched: null, po_start: null, po_end: null };
    }
    
    const cleanExtractedPO = extractedPO.replace(/[P_\-]/g, '');
    
    for (const row of this.excelData) {
      if (!row['Current PO']) continue;
      
      const cleanExcelPO = String(row['Current PO']).replace(/[P_\-]/g, '');
      
      if (cleanExtractedPO === cleanExcelPO ||
          cleanExtractedPO.startsWith(cleanExcelPO) ||
          cleanExcelPO.startsWith(cleanExtractedPO)) {
        
        return {
          valid: true,
          matched: row['Current PO'],
          po_start: row['PO Start'] ? String(row['PO Start']) : null,
          po_end: row['PO End'] ? String(row['PO End']) : null,
        };
      }
    }
    
    return { valid: false, matched: null, po_start: null, po_end: null };
  }
  
  validateDateRange(invoiceDate: string | null, poStart: string | null, poEnd: string | null): {
    valid: boolean;
    message: string;
  } {
    if (!invoiceDate || !poStart || !poEnd) {
      return { valid: false, message: 'Missing date information' };
    }
    
    try {
      const invDate = new Date(invoiceDate);
      const startDate = new Date(poStart);
      const endDate = new Date(poEnd);
      
      if (invDate >= startDate && invDate <= endDate) {
        return {
          valid: true,
          message: `Date ${invoiceDate} is within range ${poStart} to ${poEnd}`,
        };
      } else {
        return {
          valid: false,
          message: `Date ${invoiceDate} is outside range ${poStart} to ${poEnd}`,
        };
      }
    } catch (error) {
      return { valid: false, message: `Date validation error: ${error}` };
    }
  }
  
  async validateInvoice(filename: string, pdfText: string): Promise<ValidationResult> {
    // Ensure Excel data is loaded
    if (this.excelData.length === 0) {
      await this.loadExcelData();
    }
    
    // Extract data from PDF text
    const vendor = this.extractVendorName(filename, pdfText);
    const poNumber = this.extractPONumber(pdfText);
    const invoiceDate = this.extractInvoiceDate(pdfText);
    const amount = this.extractAmount(pdfText);
    
    // Validate extracted data
    const vendorValidation = this.validateVendor(vendor);
    const poValidation = this.validatePONumber(poNumber);
    const dateValidation = this.validateDateRange(
      invoiceDate,
      poValidation.po_start,
      poValidation.po_end
    );
    
    const overallStatus = vendorValidation.valid && poValidation.valid && dateValidation.valid
      ? 'APPROVED' as const
      : 'REJECTED' as const;
    
    return {
      filename,
      vendor_match: vendorValidation.valid,
      po_match: poValidation.valid,
      date_valid: dateValidation.valid,
      admin: vendorValidation.admin,
      manager: vendorValidation.manager,
      overall_status: overallStatus,
      extracted_data: {
        vendor,
        po_number: poNumber,
        invoice_date: invoiceDate,
        amount,
      },
      validation_details: {
        vendor: {
          extracted: vendor,
          matched: vendorValidation.matched,
          valid: vendorValidation.valid,
        },
        po: {
          extracted: poNumber,
          matched: poValidation.matched,
          valid: poValidation.valid,
          po_start: poValidation.po_start,
          po_end: poValidation.po_end,
        },
        date: {
          invoice_date: invoiceDate,
          valid: dateValidation.valid,
          message: dateValidation.message,
        },
      },
    };
  }
}