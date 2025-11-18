import XLSX from 'xlsx';

/**
 * Converts Excel file to vendor data JSON structure
 * @param {string} excelFilePath - Path to the Excel file
 * @returns {Object} Object with vendors array and vendorData object
 */
export function convertExcelToVendorData(excelFilePath) {
    console.log('Converting Excel to JSON...');
    
    const workbook = XLSX.readFile(excelFilePath);
    
    // Try to find the validation sheet first, then fall back to first sheet
    let sheetName = 'Service Agreements_Validation';
    if (!workbook.SheetNames.includes(sheetName)) {
        console.log('Service Agreements_Validation sheet not found, available sheets:', workbook.SheetNames);
        sheetName = workbook.SheetNames[0];
    }

    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length === 0) {
        throw new Error('No data found in Excel file');
    }

    const headers = jsonData[0];
    console.log('Headers found:', headers.slice(0, 10));

    const vendorColumnIndex = headers.findIndex(header => 
        header && header.toString().toLowerCase().includes('vendor')
    );

    if (vendorColumnIndex === -1) {
        throw new Error('No vendor column found in Excel file');
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
            
            // Get rate type from column AP (41) and rate amount from column AQ (42)
            const rateType = row[41] ? row[41].toString().trim() : null;

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
                rateType: rateType, // Variable vs Fixed
                rateAmount: (rateAmount && typeof rateAmount === 'number') ? rateAmount : null
            };
        }
    }

    const result = {
        vendors: Array.from(vendors).filter(v => v.toLowerCase() !== 'nan'),
        vendorData: vendorData,
        lastUpdated: new Date().toISOString()
    };

    console.log('Successfully converted', result.vendors.length, 'vendors to JSON');
    return result;
}

