#!/usr/bin/env python3
"""
Flask web application for PDF invoice validation.
Uses the existing PDFVendorMatcher logic as backend.
"""

from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
import os
import tempfile
from werkzeug.utils import secure_filename
from pdf_vendor_matcher import PDFVendorMatcher
import traceback

app = Flask(__name__)
app.secret_key = 'invoice_validation_secret_key_2024'

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf'}
EXCEL_FILE = "Service Agreement Table (Rolling).xlsx"

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def allowed_file(filename):
    """Check if uploaded file is a PDF."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Initialize the validator once at startup
try:
    validator = PDFVendorMatcher(EXCEL_FILE)
    print("[SUCCESS] PDF Validator initialized successfully")
except Exception as e:
    print(f"[ERROR] Error initializing validator: {e}")
    validator = None

@app.route('/')
def index():
    """Main page with upload form."""
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    """Handle PDF upload and validation."""
    if 'file' not in request.files:
        flash('No file selected', 'error')
        return redirect(request.url)
    
    file = request.files['file']
    
    if file.filename == '':
        flash('No file selected', 'error')
        return redirect(request.url)
    
    if not allowed_file(file.filename):
        flash('Please upload a PDF file only', 'error')
        return redirect(request.url)
    
    if validator is None:
        flash('Validation system not initialized. Check Excel file.', 'error')
        return redirect(request.url)
    
    try:
        # Save uploaded file temporarily
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Run validation
        result = validator.process_pdf(filepath, debug=False)
        
        # Clean up uploaded file
        os.remove(filepath)
        
        # Pass results to template
        return render_template('results.html', 
                             filename=filename, 
                             result=result)
    
    except Exception as e:
        # Clean up file if it exists
        if 'filepath' in locals() and os.path.exists(filepath):
            os.remove(filepath)
        
        error_msg = f"Error processing PDF: {str(e)}"
        print(f"❌ {error_msg}")
        print(traceback.format_exc())
        flash(error_msg, 'error')
        return redirect(url_for('index'))

@app.route('/api/validate', methods=['POST'])
def api_validate():
    """API endpoint for validation (for potential future use)."""
    if validator is None:
        return jsonify({"error": "Validation system not initialized"}), 500
    
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    
    if not allowed_file(file.filename):
        return jsonify({"error": "Invalid file type. PDF required."}), 400
    
    try:
        # Save temporarily and validate
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
            file.save(tmp_file.name)
            result = validator.process_pdf(tmp_file.name, debug=False)
            os.unlink(tmp_file.name)
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("[STARTING] Invoice Validation Web Application")
    print("Upload folder:", UPLOAD_FOLDER)
    print("Excel file:", EXCEL_FILE)
    
    # Use environment variable for port (Railway will set this)
    port = int(os.environ.get('PORT', 5000))
    host = '0.0.0.0'  # Allow external connections
    
    print(f"Navigate to: http://{host}:{port}")
    print("-" * 50)
    
    app.run(debug=False, host=host, port=port)