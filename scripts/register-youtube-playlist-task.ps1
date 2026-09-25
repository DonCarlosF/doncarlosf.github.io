<#
Registers a Windows Task Scheduler job that runs start-youtube-playlist.ps1
at 8:00 AM, Monday-Friday.

Usage (run once, from a PowerShell prompt on the Windows machine):
    .\scripts\register-youtube-playlist-task.ps1

Remove it later with:
    Unregister-ScheduledTask -TaskName "Start YouTube Playlist" -Confirm:$false
#>

$scriptPath = Join-Path $PSScriptRoot "start-youtube-playlist.ps1"

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""

$trigger = New-ScheduledTaskTrigger -Weekly `
    -DaysOfWeek Monday, Tuesday, Wednesday, Thursday, Friday -At 8:00AM

Register-ScheduledTask -TaskName "Start YouTube Playlist" `
    -Action $action -Trigger $trigger `
    -Description "Opens the morning YouTube playlist at 8am on weekdays." `
    -Force
