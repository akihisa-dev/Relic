@echo off
chcp 65001 > nul
cd /d "%~dp0app"

echo Relic をビルドしています...
echo （数分かかります）
echo.

where pnpm > nul 2>&1
if errorlevel 1 (
  echo pnpm が見つかりませんでした。
  echo 開発環境の準備が必要です。
  echo.
  pause
  exit /b 1
)

pnpm make:win

echo.
echo ビルドが完了しました。
echo app\out\Relic-win32-x64\ フォルダに Relic.exe が生成されています。
echo.
pause
