#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import XLSX from 'xlsx';
import axios from 'axios';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config();

class PDFVendorMatcher {
    constructor(excelFilePath) {
        this.excelFilePath = excelFilePath;
        this.vendorList = [];
        this.vendorData = {};
        this.amplifyApiUrl = process.env.AMPLIFY_API_URL;
        this.amplifyApiKey = process.env.AMPLIFY_API_KEY;
        
        this.loadVendorData();
    }

    async extractPdfText(pdfPath) {
        try {
            console.log(`Extracting text from PDF: ${pdfPath}`);
            
            const dataBuffer = fs.readFileSync(pdfPath);
            const data = await pdf(dataBuffer);
            
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

    loadVendorData() {
        try {
            console.log(`Loading vendor data from: ${this.excelFilePath}`);
            
            const workbook = XLSX.readFile(this.excelFilePath);
            
            let sheetName = 'Service Agreements';
            if (!workbook.SheetNames.includes(sheetName)) {
                console.log('Service Agreements sheet not found, trying first sheet');
                sheetName = workbook.SheetNames[0];
            }
            
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (jsonData.length === 0) {
                console.error('No data found in spreadsheet');
                return;
            }
            
            const headers = jsonData[0];
            console.log('Available columns:', headers);
            
            const vendorColumnIndex = headers.findIndex(header => 
                header && header.toString().toLowerCase().includes('vendor')
            );
            
            if (vendorColumnIndex === -1) {
                console.error('No vendor column found');
                return;
            }
            
            const vendors = new Set();
            
            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (row[vendorColumnIndex] && row[vendorColumnIndex].toString().trim()) {
                    const vendorName = row[vendorColumnIndex].toString().trim();
                    vendors.add(vendorName);
                    
                    // Column AQ is index 42 (AQ = 1*26 + 17 - 1 = 42)
                    const rateAmount = row[42]; // Column AQ
                    
                    // Get PO number - try Current PO first, then FY25 PO, then FY24 PO
                    let currentPo = row[headers.indexOf('Current PO')] || null;
                    if (!currentPo) {
                        currentPo = row[headers.indexOf('FY25 PO')] || null;
                    }
                    if (!currentPo) {
                        currentPo = row[headers.indexOf('FY24 PO')] || null;
                    }
                    
                    this.vendorData[vendorName] = {
                        contractStart: row[headers.indexOf('Contract Start Date')] || null,
                        contractEnd: row[headers.indexOf('Contract End Date')] || null,
                        currentPo: currentPo,
                        poStart: row[headers.indexOf('PO Start')] || null,
                        poEnd: row[headers.indexOf('PO End')] || null,
                        mainContact: row[headers.indexOf('Main Contact')] || null,
                        admin: row[headers.indexOf('Admin')] || null,
                        director: row[headers.indexOf('Asst Director / Director')] || null,
                        rateAmount: (rateAmount && typeof rateAmount === 'number') ? rateAmount : null
                    };
                }
            }
            
            this.vendorList = Array.from(vendors).filter(v => v.toLowerCase() !== 'nan');
            console.log(`Loaded ${this.vendorList.length} unique vendors with detailed data`);
            console.log(`Sample vendors:`, this.vendorList.slice(0, 5));
            
        } catch (error) {
            console.error(`Error loading vendor data: ${error.message}`);
            this.vendorList = [];
        }
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
                timeout: 30000 
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

    async processPdf(pdfPath, debug = false) {
        console.log(`\nProcessing PDF: ${pdfPath}`);
        
        const pdfText = await this.extractPdfText(pdfPath);
        if (!pdfText) {
            return { error: "Could not extract text from PDF" };
        }

        console.log(`Extracted ${pdfText.length} characters from PDF`);

        if (debug) {
            console.log('\n--- PDF TEXT SAMPLE (first 300 chars) ---');
            console.log(pdfText.substring(0, 300) + (pdfText.length > 300 ? '...' : ''));
            console.log('--- END PDF TEXT SAMPLE ---\n');
        }

        let vendorName = this.performLooseVendorMatch(pdfText);
        let method = 'loose_match';

        if (!vendorName) {
            if (!this.amplifyApiUrl || !this.amplifyApiKey) {
                console.log('Amplify API not configured - cannot match vendors');
                return { error: "API not configured" };
            }

            const apiResponse = await this.queryAmplifyApi(pdfText);
            
            if (!apiResponse || !apiResponse.vendor) {
                console.log('No vendor match found');
                return { 
                    vendor: null, 
                    method: 'amplify_api',
                    pdf_text_sample: pdfText.substring(0, 500),
                    vendor_list: this.vendorList
                };
            }
            
            vendorName = apiResponse.vendor;
            method = 'amplify_api';
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
        const expectedLower = expectedPo.toLowerCase();
        
        // Remove any trailing whitespace from expected PO
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
        const prompt = `You are an expert at extracting dates from invoice documents and validating date ranges.

TASK: Extract all dates from this invoice/document and check if ANY of them fall within the given PO (Purchase Order) period.

DOCUMENT TEXT:
${pdfText}

PO PERIOD:
Start: ${poStart}
End: ${poEnd}

INSTRUCTIONS:
1. Extract ALL dates you can find in the document (invoice date, service dates, billing periods, etc.)
2. Convert each date to YYYY-MM-DD format if possible
3. Check if ANY extracted date falls within the PO period (inclusive)
4. Look for dates in formats like: MM/DD/YYYY, DD/MM/YYYY, Month DD YYYY, YYYY-MM-DD, etc.
5. Pay special attention to invoice dates, service period dates, billing dates
6. The PO period dates might be in Excel serial format - convert them properly to dates first

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
    }

    async validateRateWithLLM(pdfText, expectedRateType, expectedAmount) {
        const tolerance = expectedAmount * 0.05;
        const minAmount = expectedAmount - tolerance;
        const maxAmount = expectedAmount + tolerance;

        const prompt = `You are an expert at extracting billing and rate information from invoice documents.

TASK: Extract rate/amount information from this invoice and validate it against expected values.

DOCUMENT TEXT:
${pdfText}

EXPECTED RATE INFO:
- Type: ${expectedRateType}
- Amount: $${expectedAmount.toFixed(2)}
- Acceptable range: $${minAmount.toFixed(2)} - $${maxAmount.toFixed(2)} (±5% tolerance)

INSTRUCTIONS:
1. Look for total amounts, line items, rates, fees, or billing amounts in the document
2. Pay attention to words like "total", "amount due", "invoice amount", "rate", "cost"
3. Extract all numeric amounts you find (convert to numbers)
4. Check if ANY amount falls within the acceptable range
5. Consider different billing periods if rate type is known (monthly, annual, etc.)
6. Look for both individual line items and total amounts

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
                    tolerance_range: `$${minAmount.toFixed(2)} - $${maxAmount.toFixed(2)}`
                };
                console.log('\n=== RATE VALIDATION LLM OUTPUT ===');
                console.log(JSON.stringify(result, null, 2));
                console.log('=== END RATE VALIDATION OUTPUT ===\n');
                return result;
            }
            return { rate_valid: false, reason: "LLM validation failed" };
        } catch (error) {
            console.error(`Error in rate validation: ${error.message}`);
            return { rate_valid: false, reason: `LLM error: ${error.message}` };
        }
    }

