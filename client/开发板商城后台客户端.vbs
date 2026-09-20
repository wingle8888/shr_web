' 兼容旧名称：请改用「商城控制台.vbs」
Option Explicit
Dim fso, sh, p
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
p = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "商城控制台.vbs")
If fso.FileExists(p) Then
  sh.Run "wscript.exe """ & p & """", 1, False
Else
  sh.Run "https://develop-boards.com/admin/?client=windows", 1, False
End If
