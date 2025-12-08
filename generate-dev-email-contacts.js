import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Generate dev-email-contacts.json with "Maret Rudin-Aulenbach {N}" names
 * mapping to maret.e.rudin-aulenbach+{N}@vanderbilt.edu
 * Structure: { "Maret Rudin-Aulenbach 1": "maret.e.rudin-aulenbach+1@vanderbilt.edu", ... }
 * Also creates a mapping file to map real names to dev names
 */
function generateDevEmailContacts() {
    // Load production email contacts to get the structure
    const prodContactsPath = path.join('data', 'email-contacts.json');
    const prodContacts = JSON.parse(fs.readFileSync(prodContactsPath, 'utf-8'));
    
    const devContacts = {
        contacts: {},
        lastUpdated: new Date().toISOString(),
        sourceFile: 'dev-email-contacts.json (generated from email-contacts.json)',
        note: 'DEV MODE: Names are "Maret Rudin-Aulenbach {N}" mapping to maret.e.rudin-aulenbach+{N}@vanderbilt.edu'
    };
    
    // Create mapping from real names to dev names
    const nameMapping = {};
    let counter = 1;
    
    // Sort production contact names for consistent ordering
    const sortedProdNames = Object.keys(prodContacts.contacts).sort();
    
    // Generate dev contacts with "Maret Rudin-Aulenbach {N}" names
    for (const realName of sortedProdNames) {
        const devName = `Maret Rudin-Aulenbach ${counter}`;
        const devEmail = `maret.e.rudin-aulenbach+${counter}@vanderbilt.edu`;
        
        devContacts.contacts[devName] = devEmail;
        nameMapping[realName] = devName;
        counter++;
    }
    
    // Save dev email contacts
    const devContactsPath = path.join('data', 'dev-email-contacts.json');
    fs.writeFileSync(devContactsPath, JSON.stringify(devContacts, null, 2));
    
    // Save name mapping for reference (optional, for debugging)
    const mappingPath = path.join('data', 'dev-name-mapping.json');
    fs.writeFileSync(mappingPath, JSON.stringify({
        mapping: nameMapping,
        lastUpdated: new Date().toISOString()
    }, null, 2));
    
    console.log(`✅ Generated dev-email-contacts.json`);
    console.log(`   Contacts: ${Object.keys(devContacts.contacts).length}`);
    console.log(`   Saved to: ${devContactsPath}`);
    console.log(`   Name mapping saved to: ${mappingPath}`);
    
    // Show sample
    console.log('\nSample entries:');
    Object.entries(devContacts.contacts).slice(0, 5).forEach(([name, email]) => {
        console.log(`  ${name}: ${email}`);
    });
    
    console.log('\nSample name mappings:');
    Object.entries(nameMapping).slice(0, 5).forEach(([realName, devName]) => {
        console.log(`  "${realName}" -> "${devName}"`);
    });
}

generateDevEmailContacts();

