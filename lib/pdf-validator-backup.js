import pdf from 'pdf-parse';
import axios from 'axios';
import vendorData from '../data/vendor-data.json';

export default class PDFValidator {
    constructor() {
        this.vendorList = vendorData.vendors;
        this.vendorData = vendorData.vendorData;
        this.amplifyApiUrl = process.env.AMPLIFY_API_URL;
        this.amplifyApiKey = process.env.AMPLIFY_API_KEY;
    }

    async extractPdfText(pdfBuffer) {
        try {
            console.log('Extracting text from PDF buffer');
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
            throw new Error('Could not extract text from PDF');
        }
    }

    performLooseVendorMatch(pdfText) {
        console.log('Performing loose vendor name matching...');
        
        const pdfTextLower = pdfText.toLowerCase();
        let bestMatch = null;
        let bestScore = 0;
        
        for (const vendor of this.vendorList) {
            const vendorLower = vendor.toLowerCase();
            
            // First, try direct substring match
            if (pdfTextLower.includes(vendorLower)) {
                console.log(`Direct match found: "${vendor}"`);
                return vendor;
            }
            
            // Then try word-based matching with better scoring
            const vendorWords = vendorLower
                .replace(/[^\w\s]/g, ' ')
                .split(/\s+/)
                .filter(word => word.length > 2 && 
                    !['inc', 'llc', 'corp', 'ltd', 'the', 'and', 'of', 'for', 'services', 'service', 'company', 'co'].includes(word));
            
            if (vendorWords.length === 0) continue;
            
            // Calculate weighted score - longer, more specific words get higher weight
            let totalWeight = 0;
            let matchedWeight = 0;
            
            for (const word of vendorWords) {
                const weight = Math.max(1, word.length - 2); // Longer words get more weight
                totalWeight += weight;
                
                if (pdfTextLower.includes(word)) {
                    matchedWeight += weight;
                }
            }
            
            const score = totalWeight > 0 ? (matchedWeight / totalWeight) : 0;
            
            // Higher threshold and require at least 2 significant words to match
            if (score > bestScore && score >= 0.7 && vendorWords.length >= 2) {
                const matchedWords = vendorWords.filter(word => pdfTextLower.includes(word));
                if (matchedWords.length >= 2) {
                    bestMatch = vendor;
                    bestScore = score;
                }
            }
        }
        
        if (bestMatch) {
            console.log(`Best loose match found: "${bestMatch}" (${Math.round(bestScore * 100)}% weighted match)`);
            return bestMatch;
        }
        
        console.log('No good loose matches found - will use LLM fallback');
        return null;
    }

