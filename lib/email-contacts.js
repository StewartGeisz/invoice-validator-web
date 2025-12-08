import emailContactsData from '../data/email-contacts.json';
import devEmailContactsData from '../data/dev-email-contacts.json';
import devNameMappingData from '../data/dev-name-mapping.json';
import { getEmailForEnvironment } from './email-utils.js';

/**
 * Email Contacts Manager
 * Provides email addresses for contacts by name
 * Structure: { "Contact Name": "email@domain.com" }
 * In dev mode, uses dev-email-contacts.json with name variations like "Maret Rudin-Aulenbach 1"
 * mapping to maret.e.rudin-aulenbach+1@vanderbilt.edu
 */
class EmailContacts {
    constructor() {
        // Determine if we're in dev mode
        const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';
        const envLower = environment.toLowerCase();
        const isDev = envLower === 'dev' || envLower === 'development';
        
        // Load appropriate contacts file based on environment
        if (isDev) {
            this.contacts = devEmailContactsData.contacts || {};
            this.nameMapping = devNameMappingData.mapping || {};
            console.log(`🔧 DEV MODE: Loaded dev email contacts for ${Object.keys(this.contacts).length} contacts`);
            console.log(`   Using name variations: "Maret Rudin-Aulenbach {N}" -> maret.e.rudin-aulenbach+{N}@vanderbilt.edu`);
        } else {
            this.contacts = emailContactsData.contacts || {};
            this.nameMapping = {};
            console.log(`✅ PRODUCTION MODE: Loaded email contacts for ${Object.keys(this.contacts).length} contacts`);
        }
    }

    /**
     * Get email address for a contact name
     * @param {string} contactName - Contact name (e.g., "Olivia Daugherty", "Ben Swaffer")
     * @returns {string|null} Email address or null if not found
     */
    getEmail(contactName) {
        if (!contactName) {
            return null;
        }
        
        // Normalize contact name (trim whitespace)
        const normalizedName = contactName.trim();
        
        if (!normalizedName || normalizedName.toLowerCase() === 'nan') {
            return null;
        }
        
        // In dev mode, map real name to dev name using the name mapping
        let lookupName = normalizedName;
        if (this.nameMapping && Object.keys(this.nameMapping).length > 0) {
            // Try exact match first
            if (this.nameMapping[normalizedName]) {
                lookupName = this.nameMapping[normalizedName];
            } else {
                // Try case-insensitive match
                const matchingKey = Object.keys(this.nameMapping).find(
                    key => key.toLowerCase() === normalizedName.toLowerCase()
                );
                if (matchingKey) {
                    lookupName = this.nameMapping[matchingKey];
                }
            }
        }
        
        // Look up email by contact name (or dev name in dev mode)
        const email = this.contacts[lookupName];
        
        if (!email) {
            return null;
        }
        
        return getEmailForEnvironment(email);
    }

    /**
     * Check if a contact name has an email configured
     * @param {string} contactName - Contact name
     * @returns {boolean} True if contact has an email configured
     */
    hasEmail(contactName) {
        if (!contactName) {
            return false;
        }
        
        const normalizedName = contactName.trim();
        return !!(this.contacts[normalizedName]);
    }
}

export default new EmailContacts();

