import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper function to run Python validation
function runPythonValidation(filePath) {
  return new Promise((resolve, reject) => {
    const pythonScript = `
import sys
import json
sys.path.append('/tmp')

try:
    # Import validation logic (you'll need to upload these files to Vercel)
    from pdf_validator_serverless import validate_pdf_serverless
    
    result = validate_pdf_serverless("${filePath}")
    print("RESULT_START")
    print(json.dumps(result, default=str))
    print("RESULT_END")
    
except Exception as e:
    print("ERROR_START")
    print(str(e))
    print("ERROR_END")
    sys.exit(1)
`;

    const pythonProcess = spawn('python3', ['-c', pythonScript], {
      cwd: '/tmp'
    });

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const resultMatch = output.match(/RESULT_START\\s*(.*)\\s*RESULT_END/s);
          if (resultMatch) {
            const result = JSON.parse(resultMatch[1]);
            resolve(result);
          } else {
            reject(new Error('Could not parse Python output'));
          }
        } catch (parseError) {
          reject(new Error('Failed to parse validation result'));
        }
      } else {
        const errorMatch = errorOutput.match(/ERROR_START\\s*(.*)\\s*ERROR_END/s) || 
                          [null, errorOutput];
        reject(new Error(`Validation failed: ${errorMatch[1]}`));
      }
    });

    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start validation: ${error.message}`));
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse form data
    const form = formidable({
      uploadDir: '/tmp',
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
    });

    const [fields, files] = await form.parse(req);
    
    const uploadedFile = files.pdf?.[0];
    if (!uploadedFile) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    if (uploadedFile.mimetype !== 'application/pdf') {
      // Clean up
      fs.unlinkSync(uploadedFile.filepath);
      return res.status(400).json({ error: 'Only PDF files are allowed' });
    }

    console.log('Processing file:', uploadedFile.originalFilename);

    // For now, return a mock response since we can't easily run Python on Vercel
    // In a real deployment, you'd need to either:
    // 1. Port the Python logic to Node.js
    // 2. Use a separate Python service (like AWS Lambda)
    // 3. Use Vercel's Python runtime (beta)
    
    const mockResult = {
      vendor: "Mock Vendor (Vercel Deployment)",
      method: "mock_for_demo",
      po_valid: true,
      po_reason: "Mock validation - deploy Python service separately",
      expected_po: "P12345",
      date_valid: true,
      date_reason: "Mock validation successful",
      dates_found: ["2024-01-15"],
      valid_dates: ["2024-01-15"],
      rate_valid: true,
      rate_reason: "Mock validation successful",
      rate_type: "annual",
      expected_amount: 50000,
      amounts_found: [50000],
      is_variable_rate: false,
      contact_person: "Mock Contact Person",
      contact_role: "Administrator",
      contact_reason: "Mock validation - all checks passed"
    };

    // Clean up uploaded file
    fs.unlinkSync(uploadedFile.filepath);

    res.json({
      success: true,
      filename: uploadedFile.originalFilename,
      result: mockResult,
      note: "This is a mock response for Vercel deployment demo. Deploy Python service separately for full validation."
    });

  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      error: 'Failed to validate PDF',
      message: error.message
    });
  }
}