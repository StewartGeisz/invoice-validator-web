// Additional validation methods for PDFValidator class

export const validationMethods = {
    async validatePoNumber(pdfText, vendorName) {
        if (!this.vendorData[vendorName]) {
            return { po_valid: false, reason: "Vendor not found in database" };
        }

        const vendorInfo = this.vendorData[vendorName];
        const expectedPo = vendorInfo.currentPo;

        if (!expectedPo || expectedPo === null || expectedPo === undefined) {
            return { po_valid: null, reason: "No PO number in database for this vendor" };
        }

        // First, try local PO number search with various patterns
        const poStr = expectedPo.toString().trim();
        const localResult = this.findPoNumberLocally(pdfText, poStr);
        if (localResult.found) {
            return { po_valid: true, expected_po: poStr, reason: localResult.reason };
        }

        // If not found locally and API is configured, use LLM for extraction
        if (this.amplifyApiUrl && this.amplifyApiKey) {
            return await this.validatePoWithLLM(pdfText, poStr);
        }

        return { po_valid: false, expected_po: poStr, reason: `PO number ${poStr} not found in PDF text` };
    },

    findPoNumberLocally(pdfText, expectedPo) {
        const pdfTextLower = pdfText.toLowerCase();
        const cleanExpected = expectedPo.trim();
        const cleanExpectedLower = cleanExpected.toLowerCase();
        
        // Pattern 1: Exact match (case-insensitive)
        if (pdfTextLower.includes(cleanExpectedLower)) {
            return { found: true, reason: "Exact PO number match found in PDF" };
        }
        
        // Pattern 2: PO number with various separators and spacing
        const poWithoutSpaces = cleanExpected.replace(/[\s-_.]/g, '');
        const poWithoutSpacesLower = poWithoutSpaces.toLowerCase();
        
        if (pdfTextLower.replace(/[\s-_.]/g, '').includes(poWithoutSpacesLower)) {
            return { found: true, reason: "PO number found in PDF (ignoring spacing/separators)" };
        }
        
        // Pattern 3: Look for PO number near common PO keywords
        const poPatterns = [
            new RegExp(`(?:p\\.?o\\.?\\s*(?:no\\.?|number)?\\s*[:#]?\\s*)${this.escapeRegex(cleanExpectedLower)}`, 'i'),
            new RegExp(`(?:purchase\\s*order\\s*[:#]?\\s*)${this.escapeRegex(cleanExpectedLower)}`, 'i'),
            new RegExp(`(?:order\\s*(?:no\\.?|number)?\\s*[:#]?\\s*)${this.escapeRegex(cleanExpectedLower)}`, 'i'),
            new RegExp(`${this.escapeRegex(cleanExpectedLower)}(?:\\s*(?:p\\.?o\\.?|purchase|order))`, 'i')
        ];
        
        for (const pattern of poPatterns) {
            if (pattern.test(pdfText)) {
                return { found: true, reason: "PO number found near PO keywords in PDF" };
            }
        }
        
        return { found: false, reason: "PO number not found using local search patterns" };
    },

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    async validateDateRange(pdfText, vendorName) {
        if (!this.vendorData[vendorName]) {
            return { date_valid: false, reason: "Vendor not found in database" };
        }

        const vendorInfo = this.vendorData[vendorName];
        const poStart = vendorInfo.poStart;
        const poEnd = vendorInfo.poEnd;

        if (!poStart || !poEnd) {
            return { date_valid: null, reason: "No PO date range in database for this vendor" };
        }

        // First try local date extraction and validation
        const localResult = this.validateDatesLocally(pdfText, poStart, poEnd);
        if (localResult.date_valid === true) {
            return localResult; // If we find valid dates locally, return immediately
        }

        // If local validation fails or finds no dates, use LLM as fallback
        return await this.validateDatesWithLLM(pdfText, poStart, poEnd);
    },

    validateDatesLocally(pdfText, poStart, poEnd) {
        // Convert PO dates to proper Date objects
        const startDate = this.parseExcelDate(poStart);
        const endDate = this.parseExcelDate(poEnd);
        
        if (!startDate || !endDate) {
            return { date_valid: false, reason: "Could not parse PO start/end dates" };
        }

        // Extract dates from PDF text using regex patterns
        const datePatterns = [
            /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g,  // MM/DD/YYYY or DD/MM/YYYY
            /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g,   // YYYY-MM-DD
            /\b(\d{1,2})-(\d{1,2})-(\d{4})\b/g,   // MM-DD-YYYY or DD-MM-YYYY
            /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/gi, // Month DD, YYYY
            /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/gi  // DD Month YYYY
        ];

        const extractedDates = [];
        const validDates = [];

        for (const pattern of datePatterns) {
            let match;
            while ((match = pattern.exec(pdfText)) !== null) {
                let dateObj = null;
                
                if (pattern === datePatterns[0] || pattern === datePatterns[2]) {
                    // Handle MM/DD/YYYY and MM-DD-YYYY (assume US format)
                    const month = parseInt(match[1]);
                    const day = parseInt(match[2]);
                    const year = parseInt(match[3]);
                    if (month <= 12 && day <= 31) {
                        dateObj = new Date(year, month - 1, day);
                    }
                } else if (pattern === datePatterns[1]) {
                    // Handle YYYY-MM-DD
                    const year = parseInt(match[1]);
                    const month = parseInt(match[2]);
                    const day = parseInt(match[3]);
                    if (month <= 12 && day <= 31) {
                        dateObj = new Date(year, month - 1, day);
                    }
                } else if (pattern === datePatterns[3]) {
                    // Handle Month DD, YYYY
                    const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
                    const monthIndex = monthNames.indexOf(match[1].toLowerCase().substring(0,3));
                    if (monthIndex !== -1) {
                        const day = parseInt(match[2]);
                        const year = parseInt(match[3]);
                        dateObj = new Date(year, monthIndex, day);
                    }
                } else if (pattern === datePatterns[4]) {
                    // Handle DD Month YYYY
                    const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
                    const monthIndex = monthNames.indexOf(match[2].toLowerCase().substring(0,3));
                    if (monthIndex !== -1) {
                        const day = parseInt(match[1]);
                        const year = parseInt(match[3]);
                        dateObj = new Date(year, monthIndex, day);
                    }
                }

                if (dateObj && !isNaN(dateObj.getTime())) {
                    const dateStr = dateObj.toISOString().split('T')[0];
                    if (!extractedDates.includes(dateStr)) {
                        extractedDates.push(dateStr);
                        
                        // Check if date falls within PO range
                        if (dateObj >= startDate && dateObj <= endDate) {
                            validDates.push(dateStr);
                        }
                    }
                }
            }
        }

        if (extractedDates.length === 0) {
            return { 
                date_valid: false, 
                dates_found: [], 
                valid_dates: [],
                reason: "No dates found in PDF text using local extraction" 
            };
        }

        if (validDates.length > 0) {
            return { 
                date_valid: true, 
                dates_found: extractedDates, 
                valid_dates: validDates,
                reason: `Found ${validDates.length} valid date(s) within PO period (${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}) using local validation`
            };
        }

        return { 
            date_valid: false, 
            dates_found: extractedDates, 
            valid_dates: [],
            reason: `Found ${extractedDates.length} date(s) but none fall within PO period (${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]})`
        };
    },

    parseExcelDate(excelDate) {
        if (!excelDate) return null;
        
        // If it's already a Date object
        if (excelDate instanceof Date) {
            return excelDate;
        }
        
        // If it's a string that looks like a date
        if (typeof excelDate === 'string') {
            const parsed = new Date(excelDate);
            if (!isNaN(parsed.getTime())) {
                return parsed;
            }
        }
        
        // If it's an Excel serial number (number of days since 1900-01-01)
        if (typeof excelDate === 'number') {
            // Excel serial date: days since January 1, 1900
            // Note: Excel incorrectly treats 1900 as a leap year, so we need to adjust
            const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
            return new Date(excelEpoch.getTime() + excelDate * 24 * 60 * 60 * 1000);
        }
        
        return null;
    },

    async validateRate(pdfText, vendorName) {
        if (!this.vendorData[vendorName]) {
            return { rate_valid: false, reason: "Vendor not found in database" };
        }

        const vendorInfo = this.vendorData[vendorName];
        const rateAmount = vendorInfo.rateAmount;

        // If no rate amount in column AQ, automatically pass
        if (!rateAmount || rateAmount === null) {
            return {
                rate_valid: true,
                reason: "No rate amount in database - automatic pass",
                is_variable: true  // Treat as variable for contact person logic
            };
        }

        // For fixed rates with amount, validate with 5% tolerance
        const tolerance = rateAmount * 0.05; // 5% tolerance
        const minAmount = rateAmount - tolerance;
        const maxAmount = rateAmount + tolerance;

        // Try to find the amount directly in text
        const amountPattern = new RegExp(`\\$?\\s*${rateAmount.toFixed(2)}`, 'i');
        if (amountPattern.test(pdfText)) {
            return {
                rate_valid: true,
                expected_amount: rateAmount,
                amounts_found: [rateAmount],
                reason: "Expected rate amount found in PDF"
            };
        }

        // If not found and API is configured, use LLM
        if (this.amplifyApiUrl && this.amplifyApiKey) {
            return await this.validateRateWithLLM(pdfText, "fixed", rateAmount);
        }

        return { rate_valid: false, reason: "Rate validation not possible without LLM" };
    },

    determineContactPerson(vendorName, poValidation, dateValidation, rateValidation) {
        if (!this.vendorData[vendorName]) {
            return { name: "Unknown", role: "Unknown", reason: "Vendor not found in database" };
        }

        const vendorInfo = this.vendorData[vendorName];
        
        // Check validation results
        const poFailed = poValidation.po_valid === false;
        const dateFailed = dateValidation.date_valid === false;
        const rateFailed = rateValidation.rate_valid === false;
        const isVariableRate = rateValidation.is_variable === true;
        
        // If ALL tests pass AND rate is NOT variable → contact manager/director
        if (!poFailed && !dateFailed && !rateFailed && !isVariableRate) {
            const director = vendorInfo.director;
            if (director && director !== null && director !== undefined && director.toString().toLowerCase() !== 'nan') {
                return {
                    name: director,
                    role: "Director/Manager",
                    reason: "All validations passed and rate is fixed - contact director"
                };
            }
        }
        
        // Otherwise → contact admin/main contact
        // (if any test fails OR if rate type is variable)
        const mainContact = vendorInfo.mainContact;
        const admin = vendorInfo.admin;
        
        // Try Main Contact first, then Admin
        const contact = (mainContact && mainContact.toString().toLowerCase() !== 'nan') ? mainContact : admin;
        
        if (contact && contact !== null && contact !== undefined && contact.toString().toLowerCase() !== 'nan') {
            const reasons = [];
            if (poFailed) reasons.push("PO validation failed");
            if (dateFailed) reasons.push("date validation failed");
            if (rateFailed) reasons.push("rate validation failed");
            if (isVariableRate) reasons.push("variable rate type");
            
            const reason = reasons.length > 0 ? 
                `Issue requires admin attention: ${reasons.join(", ")}` : 
                "Default admin contact";
            
            return {
                name: contact,
                role: "Admin/Main Contact",
                reason: reason
            };
        }
        
        return { name: "Unknown", role: "Unknown", reason: "No contact information available" };
    }
};