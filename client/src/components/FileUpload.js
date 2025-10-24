import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

const FileUpload = ({ onValidationStart, onValidationComplete, onValidationError }) => {
  const [selectedFile, setSelectedFile] = useState(null);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      onValidationError('Please upload a PDF file only');
      return;
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setSelectedFile(file);
    }
  }, [onValidationError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false,
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedFile) {
      onValidationError('Please select a PDF file');
      return;
    }

    onValidationStart();

    const formData = new FormData();
    formData.append('pdf', selectedFile);

    try {
      console.log('Uploading file:', selectedFile.name);
      
      const response = await axios.post('/api/validate', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000 // 60 second timeout
      });

      console.log('Validation response:', response.data);
      
      if (response.data.success) {
        onValidationComplete({
          filename: response.data.filename,
          result: response.data.result
        });
      } else {
        onValidationError(response.data.error || 'Validation failed');
      }
    } catch (error) {
      console.error('Validation error:', error);
      
      if (error.code === 'ECONNABORTED') {
        onValidationError('Request timed out. Please try again.');
      } else if (error.response?.data?.error) {
        onValidationError(error.response.data.error);
      } else {
        onValidationError('Failed to validate PDF. Please check your connection and try again.');
      }
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  return (
    <div className="row justify-content-center">
      <div className="col-md-8 col-lg-6">
        <div className="card">
          <div className="card-header text-center bg-transparent">
            <h2 className="mb-0">
              <i className="fas fa-upload text-primary me-2"></i>
              Upload Invoice for Validation
            </h2>
            <p className="text-muted mt-2">
              Upload a PDF invoice to validate vendor, PO number, dates, and rates
            </p>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div
                {...getRootProps()}
                className={`upload-area ${isDragActive ? 'drag-over' : ''}`}
              >
                <input {...getInputProps()} />
                
                {!selectedFile ? (
                  <>
                    <i className="fas fa-file-pdf fa-3x text-danger mb-3"></i>
                    <h5>
                      {isDragActive ? 'Drop PDF file here' : 'Select or drop PDF file'}
                    </h5>
                    <p className="text-muted">
                      Click to browse or drag and drop a PDF file
                    </p>
                    <small className="text-muted">
                      Maximum file size: 10MB
                    </small>
                  </>
                ) : (
                  <div>
                    <i className="fas fa-file-pdf fa-3x text-success mb-3"></i>
                    <h5>{selectedFile.name}</h5>
                    <p className="text-muted">
                      Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={removeFile}
                    >
                      <i className="fas fa-times me-1"></i>
                      Remove
                    </button>
                  </div>
                )}
              </div>
              
              <div className="d-grid mt-4">
                <button 
                  type="submit" 
                  className="btn btn-primary btn-lg"
                  disabled={!selectedFile}
                >
                  <i className="fas fa-search me-2"></i>
                  Validate Invoice
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