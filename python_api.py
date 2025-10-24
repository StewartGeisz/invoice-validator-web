#!/usr/bin/env python3
"""
Standalone Python API service for invoice validation.
This provides a simple HTTP API endpoint that Node.js can call.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys
from pdf_vendor_matcher import PDFVendorMatcher
import traceback

app = Flask(__name__)
CORS(app)

# Initialize validator
try:
    validator = PDFVendorMatcher("Service Agreement Table (Rolling).xlsx")
    print("[SUCCESS] PDF Validator initialized")
except Exception as e:
    print(f"[ERROR] Failed to initialize validator: {e}")
    validator = None

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'OK',
        'validator_ready': validator is not None
    })

@app.route('/validate', methods=['POST'])
def validate_pdf():
    """Validate a PDF file."""
    if not validator:
        return jsonify({'error': 'Validator not initialized'}), 500
    
    # Get file path from request
    data = request.get_json()
    if not data or 'file_path' not in data:
        return jsonify({'error': 'No file_path provided'}), 400
    
    file_path = data['file_path']
    
    if not os.path.exists(file_path):
        return jsonify({'error': 'File not found'}), 404
    
    try:
        # Process the PDF
        result = validator.process_pdf(file_path, debug=False)
        
        return jsonify({
            'success': True,
            'result': result
        })
        
    except Exception as e:
        print(f"[ERROR] Validation failed: {e}")
        print(traceback.format_exc())
        
        return jsonify({
            'error': f'Validation failed: {str(e)}'
        }), 500

if __name__ == '__main__':
    print("[PYTHON API] Starting Validation Service")
    print("Running on http://localhost:5001")
    print("-" * 40)
    
    app.run(host='127.0.0.1', port=5001, debug=True)