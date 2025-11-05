const XLSX = require('xlsx');
const fs = require('fs');

console.log('Converting Excel to JSON...');
try {
  const workbook = XLSX.readFile('Service Agreement Table (Rolling) (1).xlsx');
  let sheetName = 'Service Agreements';
  if (!workbook.SheetNames.includes(sheetName)) {
    sheetName = workbook.SheetNames[0];
  }

  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  if (jsonData.length === 0) {
    console.error('No data found');
    process.exit(1);
  }

  const headers = jsonData[0];
  console.log('Headers found:', headers.slice(0, 10));

  const vendorColumnIndex = headers.findIndex(header => 
    header && header.toString().toLowerCase().includes('vendor')
  );

  if (vendorColumnIndex === -1) {
    console.error('No vendor column found');
    process.exit(1);
  }

  const vendorData = {};
  const vendors = new Set();

  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (row[vendorColumnIndex] && row[vendorColumnIndex].toString().trim()) {
      const vendorName = row[vendorColumnIndex].toString().trim();
      vendors.add(vendorName);
      
      const rateAmount = row[42]; // Column AQ
      
      let currentPo = row[headers.indexOf('Current PO')] || null;
      if (!currentPo) {
        currentPo = row[headers.indexOf('FY25 PO')] || null;
      }
      if (!currentPo) {
        currentPo = row[headers.indexOf('FY24 PO')] || null;
      }
      
      vendorData[vendorName] = {
        contractStart: row[headers.indexOf('Contract Start Date')] || null,
        contractEnd: row[headers.indexOf('Contract End Date')] || null,
        currentPo: currentPo,
        poStart: row[headers.indexOf('PO Start')] || null,
        poEnd: row[headers.indexOf('PO End')] || null,
        mainContact: row[headers.indexOf('Main Contact')] || null,
        admin: row[headers.indexOf('Admin')] || null,
        director: row[headers.indexOf('Asst Director / Director')] || null,
        fum: row[headers.indexOf('FUM')] || null, // Column D - FUM
        rateAmount: (rateAmount && typeof rateAmount === 'number') ? rateAmount : null
      };
    }
  }

  const result = {
    vendors: Array.from(vendors).filter(v => v.toLowerCase() !== 'nan'),
    vendorData: vendorData,
    lastUpdated: new Date().toISOString()
  };

  fs.writeFileSync('data/vendor-data.json', JSON.stringify(result, null, 2));
  console.log('Successfully converted', result.vendors.length, 'vendors to JSON');
} catch (error) {
  console.error('Error converting Excel:', error.message);
}