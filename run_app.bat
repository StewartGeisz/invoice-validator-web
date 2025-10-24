@echo off
title Invoice Validation Application
echo ====================================
echo   INVOICE VALIDATION APPLICATION
echo ====================================
echo.
echo Installing dependencies...
pip install -r requirements.txt
echo.
echo Starting application...
echo Browser will open automatically...
echo.
echo Keep this window open while using the app
echo Close this window to stop the application
echo.
python standalone_app.py
pause