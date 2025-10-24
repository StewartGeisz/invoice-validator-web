@echo off
echo Starting Invoice Validation Application...
echo.

echo [1/2] Starting Python Validation API...
start "Python API" cmd /k "python python_api.py"

echo Waiting for Python API to start...
timeout /t 3 /nobreak >nul

echo [2/2] Starting Node.js Server and React Client...
npm run dev

echo.
echo Both services should now be running:
echo - Python API: http://localhost:5001
echo - React App: http://localhost:3000
echo - Node.js API: http://localhost:5000
pause