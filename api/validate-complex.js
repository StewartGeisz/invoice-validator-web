import formidable from 'formidable';
import fs from 'fs/promises';
import path from 'path';
const PDFValidator = require('../lib/pdfValidator');

export const config = {
  api: {
    bodyParser: false,
  },
};

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

        // Initialize validator and load data if needed
        const validator = new PDFValidator();
        await validator.loadVendorData();

        // Read file buffer
        const fileBuffer = await fs.readFile(file.filepath);

        // Process with real validation logic
        const validationResult = await validator.processFile(fileBuffer, file.originalFilename);

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
      message: `Processed ${results.length} files with real PDF validation`,
      results: results
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