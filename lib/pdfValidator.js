const pdf = require('pdf-parse');
const XLSX = require('xlsx');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class PDFValidator {
  constructor() {
    this.vendors = [];
    this.vendorData = {};
    this.amplifyApiUrl = process.env.AMPLIFY_API_URL;
    this.amplifyApiKey = process.env.AMPLIFY_API_KEY;
  }

  async loadVendorData() {
    try {
      // Load Excel file
      const excelPath = path.join(process.cwd(), 'Service Agreement Table (Rolling).xlsx');
      const buffer = await fs.readFile(excelPath);
      const workbook = XLSX.read(buffer);
      
      // Load from Service Agreements sheet
      if (workbook.SheetNames.includes('Service Agreements')) {
        const worksheet = workbook.Sheets['Service Agreements'];
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        const vendorSet = new Set();
        
        data.forEach(row => {
          const vendor = row['Vendor'];
          if (vendor && vendor.toString().trim() && vendor.toString().trim().toLowerCase() !== 'nan') {
            const vendorName = vendor.toString().trim();
            vendorSet.add(vendorName);
            
            this.vendorData[vendorName] = {
              contract_start: row['Contract Start Date'],
              contract_end: row['Contract End Date'],
              current_po: row['Current PO'],
              po_start: row['PO Start'],
              po_end: row['PO End'],
              director: row['Asst Director / Director'],
              main_contact: row['Main Contact'],
              admin: row['Admin']
            };
          }
        });
        
        this.vendors = Array.from(vendorSet);
        console.log(`Loaded ${this.vendors.length} vendors from Service Agreements sheet`);
      }
      
      // Load rate data from Vendors Rates sheet
      if (workbook.SheetNames.includes('Vendors Rates')) {
        const rateSheet = workbook.Sheets['Vendors Rates'];
        const rateData = XLSX.utils.sheet_to_json(rateSheet, { header: 1 });
        
        let currentVendor = null;
        
        rateData.forEach(row => {
          if (row[0] && row[0].toString().trim() && row[0].toString().trim().length > 3) {
            currentVendor = row[0].toString().trim();
            
            if (!this.vendorData[currentVendor]) {
              this.vendorData[currentVendor] = {};
            }
            
            // Look for rate amount (usually in column 2)
            if (row[2] && typeof row[2] === 'number') {
              this.vendorData[currentVendor].rate_amount = row[2];
            }
            
            // Look for billing cycle information
            for (let i = 1; i < Math.min(10, row.length); i++) {
              const cellValue = row[i] ? row[i].toString().toLowerCase() : '';
              if (['annual', 'monthly', 'weekly', 'hourly', 'biannual', 'as needed', 'variable'].includes(cellValue)) {
                this.vendorData[currentVendor].rate_type = cellValue;
                break;
              }
            }
          }
        });
        
        const rateVendors = Object.keys(this.vendorData).filter(v => 
          this.vendorData[v].rate_type || this.vendorData[v].rate_amount
        );
        console.log(`Loaded rate data for ${rateVendors.length} vendors`);
      }
      
    } catch (error) {
      console.error('Error loading vendor data:', error);
      throw error;
    }
  }

  async extractPdfText(buffer) {
    try {
      const data = await pdf(buffer);
      return data.text;
    } catch (error) {
      console.error('Error extracting PDF text:', error);
      throw error;
    }
  }

  async queryAmplifyApi(pdfText) {
    if (!this.amplifyApiUrl || !this.amplifyApiKey) {
      throw new Error('Amplify API URL or key not configured');
    }

    const prompt = `You are an expert at identifying company names in invoices and matching them to a supplier database.

TASK: Analyze this invoice/document text and identify which supplier from the provided list is the vendor/company that issued this document.

INVOICE/DOCUMENT TEXT:
${pdfText}

SUPPLIER DATABASE:
${JSON.stringify(this.vendors, null, 2)}

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
      const response = await axios.post(this.amplifyApiUrl, {
        data: {
          temperature: 0.5,
          max_tokens: 4096,
          dataSources: [],
          messages: [{ role: "user", content: prompt }],
          options: {
            ragOnly: false,
            skipRag: true,
            model: { id: "gpt-4o" },
            prompt: prompt,
          },
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.amplifyApiKey}`
        },
        timeout: 30000
      });

      if (response.status === 200) {
        const apiResponse = response.data?.data || '';
        console.log('\n=== AMPLIFY API LLM OUTPUT ===');
        console.log(apiResponse);
        console.log('=== END LLM OUTPUT ===\n');

        if (apiResponse) {
          try {
            return JSON.parse(apiResponse);
          } catch (jsonError) {
            // Try to extract JSON from markdown code blocks
            const jsonMatch = apiResponse.match(/```(?:json)?\s*(\{[^`]+\})\s*```/);
            if (jsonMatch) {
              try {
                return JSON.parse(jsonMatch[1]);
              } catch (e) {
                console.error('Could not parse JSON from markdown:', e);
              }
            }
            console.error('API response not valid JSON:', apiResponse);
            return { vendor: null };
          }
        } else {
          console.error('Empty response from API');
          return { vendor: null };
        }
      } else {
        throw new Error(`Amplify API error: ${response.status}`);
      }
    } catch (error) {
      console.error('Error querying Amplify API:', error);
      throw error;
    }
  }

  validatePoNumber(pdfText, vendorName) {
    if (!this.vendorData[vendorName]) {
      return { po_valid: false, reason: 'Vendor not found in database' };
    }

    const vendorInfo = this.vendorData[vendorName];
    const expectedPo = vendorInfo.current_po;

    if (!expectedPo) {
      return { po_valid: null, reason: 'No PO number in database for this vendor' };
    }

    const poStr = expectedPo.toString().trim();
    
    if (pdfText.toLowerCase().includes(poStr.toLowerCase())) {
      return { po_valid: true, expected_po: poStr, reason: 'PO number found in PDF' };
    } else {
      return { po_valid: false, expected_po: poStr, reason: 'PO number not found in PDF' };
    }
  }

  async validateDateRange(pdfText, vendorName) {
    if (!this.vendorData[vendorName]) {
      return { date_valid: false, reason: 'Vendor not found in database' };
    }

    const vendorInfo = this.vendorData[vendorName];
    const contractStart = vendorInfo.contract_start;
    const contractEnd = vendorInfo.contract_end;

    if (!contractStart || !contractEnd) {
      return { date_valid: null, reason: 'No contract date range in database for this vendor' };
    }

    return await this.validateDatesWithLLM(pdfText, contractStart, contractEnd);
  }

  async validateDatesWithLLM(pdfText, contractStart, contractEnd) {
    if (!this.amplifyApiUrl || !this.amplifyApiKey) {
      return { date_valid: false, reason: 'API not configured for date validation' };
    }

    const prompt = `You are an expert at extracting dates from invoice documents and validating date ranges.

TASK: Extract all dates from this invoice/document and check if ANY of them fall within the given contract period.

DOCUMENT TEXT:
${pdfText}

CONTRACT PERIOD:
Start: ${contractStart}
End: ${contractEnd}

INSTRUCTIONS:
1. Extract ALL dates you can find in the document (invoice date, service dates, billing periods, etc.)
2. Convert each date to YYYY-MM-DD format if possible
3. Check if ANY extracted date falls within the contract period (inclusive)
4. Look for dates in formats like: MM/DD/YYYY, DD/MM/YYYY, Month DD YYYY, YYYY-MM-DD, etc.
5. Pay special attention to invoice dates, service period dates, billing dates

Return ONLY valid JSON in this exact format:
{
  "dates_found": ["YYYY-MM-DD", "YYYY-MM-DD", ...],
  "date_valid": true/false,
  "valid_dates": ["YYYY-MM-DD", ...],
  "reason": "explanation of result"
}`;

    try {
      const response = await axios.post(this.amplifyApiUrl, {
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
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.amplifyApiKey}`
        },
        timeout: 30000
      });

      if (response.status === 200) {
        const apiResponse = response.data?.data || '';
        console.log('\n=== DATE VALIDATION LLM OUTPUT ===');
        console.log(apiResponse);
        console.log('=== END DATE VALIDATION OUTPUT ===\n');

        if (apiResponse) {
          try {
            return JSON.parse(apiResponse);
          } catch (jsonError) {
            const jsonMatch = apiResponse.match(/```(?:json)?\s*(\{[^`]+\})\s*```/);
            if (jsonMatch) {
              try {
                return JSON.parse(jsonMatch[1]);
              } catch (e) {
                console.error('Could not parse JSON from markdown:', e);
              }
            }
            return { date_valid: false, reason: 'Could not parse LLM response' };
          }
        }
      }
      return { date_valid: false, reason: 'API call failed' };
    } catch (error) {
      console.error('Error in date validation:', error);
      return { date_valid: false, reason: `API error: ${error.message}` };
    }
  }

  async validateRate(pdfText, vendorName) {
    if (!this.vendorData[vendorName]) {
      return { rate_valid: false, reason: 'Vendor not found in database' };
    }

    const vendorInfo = this.vendorData[vendorName];
    const rateType = vendorInfo.rate_type;
    const rateAmount = vendorInfo.rate_amount;

    if (!rateType && !rateAmount) {
      return { rate_valid: null, reason: 'No rate data in database for this vendor' };
    }

    if (rateType && ['variable', 'as needed'].includes(rateType.toLowerCase())) {
      return {
        rate_valid: true,
        rate_type: rateType,
        reason: `Rate type is '${rateType}' - automatic pass`,
        is_variable: true
      };
    }

    if (rateType && rateAmount) {
      return await this.validateRateWithLLM(pdfText, rateType, rateAmount);
    } else if (rateAmount && !rateType) {
      return await this.validateRateWithLLM(pdfText, 'unknown', rateAmount);
    } else {
      return { rate_valid: null, reason: `Incomplete rate data - type: ${rateType}, amount: ${rateAmount}` };
    }
  }

  async validateRateWithLLM(pdfText, expectedRateType, expectedAmount) {
    if (!this.amplifyApiUrl || !this.amplifyApiKey) {
      return { rate_valid: false, reason: 'API not configured for rate validation' };
    }

    const tolerance = expectedAmount * 0.05;
    const minAmount = expectedAmount - tolerance;
    const maxAmount = expectedAmount + tolerance;

    const prompt = `You are an expert at extracting billing and rate information from invoice documents.

TASK: Extract rate/amount information from this invoice and validate it against expected values.

DOCUMENT TEXT:
${pdfText}

EXPECTED RATE INFO:
- Type: ${expectedRateType}
- Amount: $${expectedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Acceptable range: $${minAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - $${maxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (±5% tolerance)

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
      const response = await axios.post(this.amplifyApiUrl, {
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
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.amplifyApiKey}`
        },
        timeout: 30000
      });

      if (response.status === 200) {
        const apiResponse = response.data?.data || '';
        console.log('\n=== RATE VALIDATION LLM OUTPUT ===');
        console.log(apiResponse);
        console.log('=== END RATE VALIDATION OUTPUT ===\n');

        if (apiResponse) {
          try {
            const rateResult = JSON.parse(apiResponse);
            rateResult.expected_amount = expectedAmount;
            rateResult.rate_type = expectedRateType;
            rateResult.tolerance_range = `$${minAmount.toLocaleString()} - $${maxAmount.toLocaleString()}`;
            return rateResult;
          } catch (jsonError) {
            const jsonMatch = apiResponse.match(/```(?:json)?\s*(\{[^`]+\})\s*```/);
            if (jsonMatch) {
              try {
                const rateResult = JSON.parse(jsonMatch[1]);
                rateResult.expected_amount = expectedAmount;
                rateResult.rate_type = expectedRateType;
                rateResult.tolerance_range = `$${minAmount.toLocaleString()} - $${maxAmount.toLocaleString()}`;
                return rateResult;
              } catch (e) {
                console.error('Could not parse JSON from markdown:', e);
              }
            }
            return { rate_valid: false, reason: 'Could not parse LLM response' };
          }
        }
      }
      return { rate_valid: false, reason: 'API call failed' };
    } catch (error) {
      console.error('Error in rate validation:', error);
      return { rate_valid: false, reason: `API error: ${error.message}` };
    }
  }

  determineContactPerson(vendorName, poValidation, dateValidation, rateValidation) {
    if (!this.vendorData[vendorName]) {
      return { name: 'Unknown', role: 'Unknown', reason: 'Vendor not found in database' };
    }

    const vendorInfo = this.vendorData[vendorName];
    
    const poFailed = poValidation.po_valid === false;
    const dateFailed = dateValidation.date_valid === false;
    const rateFailed = rateValidation.rate_valid === false;
    const isVariableRate = rateValidation.is_variable === true;

    // If all tests pass AND rate is not variable → contact manager/director
    if (!poFailed && !dateFailed && !rateFailed && !isVariableRate) {
      const director = vendorInfo.director;
      if (director && director.toString().toLowerCase() !== 'nan' && director.toString().trim()) {
        return {
          name: director.toString().trim(),
          role: 'Director/Manager',
          reason: 'All validations passed and rate is fixed'
        };
      }
    }

    // Otherwise → contact admin/main contact
    const mainContact = vendorInfo.main_contact || vendorInfo.admin;
    
    if (mainContact && mainContact.toString().toLowerCase() !== 'nan' && mainContact.toString().trim()) {
      const reasons = [];
      if (poFailed) reasons.push('PO validation failed');
      if (dateFailed) reasons.push('date validation failed');
      if (rateFailed) reasons.push('rate validation failed');
      if (isVariableRate) reasons.push('variable rate type');
      
      const reason = reasons.length > 0 
        ? `Issue requires admin attention: ${reasons.join(', ')}` 
        : 'Default admin contact';
      
      return {
        name: mainContact.toString().trim(),
        role: 'Admin/Main Contact',
        reason: reason
      };
    }

    return { name: 'Unknown', role: 'Unknown', reason: 'No contact information available' };
  }

  async processFile(fileBuffer, filename) {
    try {
      console.log(`\nProcessing file: ${filename}`);
      
      // Extract PDF text
      const pdfText = await this.extractPdfText(fileBuffer);
      if (!pdfText) {
        throw new Error('Could not extract text from PDF');
      }

      console.log(`Extracted ${pdfText.length} characters from PDF`);

      // Identify vendor using LLM
      if (!this.amplifyApiUrl || !this.amplifyApiKey) {
        throw new Error('Amplify API not configured');
      }

      console.log('Querying Amplify API for vendor matching...');
      const apiResponse = await this.queryAmplifyApi(pdfText);

      if (!apiResponse || !apiResponse.vendor) {
        return { 
          vendor: null, 
          po_valid: null, 
          date_valid: null, 
          rate_valid: null,
          method: 'amplify_api',
          contact_person: 'Unknown',
          contact_role: 'Unknown',
          contact_reason: 'No vendor match found'
        };
      }

      const vendorName = apiResponse.vendor;
      console.log(`Vendor identified: ${vendorName}`);

      // Validate PO number
      console.log('Validating PO number...');
      const poValidation = this.validatePoNumber(pdfText, vendorName);

      // Validate date range
      console.log('Validating date range...');
      const dateValidation = await this.validateDateRange(pdfText, vendorName);

      // Validate rate
      console.log('Validating rate...');
      const rateValidation = await this.validateRate(pdfText, vendorName);

      // Determine contact person
      const contactPerson = this.determineContactPerson(vendorName, poValidation, dateValidation, rateValidation);

      // Compile final result
      const result = {
        vendor: vendorName,
        method: 'amplify_api',
        po_valid: poValidation.po_valid,
        po_reason: poValidation.reason,
        expected_po: poValidation.expected_po,
        date_valid: dateValidation.date_valid,
        date_reason: dateValidation.reason,
        dates_found: dateValidation.dates_found || [],
        valid_dates: dateValidation.valid_dates || [],
        rate_valid: rateValidation.rate_valid,
        rate_reason: rateValidation.reason,
        rate_type: rateValidation.rate_type || rateValidation.expected_type,
        expected_amount: rateValidation.expected_amount,
        amounts_found: rateValidation.amounts_found || [],
        is_variable_rate: rateValidation.is_variable || false,
        contact_person: contactPerson.name,
        contact_role: contactPerson.role,
        contact_reason: contactPerson.reason
      };

      return result;

    } catch (error) {
      console.error(`Error processing ${filename}:`, error);
      throw error;
    }
  }
}

module.exports = PDFValidator;