@echo off
rem Desktop entry point: enCORE Student-Led for "Luis" with ONLY Math checked.
rem Add --dry-run to verify the checkboxes and back out without starting anything.
call "%~dp0_student-led.cmd" math %*
