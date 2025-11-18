import pdf from 'pdf-parse';
import axios from 'axios';
import vendorData from '../data/vendor-data.json';

export default class PDFValidator {
    constructor() {
        this.vendorList = vendorData.vendors;
        this.vendorData = vendorData.vendorData;
        this.amplifyApiUrl = process.env.AMPLIFY_API_URL;
        this.amplifyApiKey = process.env.AMPLIFY_API_KEY;
        
        console.log(`Loaded ${this.vendorList.length} unique vendors with detailed data`);
        console.log(`Sample vendors:`, this.vendorList.slice(0, 5));
    }

    async extractPdfText(pdfBuffer, filename) {
        try {
            console.log(`Extracting text from PDF: ${filename}`);
            
            const data = await pdf(pdfBuffer);
            
            let text = data.text;
            
            if (text) {
                const lines = [];
                for (const line of text.split('\n')) {
                    const cleanedLine = line.trim().replace(/\s+/g, ' ');
                    if (cleanedLine) {
                        lines.push(cleanedLine);
                    }
                }
                text = lines.join('\n');
            }
            
            console.log(`Extracted ${text.length} characters from PDF`);
            return text.trim();
            
        } catch (error) {
            console.error(`Error extracting PDF text: ${error.message}`);
            return '';
        }
    }

    performLooseVendorMatch(pdfText) {
        console.log('Performing enhanced vendor name matching...');
        
        const pdfTextLower = pdfText.toLowerCase();
        let exactMatches = [];
        let partialMatches = [];
        
        // First pass: Look for exact matches and high-confidence partial matches
        for (const vendor of this.vendorList) {
            const vendorLower = vendor.toLowerCase();
            
            // Check for exact substring match (highest priority)
            if (pdfTextLower.includes(vendorLower)) {
                console.log(`Exact substring match found: "${vendor}"`);
                exactMatches.push({
                    vendor: vendor,
                    type: 'exact',
                    score: 1.0,
                    matchLength: vendorLower.length
                });
                continue;
            }
            
            // Check for company name variations (remove common suffixes)
            const cleanVendor = vendorLower
                .replace(/\b(inc\.?|llc\.?|corp\.?|ltd\.?|company|co\.?|services?|service)\b/g, '')
                .trim();
            
            if (cleanVendor.length > 5 && pdfTextLower.includes(cleanVendor)) {
                console.log(`Clean name match found: "${vendor}" (matched: "${cleanVendor}")`);
                exactMatches.push({
                    vendor: vendor,
                    type: 'clean',
                    score: 0.95,
                    matchLength: cleanVendor.length
                });
                continue;
            }
            
            // Word-based matching for partial matches
            const vendorWords = vendorLower
                .replace(/[^\w\s]/g, ' ')
                .split(/\s+/)
                .filter(word => word.length > 2 && 
                    !['inc', 'llc', 'corp', 'ltd', 'the', 'and', 'of', 'for', 'services', 'service', 'company', 'co'].includes(word));
            
            if (vendorWords.length >= 2) {
                // Look for significant word matches
                const matchedWords = vendorWords.filter(word => pdfTextLower.includes(word));
                
                if (matchedWords.length >= 2) {
                    // Calculate weighted score based on word importance
                    let totalWeight = 0;
                    let matchedWeight = 0;
                    
                    for (const word of vendorWords) {
                        const weight = Math.max(1, word.length - 2);
                        totalWeight += weight;
                        
                        if (pdfTextLower.includes(word)) {
                            matchedWeight += weight;
                        }
                    }
                    
                    const score = totalWeight > 0 ? (matchedWeight / totalWeight) : 0;
                    
                    if (score >= 0.8) { // Higher threshold for partial matches
                        partialMatches.push({
                            vendor: vendor,
                            type: 'partial',
                            score: score,
                            matchedWords: matchedWords,
                            totalWords: vendorWords.length
                        });
                    }
                }
            }
        }
        
        // Return best match based on priority: exact > clean > partial
        if (exactMatches.length > 0) {
            // Sort by match length (longer matches are more specific)
            exactMatches.sort((a, b) => b.matchLength - a.matchLength);
            const bestExact = exactMatches[0];
            console.log(`Best exact match: "${bestExact.vendor}" (type: ${bestExact.type}, length: ${bestExact.matchLength})`);
            return bestExact.vendor;
        }
        
        if (partialMatches.length > 0) {
            // Sort by score, then by number of matched words
            partialMatches.sort((a, b) => {
                if (Math.abs(a.score - b.score) < 0.1) {
                    return b.matchedWords.length - a.matchedWords.length;
                }
                return b.score - a.score;
            });
            
            const bestPartial = partialMatches[0];
            console.log(`Best partial match: "${bestPartial.vendor}" (${Math.round(bestPartial.score * 100)}% match, ${bestPartial.matchedWords.length}/${bestPartial.totalWords} words)`);
            return bestPartial.vendor;
        }
        
        console.log('No good matches found - will use LLM fallback');
        return null;
    }

