@echo off
cd /d "%~dp0"
start "小钱本本地服务" /min node preview-server.mjs
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:4173/index.html"
