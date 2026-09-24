# Creates five Desktop shortcuts pointing at the Luis-<Subject>.cmd
# launchers in this folder. Re-running overwrites them.
#
#   Luis - ELA
#   Luis - Math
#   Luis - Science
#   Luis - Social Studies
#   Luis - Social Skills
#
# Social Studies is a school subject. Social Skills is a different
# activity. The shortcuts are not aliases.
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
  @{ Name = 'ELA';            File = 'Luis-ELA.cmd';            About = 'School subject for Luis. Only ELA stays checked, then it waits for you.' },
  @{ Name = 'Math';           File = 'Luis-Math.cmd';           About = 'School subject for Luis. Only Math stays checked, then it waits for you.' },
  @{ Name = 'Science';        File = 'Luis-Science.cmd';        About = 'School subject for Luis. Only Science stays checked, then it waits for you.' },
  @{ Name = 'Social Studies'; File = 'Luis-Social-Studies.cmd'; About = 'School subject for Luis. Only Social Studies stays checked, then it waits for you. This is not Social Skills.' },
  @{ Name = 'Social Skills';  File = 'Luis-Social-Skills.cmd';  About = 'Social Skills for Luis. This is not Social Studies.' }
)

foreach ($s in $subjects) {
  $target = Join-Path $here $s.File
  if (-not (Test-Path $target)) { throw "missing launcher: $target" }
  $lnk = Join-Path $desktop ("Luis - " + $s.Name + ".lnk")
  $sc = $shell.CreateShortcut($lnk)
  $sc.TargetPath = $target
  $sc.WorkingDirectory = $runnerDir
  $sc.Description = $s.About
  $sc.IconLocation = "$env:SystemRoot\System32\imageres.dll,76"
  $sc.Save()
  Write-Host ("created  " + $lnk)
}

Write-Host ''
Write-Host "Done. Five shortcuts are on the Desktop:"
Write-Host "  Luis - ELA, Luis - Math, Luis - Science,"
Write-Host "  Luis - Social Studies, and Luis - Social Skills."
Write-Host "Social Studies and Social Skills are different shortcuts."
Write-Host "Each opens a window, sets up that one subject, and waits"
Write-Host "for you to press Next on the TeachTown screen."
