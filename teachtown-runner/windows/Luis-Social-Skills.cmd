@echo off
rem Desktop entry point: Social Skills for "Luis".
rem ONLY Social Skills stays checked. This is not Social Studies.
rem Add --dry-run to check the boxes and back out without starting a lesson.
call "%~dp0_student-led.cmd" social-skills %*
