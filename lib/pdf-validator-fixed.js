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
            throw new Error("Could not extract text from PDF");
        }

        console.log(`Extracted ${pdfText.length} characters from PDF`);

        console.log('\n--- PDF TEXT SAMPLE (first 300 chars) ---');
        console.log(pdfText.substring(0, 300) + (pdfText.length > 300 ? '...' : ''));
        console.log('--- END PDF TEXT SAMPLE ---\n');

        let vendorName = this.performLooseVendorMatch(pdfText);
        let method = 'loose_match';

        if (!vendorName) {
            if (!this.amplifyApiUrl || !this.amplifyApiKey) {
                console.log('Amplify API not configured - cannot match vendors');
                return { 
                    vendor: null, 
                    method: 'no_api',
                    filename: filename,
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
                    filename: filename,
                    pdf_text_sample: pdfText.substring(0, 500),
                    vendor_list: this.vendorList.slice(0, 20)
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

    // All other methods remain exactly the same as original...
    // [Copy remaining methods from original implementation]
}