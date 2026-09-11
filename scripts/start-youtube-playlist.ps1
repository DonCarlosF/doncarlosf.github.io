<#
Opens the morning YouTube playlist in the default browser.
Triggered daily at 8am M-F by the scheduled task set up in
register-youtube-playlist-task.ps1 — run that once to install it.
#>

Start-Process "https://youtube.com/playlist?list=PLVB82mQky5qM"
