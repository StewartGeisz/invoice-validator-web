const fs = require('fs');
const pdfParse = require('pdf-parse').default || require('pdf-parse');

async function testPDFExtraction(filename) {
  try {
    console.log(`\n=== Testing Real PDF Extraction: ${filename} ===`);
    
    // Read PDF file
    const buffer = fs.readFileSync(filename);
    
    // Extract text using pdf-parse
    const pdfData = await pdfParse(buffer);
    const extractedText = pdfData.text;
    
    console.log('📄 Raw PDF text (first 500 chars):');
    console.log(extractedText.substring(0, 500));
    
    // Extract PO using same patterns as the updated web API
    let po_number = null;
    const po_patterns = [
      /P\.?\s*O\.?\s*(?:Number|No\.?|#)?\s*:?\s*([P]?\d{8}(?:[_\-]\d+)?)/i,
      /PO\s*#?\s*:?\s*([P]?\d{8}(?:[_\-]\d+)?)/i,
      /Purchase\s*Order\s*:?\s*([P]?\d{8}(?:[_\-]\d+)?)/i,
      /([P]\d{8}(?:[_\-]\d+)?)/i,  // Direct PO pattern
    ];
    
    for (const pattern of po_patterns) {
      const match = extractedText.match(pattern);
      if (match) {
        let po = match[1].trim();
        if (po.match(/^\d{8}$/)) {
          po = 'P' + po;
        } else if (!po.startsWith('P') && po.match(/^\d{8}/)) {
          po = 'P' + po;
        }
        po_number = po;
        console.log(`✅ Found PO with pattern: ${pattern} → ${po_number}`);
        break;
      }
    }
    
    // Extract date using same patterns as the updated web API
    let invoice_date = null;
    const date_patterns = [
      /(?:Invoice\s+Date|Date)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /Date\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g,
    ];
    
    for (const pattern of date_patterns) {
      let matches;
      if (pattern.global) {
        matches = Array.from(extractedText.matchAll(pattern));
      } else {
        const match = extractedText.match(pattern);
        matches = match ? [match] : [];
      }
      
      for (const match of matches) {
        const date_str = match[1];
        try {
          const parsed = new Date(date_str);
          if (parsed.getFullYear() >= 2020 && parsed.getFullYear() <= 2030) {
            invoice_date = parsed.toISOString().split('T')[0];
            console.log(`✅ Found date with pattern: ${pattern} → ${date_str} → ${invoice_date}`);
            break;
          }
        } catch (error) {
          continue;
        }
      }
      
      if (invoice_date) break;
    }
    
    console.log('\n📄 Final Extraction Results:');
    console.log(`  PO Number: ${po_number}`);
    console.log(`  Invoice Date: ${invoice_date}`);
    
    return { po_number, invoice_date };
    
  } catch (error) {
    console.error('PDF extraction error:', error);
    return { po_number: null, invoice_date: null };
  }
}

// Test all three PDFs
async function testAll() {
  const files = [
    '25-23487 John Bouchard P25063542.pdf',
    '12628 Mid South P26003063.pdf', 
    '230006 The Budd Group P26000686.pdf'
  ];
  
  for (const file of files) {
    if (fs.existsSync(file)) {
      await testPDFExtraction(file);
    } else {
      console.log(`\n❌ File not found: ${file}`);
    }
  }
}

testAll().catch(console.error);