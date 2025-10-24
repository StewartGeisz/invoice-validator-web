import React, { useState } from 'react';
import ValidationResults from './ValidationResults';

const MultipleValidationResults = ({ results, message, note, onNewUpload }) => {
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);

  if (!results || results.length === 0) {
    return (
      <div className="text-center">
        <div className="alert alert-warning">
          No validation results to display.
        </div>
      </div>
    );
  }

  // Calculate summary statistics
  const totalFiles = results.length;
  const successfulFiles = results.filter(r => r.success).length;
  const failedFiles = results.filter(r => !r.success).length;

  return (
    <div className="fade-in">
      {/* Summary Header */}
      <div className="card mb-4">
        <div className="card-body text-center">
          <h2>
            <i className="fas fa-file-alt text-primary me-2"></i>
            Batch Validation Results
          </h2>
          <p className="text-muted">{message}</p>
          
          <div className="row mt-3">
            <div className="col-md-4">
              <div className="border-end">
                <h4 className="text-info">{totalFiles}</h4>
                <small className="text-muted">Total Files</small>
              </div>
            </div>
            <div className="col-md-4">
              <div className="border-end">
                <h4 className="text-success">{successfulFiles}</h4>
                <small className="text-muted">Processed</small>
              </div>
            </div>
            <div className="col-md-4">
              <h4 className="text-danger">{failedFiles}</h4>
              <small className="text-muted">Failed</small>
            </div>
          </div>

          {note && (
            <div className="alert alert-info mt-3" role="alert">
              <i className="fas fa-info-circle me-2"></i>
              {note}
            </div>
          )}
        </div>
      </div>

      {/* File Selection Tabs */}
      {totalFiles > 1 && (
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0">
              <i className="fas fa-list me-2"></i>
              Select File to View Details
            </h5>
          </div>
          <div className="card-body">
            <div className="row">
              {results.map((result, index) => (
                <div key={index} className="col-md-6 col-lg-4 mb-2">
                  <button
                    type="button"
                    className={`btn w-100 ${selectedResultIndex === index ? 
                      (result.success ? 'btn-success' : 'btn-danger') : 
                      'btn-outline-secondary'}`}
                    onClick={() => setSelectedResultIndex(index)}
                  >
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="text-start">
                        <i className={`fas fa-file-pdf me-2 ${result.success ? 'text-light' : 'text-light'}`}></i>
                        <small className="fw-medium">{result.filename}</small>
                      </div>
                      <div>
                        {result.success ? (
                          <i className="fas fa-check-circle"></i>
                        ) : (
                          <i className="fas fa-exclamation-triangle"></i>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Current Result Details */}
      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">
            <i className="fas fa-file-pdf me-2"></i>
            {results[selectedResultIndex]?.filename || 'File Details'}
            {totalFiles > 1 && (
              <span className="badge bg-primary ms-2">
                {selectedResultIndex + 1} of {totalFiles}
              </span>
            )}
          </h5>
        </div>
        <div className="card-body">
          {results[selectedResultIndex]?.success ? (
            <ValidationResults
              result={{
                filename: results[selectedResultIndex].filename,
                result: results[selectedResultIndex].result
              }}
              onNewUpload={onNewUpload}
              hideNewUploadButton={totalFiles > 1}
            />
          ) : (
            <div className="alert alert-danger">
              <h5>
                <i className="fas fa-exclamation-triangle me-2"></i>
                Processing Failed
              </h5>
              <p className="mb-0">
                <strong>Error:</strong> {results[selectedResultIndex]?.error}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation and Actions */}
      {totalFiles > 1 && (
        <div className="card mt-3">
          <div className="card-body">
            <div className="row align-items-center">
              <div className="col-md-6">
                <div className="btn-group" role="group">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setSelectedResultIndex(Math.max(0, selectedResultIndex - 1))}
                    disabled={selectedResultIndex === 0}
                  >
                    <i className="fas fa-chevron-left me-1"></i>
                    Previous
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setSelectedResultIndex(Math.min(totalFiles - 1, selectedResultIndex + 1))}
                    disabled={selectedResultIndex === totalFiles - 1}
                  >
                    Next
                    <i className="fas fa-chevron-right ms-1"></i>
                  </button>
                </div>
              </div>
              <div className="col-md-6 text-end">
                <button 
                  onClick={onNewUpload}
                  className="btn btn-primary"
                >
                  <i className="fas fa-plus me-2"></i>
                  Validate More Invoices
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultipleValidationResults;