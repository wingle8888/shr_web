' 商城控制台 - Windows 桌面客户端
' 双击本文件即可打开商城控制台（独立窗口，无需先打开浏览器）
Option Explicit

Dim sh, fso, url, edge, chrome, scriptDir, cfg, line, cfgPath

url = "https://develop-boards.com/admin/?client=windows"
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' 可选：同目录 config.txt 第一行可写自定义后台地址
cfgPath = fso.BuildPath(scriptDir, "config.txt")
If fso.FileExists(cfgPath) Then
  Set cfg = fso.OpenTextFile(cfgPath, 1)
  If Not cfg.AtEndOfStream Then
    line = Trim(cfg.ReadLine)
    If Left(LCase(line), 4) = "http" Then url = line
  End If
  cfg.Close
End If

If InStr(url, "?") > 0 Then
  If InStr(LCase(url), "client=") = 0 Then url = url & "&client=windows"
Else
  url = url & "?client=windows"
End If

edge = FindBrowser("Microsoft\Edge\Application\msedge.exe")
If edge <> "" Then
  sh.Run """" & edge & """ --app=""" & url & """ --new-window --window-size=1280,860", 1, False
  WScript.Quit 0
End If

chrome = FindBrowser("Google\Chrome\Application\chrome.exe")
If chrome <> "" Then
  sh.Run """" & chrome & """ --app=""" & url & """ --new-window --window-size=1280,860", 1, False
  WScript.Quit 0
End If

sh.Run url, 1, False
WScript.Quit 0

Function FindBrowser(relPath)
  Dim paths(3), i, p
  paths(0) = sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\" & relPath
  paths(1) = sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\" & relPath
  paths(2) = sh.ExpandEnvironmentStrings("%LocalAppData%") & "\" & relPath
  paths(3) = sh.ExpandEnvironmentStrings("%UserProfile%") & "\AppData\Local\" & relPath
  FindBrowser = ""
  For i = 0 To 3
    p = paths(i)
    If fso.FileExists(p) Then
      FindBrowser = p
      Exit Function
    End If
  Next
End Function
