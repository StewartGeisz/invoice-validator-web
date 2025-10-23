// Test all three PDFs with proper abstract extraction logic

// Simulate proper PDF content extraction for ALL files
function extractPDFContent(filename) {
  let mockText = '';
  
  if (filename.includes('John Bouchard')) {
    mockText = 'INVOICE NO: 25-23487\nInvoice Date: Page.\n6/27/2025 1 of 1\nJOHN BOUCHARD & SONS CO.\nPO Number: Customer Number:\nP25003990 22022';
  } else if (filename.includes('Mid South')) {
    mockText = 'Invoice Date: 8/23/2025\nPO Number: P26003063';
  } else if (filename.includes('Budd')) {
    mockText = 'Invoice # 230006\nDate 8/31/2025\nPO # P26000686\nMemo August 2025';
  }
  
  // Extract PO using same patterns as Python script
  let po_number = null;
  const po_patterns = [
    /P\.?\s*O\.?\s*(?:Number|No\.?|#)?\s*:?\s*([P]?\d{8}(?:[_\-]\d+)?)/i,
    /PO\s*#?\s*:?\s*([P]?\d{8}(?:[_\-]\d+)?)/i,
    /([P]\d{8}(?:[_\-]\d+)?)/i,
  ];
  
  for (const pattern of po_patterns) {
    const match = mockText.match(pattern);
    if (match) {
      let po = match[1].trim();
      if (po.match(/^\d{8}$/)) {
        po = 'P' + po;
      }
      po_number = po;
      break;
    }
  }
  
  // Extract date using same patterns as Python script
  let invoice_date = null;
  const date_patterns = [
    /(?:Invoice\s+Date|Date)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
  ];
  
  for (const pattern of date_patterns) {
    const matches = mockText.match(pattern);
    if (matches) {
      const date_str = matches[1];
      try {
        const parsed = new Date(date_str);
        if (parsed.getFullYear() >= 2020) {
          invoice_date = parsed.toISOString().split('T')[0];
          break;
        }
      } catch (error) {
        continue;
      }
    }
  }
  
  return { po_number, invoice_date };
}

// Simulate Excel data (based on your Python script output)
const excelData = [
  { 
    "Vendor": "John Bouchard & Sons (Inspections)", 
    "Current PO": "P26000156", 
    "PO Start": "2025-07-01 00:00:00", 
    "PO End": "2026-06-30 00:00:00" 
  },
  { 
    "Vendor": "John Bouchard & Sons (repairs)", 
    "Current PO": "P25063542", 
    "PO Start": "2025-07-01 00:00:00", 
    "PO End": "2026-06-30 00:00:00" 
  },
  {
    "Vendor": "Mid South", 
    "Current PO": "P26003063", 
    "PO Start": "2025-07-01 00:00:00", 
    "PO End": "2026-06-30 00:00:00" 
  },
  {
    "Vendor": "The Budd Group", 
    "Current PO": "P26000686", 
    "PO Start": "2025-07-01 00:00:00", 
    "PO End": "2026-06-30 00:00:00" 
  }
];

function testValidation(filename) {
  console.log(`\n=== TESTING: ${filename} ===`);
  
  // Extract PDF content using abstract logic
  const pdfContent = extractPDFContent(filename);
  const extractedPO = pdfContent.po_number;
  const extractedDate = pdfContent.invoice_date;
  
  console.log(`PDF Content PO: ${extractedPO}`);
  console.log(`PDF Content Date: ${extractedDate}`);
  
  // Test PO validation
  const cleanExtractedPO = extractedPO ? extractedPO.replace('P', '').replace('_', '').replace('-', '') : null;
  console.log(`Cleaned PO: ${cleanExtractedPO}`);
  
  let poMatch = null;
  if (cleanExtractedPO) {
    for (const row of excelData) {
      if (!row['Current PO']) continue;
      const cleanExcelPO = String(row['Current PO']).replace('P', '').replace('_', '').replace('-', '');
      
      if (cleanExtractedPO === cleanExcelPO) {
        poMatch = row;
        console.log(`  ✅ PO Match: PASS - ${extractedPO} matches ${poMatch['Current PO']}`);
        break;
      }
    }
  }
  
  if (!poMatch) {
    console.log(`  ❌ PO Match: FAIL - ${extractedPO} not found in Excel`);
    return;
  }
  
  // Test date validation
  const invoiceDate = new Date(extractedDate);
  const startDate = new Date(poMatch['PO Start']);
  const endDate = new Date(poMatch['PO End']);
  
  console.log(`  Date Range: ${startDate.toDateString()} to ${endDate.toDateString()}`);
  console.log(`  Invoice Date: ${invoiceDate.toDateString()}`);
  
  if (invoiceDate >= startDate && invoiceDate <= endDate) {
    console.log(`  ✅ Date Range: PASS`);
    console.log(`  🎯 OVERALL: APPROVED`);
  } else {
    console.log(`  ❌ Date Range: FAIL - outside range`);
    console.log(`  🎯 OVERALL: REJECTED`);
  }
}

// Test all three files
console.log("TESTING ALL PDFs WITH ABSTRACT LOGIC");
console.log("=" .repeat(50));

testValidation("25-23487 John Bouchard P25063542.pdf");
testValidation("12628 Mid South P26003063.pdf");
testValidation("230006 The Budd Group P26000686.pdf");