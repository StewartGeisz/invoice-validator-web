const XLSX = require('xlsx');

console.log('Examining Service Agreements_Validation sheet...');
try {
  const workbook = XLSX.readFile('Service Agreement Table (Rolling) (1).xlsx');
  console.log('Available sheets:', workbook.SheetNames);

  const sheetName = 'Service Agreements_Validation';
  if (!workbook.SheetNames.includes(sheetName)) {
    console.error(`Sheet ${sheetName} not found!`);
    process.exit(1);
  }

  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  if (jsonData.length === 0) {
    console.error('No data found in Service Agreements_Validation sheet');
    process.exit(1);
  }

  const headers = jsonData[0];
  console.log('\n=== SERVICE AGREEMENTS_VALIDATION HEADERS ===');
  headers.forEach((header, index) => {
    console.log(`Column ${index}: ${header}`);
  });

  // Look for Mid South in this sheet
  console.log('\n=== SEARCHING FOR MID SOUTH IN VALIDATION SHEET ===');
  for (let i = 1; i < Math.min(jsonData.length, 100); i++) {
    const row = jsonData[i];
    if (row[0] && row[0].toString().toLowerCase().includes('mid south')) {
      console.log('\nFound Mid South at row:', i + 1);
      console.log('Vendor:', row[0]);
      
      // Show all non-empty columns
      for (let j = 0; j < row.length; j++) {
        if (row[j] !== null && row[j] !== undefined && row[j] !== '') {
          console.log(`  Column ${j} (${headers[j] || 'Unknown'}): ${row[j]}`);
        }
      }
      
      // Check column AQ specifically 
      console.log(`Column AQ (42): ${row[42]}`);
      break;
    }
  }

  // Look for rate-related columns
  console.log('\n=== RATE-RELATED COLUMNS ===');
  headers.forEach((header, index) => {
    if (header && (header.toString().toLowerCase().includes('rate') || 
                   header.toString().toLowerCase().includes('amount') || 
                   header.toString().toLowerCase().includes('variable') ||
                   header.toString().toLowerCase().includes('fixed') ||
                   header.toString().toLowerCase().includes('type'))) {
      console.log(`Column ${index}: ${header}`);
    }
  });

} catch (error) {
  console.error('Error:', error.message);
}