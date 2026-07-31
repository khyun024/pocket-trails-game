@echo off
setlocal
cd /d "%~dp0"
set "NODE_DIR=C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
set "PNPM_CMD=C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"
set "PATH=%NODE_DIR%;%PATH%"
echo.
echo Pocket Trails local server
echo PC: http://localhost:3000
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=*" %%b in ("%%a") do echo Mobile: http://%%b:3000
)
echo.
start "" /b cmd /c "ping 127.0.0.1 -n 4 >nul && start "" http://localhost:3000"
call "%PNPM_CMD%" run dev
echo.
echo Server stopped. Press any key to close.
pause >nul
