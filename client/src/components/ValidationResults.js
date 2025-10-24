import React from 'react';

const ValidationResults = ({ result, onNewUpload }) => {
  const { filename, result: validationData } = result;

  // Helper functions
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getOverallStatus = () => {
    const allPassed = (
      validationData.po_valid === true &&
      validationData.date_valid === true &&
      validationData.rate_valid === true
    );
    
    const anyFailed = (
      validationData.po_valid === false ||
      validationData.date_valid === false ||
      validationData.rate_valid === false
    );

    if (allPassed) return { status: 'success', text: 'FULLY VALIDATED', icon: 'check-circle' };
    if (anyFailed) return { status: 'fail', text: 'VALIDATION FAILED', icon: 'exclamation-triangle' };
    return { status: 'warn', text: 'PARTIAL VALIDATION', icon: 'info-circle' };
  };

  const overallStatus = getOverallStatus();

  const StatusBadge = ({ status, children }) => {
    const className = status === true ? 'status-pass' : 
                     status === false ? 'status-fail' : 'status-warn';
    
    const icon = status === true ? 'check' : 
                 status === false ? 'times' : 'question-circle';

    return (
      <span className={`status-badge ${className} me-3`}>
        <i className={`fas fa-${icon} me-1`}></i>
        {children}
      </span>
    );
  };

  return (
    <div className="fade-in">
      {/* Header Card */}
      <div className="card mb-4">
        <div className="card-body text-center">
          <h2>
            <i className="fas fa-file-alt text-primary me-2"></i>
            Validation Results: {filename}
          </h2>
          
          <span className={`status-badge status-${overallStatus.status}`}>
            <i className={`fas fa-${overallStatus.icon} me-1`}></i>
            {overallStatus.text}
          </span>
        </div>
      </div>

      <div className="row">
        {/* Validation Results Column */}
        <div className="col-lg-8">
          
          {/* Vendor Identification */}
          <div className="validation-section">
            <h5>
              <i className="fas fa-building text-primary me-2"></i>
              Vendor Identification
            </h5>
            {validationData.vendor ? (
              <div className="d-flex align-items-center">
                <StatusBadge status={true}>IDENTIFIED</StatusBadge>
                <strong>{validationData.vendor}</strong>
              </div>
            ) : (
              <div className="d-flex align-items-center">
                <StatusBadge status={false}>NOT FOUND</StatusBadge>
                <span className="text-muted">No matching vendor found in database</span>
              </div>
            )}
          </div>

          {/* PO Number Validation */}
          <div className="validation-section">
            <h5>
              <i className="fas fa-hashtag text-primary me-2"></i>
              Purchase Order Number
            </h5>
            {validationData.po_valid === true ? (
              <div className="d-flex align-items-center">
                <StatusBadge status={true}>VALID</StatusBadge>
                <span>PO Number <strong>{validationData.expected_po}</strong> found in document</span>
              </div>
            ) : validationData.po_valid === false ? (
              <div className="d-flex align-items-center">
                <StatusBadge status={false}>INVALID</StatusBadge>
                <span>Expected PO <strong>{validationData.expected_po}</strong> not found</span>
              </div>
            ) : (
              <div className="d-flex align-items-center">
                <StatusBadge status={null}>UNKNOWN</StatusBadge>
                <span className="text-muted">{validationData.po_reason || 'No PO data available'}</span>
              </div>
            )}
          </div>

          {/* Date Validation */}
          <div className="validation-section">
            <h5>
              <i className="fas fa-calendar text-primary me-2"></i>
              Date Validation
            </h5>
            {validationData.date_valid === true ? (
              <div>
                <div className="d-flex align-items-center">
                  <StatusBadge status={true}>VALID</StatusBadge>
                  <span>Dates fall within contract period</span>
                </div>
                {validationData.valid_dates && validationData.valid_dates.length > 0 && (
                  <div className="mt-2">
                    <small className="text-muted">Valid dates found: </small>
                    {validationData.valid_dates.map((date, index) => (
                      <span key={index} className="badge bg-success me-1">{date}</span>
                    ))}
                  </div>
                )}
              </div>
            ) : validationData.date_valid === false ? (
              <div>
                <div className="d-flex align-items-center">
                  <StatusBadge status={false}>INVALID</StatusBadge>
                  <span>Dates outside contract period</span>
                </div>
                {validationData.dates_found && validationData.dates_found.length > 0 && (
                  <div className="mt-2">
                    <small className="text-muted">Dates found: </small>
                    {validationData.dates_found.map((date, index) => (
                      <span key={index} className="badge bg-danger me-1">{date}</span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="d-flex align-items-center">
                <StatusBadge status={null}>UNKNOWN</StatusBadge>
                <span className="text-muted">{validationData.date_reason || 'No date data available'}</span>
              </div>
            )}
          </div>

          {/* Rate Validation */}
          <div className="validation-section">
            <h5>
              <i className="fas fa-dollar-sign text-primary me-2"></i>
              Rate Validation
            </h5>
            {validationData.rate_valid === true ? (
              <div>
                <div className="d-flex align-items-center">
                  <StatusBadge status={true}>VALID</StatusBadge>
                  {validationData.is_variable_rate ? (
                    <span>Variable rate - automatic pass</span>
                  ) : (
                    <span>Amount within expected range (±5%)</span>
                  )}
                </div>
                {validationData.expected_amount && !validationData.is_variable_rate && (
                  <div className="mt-2">
                    <small className="text-muted">
                      Expected: <strong>{formatCurrency(validationData.expected_amount)}</strong>
                      {validationData.amounts_found && validationData.amounts_found.length > 0 && (
                        <>
                          {' | Found: '}
                          {validationData.amounts_found.map((amount, index) => (
                            <span key={index} className="badge bg-success me-1">
                              {formatCurrency(amount)}
                            </span>
                          ))}
                        </>
                      )}
                    </small>
                  </div>
                )}
              </div>
            ) : validationData.rate_valid === false ? (
              <div>
                <div className="d-flex align-items-center">
                  <StatusBadge status={false}>INVALID</StatusBadge>
                  <span>Amount outside expected range</span>
                </div>
                {validationData.expected_amount && (
                  <div className="mt-2">
                    <small className="text-muted">
                      Expected: <strong>{formatCurrency(validationData.expected_amount)}</strong>
                      {validationData.amounts_found && validationData.amounts_found.length > 0 && (
                        <>
                          {' | Found: '}
                          {validationData.amounts_found.map((amount, index) => (
                            <span key={index} className="badge bg-danger me-1">
                              {formatCurrency(amount)}
                            </span>
                          ))}
                        </>
                      )}
                    </small>
                  </div>
                )}
              </div>
            ) : (
              <div className="d-flex align-items-center">
                <StatusBadge status={null}>UNKNOWN</StatusBadge>
                <span className="text-muted">{validationData.rate_reason || 'No rate data available'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Contact Information Column */}
        <div className="col-lg-4">
          {/* Contact Person Card */}
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="fas fa-user text-primary me-2"></i>
                Contact Information
              </h5>
            </div>
            <div className="card-body">
              {validationData.contact_person && validationData.contact_person !== 'Unknown' ? (
                <>
                  <div className="text-center mb-3">
                    <i className="fas fa-user-circle fa-3x text-primary"></i>
                  </div>
                  <h6 className="text-center">{validationData.contact_person}</h6>
                  <p className="text-center text-muted">{validationData.contact_role}</p>
                  <hr />
                  <small className="text-muted">
                    <strong>Reason:</strong><br />
                    {validationData.contact_reason}
                  </small>
                </>
              ) : (
                <div className="text-center text-muted">
                  <i className="fas fa-question-circle fa-3x mb-3"></i>
                  <p>{validationData.contact_reason || 'No contact information available'}</p>
                </div>
              )}
            </div>
          </div>

          {/* Summary Card */}
          <div className="card mt-3">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="fas fa-chart-pie text-primary me-2"></i>
                Validation Summary
              </h5>
            </div>
            <div className="card-body">
              <div className="row text-center">
                <div className="col-6">
                  <div className="border-end">
                    {(() => {
                      const passed = [
                        validationData.vendor ? 1 : 0,
                        validationData.po_valid === true ? 1 : 0,
                        validationData.date_valid === true ? 1 : 0,
                        validationData.rate_valid === true ? 1 : 0
                      ].reduce((a, b) => a + b, 0);
                      
                      return (
                        <>
                          <h4 className="text-success">{passed}</h4>
                          <small className="text-muted">Passed</small>
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="col-6">
                  {(() => {
                    const failed = [
                      !validationData.vendor ? 1 : 0,
                      validationData.po_valid === false ? 1 : 0,
                      validationData.date_valid === false ? 1 : 0,
                      validationData.rate_valid === false ? 1 : 0
                    ].reduce((a, b) => a + b, 0);
                    
                    return (
                      <>
                        <h4 className="text-danger">{failed}</h4>
                        <small className="text-muted">Failed</small>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Actions Card */}
          <div className="card mt-3">
            <div className="card-body text-center">
              <button 
                onClick={onNewUpload}
                className="btn btn-primary"
              >
                <i className="fas fa-plus me-2"></i>
                Validate Another Invoice
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ValidationResults;