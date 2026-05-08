@echo off
chcp 65001 > nul
cd /d "%~dp0app"

echo Building Relic...
echo (This may take a few minutes)
echo.

where pnpm > /dev/null 2>&1
if errorlevel 1 (
  echo pnpm not found. Please set up the development environment.
  echo.
  pause
  exit /b 1
)

pnpm make:win

echo.
echo Build complete.
echo Relic.exe is in app\out\Relic-win32-x64\
echo.
pause
