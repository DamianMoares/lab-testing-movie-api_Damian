@echo off
echo Ejecutando tests con cobertura...
cd /d "%~dp0"
node node_modules\jest\bin\jest.js --coverage
pause
