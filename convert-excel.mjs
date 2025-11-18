import fs from 'fs';
import { convertExcelToVendorData } from './lib/excel-converter.js';

console.log('Converting Excel to JSON...');
try {
  const result = convertExcelToVendorData('Service Agreement Table (Rolling) (1).xlsx');
  
  fs.writeFileSync('data/vendor-data.json', JSON.stringify(result, null, 2));
  console.log('Successfully converted', result.vendors.length, 'vendors to JSON');
} catch (error) {
  console.error('Error converting Excel:', error.message);
  process.exit(1);
}

