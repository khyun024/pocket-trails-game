@echo off
setlocal
cd /d "%~dp0"
title Pocket Trails - Mobile GPS

set "NODE_DIR=C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
set "PNPM_CMD=C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"
set "PATH=%NODE_DIR%;%PATH%"

echo.
echo ========================================================
echo   POCKET TRAILS - MOBILE GPS
echo ========================================================
echo.
echo Starting the local game server...

netstat -ano | findstr /r /c:":3000 .*LISTENING" >nul
if errorlevel 1 (
  start "Pocket Trails Local Server" /min cmd /c "cd /d ""%~dp0"" && call ""%PNPM_CMD%"" run dev"
  timeout /t 6 /nobreak >nul
)

echo.
echo An HTTPS mobile address will appear below.
echo Open the address ending in trycloudflare.com on your iPhone.
echo Keep BOTH PC windows open while playing.
echo Press Ctrl+C to stop the mobile connection.
echo.

"%~dp0tools\cloudflared.exe" tunnel --url http://127.0.0.1:3000 --no-autoupdate

echo.
echo Mobile connection stopped.
pause
