@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-desktop-client.ps1" -CompatibleDisplay
if errorlevel 1 pause
