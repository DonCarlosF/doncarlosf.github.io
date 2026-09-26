@echo off
setlocal
rem ---------------------------------------------------------------------
rem Desktop entry point for the para educator: opens the button page
rem (http://127.0.0.1:4317/para) in the default browser. One tab per
rem learner; each has Social Studies / ELA / Math / Science (enCORE
rem Student-Led, only that subject checked) plus the learner's Social
rem Skills routine when one is set up in Settings.
rem
rem Starts the local UI server (this machine only) in a minimized
rem "TeachTown helper" window. If it is already running, the page just
rem opens again - a second click never starts a second server.
rem
rem Keep this file ASCII-only and CRLF (see ../.gitattributes) -- cmd.exe
rem misreads anything else.
rem ---------------------------------------------------------------------

rem The runner lives one folder up from windows\.
cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on PATH.
  echo Install Node 18 or newer from https://nodejs.org (LTS), then run this again.
  pause
  exit /b 1
)
if not exist "node_modules\playwright" (
  echo Dependencies are missing. In this folder run:  npm install
  echo   %CD%
  pause
  exit /b 1
)
if not exist "config.json" (
  echo config.json is missing. In this folder run:  npm run init-config
  echo   %CD%
  pause
  exit /b 1
)

start "TeachTown helper - keep open" /min node ui-server.js --para
endlocal & exit /b 0
