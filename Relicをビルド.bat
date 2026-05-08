@echo off
chcp 65001 > nul
cd /d "%~dp0app"

echo Building Relic...
echo (This may take a few minutes)
echo.

if exist "%APPDATA%\npm\pnpm.cmd" (
  "%APPDATA%\npm\pnpm.cmd" make:win
  echo.
  echo Build complete.
  echo Relic.exe is in app\out\Relic-win32-x64\
  echo.
  pause
  exit /b 0
)

echo pnpm not found. Please set up the development environment.
echo.
pause
