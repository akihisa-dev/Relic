@echo off
chcp 65001 > nul
cd /d "%~dp0app"

set APP_PATH=%CD%\out\Relic-win32-x64\Relic.exe

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

if exist "%APPDATA%\npm\pnpm.cmd" (
  "%APPDATA%\npm\pnpm.cmd" start
  echo.
  echo Relic has exited.
  pause
  exit /b 0
)

echo pnpm not found. Please set up the development environment.
echo.
pause
