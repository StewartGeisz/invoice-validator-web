import { useState } from 'react';
import Head from 'next/head';

export default function Home() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  
  // Excel upload state
  const [excelFile, setExcelFile] = useState(null);
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [excelError, setExcelError] = useState(null);
  const [excelSuccess, setExcelSuccess] = useState(null);
  const [showExcelUpload, setShowExcelUpload] = useState(false);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const pdfFiles = selectedFiles.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length !== selectedFiles.length) {
      setError('Please select only PDF files');
      return;
    }
    
    if (pdfFiles.length === 0) {
      setError('Please select at least one PDF file');
      setFiles([]);
      return;
    }

    setFiles(pdfFiles);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      setError('Please select PDF files');
      return;
    }

    setUploading(true);
    setError(null);
    setResults([]);

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('pdf', file);
      });

      const response = await fetch('/api/validate-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setResults(data.results || []);
      } else {
        setError(data.error || 'Validation failed');
      }
    } catch (err) {
      setError('Upload failed. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const getStatusIcon = (valid) => {
    if (valid === true) return '✅';
    if (valid === false) return '❌';
    return '⚠️';
  };

  const getStatusColor = (valid) => {
    if (valid === true) return 'text-green-600';
    if (valid === false) return 'text-red-600';
    return 'text-yellow-600';
  };

  const handleExcelChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const validExtensions = ['.xlsx', '.xls'];
      const fileExtension = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'));
      
      if (!validExtensions.includes(fileExtension)) {
        setExcelError('Please select an Excel file (.xlsx or .xls)');
        setExcelFile(null);
        return;
      }
      
      setExcelFile(selectedFile);
      setExcelError(null);
      setExcelSuccess(null);
    }
  };

  const handleExcelSubmit = async (e) => {
    e.preventDefault();
    if (!excelFile) {
      setExcelError('Please select an Excel file');
      return;
    }

    setUploadingExcel(true);
    setExcelError(null);
    setExcelSuccess(null);

    try {
      const formData = new FormData();
      formData.append('excel', excelFile);

      const response = await fetch('/api/update-vendor-data', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setExcelSuccess({
          message: data.message,
          vendorCount: data.vendorCount,
          lastUpdated: data.lastUpdated,
          filename: data.filename
        });
        setExcelFile(null);
        // Reset file input
        e.target.reset();
        // Auto-hide after 5 seconds
        setTimeout(() => {
          setShowExcelUpload(false);
          setExcelSuccess(null);
        }, 5000);
      } else {
        setExcelError(data.error || 'Failed to update vendor data');
      }
    } catch (err) {
      setExcelError('Upload failed. Please try again.');
      console.error('Excel upload error:', err);
    } finally {
      setUploadingExcel(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>PDF Invoice Validator</title>
        <meta name="description" content="Validate PDF invoices against vendor database" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto px-4 py-8 relative">
        {/* Excel Upload Card - Top Right Corner */}
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          {!showExcelUpload ? (
            <button
              onClick={() => setShowExcelUpload(true)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg shadow-md text-sm font-medium transition-colors flex items-center gap-2"
              title="Update vendor database from Excel"
            >
              <span>📊</span>
              <span>Update Vendor Data</span>
            </button>
          ) : (
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Update Vendor Database</h3>
                <button
                  onClick={() => {
                    setShowExcelUpload(false);
                    setExcelFile(null);
                    setExcelError(null);
                    setExcelSuccess(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              
              <p className="text-xs text-gray-600 mb-3">
                Upload monthly Excel file to update vendor information. The file will replace the current vendor database.
              </p>
              
              {excelSuccess ? (
                <div className="bg-green-50 border border-green-200 rounded p-3 mb-3">
                  <p className="text-green-800 text-sm font-medium mb-1">✅ {excelSuccess.message}</p>
                  <p className="text-green-700 text-xs">
                    Updated {excelSuccess.vendorCount} vendors
                    {excelSuccess.lastUpdated && (
                      <span className="block mt-1">
                        Last updated: {new Date(excelSuccess.lastUpdated).toLocaleString()}
                      </span>
                    )}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleExcelSubmit} className="space-y-3">
                  <div>
                    <label htmlFor="excel" className="block text-xs font-medium text-gray-700 mb-1">
                      Select Excel File (.xlsx or .xls)
                    </label>
                    <input
                      type="file"
                      id="excel"
                      accept=".xlsx,.xls"
                      onChange={handleExcelChange}
                      className="block w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>
                  
                  {excelFile && (
                    <div className="text-xs text-gray-600">
                      Selected: {excelFile.name}
                    </div>
                  )}
                  
                  {excelError && (
                    <div className="text-red-600 text-xs bg-red-50 border border-red-200 rounded p-2">
                      {excelError}
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={!excelFile || uploadingExcel}
                    className="w-full bg-green-600 text-white py-2 px-3 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                  >
                    {uploadingExcel ? 'Processing...' : 'Update Database'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            PDF Invoice Validator
          </h1>
          
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Upload Invoice PDF</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="pdf" className="block text-sm font-medium text-gray-700 mb-2">
                  Select PDF Files (multiple files supported)
                </label>
                <input
                  type="file"
                  id="pdf"
                  accept=".pdf"
                  multiple
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              
              {files.length > 0 && (
                <div className="text-sm text-gray-600">
                  Selected {files.length} file(s): {files.map(f => f.name).join(', ')}
                </div>
              )}
              
              {error && (
                <div className="text-red-600 text-sm">{error}</div>
              )}
              
              <button
                type="submit"
                disabled={files.length === 0 || uploading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {uploading ? `Validating ${files.length} file(s)...` : `Validate ${files.length || ''} Invoice${files.length !== 1 ? 's' : ''}`}
              </button>
            </form>
          </div>

          {results.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Validation Results ({results.length} files)</h2>
              
              {results.map((result, index) => (
                <div key={index} className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-xl font-semibold mb-4">
                    📄 {result.filename || `File ${index + 1}`}
                  </h3>
                  
                  {result.error ? (
                    <div className="text-red-600 p-4 bg-red-50 rounded border border-red-200">
                      ❌ Error processing file: {result.error}
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {/* Vendor Information */}
                      <div className="border rounded p-4">
                        <h4 className="font-semibold text-lg mb-2">Vendor Identification</h4>
                        {result.vendor ? (
                          <div>
                            <p className="text-green-600 font-medium">✅ Vendor: {result.vendor}</p>
                            <p className="text-sm text-gray-600">Method: {result.method}</p>
                          </div>
                        ) : (
                          <p className="text-red-600">❌ No vendor match found</p>
                        )}
                      </div>

                      {result.vendor && (
                        <>
                          {/* Validation Results Grid */}
                          <div className="grid md:grid-cols-3 gap-4">
                            {/* PO Validation */}
                            <div className="border rounded p-4">
                              <h5 className="font-semibold mb-2">
                                {getStatusIcon(result.po_valid)} PO Number
                              </h5>
                              <p className={`text-sm ${getStatusColor(result.po_valid)}`}>
                                {result.po_reason}
                              </p>
                              {result.expected_po && (
                                <p className="text-xs text-gray-600 mt-1">
                                  Expected: {result.expected_po}
                                </p>
                              )}
                            </div>

                            {/* Date Validation */}
                            <div className="border rounded p-4">
                              <h5 className="font-semibold mb-2">
                                {getStatusIcon(result.date_valid)} Date Range
                              </h5>
                              <p className={`text-sm ${getStatusColor(result.date_valid)}`}>
                                {result.date_reason}
                              </p>
                              {result.valid_dates && result.valid_dates.length > 0 && (
                                <p className="text-xs text-gray-600 mt-1">
                                  Valid dates: {result.valid_dates.join(', ')}
                                </p>
                              )}
                            </div>

                            {/* Rate Validation */}
                            <div className="border rounded p-4">
                              <h5 className="font-semibold mb-2">
                                {getStatusIcon(result.rate_valid)} Rate Amount
                              </h5>
                              <p className={`text-sm ${getStatusColor(result.rate_valid)}`}>
                                {result.rate_reason}
                              </p>
                              {result.expected_amount && (
                                <p className="text-xs text-gray-600 mt-1">
                                  Expected: ${result.expected_amount.toFixed(2)}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Contact Information */}
                          <div className="border rounded p-4 bg-blue-50">
                            <h5 className="font-semibold mb-2">👤 Recommended Contact</h5>
                            <p className="font-medium">{result.contact_person}</p>
                            <p className="text-sm text-gray-600">{result.contact_role}</p>
                            <p className="text-xs text-gray-500 mt-1">{result.contact_reason}</p>
                          </div>

                          {/* Overall Status */}
                          <div className={`border rounded p-4 ${
                            result.po_valid === true && result.date_valid === true && result.rate_valid === true
                              ? 'bg-green-50 border-green-200'
                              : result.po_valid === false || result.date_valid === false || result.rate_valid === false
                              ? 'bg-red-50 border-red-200'
                              : 'bg-yellow-50 border-yellow-200'
                          }`}>
                            <h5 className="font-semibold mb-2">Overall Status</h5>
                            <p className={`font-medium ${
                              result.po_valid === true && result.date_valid === true && result.rate_valid === true
                                ? 'text-green-600'
                                : result.po_valid === false || result.date_valid === false || result.rate_valid === false
                                ? 'text-red-600'
                                : 'text-yellow-600'
                            }`}>
                              {result.po_valid === true && result.date_valid === true && result.rate_valid === true
                                ? '🟢 INVOICE FULLY VALIDATED'
                                : result.po_valid === false || result.date_valid === false || result.rate_valid === false
                                ? '🔴 INVOICE VALIDATION FAILED'
                                : '🟡 PARTIAL VALIDATION (some checks couldn\'t be performed)'}
                            </p>
                          </div>
                        </>
                      )}

                      {/* Debug Information */}
                      <details className="border rounded p-4">
                        <summary className="cursor-pointer font-medium">Debug Information</summary>
                        <div className="mt-2 text-xs text-gray-600 space-y-2">
                          <p><strong>File:</strong> {result.filename}</p>
                          <p><strong>PDF Text Length:</strong> {result.pdf_text_length} characters</p>
                          <div>
                            <strong>PDF Text Sample:</strong>
                            <pre className="bg-gray-100 p-2 mt-1 rounded text-xs overflow-auto">
                              {result.pdf_text_sample}
                            </pre>
                          </div>
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}