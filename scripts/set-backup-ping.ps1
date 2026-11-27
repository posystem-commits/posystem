# Saves the healthchecks.io ping address of the nightly-backup check into .env.local (where the backup reads it).
# Run:  powershell -ExecutionPolicy Bypass -File scripts\set-backup-ping.ps1
# You paste the address at the prompt; it is not shown or printed.
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env.local"
if (-not (Test-Path $envFile)) { Write-Host "Can't find $envFile" -ForegroundColor Red; exit 1 }
$secure = Read-Host "Paste the ping URL of the 'Nightly backup' check (it starts with https://hc-ping.com/)" -AsSecureString
$url = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)).Trim()
if ($url -notmatch '^https://hc-ping\.com/[0-9a-fA-F-]{20,}/?$') { Write-Host "That doesn't look like a healthchecks.io ping URL. Nothing was saved." -ForegroundColor Red; exit 1 }
# Keep the file exactly as it is (no byte-order mark, same line endings); only replace or add our own line.
$text = [IO.File]::ReadAllText($envFile)
$nl = if ($text.Contains("`r`n")) { "`r`n" } else { "`n" }
$text = [regex]::Replace($text, '(?m)^HEALTHCHECK_BACKUP_URL=.*(\r?\n|$)', '')
if ($text.Length -gt 0 -and -not $text.EndsWith("`n")) { $text += $nl }
$text += "HEALTHCHECK_BACKUP_URL=$url$nl"
[IO.File]::WriteAllText($envFile, $text, (New-Object Text.UTF8Encoding($false)))
Write-Host "Saved. The nightly backup will now ping healthchecks.io when it finishes." -ForegroundColor Green
