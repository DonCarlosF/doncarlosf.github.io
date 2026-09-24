@echo off
rem Puts the four "Luis - <Subject>" shortcuts on this user's Desktop.
rem Runs install-shortcuts.ps1 next to this file with script execution
rem allowed for this one process only (no machine-wide policy change).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-shortcuts.ps1"
if errorlevel 1 (
  echo.
  echo Could not create the shortcuts automatically. Manual fallback:
  echo   right-click each Luis-*.cmd in this folder ^> Send to ^> Desktop ^(create shortcut^)
)
echo.
pause
