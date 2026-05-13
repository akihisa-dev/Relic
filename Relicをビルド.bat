@echo off
chcp 65001 > nul
cd /d "%~dp0app"

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

call "%PNPM_CMD%" make:win
if errorlevel 1 (
  echo.
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo Build complete.
echo Relic.exe is in app\out\Relic-win32-x64\
echo.
pause
