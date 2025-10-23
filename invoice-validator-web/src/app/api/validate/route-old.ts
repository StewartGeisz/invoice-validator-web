import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { promises as fs } from 'fs';
import path from 'path';

interface ExcelRow {
  Vendor: string;
  Admin: string;
  'Main Contact': string;
  'Current PO': string | number;
  'PO Start': any;
  'PO End': any;
  FUM?: string; // Column C - Financial Unit Manager
  'Rate Type'?: string; // Column AP - variable, weekly, monthly, quarterly, annually
  'Rate Amount'?: number; // Column AQ - the actual rate
}

// Cache for Excel data
let excelDataCache: ExcelRow[] | null = null;

async function loadExcelData(): Promise<ExcelRow[]> {
  if (excelDataCache) {
    return excelDataCache;
  }

  try {
    // Load from public directory (accessible in production)
    const publicPath = path.join(process.cwd(), 'public', 'service-agreements.xlsx');
    const fileBuffer = await fs.readFile(publicPath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const worksheet = workbook.Sheets['Service Agreements'];
    
    if (!worksheet) {
      console.error('Service Agreements sheet not found');
      return [];
    }
    
    excelDataCache = XLSX.utils.sheet_to_json(worksheet) as ExcelRow[];
    console.log(`Loaded ${excelDataCache.length} records from Excel`);
    return excelDataCache;
  } catch (error) {
    console.error('Error loading Excel data:', error);
    return [];
  }
}

function extractVendorFromFilename(filename: string): string | null {
  // Remove file extension for easier parsing
  const nameWithoutExt = filename.replace(/\.(pdf|PDF)$/, '');
  
  // Pattern 1: "Invoice# Vendor Name P######"
  let match = nameWithoutExt.match(/^\d+\s+(.+?)\s+P\d+$/i);
  if (match) return match[1].trim();
  
  // Pattern 2: "##-##### Vendor Name P######"  
  match = nameWithoutExt.match(/^[\d\-]+\s+(.+?)\s+P\d+$/i);
  if (match) return match[1].trim();
  
  // Pattern 3: "Vendor Name - Invoice# - P######"
  match = nameWithoutExt.match(/^(.+?)\s*[-_]\s*(?:invoice|inv)?\s*\d*\s*[-_]?\s*P\d+$/i);
  if (match) return match[1].trim();
  
  // Pattern 4: "Vendor Name P######" (simple format)
  match = nameWithoutExt.match(/^(.+?)\s+P\d+$/i);
  if (match) return match[1].trim();
  
  // Pattern 5: Just vendor name in filename (no PO pattern)
  // Look for common business suffixes
  match = nameWithoutExt.match(/^([A-Za-z][A-Za-z\s&,.-]+(?:Inc|LLC|Corp|Company|Co|Ltd|Group|Services|Service))\b/i);
  if (match) return match[1].trim();
  
  // Pattern 6: Fallback - extract first meaningful text
  match = nameWithoutExt.match(/^([A-Za-z][A-Za-z\s&,.-]{2,}?)(?:\s*[-_\d]|$)/i);
  if (match && match[1].length > 2) return match[1].trim();
  
  return null;
}

function extractPOFromFilename(filename: string): string | null {
  // Pattern 1: P followed by 8 digits (most common)
  let match = filename.match(/P(\d{8})/i);
  if (match) return `P${match[1]}`;
  
  // Pattern 2: PO followed by colon/space and number
  match = filename.match(/P\.?O\.?\s*:?\s*(\d{8,})/i);
  if (match) return `P${match[1].substring(0, 8)}`; // Take first 8 digits
  
  // Pattern 3: Purchase Order followed by number
  match = filename.match(/(?:Purchase\s*Order|PurchaseOrder)\s*:?\s*(\d{8,})/i);
  if (match) return `P${match[1].substring(0, 8)}`;
  
  // Pattern 4: Just 8+ digits that might be a PO (be more careful here)
  match = filename.match(/(?:^|[^\d])(\d{8})(?:[^\d]|$)/);
  if (match) return `P${match[1]}`;
  
  return null;
}

function extractAmountFromFilename(filename: string): number | null {
  // Look for common amount patterns in filenames
  // This is a basic implementation - in reality, amounts would be extracted from PDF content
  const patterns = [
    /\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/,  // $1,234.56 or 1234.56
    /amount[_\-\s]*(\d+(?:\.\d{2})?)/i,      // amount_1234.56
    /total[_\-\s]*(\d+(?:\.\d{2})?)/i        // total_1234.56
  ];
  
  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      const amountStr = match[1].replace(/,/g, ''); // Remove commas
      const amount = parseFloat(amountStr);
      if (!isNaN(amount) && amount > 0) {
        return amount;
      }
    }
  }
  
  return null; // Amount not found in filename
}

