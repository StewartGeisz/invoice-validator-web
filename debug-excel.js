const XLSX = require('xlsx');

console.log('Debugging Excel data...');
const workbook = XLSX.readFile('Service Agreement Table (Rolling).xlsx');
const worksheet = workbook.Sheets['Service Agreements'];
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

const headers = jsonData[0];
console.log('Looking for rate-related columns...');
headers.forEach((header, index) => {
  if (header && (header.toString().toLowerCase().includes('rate') || 
                 header.toString().toLowerCase().includes('amount') || 
                 header.toString().toLowerCase().includes('price') ||
                 header.toString().toLowerCase().includes('cost'))) {
    console.log(`Index ${index}: ${header}`);
  }
});

// Look for Mid South row and show all data
console.log('\nSearching for Mid South data...');
for (let i = 1; i < jsonData.length; i++) {
  const row = jsonData[i];
  if (row[0] && row[0].toString().toLowerCase().includes('mid south')) {
    console.log('\nMid South found at row:', i + 1);
    console.log('Vendor name:', row[0]);
    
    // Check for the rate you mentioned
    row.forEach((cell, index) => {
      if (cell && cell.toString().includes('10,942')) {
        console.log(`FOUND RATE - Column ${index} (${headers[index]}): ${cell}`);
      }
    });
    
    // Also check for weekly rates
    row.forEach((cell, index) => {
      if (cell && cell.toString().toLowerCase().includes('weekly')) {
        console.log(`WEEKLY FOUND - Column ${index} (${headers[index]}): ${cell}`);
      }
    });
    
    // Show scope or description columns that might contain rate info
    console.log('\nScope/Description columns:');
    if (row[1]) console.log(`Column 1 (${headers[1]}): ${row[1]}`);
    if (row[2]) console.log(`Column 2 (${headers[2]}): ${row[2]}`);
    
    break;
  }
}