'use client';

import { useState } from 'react';

interface ValidationResult {
  filename: string;
  vendor_match: boolean;
  po_match: boolean;
  date_valid: boolean;
  rate_valid?: boolean;
  admin: string;
  manager: string;
  fum?: string;
  rate_type?: string;
  rate_amount?: number;
  overall_status: 'APPROVED' | 'REJECTED';
  routing?: {
    primaryContact: string;
    contactType: 'admin' | 'manager' | 'fum';
    workflow: string;
  };
  extracted_data: {
    vendor: string;
    po_number: string;
    invoice_date: string;
    amount: number;
  };
  validation_details: {
    vendor: {
      extracted: string;
      matched: string;
      valid: boolean;
    };
    po: {
      extracted: string;
      matched: string;
      valid: boolean;
      po_start: string;
      po_end: string;
    };
    date: {
      invoice_date: string;
      valid: boolean;
      message: string;
    };
    rate?: {
      type: string;
      expected_amount: number;
      invoice_amount: number;
      valid: boolean;
      message: string;
      requires_fum_review: boolean;
    };
  };
}

interface ValidationResultsProps {
  results: ValidationResult[];
}

export default function ValidationResults({ results }: ValidationResultsProps) {
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const toggleExpanded = (filename: string) => {
    setExpandedResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filename)) {
        newSet.delete(filename);
      } else {
        newSet.add(filename);
      }
      return newSet;
    });
  };

  const approvedResults = results.filter(r => r.overall_status === 'APPROVED');
  const rejectedResults = results.filter(r => r.overall_status === 'REJECTED');

  const StatusBadge = ({ status }: { status: 'APPROVED' | 'REJECTED' }) => (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
      status === 'APPROVED' 
        ? 'bg-green-100 text-green-800' 
        : 'bg-red-100 text-red-800'
    }`}>
      {status}
    </span>
  );

  const CheckIcon = ({ valid }: { valid: boolean }) => (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${
      valid ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }`}>
      {valid ? '✓' : '✗'}
    </span>
  );

  const ResultCard = ({ result }: { result: ValidationResult }) => {
    const isExpanded = expandedResults.has(result.filename);
    
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {result.filename}
              </h3>
              <StatusBadge status={result.overall_status} />
            </div>
            <button
              onClick={() => toggleExpanded(result.filename)}
              className="text-gray-400 hover:text-gray-600 ml-4"
            >
              <svg 
                className={`w-6 h-6 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Routing Info - Shows primary contact based on workflow */}
          <div className="mb-4">
            {result.routing ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                  <span className="font-medium text-blue-800">Routing Information</span>
                </div>
                <div className="text-sm space-y-1">
                  <div><strong>Primary Contact:</strong> {result.routing.primaryContact || 'Unknown'}</div>
                  <div><strong>Contact Type:</strong> {result.routing.contactType.toUpperCase()}</div>
                  <div><strong>Workflow:</strong> {result.routing.workflow}</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-600">Admin:</span>
                  <span className="ml-2 font-medium">{result.admin || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Manager:</span>
                  <span className="ml-2 font-medium">{result.manager || 'Unknown'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Validation Status Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="flex items-center space-x-2">
              <CheckIcon valid={result.vendor_match} />
              <span className="text-sm">Vendor</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckIcon valid={result.po_match} />
              <span className="text-sm">PO Number</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckIcon valid={result.date_valid} />
              <span className="text-sm">Date Range</span>
            </div>
            {result.rate_valid !== undefined && (
              <div className="flex items-center space-x-2">
                <CheckIcon valid={result.rate_valid} />
                <span className="text-sm">Rate</span>
              </div>
            )}
          </div>

          {/* Expanded Details */}
          {isExpanded && (
            <div className="border-t border-gray-200 pt-4 space-y-4">
              {/* Extracted Data */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Extracted Data</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-600">Vendor:</span>
                      <span className="ml-2">{result.extracted_data.vendor || 'Not found'}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">PO Number:</span>
                      <span className="ml-2">{result.extracted_data.po_number || 'Not found'}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Invoice Date:</span>
                      <span className="ml-2">{result.extracted_data.invoice_date || 'Not found'}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Amount:</span>
                      <span className="ml-2">
                        {result.extracted_data.amount ? `$${result.extracted_data.amount.toLocaleString()}` : 'Not found'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Validation Details */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Validation Details</h4>
                <div className="space-y-3">
                  {/* Vendor Validation */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <CheckIcon valid={result.validation_details.vendor.valid} />
                      <span className="ml-2 font-medium">Vendor Validation</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <div>Extracted: {result.validation_details.vendor.extracted || 'None'}</div>
                      <div>Matched: {result.validation_details.vendor.matched || 'None'}</div>
                    </div>
                  </div>

                  {/* PO Validation */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <CheckIcon valid={result.validation_details.po.valid} />
                      <span className="ml-2 font-medium">PO Validation</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <div>Extracted: {result.validation_details.po.extracted || 'None'}</div>
                      <div>Matched: {result.validation_details.po.matched || 'None'}</div>
                      {result.validation_details.po.po_start && result.validation_details.po.po_end && (
                        <div>Valid Period: {result.validation_details.po.po_start} to {result.validation_details.po.po_end}</div>
                      )}
                    </div>
                  </div>

                  {/* Date Validation */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <CheckIcon valid={result.validation_details.date.valid} />
                      <span className="ml-2 font-medium">Date Validation</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <div>Invoice Date: {result.validation_details.date.invoice_date || 'None'}</div>
                      <div>Status: {result.validation_details.date.message}</div>
                    </div>
                  </div>

                  {/* Rate Validation */}
                  {result.validation_details.rate && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center mb-2">
                        <CheckIcon valid={result.validation_details.rate.valid} />
                        <span className="ml-2 font-medium">Rate Validation</span>
                        {result.validation_details.rate.requires_fum_review && (
                          <span className="ml-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                            FUM Review Required
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        <div>Rate Type: {result.validation_details.rate.type || 'Not specified'}</div>
                        {result.validation_details.rate.expected_amount && (
                          <div>Expected: ${result.validation_details.rate.expected_amount.toLocaleString()}</div>
                        )}
                        {result.validation_details.rate.invoice_amount && (
                          <div>Invoice Amount: ${result.validation_details.rate.invoice_amount.toLocaleString()}</div>
                        )}
                        <div>Status: {result.validation_details.rate.message}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Rejection Reasons */}
              {result.overall_status === 'REJECTED' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-medium text-red-800 mb-2">Rejection Reasons:</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    {!result.vendor_match && <li>• Vendor not found in service agreements</li>}
                    {!result.po_match && <li>• PO number not found or invalid</li>}
                    {!result.date_valid && <li>• Invoice date validation failed</li>}
                    {result.rate_valid === false && <li>• Rate validation failed</li>}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-2xl font-semibold text-gray-800">Validation Results</h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Approved Results */}
        {approvedResults.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-green-800 mb-4">
              Approved Invoices ({approvedResults.length})
            </h3>
            <div className="space-y-4">
              {approvedResults.map((result) => (
                <ResultCard key={result.filename} result={result} />
              ))}
            </div>
          </div>
        )}

        {/* Rejected Results */}
        {rejectedResults.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-red-800 mb-4">
              Rejected Invoices ({rejectedResults.length})
            </h3>
            <div className="space-y-4">
              {rejectedResults.map((result) => (
                <ResultCard key={result.filename} result={result} />
              ))}
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-2">Next Steps:</h4>
          <div className="text-sm text-blue-700 space-y-2">
            {approvedResults.length > 0 && (
              <div>
                <strong>Approved invoices:</strong>
                <ul className="mt-1 ml-4 space-y-1">
                  <li>• Variable rate invoices: Route to FUM for rate review, then to Manager</li>
                  <li>• Fixed rate invoices: Route directly to Manager for processing</li>
                  <li>• After approval: Process in Oracle system</li>
                </ul>
              </div>
            )}
            {rejectedResults.length > 0 && (
              <div>
                <strong>Rejected invoices:</strong>
                <ul className="mt-1 ml-4 space-y-1">
                  <li>• Route to Admin for initial review and correction</li>
                  <li>• Verify vendor registration and PO validity</li>
                  <li>• Confirm date ranges and rate information</li>
                  <li>• Resubmit after corrections</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}