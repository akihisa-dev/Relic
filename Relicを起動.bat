@echo off
chcp 65001 > nul
cd /d "%~dp0app"

echo Relic を起動しています...
echo.

set APP_PATH=%CD%\out\Relic-win32-x64\Relic.exe

if exist "%APP_PATH%" (
  start "" "%APP_PATH%"
  echo Relic.exe を起動しました。
  echo このウィンドウは閉じて大丈夫です。
  timeout /t 3 > nul
  exit /b 0
)

where pnpm > nul 2>&1
if errorlevel 1 (
  echo pnpm が見つかりませんでした。
  echo 開発環境の準備が必要です。
  echo.
  pause
  exit /b 1
)

pnpm start

echo.
echo Relic が終了しました。
pause
