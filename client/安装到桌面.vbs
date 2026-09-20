' 一键把「商城控制台」放到桌面，之后可双击打开
Option Explicit

Dim sh, fso, desktop, link, target, icon, oldLink
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

desktop = sh.SpecialFolders("Desktop")
target = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "商城控制台.vbs")

If Not fso.FileExists(target) Then
  MsgBox "未找到客户端文件：" & target, 16, "商城控制台"
  WScript.Quit 1
End If

oldLink = fso.BuildPath(desktop, "开发板商城后台客户端.lnk")
If fso.FileExists(oldLink) Then fso.DeleteFile oldLink, True

Set link = sh.CreateShortcut(fso.BuildPath(desktop, "商城控制台.lnk"))
link.TargetPath = "wscript.exe"
link.Arguments = """" & target & """"
link.WorkingDirectory = fso.GetParentFolderName(target)
link.WindowStyle = 1
link.Description = "商城控制台"
icon = sh.ExpandEnvironmentStrings("%SystemRoot%\System32\shell32.dll")
link.IconLocation = icon & ", 165"
link.Save

MsgBox "已创建桌面快捷方式：" & vbCrLf & "商城控制台" & vbCrLf & vbCrLf & "以后在桌面双击即可打开。", 64, "安装完成"
