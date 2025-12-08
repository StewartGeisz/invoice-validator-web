import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Audit Logger Service
 * 
 * Designed for easy migration to MongoDB:
 * - All storage operations abstracted into private methods
 * - Consistent data structure that maps directly to MongoDB documents
 * - Simple interface that can be swapped with MongoDB client
 * 
 * To migrate to MongoDB:
 * 1. Replace _saveLogEntry() and _loadLogs() with MongoDB operations
 * 2. Replace _savePdf() with GridFS or MongoDB file storage
 * 3. Keep the public interface (logValidation) unchanged
 */
class AuditLogger {
    constructor() {
        this.logDir = path.join(process.cwd(), 'audit_log');
        this.logFile = path.join(this.logDir, 'logs.json');
        this.pdfDir = path.join(this.logDir, 'pdfs');
        
        // Ensure directories exist
        this._ensureDirectories();
    }

    /**
     * Main public method to log a validation
     * @param {Object} validationResult - Result from PDFValidator.processPdf()
     * @param {Buffer} pdfBuffer - Original PDF file buffer
     * @param {string} originalFilename - Original filename
     * @param {Object} metadata - Additional metadata (optional)
     * @returns {Promise<string>} Unique validation ID
     */
    async logValidation(validationResult, pdfBuffer, originalFilename, metadata = {}) {
        try {
            // Generate unique ID for this validation
            const validationId = crypto.randomUUID ? crypto.randomUUID() : this._generateId();
            const timestamp = new Date().toISOString();

            // Extract full PDF text (should be available in validation result)
            const pdfText = validationResult.pdf_text_full || validationResult.pdf_text_sample || '';

            // Create log entry with all relevant information
            const logEntry = {
                // Unique identifier (maps to MongoDB _id)
                id: validationId,
                timestamp: timestamp,
                
                // File information
                originalFilename: originalFilename,
                pdfFilename: `${validationId}_${this._sanitizeFilename(originalFilename)}`,
                pdfPath: `pdfs/${validationId}_${this._sanitizeFilename(originalFilename)}`,
                
                // PDF content metadata
                pdfSize: pdfBuffer.length,
                pdfTextLength: validationResult.pdf_text_length || 0,
                pdfText: pdfText, // Full extracted text
                
                // Validation results
                vendor: validationResult.vendor || null,
                vendorMatchMethod: validationResult.method || null,
                
                // PO Validation
                poValidation: {
                    valid: validationResult.po_valid,
                    reason: validationResult.po_reason || null,
                    expectedPo: validationResult.expected_po || null,
                },
                
                // Date Validation
                dateValidation: {
                    valid: validationResult.date_valid,
                    reason: validationResult.date_reason || null,
                    datesFound: validationResult.dates_found || [],
                    validDates: validationResult.valid_dates || [],
                },
                
                // Rate Validation
                rateValidation: {
                    valid: validationResult.rate_valid,
                    reason: validationResult.rate_reason || null,
                    rateType: validationResult.rate_type || null,
                    expectedAmount: validationResult.expected_amount || null,
                    amountsFound: validationResult.amounts_found || [],
                    isVariableRate: validationResult.is_variable_rate || false,
                },
                
                // Contact recommendation
                contactRecommendation: {
                    person: validationResult.contact_person || null,
                    role: validationResult.contact_role || null,
                    reason: validationResult.contact_reason || null,
                },
                
                // Overall validation status
                overallStatus: this._determineOverallStatus(validationResult),
                
                // Additional metadata
                metadata: {
                    ...metadata,
                    userAgent: metadata.userAgent || null,
                    ipAddress: metadata.ipAddress || null,
                    sessionId: metadata.sessionId || null,
                    referenceId: metadata.referenceId || null,
                    originalSenderEmail: metadata.sourceEmail || null, // Store original sender for tracking
                },
                
                // Store reference ID at top level for easy lookup
                referenceId: metadata.referenceId || null,
                
                // Store original sender email at top level for easy access
                originalSenderEmail: metadata.sourceEmail || null,
                
                // Error information (if any)
                error: validationResult.error || null,
            };

            // Save log entry and PDF file
            await Promise.all([
                this._saveLogEntry(logEntry),
                this._savePdf(pdfBuffer, logEntry.pdfFilename)
            ]);

            console.log(`Audit log entry created: ${validationId} for ${originalFilename}`);
            return validationId;

        } catch (error) {
            console.error('Error logging validation:', error);
            // Don't throw - logging failures shouldn't break validation
            return null;
        }
    }

