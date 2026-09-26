# Puts the "TeachTown Buttons" shortcut on the Desktop - the para page
# (one tab per learner, the four subject buttons, Social Skills routines).
# Re-running overwrites it.
#
#   Double-click "Install Desktop Shortcuts.cmd" (same folder), or:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\install-shortcuts.ps1
#   ... -PerSubject   also adds the four one-click console launchers
#                     "Luis - <Subject>" (first learner only, no page)
#
# Nothing here touches TeachTown, credentials, or config.json. It only
# writes .lnk files to the current user's Desktop.
param([switch]$PerSubject)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerDir = (Resolve-Path (Join-Path $here '..')).Path
$desktop = [Environment]::GetFolderPath('Desktop')
$shell = New-Object -ComObject WScript.Shell

function New-Shortcut($name, $file, $description) {
  $target = Join-Path $here $file
  if (-not (Test-Path $target)) { throw "missing launcher: $target" }
  $lnk = Join-Path $desktop ($name + '.lnk')
  $sc = $shell.CreateShortcut($lnk)
  $sc.TargetPath = $target
  $sc.WorkingDirectory = $runnerDir
  $sc.Description = $description
  $sc.IconLocation = "$env:SystemRoot\System32\imageres.dll,76"
  $sc.Save()
  Write-Host ("created  " + $lnk)
}

New-Shortcut 'TeachTown Buttons' 'TeachTown-Buttons.cmd' 'TeachTown para page: pick the learner, tap a subject or the Social Skills routine'

if ($PerSubject) {
  $subjects = @(
    @{ Name = 'Social Studies'; File = 'Luis-Social-Studies.cmd' },
    @{ Name = 'ELA';            File = 'Luis-ELA.cmd' },
    @{ Name = 'Math';           File = 'Luis-Math.cmd' },
    @{ Name = 'Science';        File = 'Luis-Science.cmd' }
  )
  foreach ($s in $subjects) {
    New-Shortcut ('Luis - ' + $s.Name) $s.File ('TeachTown enCORE Student-Led: only ' + $s.Name + ' checked, stops at READY')
  }
}

Write-Host ''
Write-Host 'Done. Double-click "TeachTown Buttons" on the Desktop: the button page opens'
Write-Host 'in the browser, and a minimized "TeachTown helper" window runs it - leave'
Write-Host 'that window open while you work.'
