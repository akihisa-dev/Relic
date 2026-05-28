@echo off
chcp 65001 > nul
cd /d "%~dp0..\app"

set "PNPM_CMD=%APPDATA%\npm\pnpm.cmd"

echo Starting Relic...
echo.

if not exist "%PNPM_CMD%" (
  echo pnpm not found. Please set up the development environment.
  echo.
  pause
  exit /b 1
)

echo Checking dependencies...
call "%PNPM_CMD%" install
if errorlevel 1 (
  echo.
  echo Failed to install dependencies.
  pause
  exit /b 1
)
echo.

call "%PNPM_CMD%" start
if errorlevel 1 (
  echo.
  echo Relic failed to start.
  pause
  exit /b 1
)

echo.
echo Relic has exited.
pause