    async callAmplifyApi(prompt) {
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
                timeout: 30000
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
}

async function main() {
    console.log('Starting PDF Vendor Matcher...');
    
    const excelPath = "Service Agreement Table (Rolling).xlsx";
    
    if (!fs.existsSync(excelPath)) {
        console.error(`Excel file not found: ${excelPath}`);
        process.exit(1);
    }

    console.log('Excel file found, initializing matcher...');
    const matcher = new PDFVendorMatcher(excelPath);

    console.log('\nLoaded vendors:');
    for (let i = 0; i < Math.min(10, matcher.vendorList.length); i++) {
        console.log(`  ${i + 1}. ${matcher.vendorList[i]}`);
    }
    if (matcher.vendorList.length > 10) {
        console.log(`  ... and ${matcher.vendorList.length - 10} more`);
    }

    const pdfFiles = fs.readdirSync('.').filter(file => file.endsWith('.pdf'));

    if (pdfFiles.length === 0) {
        console.log('\nNo PDF files found in current directory');
        return;
    }

    for (let i = 0; i < pdfFiles.length; i++) {
        const pdfFile = pdfFiles[i];
        const result = await matcher.processPdf(pdfFile, i === 0);

        console.log('\n' + '='.repeat(60));
        console.log(`PROCESSING RESULTS for ${pdfFile}`);
        console.log('='.repeat(60));

        if (result.error) {
            console.log(`[ERROR] ${result.error}`);
            continue;
        }

        if (result.vendor) {
            console.log(`[SUCCESS] VENDOR IDENTIFIED: ${result.vendor}`);
            console.log(`[INFO] Detection method: ${result.method}`);
            console.log(`[INFO] PDF text length: ${result.pdf_text_length} characters`);

            // PO validation results
            const poValid = result.po_valid;
            if (poValid === true) {
                console.log(`[PASS] PO NUMBER: Valid (${result.expected_po})`);
            } else if (poValid === false) {
                console.log(`[FAIL] PO NUMBER: Invalid - Expected ${result.expected_po} but not found`);
                console.log(`       Reason: ${result.po_reason}`);
            } else {
                console.log(`[WARN] PO NUMBER: ${result.po_reason}`);
            }

            // Date validation results
            const dateValid = result.date_valid;
            if (dateValid === true) {
                console.log(`[PASS] DATES: Valid - Found dates within contract period: ${result.valid_dates.join(', ')}`);
            } else if (dateValid === false) {
                console.log(`[FAIL] DATES: Invalid - Found dates: ${result.dates_found.join(', ')}`);
                console.log(`       Reason: ${result.date_reason}`);
            } else {
                console.log(`[WARN] DATES: ${result.date_reason}`);
            }

            // Rate validation results
            const rateValid = result.rate_valid;
            if (rateValid === true) {
                if (result.is_variable_rate) {
                    console.log(`[PASS] RATE: Variable rate type - automatic pass`);
                } else {
                    console.log(`[PASS] RATE: Valid - Expected $${result.expected_amount?.toFixed(2)}, Found amounts: ${result.amounts_found.join(', ')}`);
                }
            } else if (rateValid === false) {
                console.log(`[FAIL] RATE: Invalid - Expected $${result.expected_amount?.toFixed(2)}, Found amounts: ${result.amounts_found.join(', ')}`);
                console.log(`       Reason: ${result.rate_reason}`);
            } else {
                console.log(`[WARN] RATE: ${result.rate_reason}`);
            }

            // Contact person information
            const contactPerson = result.contact_person;
            const contactRole = result.contact_role;
            const contactReason = result.contact_reason;
            
            console.log();
            if (contactPerson && contactPerson !== 'Unknown') {
                console.log(`👤 [CONTACT] ${contactRole}: ${contactPerson}`);
                console.log(`   Reason: ${contactReason}`);
            } else {
                console.log(`⚠️  [CONTACT] ${contactReason}`);
            }

            // Overall status
            const allPassed = (poValid === true && dateValid === true && rateValid === true);
            const anyFailed = (poValid === false || dateValid === false || rateValid === false);

            console.log();
            if (allPassed) {
                console.log("🟢 [SUCCESS] OVERALL: INVOICE FULLY VALIDATED");
            } else if (anyFailed) {
                console.log("🔴 [FAILED] OVERALL: INVOICE VALIDATION FAILED");
            } else {
                console.log("🟡 [PARTIAL] OVERALL: PARTIAL VALIDATION (some checks couldn't be performed)");
            }

        } else {
            console.log('[FAILED] No vendor match found');
            console.log('\n--- PDF TEXT SAMPLE ---');
            console.log(result.pdf_text_sample);
            console.log('\n--- SUPPLIER LIST ---');
            result.vendor_list.slice(0, 10).forEach((vendor, idx) => {
                console.log(`${idx + 1}. ${vendor}`);
            });
            if (result.vendor_list.length > 10) {
                console.log(`... and ${result.vendor_list.length - 10} more suppliers`);
            }
            console.log('\n[ACTION] The above data would be sent to Amplify API for LLM analysis');
        }

        console.log('='.repeat(60));
    }
}

if (process.argv[1] && process.argv[1].endsWith('pdf-vendor-matcher.js')) {
    main().catch(console.error);
}

export default PDFVendorMatcher;