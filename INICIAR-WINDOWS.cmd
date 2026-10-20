@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Instale o Node.js 22 LTS para desenvolver localmente.
 echo Para publicar sem instalar, use a pasta PRONTO-PARA-PUBLICAR.
 pause
 exit /b 1
)
if not exist "node_modules" (
 call npm ci
 if errorlevel 1 (
  pause
  exit /b 1
 )
)
echo Abra a URL indicada abaixo. Configure o Supabase pela propria tela.
call npm run dev
pause
