import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ============================================================================
// CONFIGURATION - Easy way to change the dev email pattern
// ============================================================================
// Change these values to use a different email pattern for dev mode
const DEV_NAME_PREFIX = 'Maret Rudin-Aulenbach';  // Name prefix: "Maret Rudin-Aulenbach 1", "Maret Rudin-Aulenbach 2", etc.
const DEV_EMAIL_BASE = 'maret.e.rudin-aulenbach'; // Email base: "maret.e.rudin-aulenbach+1@vanderbilt.edu"
const DEV_EMAIL_DOMAIN = '@vanderbilt.edu';       // Email domain
// ============================================================================

/**
 * Generate dev-email-contacts.json with configurable dev names and emails
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
        note: `DEV MODE: Names are "${DEV_NAME_PREFIX} {N}" mapping to ${DEV_EMAIL_BASE}+{N}${DEV_EMAIL_DOMAIN}`
    };
    
    // Create mapping from real names to dev names
    const nameMapping = {};
    let counter = 1;
    
    // Sort production contact names for consistent ordering
    const sortedProdNames = Object.keys(prodContacts.contacts).sort();
    
    // Generate dev contacts with configurable names and emails
    for (const realName of sortedProdNames) {
        const devName = `${DEV_NAME_PREFIX} ${counter}`;
        const devEmail = `${DEV_EMAIL_BASE}+${counter}${DEV_EMAIL_DOMAIN}`;
        
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