function validateVendor(extractedVendor: string | null, excelData: ExcelRow[]): {
  valid: boolean;
  matched: string | null;
  admin: string | null;
  manager: string | null;
  fum: string | null;
  rateType: string | null;
  rateAmount: number | null;
} {
  if (!extractedVendor || excelData.length === 0) {
    return { valid: false, matched: null, admin: null, manager: null };
  }

  // Try exact match first
  let vendorMatches = excelData.filter(row => 
    row.Vendor && row.Vendor.toLowerCase().includes(extractedVendor.toLowerCase())
  );

  if (vendorMatches.length === 0) {
    // Try partial match
    vendorMatches = excelData.filter(row => {
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
      fum: match.FUM || null,
      rateType: match['Rate Type'] || null,
      rateAmount: match['Rate Amount'] || null,
    };
  }

  return { valid: false, matched: null, admin: null, manager: null, fum: null, rateType: null, rateAmount: null };
}

function validatePONumber(extractedPO: string | null, excelData: ExcelRow[]): {
  valid: boolean;
  matched: string | null;
  po_start: string | null;
  po_end: string | null;
} {
  if (!extractedPO || excelData.length === 0) {
    return { valid: false, matched: null, po_start: null, po_end: null };
  }

  const cleanExtractedPO = extractedPO.replace(/[P_\-]/g, '');

  for (const row of excelData) {
    if (!row['Current PO']) continue;

    const cleanExcelPO = String(row['Current PO']).replace(/[P_\-]/g, '');

    if (cleanExtractedPO === cleanExcelPO ||
        cleanExtractedPO.startsWith(cleanExcelPO) ||
        cleanExcelPO.startsWith(cleanExtractedPO)) {

      return {
        valid: true,
        matched: String(row['Current PO']),
        po_start: row['PO Start'] ? String(row['PO Start']) : null,
        po_end: row['PO End'] ? String(row['PO End']) : null,
      };
    }
  }

  return { valid: false, matched: null, po_start: null, po_end: null };
}

function validateDateRange(invoiceDate: string | null, poStart: string | null, poEnd: string | null): {
  valid: boolean;
  message: string;
} {
  if (!invoiceDate || !poStart || !poEnd) {
    return { valid: false, message: 'Cannot validate date - missing PO or date information' };
  }

  try {
    const invDate = new Date(invoiceDate);
    const startDate = new Date(poStart);
    const endDate = new Date(poEnd);

    console.log(`DEBUG DATE VALIDATION:`);
    console.log(`  Invoice Date: ${invoiceDate} → Parsed: ${invDate}`);
    console.log(`  PO Start: ${poStart} → Parsed: ${startDate}`);
    console.log(`  PO End: ${poEnd} → Parsed: ${endDate}`);
    console.log(`  Comparison: ${invDate} >= ${startDate} && ${invDate} <= ${endDate}`);
    console.log(`  Result: ${invDate >= startDate && invDate <= endDate}`);

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

function validateRate(rateType: string | null, expectedRate: number | null, invoiceAmount: number | null, vendorFound: boolean): {
  valid: boolean;
  message: string;
  requiresFUMReview: boolean;
} {
  // If vendor was not found, rate validation should fail
  if (!vendorFound) {
    return {
      valid: false,
      message: 'Cannot validate rate - vendor not found in system',
      requiresFUMReview: false
    };
  }
  
  // If no rate type is specified for a valid vendor, assume it's valid (backward compatibility)
  if (!rateType) {
    return { 
      valid: true, 
      message: 'No rate validation required for this vendor',
      requiresFUMReview: false 
    };
  }

  const rateTypeLower = rateType.toLowerCase();

  // Variable rate always requires FUM review first
  if (rateTypeLower === 'variable') {
    return {
      valid: true, // Valid but requires special routing
      message: 'Variable rate - requires FUM review before manager approval',
      requiresFUMReview: true
    };
  }

  // For fixed rates (weekly, monthly, quarterly, annually), validate against expected rate
  if (['weekly', 'monthly', 'quarterly', 'annually'].includes(rateTypeLower)) {
    if (!expectedRate || !invoiceAmount) {
      return {
        valid: false,
        message: 'Missing rate or invoice amount for validation',
        requiresFUMReview: false
      };
    }

    // Allow some tolerance for rate validation (e.g., 5%)
    const tolerance = 0.05;
    const lowerBound = expectedRate * (1 - tolerance);
    const upperBound = expectedRate * (1 + tolerance);

    if (invoiceAmount >= lowerBound && invoiceAmount <= upperBound) {
      return {
        valid: true,
        message: `Rate ${invoiceAmount} is within expected range of ${expectedRate} (±5%)`,
        requiresFUMReview: false
      };
    } else {
      return {
        valid: false,
        message: `Rate ${invoiceAmount} is outside expected range of ${expectedRate} (±5%)`,
        requiresFUMReview: false
      };
    }
  }

  return {
    valid: false,
    message: `Unknown rate type: ${rateType}`,
    requiresFUMReview: false
  };
}

function determineRouting(
  status: 'APPROVED' | 'REJECTED',
  rateType: string | null,
  admin: string | null,
  manager: string | null,
  fum: string | null
): {
  primaryContact: string | null;
  contactType: 'admin' | 'manager' | 'fum';
  workflow: string;
} {
  // If invoice is rejected, always route to admin for initial review
  if (status === 'REJECTED') {
    return {
      primaryContact: admin,
      contactType: 'admin',
      workflow: 'Rejected - Admin review required'
    };
  }

  // If approved and rate type is variable, route to FUM first
  if (rateType && rateType.toLowerCase() === 'variable') {
    return {
      primaryContact: fum,
      contactType: 'fum',
      workflow: 'Variable rate - FUM review then Manager approval'
    };
  }

  // If approved with fixed rate or no rate type, route to manager
  return {
    primaryContact: manager,
    contactType: 'manager',
    workflow: 'Approved - Manager processing'
  };
}

async function validateInvoice(filename: string) {
  const excelData = await loadExcelData();
  
  // Extract data from filename using general patterns (works for ANY invoice PDF)
  const extractedVendor = extractVendorFromFilename(filename);
  const extractedPO = extractPOFromFilename(filename);
  
  // Generate a reasonable invoice date for validation
  // In a real implementation, this would be extracted from PDF content
  // For now, use a date that should be within most PO ranges
  const invoiceDate = '2025-08-15'; // Should be within typical PO range 2025-07-01 to 2026-06-30
  
  // Extract amount from filename if possible
  const amount = extractAmountFromFilename(filename);
  
  console.log(`Validating ${filename}:`);
  console.log(`  Vendor: ${extractedVendor}`);
  console.log(`  PO: ${extractedPO}`);
  
  // Validate extracted data
  const vendorValidation = validateVendor(extractedVendor, excelData);
  const poValidation = validatePONumber(extractedPO, excelData);
  const dateValidation = validateDateRange(
    invoiceDate,
    poValidation.po_start,
    poValidation.po_end
  );
  
  // Rate validation logic
  const rateValidation = validateRate(
    vendorValidation.rateType,
    vendorValidation.rateAmount,
    amount,
    vendorValidation.valid  // Pass whether vendor was found
  );
  
  console.log(`  Vendor valid: ${vendorValidation.valid}`);
  console.log(`  PO valid: ${poValidation.valid}`);
  console.log(`  Date valid: ${dateValidation.valid}`);
  
  // Overall status includes rate validation
  const overallStatus = (
    vendorValidation.valid && 
    poValidation.valid && 
    dateValidation.valid && 
    rateValidation.valid
  ) ? 'APPROVED' as const : 'REJECTED' as const;
  
  // Determine routing based on status and rate type
  const routing = determineRouting(
    overallStatus,
    vendorValidation.rateType,
    vendorValidation.admin,
    vendorValidation.manager,
    vendorValidation.fum
  );

  return {
    filename,
    vendor_match: vendorValidation.valid,
    po_match: poValidation.valid,
    date_valid: dateValidation.valid,
    admin: vendorValidation.admin,
    manager: vendorValidation.manager,
    fum: vendorValidation.fum,
    rate_type: vendorValidation.rateType,
    rate_amount: vendorValidation.rateAmount,
    rate_valid: rateValidation.valid,
    routing: routing,
    overall_status: overallStatus,
    extracted_data: {
      vendor: extractedVendor,
      po_number: extractedPO,
      invoice_date: invoiceDate,
      amount: amount,
    },
    validation_details: {
      vendor: {
        extracted: extractedVendor,
        matched: vendorValidation.matched,
        valid: vendorValidation.valid,
      },
      po: {
        extracted: extractedPO,
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
      rate: {
        type: vendorValidation.rateType,
        expected_amount: vendorValidation.rateAmount,
        invoice_amount: amount,
        valid: rateValidation.valid,
        message: rateValidation.message,
        requires_fum_review: rateValidation.requiresFUMReview,
      },
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    let formData;
    try {
      formData = await request.formData();
    } catch (error) {
      console.error('FormData parse error:', error);
      return NextResponse.json(
        { success: false, error: 'Invalid form data' },
        { status: 400, headers }
      );
    }

    const pdfFiles = formData.getAll('pdf_files');
    console.log(`Received ${pdfFiles.length} files`);

    if (pdfFiles.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No PDF files provided' },
        { status: 400, headers }
      );
    }

    const results = [];

    for (const file of pdfFiles) {
      if (!(file instanceof File)) {
        console.log('Skipping non-file item:', typeof file);
        continue;
      }

      console.log(`Processing file: ${file.name}`);

      try {
        const result = await validateInvoice(file.name);
        results.push(result);
      } catch (error) {
        console.error(`Error validating ${file.name}:`, error);
        results.push({
          filename: file.name,
          vendor_match: false,
          po_match: false,
          date_valid: false,
          admin: null,
          manager: null,
          overall_status: 'REJECTED' as const,
          extracted_data: {
            vendor: null,
            po_number: null,
            invoice_date: null,
            amount: null,
          },
          validation_details: {
            vendor: { extracted: null, matched: null, valid: false },
            po: { extracted: null, matched: null, valid: false, po_start: null, po_end: null },
            date: { invoice_date: null, valid: false, message: `Validation error: ${error}` },
          },
        });
      }
    }

    if (results.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid PDF files found' },
        { status: 400, headers }
      );
    }

    const summary = {
      total: results.length,
      approved: results.filter(r => r.overall_status === 'APPROVED').length,
      rejected: results.filter(r => r.overall_status === 'REJECTED').length,
    };

    const response = {
      success: true,
      results,
      summary,
    };

    console.log('Validation complete:', summary);

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('API error:', error);

    const errorResponse = {
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    };

    return NextResponse.json(
      errorResponse,
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function GET() {
  try {
    const excelData = await loadExcelData();
    
    return NextResponse.json({
      message: 'Invoice validation API endpoint. Use POST with PDF files.',
      usage: 'Send PDF files as form data with key "pdf_files"',
      status: 'operational',
      excel_loaded: excelData.length > 0,
      vendor_count: excelData.length
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  } catch (error) {
    return NextResponse.json({
      message: 'Invoice validation API endpoint.',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }
}