    async queryAmplifyApi(pdfText) {
        if (!this.amplifyApiUrl || !this.amplifyApiKey) {
            console.error('Error: Amplify API URL or key not found in environment variables');
            return null;
        }

        const prompt = `You are an expert at identifying company names in invoices and matching them to a supplier database. You must be extremely careful to match the ACTUAL company that issued the invoice, not just any company mentioned in the text.

CRITICAL INSTRUCTIONS:
1. ONLY match the company that is the INVOICE SENDER/ISSUER
2. Look for company names in: letterheads, "FROM:" fields, return addresses, company headers, billing entity
3. IGNORE companies mentioned as: customers, clients, "Bill To:", addresses, references, or project names
4. The invoice sender is usually at the TOP of the document or in a "FROM:" section
5. If you see multiple companies, identify which one is actually BILLING/INVOICING

INVOICE/DOCUMENT TEXT:
${pdfText}

SUPPLIER DATABASE:
${JSON.stringify(this.vendorList, null, 2)}

MATCHING PROCESS:
1. Find the company that is SENDING/ISSUING this invoice (usually at the top or in sender section)
2. Look for exact matches first: "Mid South Instrument Services Inc." should match exactly
3. Then try variations without legal suffixes: "Mid South Instrument Services" → "Mid South Instrument Services Inc."
4. Handle punctuation differences: "Mid-South" → "Mid South"
5. Only consider partial matches if they are clearly the same business entity
6. REJECT matches where:
   - The company name appears only as a customer/client
   - The company name appears only in addresses or references
   - Multiple words match but it's clearly a different company

EXAMPLES OF WHAT TO AVOID:
- Don't match "Cumberland University" to "Cumberland Predictive Maintenance" 
- Don't match client names to vendor names
- Don't match "Bill To:" addresses to invoice senders

CONFIDENCE REQUIREMENT: Only return a match if you are 90%+ confident the supplier is the actual invoice issuer.

Return ONLY valid JSON in this exact format:
{"vendor": "Exact Name From Supplier List"} 

OR if no clear match found:
{"vendor": null}`;

        try {
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.amplifyApiKey}`
            };

            const payload = {
                data: {
                    temperature: 0.5,
                    max_tokens: 4096,
                    dataSources: [],
                    messages: [
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    options: {
                        ragOnly: false,
                        skipRag: true,
                        model: { id: "gpt-4o" },
                        prompt: prompt,
                    },
                }
            };

            console.log('Querying Amplify API for vendor matching...');
            const response = await axios.post(this.amplifyApiUrl, payload, { 
                headers, 
                timeout: 25000
            });

            if (response.status === 200) {
                const responseData = response.data;
                const apiResponse = responseData.data || "";

                console.log('\n=== AMPLIFY API LLM OUTPUT ===');
                console.log(apiResponse);
                console.log('=== END LLM OUTPUT ===\n');

                if (apiResponse) {
                    try {
                        return JSON.parse(apiResponse);
                    } catch (jsonError) {
                        const jsonMatch = apiResponse.match(/```(?:json)?\s*(\{[^`]+\})\s*```/);
                        if (jsonMatch) {
                            try {
                                return JSON.parse(jsonMatch[1]);
                            } catch (parseError) {
                                console.error('Could not parse JSON from markdown');
                            }
                        }
                        
                        console.error(`API response not valid JSON: ${apiResponse}`);
                        return { vendor: null };
                    }
                } else {
                    console.error('Empty response from API');
                    return { vendor: null };
                }
            } else {
                console.error(`Amplify API error: ${response.status} - ${response.data}`);
                return null;
            }

        } catch (error) {
            console.error(`Error querying Amplify API: ${error.message}`);
            return null;
        }
    }

    async processPdf(pdfBuffer, filename) {
        console.log(`\nProcessing PDF: ${filename}`);
        
        const pdfText = await this.extractPdfText(pdfBuffer, filename);
        if (!pdfText) {
            return { 
                error: "Could not extract text from PDF",
                filename: filename,
                pdf_text_full: '',
                pdf_text_length: 0
            };
        }

        console.log(`Extracted ${pdfText.length} characters from PDF`);

        console.log('\n--- PDF TEXT SAMPLE (first 300 chars) ---');
        console.log(pdfText.substring(0, 300) + (pdfText.length > 300 ? '...' : ''));
        console.log('--- END PDF TEXT SAMPLE ---\n');

        // Skip local matching - go straight to LLM for better accuracy
        let vendorName = null;
        let method = 'llm_only';

        if (!this.amplifyApiUrl || !this.amplifyApiKey) {
            console.log('Amplify API not configured - falling back to local matching');
            vendorName = this.performLooseVendorMatch(pdfText);
            method = vendorName ? 'local_fallback' : 'no_api';
            
            if (!vendorName) {
                return { 
                    vendor: null, 
                    method: 'no_api',
                    filename: filename,
                    pdf_text_full: pdfText,
                    pdf_text_length: pdfText.length,
                    pdf_text_sample: pdfText.substring(0, 500),
                    vendor_list: this.vendorList.slice(0, 20)
                };
            }
        } else {
            console.log('Using LLM-only vendor identification for maximum accuracy');
            const apiResponse = await this.queryAmplifyApi(pdfText);
            
            if (!apiResponse || !apiResponse.vendor) {
                console.log('LLM could not identify vendor - trying local fallback');
                vendorName = this.performLooseVendorMatch(pdfText);
                method = vendorName ? 'local_fallback' : 'no_match';
                
                if (!vendorName) {
                    return { 
                        vendor: null, 
                        method: 'no_match',
                        filename: filename,
                        pdf_text_full: pdfText,
                        pdf_text_length: pdfText.length,
                        pdf_text_sample: pdfText.substring(0, 500),
                        vendor_list: this.vendorList.slice(0, 20)
                    };
                }
            } else {
                vendorName = apiResponse.vendor;
                method = 'llm_primary';
            }
        }

        console.log(`Vendor identified: ${vendorName} (method: ${method})`);
        
        // Step 2: Validate PO number
        console.log('Validating PO number...');
        const poValidation = await this.validatePoNumber(pdfText, vendorName);
        console.log(`PO Validation: ${JSON.stringify(poValidation)}`);
        
        // Step 3: Validate date range
        console.log('Validating date range...');
        const dateValidation = await this.validateDateRange(pdfText, vendorName);
        console.log(`Date Validation: ${JSON.stringify(dateValidation)}`);
        
        // Step 4: Validate rate
        console.log('Validating rate...');
        const rateValidation = await this.validateRate(pdfText, vendorName);
        console.log(`Rate Validation: ${JSON.stringify(rateValidation)}`);
        
        // Step 5: Determine contact person based on results
        const contactPerson = this.determineContactPerson(vendorName, poValidation, dateValidation, rateValidation);
        
        return {
            vendor: vendorName,
            method: method,
            filename: filename,
            pdf_text_length: pdfText.length,
            pdf_text_full: pdfText, // Full extracted text for audit logging
            pdf_text_sample: pdfText.substring(0, 500) + (pdfText.length > 500 ? '...' : ''),
            po_valid: poValidation.po_valid,
            po_reason: poValidation.reason,
            expected_po: poValidation.expected_po,
            date_valid: dateValidation.date_valid,
            date_reason: dateValidation.reason,
            dates_found: dateValidation.dates_found || [],
            valid_dates: dateValidation.valid_dates || [],
            rate_valid: rateValidation.rate_valid,
            rate_reason: rateValidation.reason,
            rate_type: rateValidation.rate_type,
            expected_amount: rateValidation.expected_amount,
            amounts_found: rateValidation.amounts_found || [],
            is_variable_rate: rateValidation.is_variable || false,
            contact_person: contactPerson.name,
            contact_role: contactPerson.role,
            contact_reason: contactPerson.reason
        };
    }

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
    }

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
        
        // Pattern 4: Look for PO number in structured format (like in tables or forms)
        const lines = pdfText.split(/[\n\r]+/);
        for (const line of lines) {
            if (line.toLowerCase().includes(cleanExpectedLower)) {
                return { found: true, reason: "PO number found in PDF line structure" };
            }
        }
        
        return { found: false, reason: "PO number not found using local search patterns" };
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    async validatePoWithLLM(pdfText, expectedPo) {
        const prompt = `You are an expert at extracting PO (Purchase Order) numbers from invoice documents.

TASK: Find and extract PO numbers from this invoice and check if the expected PO number is present.

INVOICE TEXT:
${pdfText}

EXPECTED PO NUMBER: ${expectedPo}

INSTRUCTIONS:
1. Look for PO numbers, purchase order numbers, or order numbers in the document
2. Common patterns: "PO:", "P.O.:", "Purchase Order:", "Order #:", etc.
3. Extract all PO-like numbers you find
4. Check if the expected PO number matches any found PO numbers (case-insensitive)
5. Be flexible with formatting differences (spaces, dashes, etc.)

Return ONLY valid JSON in this exact format:
{
  "po_numbers_found": ["P12345", "PO-67890", ...],
  "po_valid": true/false,
  "reason": "explanation of what was found"
}`;

        try {
            const response = await this.callAmplifyApi(prompt);
            if (response) {
                const result = { ...response, expected_po: expectedPo };
                console.log('\n=== PO VALIDATION LLM OUTPUT ===');
                console.log(JSON.stringify(result, null, 2));
                console.log('=== END PO VALIDATION OUTPUT ===\n');
                return result;
            }
            return { po_valid: false, expected_po: expectedPo, reason: "LLM validation failed" };
        } catch (error) {
            console.error(`Error in PO validation: ${error.message}`);
            return { po_valid: false, expected_po: expectedPo, reason: `LLM error: ${error.message}` };
        }
    }

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
    }

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
    }

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
    }

    async validateDatesWithLLM(pdfText, poStart, poEnd) {
        const startDate = this.parseExcelDate(poStart);
        const endDate = this.parseExcelDate(poEnd);
        
        const startDateStr = startDate ? startDate.toISOString().split('T')[0] : poStart;
        const endDateStr = endDate ? endDate.toISOString().split('T')[0] : poEnd;

        const prompt = `You are an expert at extracting dates from invoice documents and validating date ranges.

TASK: Extract all dates from this invoice/document and check if ANY of them fall within the given PO (Purchase Order) period.

DOCUMENT TEXT:
${pdfText}

PO PERIOD:
Start: ${startDateStr}
End: ${endDateStr}

INSTRUCTIONS:
1. Extract ALL dates you can find in the document (invoice date, service dates, billing periods, etc.)
2. Convert each date to YYYY-MM-DD format if possible
3. Check if ANY extracted date falls within the PO period (inclusive)
4. Look for dates in formats like: MM/DD/YYYY, DD/MM/YYYY, Month DD YYYY, YYYY-MM-DD, etc.
5. Pay special attention to invoice dates, service period dates, billing dates
6. Be flexible with date interpretation but prefer obvious invoice/service dates

Return ONLY valid JSON in this exact format:
{
  "dates_found": ["YYYY-MM-DD", "YYYY-MM-DD", ...],
  "date_valid": true/false,
  "valid_dates": ["YYYY-MM-DD", ...],
  "reason": "explanation of result"
}`;

        try {
            const response = await this.callAmplifyApi(prompt);
            if (response) {
                console.log('\n=== DATE VALIDATION LLM OUTPUT ===');
                console.log(JSON.stringify(response, null, 2));
                console.log('=== END DATE VALIDATION OUTPUT ===\n');
                return response;
            }
            return { date_valid: false, reason: "LLM validation failed" };
        } catch (error) {
            console.error(`Error in date validation: ${error.message}`);
            return { date_valid: false, reason: `LLM error: ${error.message}` };
        }
    }

    async validateRate(pdfText, vendorName) {
        if (!this.vendorData[vendorName]) {
            return { rate_valid: false, reason: "Vendor not found in database" };
        }

        const vendorInfo = this.vendorData[vendorName];
        const rateType = vendorInfo.rateType;
        const rateAmount = vendorInfo.rateAmount;

        // Check rate type from column AP (41) first
        if (!rateType || rateType === null || rateType === undefined) {
            // No rate type specified - use old logic as fallback
            if (!rateAmount || rateAmount === null) {
                return {
                    rate_valid: true,
                    reason: "No rate type or amount in database - automatic pass",
                    is_variable: true
                };
            }
        } else if (rateType.toLowerCase() === 'variable') {
            // Variable rate - automatically pass
            return {
                rate_valid: true,
                rate_type: rateType,
                reason: "Variable rate type - automatic pass",
                is_variable: true
            };
        }

        // Fixed rate (anything that isn't "Variable") - validate against AQ column amount
        if (!rateAmount || rateAmount === null) {
            return {
                rate_valid: false,
                rate_type: rateType,
                reason: "Fixed rate type but no rate amount in database (column AQ empty)"
            };
        }

        // For fixed rates, validate with exact match (no tolerance)
        const formattedAmount = rateAmount.toFixed(2);
        const amountWithCommas = Number(rateAmount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        
        // Create multiple patterns to handle different formatting
        const patterns = [
            new RegExp(`\\$?\\s*${this.escapeRegex(formattedAmount)}`, 'i'),  // $10924.20
            new RegExp(`\\$?\\s*${this.escapeRegex(amountWithCommas)}`, 'i'), // $10,924.20
            new RegExp(`\\$?\\s*${this.escapeRegex(rateAmount.toString())}`, 'i') // $10924.2
        ];
        
        for (const pattern of patterns) {
            if (pattern.test(pdfText)) {
                return {
                    rate_valid: true,
                    rate_type: rateType,
                    expected_amount: rateAmount,
                    amounts_found: [rateAmount],
                    reason: `Exact fixed rate amount found in PDF (${rateAmount})`,
                    is_variable: false
                };
            }
        }

        // If not found and API is configured, use LLM
        if (this.amplifyApiUrl && this.amplifyApiKey) {
            return await this.validateRateWithLLM(pdfText, "fixed", rateAmount, rateType);
        }

        return { 
            rate_valid: false, 
            rate_type: rateType,
            expected_amount: rateAmount,
            reason: "Fixed rate validation not possible without LLM" 
        };
    }

    async validateRateWithLLM(pdfText, expectedRateType, expectedAmount, actualRateType = null) {
        const prompt = `You are an expert at extracting billing and rate information from invoice documents.

TASK: Extract rate/amount information from this invoice and validate it against expected values.

DOCUMENT TEXT:
${pdfText}

EXPECTED RATE INFO:
- Type: ${expectedRateType}
- Amount: $${expectedAmount.toFixed(2)}
- Required: EXACT MATCH (no tolerance allowed)

INSTRUCTIONS:
1. Look for total amounts, line items, rates, fees, or billing amounts in the document
2. Pay attention to words like "total", "amount due", "invoice amount", "rate", "cost"
3. Extract all numeric amounts you find (convert to numbers)
4. Check if ANY amount exactly matches $${expectedAmount.toFixed(2)}
5. Consider different billing periods if rate type is known (monthly, annual, etc.)
6. Look for both individual line items and total amounts
7. IMPORTANT: Only exact matches are valid - no tolerance allowed

Return ONLY valid JSON in this exact format:
{
  "amounts_found": [123.45, 678.90, ...],
  "rate_valid": true/false,
  "matching_amounts": [123.45, ...],
  "reason": "explanation of what was found and why it passed/failed"
}`;

        try {
            const response = await this.callAmplifyApi(prompt);
            if (response) {
                const result = {
                    ...response,
                    rate_type: actualRateType,
                    expected_amount: expectedAmount,
                    expected_type: expectedRateType,
                    exact_match_required: true,
                    is_variable: false
                };
                console.log('\n=== RATE VALIDATION LLM OUTPUT ===');
                console.log(JSON.stringify(result, null, 2));
                console.log('=== END RATE VALIDATION OUTPUT ===\n');
                return result;
            }
            return { 
                rate_valid: false, 
                rate_type: actualRateType,
                reason: "LLM validation failed" 
            };
        } catch (error) {
            console.error(`Error in rate validation: ${error.message}`);
            return { 
                rate_valid: false, 
                rate_type: actualRateType,
                reason: `LLM error: ${error.message}` 
            };
        }
    }

    async callAmplifyApi(prompt) {
        if (!this.amplifyApiUrl || !this.amplifyApiKey) {
            throw new Error('Amplify API credentials not configured');
        }

        try {
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.amplifyApiKey}`
            };

            const payload = {
                data: {
                    temperature: 0.3,
                    max_tokens: 2000,
                    dataSources: [],
                    messages: [{ role: "user", content: prompt }],
                    options: {
                        ragOnly: false,
                        skipRag: true,
                        model: { id: "gpt-4o" },
                        prompt: prompt,
                    },
                }
            };

            const response = await axios.post(this.amplifyApiUrl, payload, {
                headers,
                timeout: 25000
            });

            if (response.status === 200) {
                const responseData = response.data;
                const apiResponse = responseData.data || "";

                if (apiResponse) {
                    try {
                        return JSON.parse(apiResponse);
                    } catch (jsonError) {
                        const jsonMatch = apiResponse.match(/```(?:json)?\s*(\{[^`]+\})\s*```/);
                        if (jsonMatch) {
                            try {
                                return JSON.parse(jsonMatch[1]);
                            } catch (parseError) {
                                console.error('Could not parse JSON from markdown');
                            }
                        }
                        console.error(`API response not valid JSON: ${apiResponse}`);
                        return null;
                    }
                }
            }
            return null;
        } catch (error) {
            throw error;
        }
    }

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
        
        // New logic: If ALL validations pass AND rate is fixed → Contact Main Contact
        if (!poFailed && !dateFailed && !rateFailed && !isVariableRate) {
            const mainContact = vendorInfo.mainContact;
            if (mainContact && mainContact !== null && mainContact !== undefined && mainContact.toString().toLowerCase() !== 'nan') {
                return {
                    name: mainContact,
                    role: "Main Contact",
                    reason: "All validations passed and rate is fixed - contact main contact"
                };
            }
        }
        
        // If any validation fails OR variable rate → Contact FUM
        const fum = vendorInfo.fum;
        
        if (fum && fum !== null && fum !== undefined && fum.toString().toLowerCase() !== 'nan') {
            const reasons = [];
            if (poFailed) reasons.push("PO validation failed");
            if (dateFailed) reasons.push("date validation failed");
            if (rateFailed) reasons.push("rate validation failed");
            if (isVariableRate) reasons.push("variable rate type");
            
            const reason = reasons.length > 0 ? 
                `Issue requires FUM attention: ${reasons.join(", ")}` : 
                "Default FUM contact";
            
            return {
                name: fum,
                role: "FUM",
                reason: reason
            };
        }
        
        return { name: "Unknown", role: "Unknown", reason: "No contact information available" };
    }
}