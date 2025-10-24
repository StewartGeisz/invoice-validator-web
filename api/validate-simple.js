const formidable = require('formidable');
const fs = require('fs').promises;
const path = require('path');

// Simple validation function for testing
function createMockValidation(filename) {
  return {
    vendor: "Test Vendor Corporation", 
    method: "amplify_api_test",
    po_valid: true,
    po_reason: "PO validation test passed",
    expected_po: "TEST123456",
    date_valid: true,
    date_reason: "Date validation test passed",
    dates_found: ["2024-10-24"],
    valid_dates: ["2024-10-24"],
    rate_valid: true,
    rate_reason: "Rate validation test passed",
    rate_type: "annual",
    expected_amount: 50000,
    amounts_found: [50000],
    is_variable_rate: false,
    contact_person: "John Test Manager",
    contact_role: "Director/Manager",
    contact_reason: "All test validations passed"
  };
}

module.exports = async function handler(req, res) {
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
      multiples: true,
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
        console.log(`Processing: ${file.originalFilename}`);

        // For now, use simple mock validation to test the flow
        const validationResult = createMockValidation(file.originalFilename);

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
      message: `Processed ${results.length} files (simplified validation)`,
      results: results,
      note: "This is a simplified version to test the upload flow. Real PDF validation coming next."
    };

    console.log(`Returning results for ${results.length} files`);
    return res.status(200).json(response);

  } catch (error) {
    console.error('Validation error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to process files',
      message: error.message,
      stack: error.stack
    });
  }
};