    /**
     * Get all log entries (for admin/reporting)
     * @param {Object} filters - Optional filters (for MongoDB query compatibility)
     * @returns {Promise<Array>} Array of log entries
     */
    async getLogs(filters = {}) {
        return this._loadLogs(filters);
    }

    /**
     * Get a specific log entry by ID
     * @param {string} validationId - Validation ID
     * @returns {Promise<Object|null>} Log entry or null
     */
    async getLogById(validationId) {
        const logs = await this._loadLogs();
        return logs.find(entry => entry.id === validationId) || null;
    }

    // ============================================
    // PRIVATE METHODS - Storage Abstraction Layer
    // ============================================
    // These methods can be easily replaced with MongoDB operations

    /**
     * Save log entry to storage
     * CURRENT: JSON file
     * FUTURE: MongoDB collection.insertOne()
     */
    async _saveLogEntry(logEntry) {
        const logs = await this._loadLogs();
        logs.push(logEntry);
        
        // Write to JSON file (current implementation)
        fs.writeFileSync(this.logFile, JSON.stringify(logs, null, 2));
        
        // FUTURE MongoDB implementation would be:
        // await db.collection('audit_logs').insertOne(logEntry);
    }

    /**
     * Load log entries from storage
     * CURRENT: JSON file
     * FUTURE: MongoDB collection.find()
     */
    async _loadLogs(filters = {}) {
        // Current JSON file implementation
        if (!fs.existsSync(this.logFile)) {
            return [];
        }

        const fileContent = fs.readFileSync(this.logFile, 'utf-8');
        let logs = JSON.parse(fileContent);

        // Apply filters (simple implementation for JSON)
        // FUTURE: MongoDB would handle this in the query
        if (filters.vendor) {
            logs = logs.filter(entry => entry.vendor === filters.vendor);
        }
        if (filters.startDate) {
            logs = logs.filter(entry => entry.timestamp >= filters.startDate);
        }
        if (filters.endDate) {
            logs = logs.filter(entry => entry.timestamp <= filters.endDate);
        }
        if (filters.status) {
            logs = logs.filter(entry => entry.overallStatus === filters.status);
        }

        return logs;
    }

    /**
     * Save PDF file to storage
     * CURRENT: File system
     * FUTURE: MongoDB GridFS or file storage service
     */
    async _savePdf(pdfBuffer, filename) {
        const pdfPath = path.join(this.pdfDir, filename);
        fs.writeFileSync(pdfPath, pdfBuffer);
        
        // FUTURE MongoDB GridFS implementation would be:
        // const bucket = new GridFSBucket(db, { bucketName: 'pdfs' });
        // const uploadStream = bucket.openUploadStream(filename);
        // uploadStream.end(pdfBuffer);
    }

    /**
     * Get PDF file buffer
     * CURRENT: File system
     * FUTURE: MongoDB GridFS
     */
    async getPdfBuffer(validationId, originalFilename) {
        const filename = `${validationId}_${this._sanitizeFilename(originalFilename)}`;
        const pdfPath = path.join(this.pdfDir, filename);
        
        if (!fs.existsSync(pdfPath)) {
            return null;
        }
        
        return fs.readFileSync(pdfPath);
        
        // FUTURE MongoDB GridFS implementation would be:
        // const bucket = new GridFSBucket(db, { bucketName: 'pdfs' });
        // return bucket.openDownloadStreamByName(filename);
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    _ensureDirectories() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
        if (!fs.existsSync(this.pdfDir)) {
            fs.mkdirSync(this.pdfDir, { recursive: true });
        }
    }

    _sanitizeFilename(filename) {
        // Remove path separators and special characters
        return filename
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .substring(0, 100); // Limit length
    }

    _determineOverallStatus(validationResult) {
        const poValid = validationResult.po_valid;
        const dateValid = validationResult.date_valid;
        const rateValid = validationResult.rate_valid;

        // If any critical validation failed, status is failed
        if (poValid === false || dateValid === false || rateValid === false) {
            return 'failed';
        }

        // If all validations passed, status is passed
        if (poValid === true && dateValid === true && rateValid === true) {
            return 'passed';
        }

        // If some validations couldn't be performed (null), status is partial
        return 'partial';
    }

    _generateId() {
        // Fallback ID generator if crypto.randomUUID() is not available
        return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    }
}

// Export singleton instance
export default new AuditLogger();