    async queryAmplifyApi(pdfText) {
        if (!this.amplifyApiUrl || !this.amplifyApiKey) {
            console.error('Error: Amplify API URL or key not found in environment variables');
            return null;
        }

        const prompt = `You are an expert at identifying company names in invoices and matching them to a supplier database.

TASK: Analyze this invoice/document text and identify which supplier from the provided list is the vendor/company that issued this document.

INVOICE/DOCUMENT TEXT:
${pdfText}

SUPPLIER DATABASE:
${JSON.stringify(this.vendorList, null, 2)}

MATCHING RULES:
1. Look for company names that appear as the sender/issuer of the invoice
2. Match variations like:
   - "Mid-South Instrument Service" → "Mid South Instrument Services Inc."
   - "The Budd Group" → "The Budd Group" 
   - "John Bouchard & Sons" → "John Bouchard & Sons"
3. Ignore differences in:
   - Punctuation (hyphens, periods, commas)
   - Word order variations
   - Legal suffixes (Inc, LLC, Corp, etc.)
   - Articles (The, A, An)
4. Be flexible with partial matches - "Evoqua" should match "Evoqua Water Technologies"
5. Look in headers, letterheads, "From:" fields, company contact info
6. If multiple potential matches, choose the most specific/complete one

IMPORTANT: Only match if you are confident this supplier is the one issuing the invoice/document. Return null if no clear match exists.

Return ONLY valid JSON in this exact format:
{"vendor": "Exact Name From Supplier List"} 

OR if no match found:
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
                timeout: 25000  // Reduced for serverless
            });

            if (response.status === 200) {
                const responseData = response.data;
                const apiResponse = responseData.data || "";

                console.log('=== AMPLIFY API LLM OUTPUT ===');
                console.log(apiResponse);
                console.log('=== END LLM OUTPUT ===');

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
        console.log(`Processing PDF: ${filename}`);
        
        const pdfText = await this.extractPdfText(pdfBuffer);
        if (!pdfText) {
            throw new Error("Could not extract text from PDF");
        }

        console.log(`Extracted ${pdfText.length} characters from PDF`);

        let vendorName = this.performLooseVendorMatch(pdfText);
        let method = 'loose_match';

        if (!vendorName) {
            if (!this.amplifyApiUrl || !this.amplifyApiKey) {
                console.log('Amplify API not configured - cannot match vendors');
                return { 
                    vendor: null, 
                    method: 'no_api',
                    pdf_text_sample: pdfText.substring(0, 500),
                    vendor_list: this.vendorList.slice(0, 20)
                };
            }

            const apiResponse = await this.queryAmplifyApi(pdfText);
            
            if (!apiResponse || !apiResponse.vendor) {
                console.log('No vendor match found');
                return { 
                    vendor: null, 
                    method: 'amplify_api',
                    pdf_text_sample: pdfText.substring(0, 500),
                    vendor_list: this.vendorList.slice(0, 20)
                };
            }
            
            vendorName = apiResponse.vendor;
            method = 'amplify_api';
        }

        console.log(`Vendor identified: ${vendorName} (method: ${method})`);
        console.log(`DEBUG: PDF text sample for matching:`, pdfText.substring(0, 500));
        
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

        const poStr = expectedPo.toString().trim();
        const localResult = this.findPoNumberLocally(pdfText, poStr);
        if (localResult.found) {
            return { po_valid: true, expected_po: poStr, reason: localResult.reason };
        }

        if (this.amplifyApiUrl && this.amplifyApiKey) {
            return await this.validatePoWithLLM(pdfText, poStr);
        }

        return { po_valid: false, expected_po: poStr, reason: `PO number ${poStr} not found in PDF text` };
    }

    findPoNumberLocally(pdfText, expectedPo) {
        const pdfTextLower = pdfText.toLowerCase();
        const cleanExpected = expectedPo.trim();
        const cleanExpectedLower = cleanExpected.toLowerCase();
        
        if (pdfTextLower.includes(cleanExpectedLower)) {
            return { found: true, reason: "Exact PO number match found in PDF" };
        }
        
        const poWithoutSpaces = cleanExpected.replace(/[\s-_.]/g, '');
        const poWithoutSpacesLower = poWithoutSpaces.toLowerCase();
        
        if (pdfTextLower.replace(/[\s-_.]/g, '').includes(poWithoutSpacesLower)) {
            return { found: true, reason: "PO number found in PDF (ignoring spacing/separators)" };
        }
        
        return { found: false, reason: "PO number not found using local search patterns" };
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

        const localResult = this.validateDatesLocally(pdfText, poStart, poEnd);
        if (localResult.date_valid === true) {
            return localResult;
        }

        return await this.validateDatesWithLLM(pdfText, poStart, poEnd);
    }

    validateDatesLocally(pdfText, poStart, poEnd) {
        const startDate = this.parseExcelDate(poStart);
        const endDate = this.parseExcelDate(poEnd);
        
        if (!startDate || !endDate) {
            return { date_valid: false, reason: "Could not parse PO start/end dates" };
        }

        const datePatterns = [
            /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g,
            /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g,
            /\b(\d{1,2})-(\d{1,2})-(\d{4})\b/g
        ];

        const extractedDates = [];
        const validDates = [];

        for (const pattern of datePatterns) {
            let match;
            while ((match = pattern.exec(pdfText)) !== null) {
                let dateObj = null;
                
                if (pattern === datePatterns[0] || pattern === datePatterns[2]) {
                    const month = parseInt(match[1]);
                    const day = parseInt(match[2]);
                    const year = parseInt(match[3]);
                    if (month <= 12 && day <= 31) {
                        dateObj = new Date(year, month - 1, day);
                    }
                } else if (pattern === datePatterns[1]) {
                    const year = parseInt(match[1]);
                    const month = parseInt(match[2]);
                    const day = parseInt(match[3]);
                    if (month <= 12 && day <= 31) {
                        dateObj = new Date(year, month - 1, day);
                    }
                }

                if (dateObj && !isNaN(dateObj.getTime())) {
                    const dateStr = dateObj.toISOString().split('T')[0];
                    if (!extractedDates.includes(dateStr)) {
                        extractedDates.push(dateStr);
                        
                        if (dateObj >= startDate && dateObj <= endDate) {
                            validDates.push(dateStr);
                        }
                    }
                }
            }
        }

        if (validDates.length > 0) {
            return { 
                date_valid: true, 
                dates_found: extractedDates, 
                valid_dates: validDates,
                reason: `Found ${validDates.length} valid date(s) within PO period`
            };
        }

        return { 
            date_valid: false, 
            dates_found: extractedDates, 
            valid_dates: [],
            reason: extractedDates.length > 0 ? 
                `Found ${extractedDates.length} date(s) but none fall within PO period` :
                "No dates found in PDF text"
        };
    }

    parseExcelDate(excelDate) {
        if (!excelDate) return null;
        
        if (excelDate instanceof Date) {
            return excelDate;
        }
        
        if (typeof excelDate === 'string') {
            const parsed = new Date(excelDate);
            if (!isNaN(parsed.getTime())) {
                return parsed;
            }
        }
        
        if (typeof excelDate === 'number') {
            const excelEpoch = new Date(1899, 11, 30);
            return new Date(excelEpoch.getTime() + excelDate * 24 * 60 * 60 * 1000);
        }
        
        return null;
    }

    async validateRate(pdfText, vendorName) {
        if (!this.vendorData[vendorName]) {
            return { rate_valid: false, reason: "Vendor not found in database" };
        }

        const vendorInfo = this.vendorData[vendorName];
        const rateAmount = vendorInfo.rateAmount;

        if (!rateAmount || rateAmount === null) {
            return {
                rate_valid: true,
                reason: "No rate amount in database - automatic pass",
                is_variable: true
            };
        }

        const amountPattern = new RegExp(`\\$?\\s*${rateAmount.toFixed(2)}`, 'i');
        if (amountPattern.test(pdfText)) {
            return {
                rate_valid: true,
                expected_amount: rateAmount,
                amounts_found: [rateAmount],
                reason: "Exact rate amount found in PDF"
            };
        }

        if (this.amplifyApiUrl && this.amplifyApiKey) {
            return await this.validateRateWithLLM(pdfText, "fixed", rateAmount);
        }

        return { rate_valid: false, reason: "Rate validation not possible without LLM" };
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
                return result;
            }
            return { po_valid: false, expected_po: expectedPo, reason: "LLM validation failed" };
        } catch (error) {
            console.error(`Error in PO validation: ${error.message}`);
            return { po_valid: false, expected_po: expectedPo, reason: `LLM error: ${error.message}` };
        }
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
                return response;
            }
            return { date_valid: false, reason: "LLM validation failed" };
        } catch (error) {
            console.error(`Error in date validation: ${error.message}`);
            return { date_valid: false, reason: `LLM error: ${error.message}` };
        }
    }

    async validateRateWithLLM(pdfText, expectedRateType, expectedAmount) {
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
                    expected_amount: expectedAmount,
                    expected_type: expectedRateType,
                    exact_match_required: true
                };
                return result;
            }
            return { rate_valid: false, reason: "LLM validation failed" };
        } catch (error) {
            console.error(`Error in rate validation: ${error.message}`);
            return { rate_valid: false, reason: `LLM error: ${error.message}` };
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