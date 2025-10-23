'use client';

import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import ValidationResults from '@/components/ValidationResults';

interface ValidationResult {
  filename: string;
  vendor_match: boolean;
  po_match: boolean;
  date_valid: boolean;
  admin: string;
  manager: string;
  overall_status: 'APPROVED' | 'REJECTED';
  extracted_data: {
    vendor: string;
    po_number: string;
    invoice_date: string;
    amount: number;
  };
  validation_details: any;
}

interface ValidationSummary {
  total: number;
  approved: number;
  rejected: number;
}

export default function Home() {
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleValidation = async (pdfFiles: File[]) => {
    setLoading(true);
    setError(null);
    setResults([]);
    setSummary(null);

    try {
      const formData = new FormData();
      
      pdfFiles.forEach((file) => {
        formData.append('pdf_files', file);
      });

      const response = await fetch('/api/validate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Validation failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // If response is not JSON, use the status text
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('Invalid response from server - not valid JSON');
      }
      
      if (data.success) {
        setResults(data.results);
        setSummary(data.summary);
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Invoice Validation System
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Automatically validate Oracle invoices against service agreement data. 
            Upload your PDF invoices to validate them instantly.
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          {/* File Upload Section */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Upload PDF Invoices
            </h2>
            <FileUpload
              onValidate={handleValidation}
              loading={loading}
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-6">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-700 mr-2"></div>
                Processing invoices... This may take a few moments.
              </div>
            </div>
          )}

          {/* Results Summary */}
          {summary && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Validation Summary
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{summary.total}</div>
                  <div className="text-blue-800">Total Invoices</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{summary.approved}</div>
                  <div className="text-green-800">Approved</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{summary.rejected}</div>
                  <div className="text-red-800">Rejected</div>
                </div>
              </div>
            </div>
          )}

          {/* Validation Results */}
          {results.length > 0 && (
            <ValidationResults results={results} />
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-500">
          <p>Automated Invoice Validation System - Reducing processing time from hours to minutes</p>
        </div>
      </div>
    </div>
  );
}