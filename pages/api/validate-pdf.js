import formidable from 'formidable';
import PDFValidator from '../../lib/pdf-validator';
import auditLogger from '../../lib/audit-logger';

export const config = {
    api: {
        bodyParser: false,
        responseLimit: false,
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const form = formidable({
            maxFileSize: Infinity,
            maxTotalFileSize: Infinity,
            keepExtensions: true,
        });

        const [fields, files] = await form.parse(req);
        
        const pdfFiles = files.pdf
            ? (Array.isArray(files.pdf) ? files.pdf : [files.pdf])
            : [];
        
        if (pdfFiles.length === 0) {
            return res.status(400).json({ error: 'No PDF files provided' });
        }

        for (const file of pdfFiles) {
            if (file.mimetype !== 'application/pdf') {
                return res.status(400).json({ error: `File ${file.originalFilename} must be a PDF` });
            }
        }

        const fs = require('fs');
        const validator = new PDFValidator();
        const results = [];

        console.log(`Processing ${pdfFiles.length} files sequentially...`);

        for (let i = 0; i < pdfFiles.length; i++) {
            const pdfFile = pdfFiles[i];
            let pdfBuffer = null;

            console.log(`Processing file ${i + 1}/${pdfFiles.length}: ${pdfFile.originalFilename}`);

            try {
                // Read file
                pdfBuffer = fs.readFileSync(pdfFile.filepath);

                // Validate
                const result = await validator.processPdf(pdfBuffer, pdfFile.originalFilename);
                results.push(result);

                console.log(`✅ Completed file ${i + 1}/${pdfFiles.length}: ${pdfFile.originalFilename}`);

                // Audit log (non-blocking)
                try {
                    await auditLogger.logValidation(
                        result,
                        pdfBuffer,
                        pdfFile.originalFilename,
                        {
                            ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
                            userAgent: req.headers['user-agent'],
                        }
                    );
                } catch (logError) {
                    console.error('Failed to log validation to audit trail:', logError);
                }

                // Cleanup
                fs.unlinkSync(pdfFile.filepath);

                // Delay before next file
                if (i < pdfFiles.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

            } catch (fileError) {
                console.error(`❌ Error processing ${pdfFile.originalFilename}:`, fileError);

                const errorResult = {
                    filename: pdfFile.originalFilename,
                    error: fileError.message || 'Processing failed',
                    vendor: null
                };

                results.push(errorResult);

                // Log error if we have the data
                if (pdfBuffer) {
                    try {
                        await auditLogger.logValidation(
                            errorResult,
                            pdfBuffer,
                            pdfFile.originalFilename,
                            {
                                ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
                                userAgent: req.headers['user-agent'],
                            }
                        );
                    } catch (logError) {
                        console.error('Failed to log error to audit trail:', logError);
                    }
                }

                try {
                    fs.unlinkSync(pdfFile.filepath);
                } catch (cleanupError) {
                    console.error('Failed to cleanup file:', cleanupError);
                }
            }
        }

        return res.status(200).json({
            success: true,
            results,
            count: results.length,
        });

    } catch (error) {
        console.error('PDF validation error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
}
