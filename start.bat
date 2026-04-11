@echo off
title LurkHound — AD Recon System
color 0C

echo.
echo   ╔═══════════════════════════════════════════════╗
echo   ║          LURKHOUND  //  AD RECON SYSTEM       ║
echo   ║     Active Directory Attack-Path Discovery    ║
echo   ╚═══════════════════════════════════════════════╝
echo.

set ROOT=%~dp0

echo   [1/2] Starting Backend (FastAPI) on port 8000...
start "LurkHound Backend" cmd /k "cd /d "%ROOT%backend" && python main.py"

:: Brief wait for backend to bind port
timeout /t 3 /nobreak >nul

echo   [2/2] Starting Frontend (Next.js) on port 3000...
start "LurkHound Frontend" cmd /k "cd /d "%ROOT%frontend-next" && npm run dev"

timeout /t 5 /nobreak >nul

echo.
echo   ────────────────────────────────────────────────
echo   [OK] Backend  :  http://localhost:8000
echo   [OK] Frontend :  http://localhost:3000
echo   ────────────────────────────────────────────────
echo.
echo   Opening browser...
start http://localhost:3000

echo.
echo   Both services running in separate windows.
echo   Close those windows or press Ctrl+C to stop.
echo.
pause
