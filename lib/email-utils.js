/**
 * Email utility functions
 * Converts contact names to email addresses and handles dev/production mode
 */

/**
 * Convert a contact name to an email address
 * Assumes format: "First Last" -> "first.last@vanderbilt.edu"
 * Handles special cases like multiple names, middle initials, etc.
 * 
 * @param {string} name - Contact name (e.g., "Ben Swaffer", "Mary McQuillan")
 * @returns {string|null} Email address or null if name is invalid
 */
export function nameToEmail(name) {
    if (!name || typeof name !== 'string') {
        return null;
    }

    // Clean the name
    let cleanName = name.trim();
    
    // Handle "Unknown" or invalid values
    if (cleanName.toLowerCase() === 'unknown' || 
        cleanName.toLowerCase() === 'nan' || 
        cleanName.length === 0) {
        return null;
    }

    // Remove common prefixes/suffixes
    cleanName = cleanName
        .replace(/\s*\(.*?\)\s*/g, '') // Remove parenthetical notes
        .replace(/\s*\/.*$/, '') // Remove "/" and everything after (e.g., "Chris Preston/Howard Parker" -> "Chris Preston")
        .trim();

    // Split into parts
    const parts = cleanName.split(/\s+/).filter(p => p.length > 0);
    
    if (parts.length === 0) {
        return null;
    }

    // Handle single name (unlikely but possible)
    if (parts.length === 1) {
        return `${parts[0].toLowerCase()}@vanderbilt.edu`;
    }

    // Handle multiple names - use first and last
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];

    // Convert to email format: first.last@vanderbilt.edu
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@vanderbilt.edu`;

    return email;
}

/**
 * Get the appropriate email address based on environment
 * In dev mode, all emails go to maret.e.rudin-aulenbach@vanderbilt.edu
 * In production, use the actual email address
 * 
 * Environment is determined by ENVIRONMENT env var (preferred) or NODE_ENV
 * - dev/development: All emails go to maret.e.rudin-aulenbach@vanderbilt.edu
 * - production/prod: Use actual email addresses
 * 
 * @param {string} actualEmail - The actual email address to use in production
 * @returns {string} Email address to use
 */
export function getEmailForEnvironment(actualEmail) {
    const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';
    const envLower = environment.toLowerCase();
    const isDev = envLower === 'dev' || envLower === 'development';

    if (isDev) {
        console.log(`   🔧 DEV MODE: Redirecting email to maret.e.rudin-aulenbach@vanderbilt.edu (original: ${actualEmail || 'N/A'})`);
        return 'maret.e.rudin-aulenbach@vanderbilt.edu';
    }

    // Production mode - use actual email, with fallback
    if (!actualEmail) {
        console.warn(`   ⚠️  No email address provided, using fallback`);
        return 'maret.e.rudin-aulenbach@vanderbilt.edu';
    }

    return actualEmail;
}

/**
 * Convert contact name to email with environment check
 * 
 * @param {string} name - Contact name
 * @returns {string} Email address (dev mode or production)
 */
export function getContactEmail(name) {
    const actualEmail = nameToEmail(name);
    return getEmailForEnvironment(actualEmail);
}

