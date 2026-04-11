# start.ps1 — Launch LurkHound backend + frontend together
# Usage: powershell -ExecutionPolicy Bypass -File start.ps1

$Root = Split-Path $MyInvocation.MyCommand.Path
$Backend     = Join-Path $Root "backend\main.py"
$FrontendDir = Join-Path $Root "frontend-next"

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════════════╗" -ForegroundColor Red
Write-Host "  ║          LURKHOUND  //  AD RECON SYSTEM       ║" -ForegroundColor Red
Write-Host "  ║     Active Directory Attack-Path Discovery    ║" -ForegroundColor DarkRed
Write-Host "  ╚═══════════════════════════════════════════════╝" -ForegroundColor Red
Write-Host ""

# Start Python backend in a new window
Write-Host "  [1/2] Starting Backend (FastAPI) -> http://localhost:8000" -ForegroundColor Green
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$Root\backend'; Write-Host '  [BACKEND] Starting FastAPI...' -ForegroundColor Cyan; python main.py"
) -WindowStyle Normal

Start-Sleep -Seconds 3

# Start Next.js frontend in a new window
Write-Host "  [2/2] Starting Frontend (Next.js) -> http://localhost:3000" -ForegroundColor Green
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$FrontendDir'; Write-Host '  [FRONTEND] Starting Next.js...' -ForegroundColor Cyan; npm run dev"
) -WindowStyle Normal

Start-Sleep -Seconds 5

Write-Host ""
Write-Host "  ────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "  [OK] Backend  :  http://localhost:8000" -ForegroundColor Yellow
Write-Host "  [OK] Frontend :  http://localhost:3000" -ForegroundColor Yellow
Write-Host "  ────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

# Open browser
Write-Host "  Opening browser..." -ForegroundColor Cyan
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "  Both services running. Close service windows to stop." -ForegroundColor DarkGray
Write-Host ""
