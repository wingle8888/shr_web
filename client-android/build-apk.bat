@echo off
setlocal
cd /d "%~dp0"
if not exist "local.properties" (
  echo sdk.dir=C:\\Users\\Administrator\\AppData\\Local\\Android\\Sdk> local.properties
)
if exist "%~dp0gradlew.bat" (
  call "%~dp0gradlew.bat" assembleRelease --no-daemon
) else (
  gradle assembleRelease --no-daemon
)
if errorlevel 1 exit /b 1
if not exist "..\client" mkdir "..\client"
copy /y "app\build\outputs\apk\release\app-release.apk" "..\client\开发板商城-后台客户端.apk"
echo APK ready: ..\client\开发板商城-后台客户端.apk
