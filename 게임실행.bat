@echo off
cd /d "%~dp0"
start "" http://localhost:3000
where npm >nul 2>nul
if %errorlevel%==0 (
  npm run dev
) else (
  set "PATH=C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
  call "C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd" run dev
)
