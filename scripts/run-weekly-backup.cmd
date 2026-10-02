@echo off
rem Weekly off-Supabase backup of every restaurant's data (see export-backup.js in this folder).
rem Run by the Windows scheduled task "POS Weekly Backup" (Sundays 04:00).
rem To change where backups are saved (e.g. a Google Drive folder), edit BACKUP_DIR below.
set BACKUP_DIR=D:\POSYSTEM\pos-app\backups
cd /d D:\POSYSTEM\pos-app
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
echo ===== %date% %time% ===== >> "%BACKUP_DIR%\backup-log.txt"
"D:\POSYSTEM\node.exe" --env-file=.env.local scripts\export-backup.js "%BACKUP_DIR%" >> "%BACKUP_DIR%\backup-log.txt" 2>&1
