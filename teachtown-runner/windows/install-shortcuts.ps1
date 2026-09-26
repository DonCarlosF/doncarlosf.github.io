# Puts the "TeachTown Buttons" shortcut on the Desktop - the para page
# (one tab per learner; Social Studies, ELA, Math, Science; each learner's
# Social Skills app routine). Re-running overwrites it.
#
#   Double-click "Install Desktop Shortcuts.cmd" (same folder), or:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\install-shortcuts.ps1
#   ... -PerSubject   also adds the five one-click console launchers:
#                     Luis - ELA / Math / Science / Social Studies / Social Skills
#
# Social Studies is a school subject. Social Skills is a different
# activity. The shortcuts are not aliases.
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

New-Shortcut 'TeachTown Buttons' 'TeachTown-Buttons.cmd' 'TeachTown para page: pick the learner, tap a subject or the Social Skills app routine'

if ($PerSubject) {
  $subjects = @(
    @{ Name = 'ELA';            File = 'Luis-ELA.cmd';            About = 'School subject for Luis. Only ELA stays checked, then it waits for you.' },
    @{ Name = 'Math';           File = 'Luis-Math.cmd';           About = 'School subject for Luis. Only Math stays checked, then it waits for you.' },
    @{ Name = 'Science';        File = 'Luis-Science.cmd';        About = 'School subject for Luis. Only Science stays checked, then it waits for you.' },
    @{ Name = 'Social Studies'; File = 'Luis-Social-Studies.cmd'; About = 'School subject for Luis. Only Social Studies stays checked, then it waits for you. This is not Social Skills.' },
    @{ Name = 'Social Skills';  File = 'Luis-Social-Skills.cmd';  About = 'Social Skills for Luis. This is not Social Studies.' }
  )
  foreach ($s in $subjects) { New-Shortcut ('Luis - ' + $s.Name) $s.File $s.About }
}

Write-Host ''
Write-Host 'Done. Double-click "TeachTown Buttons" on the Desktop: the button page opens'
Write-Host 'in the browser, and a minimized "TeachTown helper" window runs it - leave'
Write-Host 'that window open while you work.'
if ($PerSubject) {
  Write-Host 'The five "Luis - <Subject>" shortcuts each open a console window, set up'
  Write-Host 'that one subject, and wait for you to press Next on the TeachTown screen.'
  Write-Host 'Social Studies and Social Skills are different shortcuts.'
}
