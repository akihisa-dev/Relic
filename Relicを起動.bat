@echo off
chcp 65001 > nul
set "PATH=%APPDATA%\npm;%PATH%"
cd /d "%~dp0app"

echo Starting Relic...
echo.

set APP_PATH=%CD%\out\Relic-win32-x64\Relic.exe

if exist "%APP_PATH%" (
  start "" "%APP_PATH%"
  echo Relic.exe launched.
  echo You can close this window.
  timeout /t 3 > nul
  exit /b 0
)

where pnpm > nul 2>&1
if errorlevel 1 (
  echo pnpm not found. Please set up the development environment.
  echo.
  pause
  exit /b 1
)

pnpm start

echo.
echo Relic has exited.
pause
