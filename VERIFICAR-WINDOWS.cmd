@echo off
setlocal
cd /d "%~dp0"
call npm ci
if errorlevel 1 goto falha
call npm test
if errorlevel 1 goto falha
call npm run build
if errorlevel 1 goto falha
echo Projeto verificado.
pause
exit /b 0
:falha
echo Verificacao interrompida. Confira a mensagem acima.
pause
exit /b 1
