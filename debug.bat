@echo on
echo APPDATA=%APPDATA%
if exist "%APPDATA%\npm\pnpm.cmd" (echo FILE FOUND) else (echo FILE NOT FOUND)
dir "%APPDATA%\npm\pnpm*" 2>nul
pause
