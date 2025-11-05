const XLSX = require('xlsx');

console.log('Searching for Mid South rate information...');
const workbook = XLSX.readFile('Service Agreement Table (Rolling).xlsx');
const worksheet = workbook.Sheets['Service Agreements'];
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

const headers = jsonData[0];

// Look for Mid South row and show ALL columns
for (let i = 1; i < jsonData.length; i++) {
  const row = jsonData[i];
  if (row[0] && row[0].toString().toLowerCase().includes('mid south')) {
    console.log('\n=== MID SOUTH COMPLETE ROW DATA ===');
    console.log('Row number:', i + 1);
    
    for (let j = 0; j < row.length; j++) {
      if (row[j] && row[j] !== null && row[j] !== undefined) {
        const cellValue = row[j].toString();
        // Highlight cells that contain rate information
        if (cellValue.includes('$') || cellValue.includes('10,942') || cellValue.toLowerCase().includes('weekly')) {
          console.log(`*** Column ${j} (${headers[j] || 'Unknown'}): ${cellValue} ***`);
        } else {
          console.log(`Column ${j} (${headers[j] || 'Unknown'}): ${cellValue}`);
        }
      }
    }
    break;
  }
}

// Also search all rows for the specific rate
console.log('\n=== SEARCHING ALL ROWS FOR 10,942.20 ===');
for (let i = 1; i < jsonData.length; i++) {
  const row = jsonData[i];
  for (let j = 0; j < row.length; j++) {
    if (row[j] && row[j].toString().includes('10,942')) {
      console.log(`Found rate at Row ${i + 1}, Column ${j} (${headers[j]}): ${row[j]}`);
      console.log(`Vendor in this row: ${row[0]}`);
    }
  }
}