@echo off
chcp 65001 > nul
cd /d "%~dp0..\app"

set "PNPM_CMD=%APPDATA%\npm\pnpm.cmd"

echo Building Relic...
echo (This may take a few minutes)
echo.

if not exist "%PNPM_CMD%" (
  echo pnpm not found. Please set up the development environment.
  echo.
  pause
  exit /b 1
)

echo Checking dependencies...
call "%PNPM_CMD%" install --fetch-timeout 300000 --fetch-retries 5 --network-concurrency 2
if errorlevel 1 (
  echo.
  echo Failed to install dependencies.
  echo Package download may have timed out. Please check internet, VPN, or proxy settings, then run this file again.
  pause
  exit /b 1
)
echo.

call "%PNPM_CMD%" build:win:safe
if errorlevel 1 (
  echo.
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo Build complete.
echo Safe build output is in app\out\Relic-win32-x64\
echo.
pause
