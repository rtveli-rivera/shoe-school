@echo off
REM ===============================================================
REM  Shoe School - local launcher (Windows)
REM  Serves the app on http://localhost:8146 and opens your browser.
REM  Keep this window open while you use the app; close it to stop.
REM ===============================================================
cd /d "%~dp0"

set PORT=8146

echo Starting Shoe School on http://localhost:%PORT% ...
start "" "http://localhost:%PORT%/index.html"

where py >nul 2>nul
if %errorlevel%==0 (
  py scripts\serve.py %PORT%
) else (
  python scripts\serve.py %PORT%
)
