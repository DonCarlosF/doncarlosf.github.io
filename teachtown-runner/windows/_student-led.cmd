@echo off
setlocal
rem ---------------------------------------------------------------------
rem Shared launcher behind the Luis-<Subject>.cmd files.
rem Subjects: ela, math, science, social-studies, social-skills.
rem social-studies is Social Studies. social-skills is Social Skills.
rem They are not the same.
rem
rem   _student-led.cmd ela|math|science|social-studies|social-skills [--dry-run]
rem
rem Starts the runner in enCORE Student-Led mode for the configured learner
rem (studentLed.learnerPseudonym in config.json -- "Luis") with ONLY the
rem given subject checked, then stops at READY. You press Next / launch on
rem screen. Sign-in happens in the browser window, never here; nothing is
rem typed or stored by this script.
rem
rem Keep this file ASCII-only and CRLF (see ../.gitattributes) -- cmd.exe
rem misreads anything else.
rem ---------------------------------------------------------------------

set "SUBJECT=%~1"
if "%SUBJECT%"=="" (
  echo usage: %~nx0 ela^|math^|science^|social-studies^|social-skills [--dry-run]
  pause
  exit /b 1
)

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

title TeachTown - Student-Led - %SUBJECT%
echo Starting enCORE Student-Led: subject=%SUBJECT% %2
echo Close this window or press Ctrl+C when the session is over.
echo.

node runner.js --student-led --subject %SUBJECT% %2 %3
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo The runner exited with code %RC%. Details are in the logs\ folder.
  pause
)
endlocal & exit /b %RC%
