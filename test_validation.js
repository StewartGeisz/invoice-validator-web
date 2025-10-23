// Simple test to verify our validation logic

// Simulate the PDF content extraction
const pdfContent = {
  "John Bouchard": { po_number: "P25003990", invoice_date: "2025-06-27" },
  "Mid South": { po_number: "P26003063", invoice_date: "2025-08-23" }
};

// Simulate Excel data (based on your Python script output)
const excelData = [
  { 
    "Vendor": "John Bouchard & Sons (Inspections)", 
    "Current PO": "P26000156", 
    "PO Start": "45839", 
    "PO End": "46203" 
  },
  { 
    "Vendor": "John Bouchard & Sons (repairs)", 
    "Current PO": "P25063542", 
    "PO Start": "45839", 
    "PO End": "46203" 
  },
  {
    "Vendor": "Mid South", 
    "Current PO": "P26003063", 
    "PO Start": "45839", 
    "PO End": "46203" 
  }
];

function testValidation(filename) {
  console.log(`\n=== TESTING: ${filename} ===`);
  
  // Extract PDF content
  let fileKey = null;
  if (filename.includes('John Bouchard')) fileKey = 'John Bouchard';
  if (filename.includes('Mid South')) fileKey = 'Mid South';
  
  const extractedPO = fileKey ? pdfContent[fileKey].po_number : null;
  const extractedDate = fileKey ? pdfContent[fileKey].invoice_date : null;
  
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
      console.log(`  Checking against Excel PO: ${row['Current PO']} → cleaned: ${cleanExcelPO}`);
      
      if (cleanExtractedPO === cleanExcelPO) {
        poMatch = row;
        console.log(`  ✅ PO Match found!`);
        break;
      }
    }
  }
  
  if (!poMatch) {
    console.log(`  ❌ PO Match: FAIL - ${extractedPO} not found in Excel`);
  } else {
    console.log(`  ✅ PO Match: PASS - ${extractedPO} matches ${poMatch['Current PO']}`);
    
    // Test date validation
    const invoiceDate = new Date(extractedDate);
    const startSerial = Number(poMatch['PO Start']);
    const endSerial = Number(poMatch['PO End']);
    
    // Convert Excel serial dates
    const excelEpoch = new Date(1899, 11, 30);
    const startDate = new Date(excelEpoch.getTime() + startSerial * 24 * 60 * 60 * 1000);
    const endDate = new Date(excelEpoch.getTime() + endSerial * 24 * 60 * 60 * 1000);
    
    console.log(`  Date Range: ${startDate.toDateString()} to ${endDate.toDateString()}`);
    console.log(`  Invoice Date: ${invoiceDate.toDateString()}`);
    
    if (invoiceDate >= startDate && invoiceDate <= endDate) {
      console.log(`  ✅ Date Range: PASS`);
    } else {
      console.log(`  ❌ Date Range: FAIL - outside range`);
    }
  }
}

// Test both files
testValidation("25-23487 John Bouchard P25063542.pdf");
testValidation("12628 Mid South P26003063.pdf");