@echo off
cd /d "C:\Projects\attendance-system\backend"
echo.
echo ====================================
echo Attendance Management System
echo ====================================
echo.
echo Starting server...
echo.
start http://localhost:5000
timeout /t 3 /nobreak
node server.js
pause
