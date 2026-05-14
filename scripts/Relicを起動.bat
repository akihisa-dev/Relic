@echo off
chcp 65001 > nul
cd /d "%~dp0..\app"

set "APP_PATH=%CD%\out\Relic-win32-x64\Relic.exe"
set "PNPM_CMD=%APPDATA%\npm\pnpm.cmd"

if exist "%APP_PATH%" (
  start "" "%APP_PATH%"
  echo Starting Relic...
  echo Relic.exe launched.
  echo You can close this window.
  timeout /t 3 > nul
  exit /b 0
)

echo Starting Relic...
echo.

if not exist "%PNPM_CMD%" (
  echo pnpm not found. Please set up the development environment.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo node_modules not found. Running pnpm install...
  call "%PNPM_CMD%" install
  if errorlevel 1 (
    echo.
    echo Failed to install dependencies.
    pause
    exit /b 1
  )
)

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
