import formidable from 'formidable';
import PDFValidator from '../../lib/pdf-validator';
import fs from 'fs';

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
        // Parse the multipart form data with higher limits
        const form = formidable({
            maxFileSize: 50 * 1024 * 1024, // 50MB per file
            maxTotalFileSize: 500 * 1024 * 1024, // 500MB total
            keepExtensions: true,
        });

        const [fields, files] = await form.parse(req);
        
        // Get the uploaded PDF files
        const pdfFiles = files.pdf ? (Array.isArray(files.pdf) ? files.pdf : [files.pdf]) : [];
        
        if (pdfFiles.length === 0) {
            return res.status(400).json({ error: 'No PDF files provided' });
        }

        // Validate all files are PDFs
        for (const file of pdfFiles) {
            if (file.mimetype !== 'application/pdf') {
                return res.status(400).json({ 
                    error: `File ${file.originalFilename} must be a PDF` 
                });
            }
        }

        console.log(`Processing ${pdfFiles.length} files in batch mode`);

        // Process files in smaller batches to avoid memory issues
        const validator = new PDFValidator();
        const results = [];
        const batchSize = 3;

        for (let i = 0; i < pdfFiles.length; i += batchSize) {
            const batch = pdfFiles.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(pdfFiles.length/batchSize)}`);

            // Process current batch in parallel
            const batchPromises = batch.map(async (pdfFile) => {
                try {
                    // Read the PDF file into a buffer
                    const pdfBuffer = fs.readFileSync(pdfFile.filepath);

                    // Process the PDF
                    const result = await validator.processPdf(pdfBuffer, pdfFile.originalFilename);
                    
                    // Clean up temporary file
                    try {
                        fs.unlinkSync(pdfFile.filepath);
                    } catch (cleanupError) {
                        console.warn(`Failed to cleanup ${pdfFile.filepath}:`, cleanupError);
                    }
                    
                    return result;
                } catch (fileError) {
                    console.error(`Error processing ${pdfFile.originalFilename}:`, fileError);
                    
                    // Clean up file even on error
                    try {
                        fs.unlinkSync(pdfFile.filepath);
                    } catch (cleanupError) {
                        console.warn(`Failed to cleanup ${pdfFile.filepath}:`, cleanupError);
                    }
                    
                    return {
                        filename: pdfFile.originalFilename,
                        error: fileError.message || 'Processing failed',
                        vendor: null
                    };
                }
            });

            // Wait for current batch to complete
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Small delay between batches
            if (i + batchSize < pdfFiles.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        console.log(`Completed processing ${results.length} files`);

        res.status(200).json({
            success: true,
            results: results,
            count: results.length
        });

    } catch (error) {
        console.error('Batch upload error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
}

