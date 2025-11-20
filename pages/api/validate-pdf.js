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
                // Read file with error handling
                try {
                    pdfBuffer = fs.readFileSync(pdfFile.filepath);
                } catch (readError) {
                    throw new Error(`Could not read PDF file: ${readError.message}`);
                }

                // Validate file is actually a PDF
                if (!pdfBuffer || pdfBuffer.length === 0) {
                    throw new Error("PDF file appears to be empty or corrupted");
                }

                // Check PDF header (basic validation)
                const header = pdfBuffer.slice(0, 4).toString();
                if (header !== '%PDF') {
                    throw new Error("File does not appear to be a valid PDF (missing PDF header)");
                }

                // Process PDF with timeout protection
                const result = await Promise.race([
                    validator.processPdf(pdfBuffer, pdfFile.originalFilename),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error("PDF processing timeout (file may be too complex)")), 120000) // 2 minute timeout per file
                    )
                ]);
                
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

                // Provide clean, user-friendly error messages
                let friendlyError = "PDF couldn't be processed";
                
                if (fileError.message.includes("Could not read PDF")) {
                    friendlyError = "PDF file couldn't be read - file may be corrupted";
                } else if (fileError.message.includes("empty or corrupted")) {
                    friendlyError = "PDF file appears to be empty or corrupted";
                } else if (fileError.message.includes("missing PDF header")) {
                    friendlyError = "File doesn't appear to be a valid PDF";
                } else if (fileError.message.includes("timeout")) {
                    friendlyError = "PDF processing timeout - file may be too large or complex";
                } else if (fileError.message.includes("password") || fileError.message.includes("encrypted")) {
                    friendlyError = "PDF is password protected or encrypted";
                } else if (fileError.message.includes("parse") || fileError.message.includes("extract")) {
                    friendlyError = "PDF text couldn't be extracted - unusual format";
                } else {
                    friendlyError = "PDF couldn't be processed - please try another file";
                }

                const errorResult = {
                    filename: pdfFile.originalFilename,
                    error: friendlyError,
                    vendor: null,
                    po_valid: false,
                    date_valid: false,
                    rate_valid: false,
                    contact_person: "Unknown",
                    contact_role: "Support",
                    contact_reason: "File processing error - contact support if needed"
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
        
        // Provide user-friendly error message
        let userError = "Server error processing files";
        if (error.message.includes("maxFileSize") || error.message.includes("too large")) {
            userError = "One or more files are too large to process";
        } else if (error.message.includes("timeout")) {
            userError = "Processing timeout - try fewer files or smaller files";
        } else if (error.message.includes("memory") || error.message.includes("ENOMEM")) {
            userError = "Server ran out of memory - try processing fewer files at once";
        } else if (error.message.includes("ENOENT") || error.message.includes("file not found")) {
            userError = "File processing error - some files may be corrupted";
        }
        
        return res.status(500).json({
            success: false,
            error: userError,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
