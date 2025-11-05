import formidable from 'formidable';
import PDFValidator from '../../lib/pdf-validator';

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Parse the multipart form data
        const form = formidable({
            maxFileSize: 10 * 1024 * 1024, // 10MB limit
            keepExtensions: true,
        });

        const [fields, files] = await form.parse(req);
        
        // Get the uploaded PDF files (support multiple files)
        const pdfFiles = files.pdf ? (Array.isArray(files.pdf) ? files.pdf : [files.pdf]) : [];
        
        if (pdfFiles.length === 0) {
            return res.status(400).json({ error: 'No PDF files provided' });
        }

        // Validate all files are PDFs
        for (const file of pdfFiles) {
            if (file.mimetype !== 'application/pdf') {
                return res.status(400).json({ error: `File ${file.originalFilename} must be a PDF` });
            }
        }

        // Process all PDF files
        const fs = require('fs');
        const validator = new PDFValidator();
        const results = [];

        for (const pdfFile of pdfFiles) {
            try {
                // Read the PDF file into a buffer
                const pdfBuffer = fs.readFileSync(pdfFile.filepath);

                // Process the PDF
                const result = await validator.processPdf(pdfBuffer, pdfFile.originalFilename);
                results.push(result);

                // Clean up temporary file
                fs.unlinkSync(pdfFile.filepath);
            } catch (fileError) {
                console.error(`Error processing ${pdfFile.originalFilename}:`, fileError);
                results.push({
                    filename: pdfFile.originalFilename,
                    error: fileError.message || 'Processing failed',
                    vendor: null
                });
                
                // Still clean up the file
                try {
                    fs.unlinkSync(pdfFile.filepath);
                } catch (cleanupError) {
                    console.error('Failed to cleanup file:', cleanupError);
                }
            }
        }

        res.status(200).json({
            success: true,
            results: results,
            count: results.length
        });

    } catch (error) {
        console.error('PDF validation error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
}