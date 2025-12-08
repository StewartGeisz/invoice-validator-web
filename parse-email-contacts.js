import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

/**
 * Parse Excel file containing contact names and email addresses
 * Creates a JSON mapping file: { "Name": "email@domain.com" }
 * Ignores rows with values in the Note column
 */
function parseEmailContacts() {
    const excelPath = 'Email contacts for FUM and Main Contacts - Invoice Validation.xlsx';
    
    if (!fs.existsSync(excelPath)) {
        console.error(`Excel file not found: ${excelPath}`);
        process.exit(1);
    }

    console.log('Reading Excel file...');
    const workbook = XLSX.readFile(excelPath);
    
    console.log('Available sheets:', workbook.SheetNames);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Read as array of arrays
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log('\nFirst few rows:');
    data.slice(0, 5).forEach((row, i) => {
        console.log(`Row ${i}:`, row);
    });
    
    // Find header row (usually first row)
    const headers = data[0] || [];
    console.log('\nHeaders:', headers);
    
    // Find column indices (Function, Name, Email, Note)
    const functionIndex = headers.findIndex(h => 
        h && h.toString().toLowerCase().includes('function')
    );
    const nameIndex = headers.findIndex(h => 
        h && h.toString().toLowerCase().includes('name')
    );
    const emailIndex = headers.findIndex(h => 
        h && h.toString().toLowerCase().includes('email')
    );
    const noteIndex = headers.findIndex(h => 
        h && h.toString().toLowerCase().includes('note')
    );
    
    console.log(`\nColumn indices:`);
    console.log(`  Function: ${functionIndex} (ignored)`);
    console.log(`  Name: ${nameIndex}`);
    console.log(`  Email: ${emailIndex}`);
    console.log(`  Note: ${noteIndex} (rows with values will be skipped)`);
    
    // Build name-to-email mapping
    // Structure: { "Name": "email@domain.com" }
    const nameToEmail = {};
    let skippedRows = 0;
    
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const name = row[nameIndex]?.toString().trim();
        const email = row[emailIndex]?.toString().trim();
        const note = row[noteIndex]?.toString().trim();
        
        // Skip rows with values in Note column
        if (note && note.toLowerCase() !== 'nan' && note.length > 0) {
            skippedRows++;
            continue;
        }
        
        // Skip rows with missing name or email
        if (!name || !email || name.toLowerCase() === 'nan' || email.toLowerCase() === 'nan') {
            continue;
        }
        
        // Normalize email (lowercase)
        const normalizedEmail = email.toLowerCase();
        
        // Map name to email (ignore Function column)
        nameToEmail[name] = normalizedEmail;
    }
    
    // Save to JSON
    const outputPath = path.join('data', 'email-contacts.json');
    const output = {
        contacts: nameToEmail,
        lastUpdated: new Date().toISOString(),
        sourceFile: excelPath,
        skippedRows: skippedRows
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    
    console.log(`\n✅ Parsed ${Object.keys(nameToEmail).length} contacts`);
    console.log(`✅ Skipped ${skippedRows} rows with Note values`);
    console.log(`✅ Saved to ${outputPath}`);
    
    // Show sample
    console.log('\nSample entries:');
    Object.entries(nameToEmail).slice(0, 5).forEach(([name, email]) => {
        console.log(`  ${name}: ${email}`);
    });
}

parseEmailContacts();

