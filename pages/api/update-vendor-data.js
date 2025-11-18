import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { convertExcelToVendorData } from '../../lib/excel-converter';

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
        
        // Get the uploaded Excel file
        const excelFile = files.excel ? (Array.isArray(files.excel) ? files.excel[0] : files.excel) : null;
        
        if (!excelFile) {
            return res.status(400).json({ 
                success: false,
                error: 'No Excel file provided' 
            });
        }

        // Validate file is Excel format
        const validMimeTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/vnd.ms-excel.sheet.macroEnabled.12'
        ];
        
        const validExtensions = ['.xlsx', '.xls'];
        const fileExtension = path.extname(excelFile.originalFilename).toLowerCase();
        
        if (!validExtensions.includes(fileExtension) && 
            !validMimeTypes.includes(excelFile.mimetype)) {
            return res.status(400).json({ 
                success: false,
                error: 'File must be an Excel file (.xlsx or .xls)' 
            });
        }

        // Read and process the Excel file using shared conversion function
        const result = convertExcelToVendorData(excelFile.filepath);

        // Write to vendor-data.json
        const vendorDataPath = path.join(process.cwd(), 'data', 'vendor-data.json');
        fs.writeFileSync(vendorDataPath, JSON.stringify(result, null, 2));
        
        // Clean up temporary Excel file
        fs.unlinkSync(excelFile.filepath);

        res.status(200).json({
            success: true,
            message: `Successfully updated vendor database`,
            vendorCount: result.vendors.length,
            lastUpdated: result.lastUpdated,
            filename: excelFile.originalFilename
        });

    } catch (error) {
        console.error('Excel conversion error:', error);
        
        // Try to clean up temp file if it exists
        try {
            if (files.excel) {
                const excelFile = Array.isArray(files.excel) ? files.excel[0] : files.excel;
                if (excelFile && excelFile.filepath) {
                    fs.unlinkSync(excelFile.filepath);
                }
            }
        } catch (cleanupError) {
            console.error('Failed to cleanup file:', cleanupError);
        }
        
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to process Excel file'
        });
    }
}

