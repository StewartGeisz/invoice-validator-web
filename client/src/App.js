import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import ValidationResults from './components/ValidationResults';
import Header from './components/Header';
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  const [validationResult, setValidationResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleValidationComplete = (result) => {
    setValidationResult(result);
    setIsLoading(false);
    setError(null);
  };

  const handleValidationStart = () => {
    setIsLoading(true);
    setValidationResult(null);
    setError(null);
  };

  const handleValidationError = (errorMessage) => {
    setError(errorMessage);
    setIsLoading(false);
    setValidationResult(null);
  };

  const handleNewUpload = () => {
    setValidationResult(null);
    setError(null);
    setIsLoading(false);
  };

  return (
    <div className="App">
      <Header />
      
      <div className="container mt-4">
        {/* Error Alert */}
        {error && (
          <div className="alert alert-danger alert-dismissible fade show" role="alert">
            <i className="fas fa-exclamation-triangle me-2"></i>
            {error}
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => setError(null)}
            ></button>
          </div>
        )}

        {/* Main Content */}
        <div className="row justify-content-center">
          <div className="col-12">
            {!validationResult && !isLoading ? (
              <FileUpload 
                onValidationStart={handleValidationStart}
                onValidationComplete={handleValidationComplete}
                onValidationError={handleValidationError}
              />
            ) : isLoading ? (
              <div className="text-center">
                <div className="card">
                  <div className="card-body py-5">
                    <div className="loading-spinner mb-3"></div>
                    <h4>Validating Invoice...</h4>
                    <p className="text-muted">
                      Processing PDF and running validation checks...
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <ValidationResults 
                result={validationResult}
                onNewUpload={handleNewUpload}
              />
            )}
          </div>
        </div>

        {/* Information Section */}
        {!validationResult && !isLoading && (
          <div className="row justify-content-center mt-4">
            <div className="col-lg-8">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title">
                    <i className="fas fa-info-circle text-info me-2"></i>
                    What gets validated?
                  </h5>
                  <div className="row">
                    <div className="col-md-6">
                      <ul className="list-unstyled">
                        <li className="mb-2">
                          <i className="fas fa-check text-success me-2"></i>
                          <strong>Vendor Identification:</strong> Matches company name against approved supplier database
                        </li>
                        <li className="mb-2">
                          <i className="fas fa-check text-success me-2"></i>
                          <strong>PO Number:</strong> Verifies purchase order number appears in document
                        </li>
                      </ul>
                    </div>
                    <div className="col-md-6">
                      <ul className="list-unstyled">
                        <li className="mb-2">
                          <i className="fas fa-check text-success me-2"></i>
                          <strong>Date Validation:</strong> Ensures invoice dates fall within contract periods
                        </li>
                        <li className="mb-2">
                          <i className="fas fa-check text-success me-2"></i>
                          <strong>Rate Validation:</strong> Checks amounts against expected rates (±5% tolerance)
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;