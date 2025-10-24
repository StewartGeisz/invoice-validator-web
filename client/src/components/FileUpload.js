import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

const FileUpload = ({ onValidationStart, onValidationComplete, onValidationError }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      onValidationError(`${rejectedFiles.length} file(s) rejected. Please upload PDF files only.`);
    }

    if (acceptedFiles.length > 0) {
      // Add new files to existing selection
      setSelectedFiles(prev => [...prev, ...acceptedFiles]);
    }
  }, [onValidationError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true, // Enable multiple file selection
    maxSize: 10 * 1024 * 1024 // 10MB per file
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (selectedFiles.length === 0) {
      onValidationError('Please select at least one PDF file');
      return;
    }

    onValidationStart();

    const formData = new FormData();
    
    // Append all selected files
    selectedFiles.forEach((file, index) => {
      formData.append('pdf', file);
    });

    try {
      console.log(`Uploading ${selectedFiles.length} files...`);
      
      const response = await axios.post('/api/validate', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000 // 2 minute timeout for multiple files
      });

      console.log('Validation response:', response.data);
      
      if (response.data.success) {
        onValidationComplete({
          results: response.data.results,
          message: response.data.message,
          note: response.data.note
        });
      } else {
        onValidationError(response.data.error || 'Validation failed');
      }
    } catch (error) {
      console.error('Validation error:', error);
      
      if (error.code === 'ECONNABORTED') {
        onValidationError('Request timed out. Please try with fewer files or smaller PDFs.');
      } else if (error.response?.data?.error) {
        onValidationError(error.response.data.error);
      } else {
        onValidationError('Failed to validate PDFs. Please check your connection and try again.');
      }
    }
  };

  const removeFile = (indexToRemove) => {
    setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="row justify-content-center">
      <div className="col-md-10 col-lg-8">
        <div className="card">
          <div className="card-header text-center bg-transparent">
            <h2 className="mb-0">
              <i className="fas fa-upload text-primary me-2"></i>
              Upload Invoice(s) for Validation
            </h2>
            <p className="text-muted mt-2">
              Upload one or more PDF invoices to validate vendor, PO number, dates, and rates
            </p>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div
                {...getRootProps()}
                className={`upload-area ${isDragActive ? 'drag-over' : ''}`}
              >
                <input {...getInputProps()} />
                
                {selectedFiles.length === 0 ? (
                  <>
                    <i className="fas fa-file-pdf fa-3x text-danger mb-3"></i>
                    <h5>
                      {isDragActive ? 'Drop PDF files here' : 'Select or drop PDF files'}
                    </h5>
                    <p className="text-muted">
                      Click to browse or drag and drop multiple PDF files
                    </p>
                    <small className="text-muted">
                      Maximum file size: 10MB per file
                    </small>
                  </>
                ) : (
                  <div>
                    <i className="fas fa-file-pdf fa-3x text-success mb-3"></i>
                    <h5>{selectedFiles.length} PDF file(s) selected</h5>
                    <p className="text-muted">
                      Click here or drag to add more files
                    </p>
                  </div>
                )}
              </div>
              
              {/* File List */}
              {selectedFiles.length > 0 && (
                <div className="mt-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="mb-0">Selected Files:</h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={clearAllFiles}
                    >
                      <i className="fas fa-trash me-1"></i>
                      Clear All
                    </button>
                  </div>
                  
                  <div className="list-group">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                          <i className="fas fa-file-pdf text-danger me-2"></i>
                          <span className="fw-medium">{file.name}</span>
                          <small className="text-muted ms-2">({formatFileSize(file.size)})</small>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => removeFile(index)}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="d-grid mt-4">
                <button 
                  type="submit" 
                  className="btn btn-primary btn-lg"
                  disabled={selectedFiles.length === 0}
                >
                  <i className="fas fa-search me-2"></i>
                  Validate {selectedFiles.length > 0 ? `${selectedFiles.length} Invoice${selectedFiles.length > 1 ? 's' : ''}` : 'Invoices'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;