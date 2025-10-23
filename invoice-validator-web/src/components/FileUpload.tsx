'use client';

import { useState, useRef } from 'react';

interface FileUploadProps {
  onValidate: (pdfFiles: File[]) => void;
  loading: boolean;
}

export default function FileUpload({ onValidate, loading }: FileUploadProps) {
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validPdfs = files.filter(file => file.name.endsWith('.pdf'));
    
    if (validPdfs.length !== files.length) {
      alert('Please select only PDF files');
      return;
    }
    
    setPdfFiles(validPdfs);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    const pdfFiles = files.filter(file => file.name.endsWith('.pdf'));
    
    if (pdfFiles.length > 0) {
      setPdfFiles(prev => [...prev, ...pdfFiles]);
    }
  };

  const removePdfFile = (index: number) => {
    setPdfFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (pdfFiles.length === 0) {
      alert('Please select at least one PDF file');
      return;
    }
    
    onValidate(pdfFiles);
  };

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <h4 className="text-blue-800 font-medium">Service Agreement Data Built-In</h4>
            <p className="text-blue-700 text-sm mt-1">
              The Excel spreadsheet is already integrated into the system. Simply upload your PDF invoices to validate them against the current service agreements.
            </p>
          </div>
        </div>
      </div>

      {/* PDF Files Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          PDF Invoices ({pdfFiles.length} selected)
        </label>
        <div
          className={`relative border-2 border-dashed rounded-lg ${
            dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf"
            multiple
            onChange={handlePdfChange}
            className="hidden"
            id="pdf-upload"
          />
          <label
            htmlFor="pdf-upload"
            className="flex items-center justify-center w-full h-32 cursor-pointer hover:bg-gray-50"
          >
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="mt-2">
                <span className="text-blue-600 font-medium">Click to upload</span>
                <span className="text-gray-600"> or drag and drop</span>
              </div>
              <div className="text-xs text-gray-500">PDF invoices (multiple files allowed)</div>
            </div>
          </label>
        </div>

        {/* PDF Files List */}
        {pdfFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            {pdfFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">{file.name}</div>
                  <div className="text-sm text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                <button
                  onClick={() => removePdfFile(index)}
                  className="text-red-600 hover:text-red-800 font-bold"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Validation Process Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-gray-800 font-medium mb-2">Validation Process</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• <strong>Vendor Matching:</strong> Checks against service agreement vendors</li>
          <li>• <strong>PO Validation:</strong> Verifies purchase order numbers and dates</li>
          <li>• <strong>Date Range:</strong> Ensures invoice dates fall within PO periods</li>
          <li>• <strong>Contact Info:</strong> Identifies admin and manager for each invoice</li>
        </ul>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={loading || pdfFiles.length === 0}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
          loading || pdfFiles.length === 0
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
        }`}
      >
        {loading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            Validating Invoices...
          </div>
        ) : (
          'Validate Invoices'
        )}
      </button>
    </div>
  );
}