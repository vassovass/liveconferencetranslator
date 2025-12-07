@echo off
setlocal
cd /d "%~dp0"

:: Handle flags
set INSPECT_FLAG=
if /I "%~1"=="--inspect" set INSPECT_FLAG=-Inspect
if /I "%~1"=="-inspect" set INSPECT_FLAG=-Inspect
if /I "%~1"=="inspect" set INSPECT_FLAG=-Inspect

echo [liveconferencetranslator] Starting via PowerShell with execution policy bypass.
echo.
if defined INSPECT_FLAG (
  echo Node inspector enabled on port 9229.
) else (
  echo Tip: pass --inspect to enable Node inspector on port 9229.
)
echo.

:: Prefer PowerShell script so we can bypass execution policy and keep output visible.
powershell -ExecutionPolicy Bypass -NoLogo -NoProfile -File ".\start-dev.ps1" %INSPECT_FLAG%

echo.
echo Session ended. Scroll above to copy any logs. Press any key to close this window.
pause >nul

