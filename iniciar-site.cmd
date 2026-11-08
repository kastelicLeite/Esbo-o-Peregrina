@echo off
title Grafica Peregrina - Servidor local
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo Instale o Node.js 24 para iniciar o site.
    pause
    exit /b 1
)

if not exist "node_modules\express\package.json" (
    echo Preparando as bibliotecas do projeto...
    call npm ci
    if errorlevel 1 (
        pause
        exit /b 1
    )
)

node --env-file-if-exists=.env scripts/iniciar-site.cjs

if errorlevel 1 (
    echo.
    echo Nao foi possivel iniciar o site. Confira a mensagem acima.
    pause
)
