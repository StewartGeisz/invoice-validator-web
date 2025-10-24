import formidable from 'formidable';
import fs from 'fs/promises';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Mock validation function for demonstration
function generateMockValidation(filename, index = 0) {
  const mockVendors = [
    "The Budd Group",
    "Mid South Instrument Services Inc.", 
    "John Bouchard & Sons",
    "Atlas Copco",
    "Evoqua Water Technologies"
  ];
  
  const mockPOs = ["P26000686", "P26003063", "P25063542", "P22052202", "P24000969"];
  
  // Randomly determine validation results for demo
  const vendorIndex = index % mockVendors.length;
  const isValid = Math.random() > 0.3; // 70% success rate for demo
  
  return {
    vendor: mockVendors[vendorIndex],
    method: "mock_validation_vercel",
    po_valid: isValid ? true : Math.random() > 0.5,
    po_reason: isValid ? "PO number found in document" : "Expected PO not found",
    expected_po: mockPOs[vendorIndex],
    date_valid: isValid ? true : Math.random() > 0.5,
    date_reason: isValid ? "Dates fall within contract period" : "Dates outside contract period", 
    dates_found: ["2024-10-24", "2024-10-15"],
    valid_dates: isValid ? ["2024-10-24", "2024-10-15"] : [],
    rate_valid: isValid ? true : Math.random() > 0.5,
    rate_reason: isValid ? "Amount within expected range" : "Amount outside expected range",
    rate_type: Math.random() > 0.5 ? "annual" : "monthly",
    expected_amount: 25000 + (Math.random() * 75000),
    amounts_found: [25000 + (Math.random() * 75000)],
    is_variable_rate: Math.random() > 0.8,
    contact_person: isValid ? "Jane Manager" : "John Admin",
    contact_role: isValid ? "Director/Manager" : "Admin/Main Contact", 
    contact_reason: isValid ? "All validations passed" : "Validation issues require attention"
  };
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Processing file upload request...');

    // Parse form data
    const form = formidable({
      uploadDir: '/tmp',
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      multiples: true, // Allow multiple files
    });

    const [fields, files] = await form.parse(req);
    
    // Handle both single and multiple files
    const uploadedFiles = files.pdf ? (Array.isArray(files.pdf) ? files.pdf : [files.pdf]) : [];
    
    if (uploadedFiles.length === 0) {
      return res.status(400).json({ error: 'No PDF files uploaded' });
    }

    console.log(`Processing ${uploadedFiles.length} files...`);

    const results = [];

    // Process each file
    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      
      // Validate file type
      if (file.mimetype !== 'application/pdf') {
        console.log(`Skipping non-PDF file: ${file.originalFilename}`);
        
        results.push({
          filename: file.originalFilename || `file-${i}`,
          success: false,
          error: 'Only PDF files are allowed'
        });
        
        // Clean up invalid file
        try {
          await fs.unlink(file.filepath);
        } catch (cleanupError) {
          console.warn('Could not clean up invalid file:', cleanupError.message);
        }
        
        continue;
      }

      try {
        console.log(`Validating: ${file.originalFilename}`);

        // Generate mock validation result
        const validationResult = generateMockValidation(file.originalFilename, i);

        results.push({
          filename: file.originalFilename || `file-${i}.pdf`,
          success: true,
          result: validationResult
        });

        console.log(`✓ Completed: ${file.originalFilename}`);

      } catch (error) {
        console.error(`Error processing ${file.originalFilename}:`, error);
        
        results.push({
          filename: file.originalFilename || `file-${i}`,
          success: false,
          error: `Processing failed: ${error.message}`
        });
      }

      // Clean up file
      try {
        await fs.unlink(file.filepath);
      } catch (cleanupError) {
        console.warn('Could not clean up file:', cleanupError.message);
      }
    }

    // Return results
    const response = {
      success: true,
      message: `Processed ${results.length} files`,
      results: results,
      note: "This is a demo version with mock validation results. Deploy the Python service for real validation."
    };

    console.log(`Returning results for ${results.length} files`);
    return res.status(200).json(response);

  } catch (error) {
    console.error('Validation error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to process files',
      message: error.message
    });
  }
}