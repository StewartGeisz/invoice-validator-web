#!/usr/bin/env python3
"""
Standalone Invoice Validation Application
Runs locally on user's computer with automatic browser opening.
"""

import os
import sys
import webbrowser
import threading
import time
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
import tempfile
from werkzeug.utils import secure_filename

# Add current directory to path to find pdf_vendor_matcher
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from pdf_vendor_matcher import PDFVendorMatcher
except ImportError:
    print("❌ ERROR: pdf_vendor_matcher.py not found!")
    print("Make sure all files are in the same directory.")
    input("Press Enter to exit...")
    sys.exit(1)

app = Flask(__name__)
app.secret_key = 'invoice_validation_local_app_2024'

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf'}
EXCEL_FILE = "Service Agreement Table (Rolling).xlsx"

# Check if Excel file exists
if not os.path.exists(EXCEL_FILE):
    print(f"❌ ERROR: {EXCEL_FILE} not found!")
    print("Make sure the Excel file is in the same directory as this app.")
    input("Press Enter to exit...")
    sys.exit(1)

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def allowed_file(filename):
    """Check if uploaded file is a PDF."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Initialize the validator once at startup
print("🔄 Initializing PDF validator...")
try:
    validator = PDFVendorMatcher(EXCEL_FILE)
    print("✅ PDF Validator initialized successfully")
except Exception as e:
    print(f"❌ Error initializing validator: {e}")
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
        flash('Validation system not initialized. Check Excel file and API configuration.', 'error')
        return redirect(request.url)
    
    try:
        # Save uploaded file temporarily
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Run validation
        print(f"🔍 Validating {filename}...")
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
        flash(error_msg, 'error')
        return redirect(url_for('index'))

def open_browser():
    """Open web browser after a short delay."""
    time.sleep(1.5)
    webbrowser.open('http://127.0.0.1:5000')

def main():
    """Main function to run the standalone app."""
    print("\n" + "="*60)
    print("📋 INVOICE VALIDATION - STANDALONE APPLICATION")
    print("="*60)
    print("🔧 Starting local server...")
    print("🌐 Opening web browser...")
    print("📂 Upload folder:", UPLOAD_FOLDER)
    print("📊 Excel file:", EXCEL_FILE)
    print("🔗 Local URL: http://127.0.0.1:5000")
    print("\n💡 TIP: Keep this window open while using the app")
    print("❌ Close this window or press Ctrl+C to stop the app")
    print("="*60 + "\n")
    
    # Start browser in a separate thread
    browser_thread = threading.Thread(target=open_browser)
    browser_thread.daemon = True
    browser_thread.start()
    
    try:
        # Run the Flask app
        app.run(debug=False, host='127.0.0.1', port=5000, use_reloader=False)
    except KeyboardInterrupt:
        print("\n👋 Invoice Validation App stopped by user")
    except Exception as e:
        print(f"\n❌ Error running app: {e}")
        input("Press Enter to exit...")

if __name__ == '__main__':
    main()