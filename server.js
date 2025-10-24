const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
fs.ensureDirSync(uploadsDir);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// API Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Invoice Validation API is running',
    timestamp: new Date().toISOString()
  });
});

// File upload and validation endpoint
app.post('/api/validate', upload.single('pdf'), async (req, res) => {
  console.log('📁 Received file upload request');
  
  if (!req.file) {
    return res.status(400).json({ 
      error: 'No PDF file uploaded' 
    });
  }

  const filePath = req.file.path;
  const originalName = req.file.originalname;

  console.log(`📄 Processing file: ${originalName}`);
  console.log(`💾 Saved to: ${filePath}`);

  try {
    // Call Python validation script
    const validationResult = await validatePdfWithPython(filePath);
    
    // Clean up uploaded file
    await fs.remove(filePath);
    console.log(`🗑️  Cleaned up file: ${filePath}`);

    // Return validation results
    res.json({
      success: true,
      filename: originalName,
      result: validationResult
    });

  } catch (error) {
    console.error('❌ Validation error:', error.message);
    
    // Clean up file on error
    try {
      await fs.remove(filePath);
    } catch (cleanupError) {
      console.error('🗑️  Error cleaning up file:', cleanupError.message);
    }

    res.status(500).json({
      error: 'Failed to validate PDF',
      message: error.message
    });
  }
});

// Python API configuration
const PYTHON_API_URL = 'http://localhost:5001';

// Function to call Python validation API
async function validatePdfWithPython(filePath) {
  try {
    console.log('🐍 Calling Python validation API...');
    
    const response = await axios.post(`${PYTHON_API_URL}/validate`, {
      file_path: filePath
    }, {
      timeout: 60000 // 60 second timeout
    });

    if (response.data.success) {
      console.log('✅ Python validation completed successfully');
      return response.data.result;
    } else {
      throw new Error(response.data.error || 'Validation failed');
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Python validation service is not running. Please start python_api.py');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Validation timeout. The PDF might be too complex or large.');
    } else if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    } else {
      throw new Error(`Validation service error: ${error.message}`);
    }
  }
}

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log('🚀 Invoice Validation Server Started');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌐 API available at: http://localhost:${PORT}/api`);
  console.log(`💻 Frontend will be at: http://localhost:3000 (in dev mode)`);
  console.log('-'.repeat(50));
});