@echo off
rem Puts the "TeachTown Buttons" shortcut (the para page) on this user's Desktop.
rem Runs install-shortcuts.ps1 next to this file with script execution
rem allowed for this one process only (no machine-wide policy change).
rem Extra arguments pass through, e.g. -PerSubject for the four Luis launchers.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-shortcuts.ps1" %*
if errorlevel 1 (
  echo.
  echo Could not create the shortcut automatically. Manual fallback:
  echo   right-click TeachTown-Buttons.cmd in this folder ^> Send to ^> Desktop ^(create shortcut^)
)
echo.
pause
