@echo off
rem Abre la pared en pantalla completa (kiosko) con Chrome. El servidor debe estar corriendo (npm run server).
start "" chrome.exe --kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required --force_high_performance_gpu --user-data-dir="%LOCALAPPDATA%\EnRutaPared" http://localhost:3001/
