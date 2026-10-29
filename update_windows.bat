@echo off
setlocal
cd /d "%~dp0"
echo IMPORTANT: Close the UGN dashboard server before using this manual updater.
echo A restart will be needed afterward.
set /p OK=Type UPDATE to continue: 
if /I not "%OK%"=="UPDATE" exit /b 1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0update_windows.ps1"
if errorlevel 1 (
  echo The update did not finish. See the Updates tab for details.
) else (
  echo Finished. Double-click start_windows.bat to reopen UGN.
)
pause
