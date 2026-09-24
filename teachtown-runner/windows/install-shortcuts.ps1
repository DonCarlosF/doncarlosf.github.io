# Creates four Desktop shortcuts - one per subject - pointing at the
# Luis-<Subject>.cmd launchers in this folder. Re-running overwrites them.
#
#   Double-click "Install Desktop Shortcuts.cmd" (same folder), or:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\install-shortcuts.ps1
#
# Nothing here touches TeachTown, credentials, or config.json. It only
# writes .lnk files to the current user's Desktop.

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerDir = (Resolve-Path (Join-Path $here '..')).Path
$desktop = [Environment]::GetFolderPath('Desktop')
$shell = New-Object -ComObject WScript.Shell

$subjects = @(
  @{ Name = 'ELA';           File = 'Luis-ELA.cmd' },
  @{ Name = 'Math';          File = 'Luis-Math.cmd' },
  @{ Name = 'Social Skills'; File = 'Luis-Social-Skills.cmd' },
  @{ Name = 'Science';       File = 'Luis-Science.cmd' }
)

foreach ($s in $subjects) {
  $target = Join-Path $here $s.File
  if (-not (Test-Path $target)) { throw "missing launcher: $target" }
  $lnk = Join-Path $desktop ("Luis - " + $s.Name + ".lnk")
  $sc = $shell.CreateShortcut($lnk)
  $sc.TargetPath = $target
  $sc.WorkingDirectory = $runnerDir
  $sc.Description = "TeachTown enCORE Student-Led: only " + $s.Name + " checked, stops at READY"
  $sc.IconLocation = "$env:SystemRoot\System32\imageres.dll,76"
  $sc.Save()
  Write-Host ("created  " + $lnk)
}

Write-Host ''
Write-Host "Done. Four shortcuts are on the Desktop. Each opens a console window,"
Write-Host "drives the browser to Student-Led step 2 with one subject checked, and"
Write-Host "waits for you to press Next on screen."
