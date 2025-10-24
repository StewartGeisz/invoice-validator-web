# 📋 Invoice Validation - Distribution Package

## 🎯 TWO WAYS TO SHARE THIS APP:

---

## 🌐 **Option 1: WEB APP (Easiest for Users)**

**What it is:** Users visit a website, no installation needed

**How to set up:**
1. Deploy to **Railway.app** (free hosting)
2. Share the URL with users 
3. Users just visit the website and upload PDFs

**Pros:** ✅ No installation ✅ Works on phones ✅ Professional
**Cons:** ❌ You pay hosting costs ❌ Requires internet

---

## 💻 **Option 2: PORTABLE APP (Runs on Their Computer)**

**What it is:** Users download folder and run on their computer

### 📦 Files to Share:
```
📁 Invoice-Validation-Portable/
├── 🔧 run_app.bat               # Double-click to start!
├── 📄 standalone_app.py         # Main application
├── 📄 pdf_vendor_matcher.py     # Validation logic  
├── 📊 Service Agreement Table (Rolling).xlsx  # Data
├── 🔐 .env                      # API keys
├── 📄 requirements.txt          # Dependencies
├── 📄 README_FOR_USERS.txt      # Instructions
└── 📁 templates/                # Web interface
    ├── 📄 base.html
    ├── 📄 index.html
    └── 📄 results.html
```

### 👤 User Instructions:
1. **Download** the Invoice-Validation-Portable folder
2. **Double-click** `run_app.bat` 
3. **Wait** for setup to complete (installs Python packages)
4. **Browser opens** automatically at http://127.0.0.1:5000
5. **Upload PDFs** and validate!

### 📋 Requirements for Users:
- Windows computer
- Python 3.8+ installed ([Download here](https://python.org))
- Internet connection (for API calls)

---

## 🔐 **API Key Options:**

### A) Your API Keys (Simpler)
- Include your API keys in `.env` file
- Users share your API costs
- No setup required for users

### B) User's Own Keys (More Secure)
- Users need their own Amplify API account
- Each user pays their own API costs  
- Requires setup instructions

---

## 🚀 **Quick Start Distribution:**

1. **Copy these files to a new folder:**
   ```
   - run_app.bat
   - standalone_app.py  
   - pdf_vendor_matcher.py
   - Service Agreement Table (Rolling).xlsx
   - .env (with your API keys)
   - requirements.txt
   - templates/ (entire folder)
   ```

2. **Create README_FOR_USERS.txt:**
   ```
   INVOICE VALIDATION APP
   
   1. Make sure Python is installed
   2. Double-click run_app.bat
   3. Wait for browser to open
   4. Upload PDF files to validate
   5. Keep the black window open while using
   ```

3. **ZIP the folder** and share!

---

## 💡 **Recommendation:**

**For 1-5 users:** Use **Portable App** (Option 2)
**For 5+ users:** Use **Web App** (Option 1)

**Most professional:** Deploy web app to Railway and share URL