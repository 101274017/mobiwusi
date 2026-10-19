@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-lili-desktop.ps1"
if errorlevel 1 pause
