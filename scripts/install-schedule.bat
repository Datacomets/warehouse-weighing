@echo off
REM ============================================================
REM COMETS GR — Install Daily Backup Schedule
REM Registers a Windows Task Scheduler job to run backup.sh
REM daily at 02:00 AM
REM
REM Run as Administrator:
REM   Right-click > Run as administrator
REM ============================================================

set TASK_NAME=COMETS-GR-DailyBackup
set SCRIPT_PATH=%~dp0backup.sh
set BASH_EXE=C:\Users\jekita.b\AppData\Local\Programs\Git\bin\bash.exe

echo.
echo === COMETS GR — Daily Backup Scheduler ===
echo.
echo Task Name : %TASK_NAME%
echo Script    : %SCRIPT_PATH%
echo Schedule  : Daily at 02:00 AM
echo Bash      : %BASH_EXE%
echo.

REM Check if Git Bash exists
if not exist "%BASH_EXE%" (
    echo ERROR: Git Bash not found at %BASH_EXE%
    echo Please install Git for Windows or update BASH_EXE path
    pause
    exit /b 1
)

REM Delete existing task if any
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

REM Create new scheduled task
REM  /sc DAILY          — run every day
REM  /st 02:00          — at 2 AM
REM  /rl HIGHEST        — run with highest privileges
REM  /f                 — force create (no prompt)
schtasks /create ^
  /tn "%TASK_NAME%" ^
  /tr "\"%BASH_EXE%\" \"%SCRIPT_PATH%\"" ^
  /sc DAILY ^
  /st 02:00 ^
  /rl HIGHEST ^
  /f

if %ERRORLEVEL% EQU 0 (
    echo.
    echo SUCCESS: Task "%TASK_NAME%" created!
    echo.
    echo To verify:   schtasks /query /tn "%TASK_NAME%" /v
    echo To run now:  schtasks /run /tn "%TASK_NAME%"
    echo To remove:   schtasks /delete /tn "%TASK_NAME%" /f
) else (
    echo.
    echo FAILED: Could not create task. Make sure you run as Administrator.
)

echo.
pause
