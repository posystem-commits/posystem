@echo off
rem Nightly off-Supabase backup of every restaurant's data (see export-backup.js in this folder).
rem Run by the Windows scheduled task "POS Nightly Backup" (every day 04:30; runs when the PC next starts if it was off).
rem Backups go to Google Drive (G:\My Drive\POS Backups). Edit BACKUP_DIR below to change that.
set BACKUP_DIR=G:\My Drive\POS Backups
cd /d D:\POSYSTEM\pos-app
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
echo ===== %date% %time% ===== >> "%BACKUP_DIR%\backup-log.txt"
"D:\POSYSTEM\node.exe" --env-file=.env.local scripts\export-backup.js "%BACKUP_DIR%" >> "%BACKUP_DIR%\backup-log.txt" 2>&1

