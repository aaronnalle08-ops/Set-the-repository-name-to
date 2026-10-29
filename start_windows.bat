@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or later is required. Install it from https://nodejs.org/
  pause
  exit /b 1
)
set "UGN_UPDATE_WRAPPER=1"
:START_APP
echo.
echo ==========================================
echo UGN Advertising Command Center
 echo Website: http://127.0.0.1:3000
echo ==========================================
echo.
node server.js
set "EXIT_STATUS=%ERRORLEVEL%"
if "%EXIT_STATUS%"=="74" (
  echo An update has been requested. Installing from your configured GitHub release...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0update_windows.ps1"
  if errorlevel 1 (
    echo UPDATE FAILED. Your prior program files should have been restored.
    echo Check the Updates page for details after restart.
  )
  echo Restarting the dashboard...
  goto START_APP
)
echo.
echo Dashboard stopped. Exit code: %EXIT_STATUS%
pause
