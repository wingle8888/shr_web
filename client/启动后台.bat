@echo off
chcp 65001 >nul
title 商城控制台
echo 正在启动商城控制台...
cscript //nologo "%~dp0商城控制台.vbs"
if errorlevel 1 (
  start "" "https://develop-boards.com/admin/?client=windows"
)
