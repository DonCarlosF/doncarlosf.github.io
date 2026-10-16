@echo off
rem Desktop entry point: Social Skills for "Luis".
rem Opens the Social Skills APP - not enCORE - logs Luis in, and waits on
rem the activity list. You pick the movie or activity. Not Social Studies.
rem Add --dry-run to log in and back out without starting anything.
call "%~dp0_student-led.cmd" social-skills %*
