<#
Creates a "Morning Playlist" shortcut on the desktop that runs
start-youtube-playlist.ps1 (opens the playlist in the default browser).

Usage (run once, from a PowerShell prompt on the Windows machine):
    .\scripts\create-youtube-playlist-shortcut.ps1

Delete the shortcut from the desktop to remove it later.
#>

$scriptPath = Join-Path $PSScriptRoot "start-youtube-playlist.ps1"
$shortcutPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "Morning Playlist.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.Description = "Opens the morning YouTube playlist"
$shortcut.IconLocation = "imageres.dll,174"
$shortcut.Save()

Write-Host "Shortcut created at $shortcutPath"
