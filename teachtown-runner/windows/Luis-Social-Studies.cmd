@echo off
rem Desktop entry point: school subject Social Studies for "Luis".
rem ONLY Social Studies stays checked. This is not Social Skills.
rem Add --dry-run to check the boxes and back out without starting a lesson.
call "%~dp0_student-led.cmd" social-studies %*
