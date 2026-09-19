@echo off
chcp 65001 >nul
title 开发板商城后台客户端
echo 正在启动后台客户端...
cscript //nologo "%~dp0开发板商城后台客户端.vbs"
if errorlevel 1 (
  start "" "https://develop-boards.com/admin/"
)
