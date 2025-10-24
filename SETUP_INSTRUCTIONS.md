# 🚀 Invoice Validation - Setup Instructions

## 📦 Files Needed for Distribution

**Core Files (Required):**
```
📁 Invoice-Validation/
├── 📄 standalone_app.py          # Main application
├── 📄 pdf_vendor_matcher.py      # Validation logic
├── 📊 Service Agreement Table (Rolling).xlsx  # Data file
├── 🔐 .env                       # API keys (create this)
├── 📄 requirements.txt           # Python dependencies
└── 📁 templates/                 # Web interface files
    ├── 📄 base.html
    ├── 📄 index.html
    └── 📄 results.html
```

---

## 🎯 Option 1: Simple Python Distribution

**For users who have Python installed:**

### Step 1: Create Distribution Package
```bash
# Copy these files to a new folder:
- standalone_app.py
- pdf_vendor_matcher.py
- Service Agreement Table (Rolling).xlsx
- requirements.txt
- templates/ (entire folder)
- .env (with API keys)
```

### Step 2: Create .env file
```env
AMPLIFY_API_URL=your_amplify_api_url_here
AMPLIFY_API_KEY=your_amplify_api_key_here
```

### Step 3: User Instructions
```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Run the application
python standalone_app.py

# 3. Browser opens automatically at http://127.0.0.1:5000
```

---

## 🎯 Option 2: Executable (.exe) Distribution

**For users who DON'T have Python installed:**

### Create Executable
```bash
# Install PyInstaller
pip install pyinstaller

# Create executable (Windows)
pyinstaller --onefile --windowed --add-data "templates;templates" --add-data "Service Agreement Table (Rolling).xlsx;." --add-data ".env;." standalone_app.py

# Creates: dist/standalone_app.exe
```

### Distribution Package
```
📁 Invoice-Validation-Portable/
├── 📄 standalone_app.exe         # Double-click to run!
├── 📄 README.txt                 # Simple instructions
└── 📁 templates/                 # Web interface files
    ├── 📄 base.html
    ├── 📄 index.html
    └── 📄 results.html
```

**User Instructions:**
1. Download the folder
2. Double-click `standalone_app.exe`
3. Browser opens automatically
4. Upload and validate PDFs!

---

## 🎯 Option 3: Professional Installer

**Create Windows installer with Inno Setup:**

### Features:
- ✅ One-click installation
- ✅ Desktop shortcut
- ✅ Start menu entry  
- ✅ Uninstaller
- ✅ Professional appearance

---

## 🔧 API Configuration

**Each user needs their own API keys:**

### Option A: Include in Distribution
- Add your API keys to `.env` file
- Users share your API costs

### Option B: User Provides Keys
- Create setup wizard asking for API keys
- Each user pays their own API costs

---

## 📋 Distribution Checklist

**Before distributing:**
- [ ] Test on clean computer without Python
- [ ] Include all required files
- [ ] Test with sample PDF
- [ ] Create clear instructions
- [ ] Test API connectivity
- [ ] Consider API key security

**Recommended approach:**
1. **Start with Option 1** (Python distribution) for technical users
2. **Create Option 2** (Executable) for non-technical users
3. **Consider Option 3** (Installer) for professional distribution