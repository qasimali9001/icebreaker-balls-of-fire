@echo off
cd /d "%~dp0"
echo.
echo  Icebreaker — http://localhost:5173
echo  Close this window to stop the server.
echo.
timeout /t 1 /nobreak >nul
start "" "http://localhost:5173"
python -m http.server 5173
if errorlevel 1 (
  echo.
  echo  If that failed, try: py -3 -m http.server 5173
  pause
)
