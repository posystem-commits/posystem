# Helps you add the monitor's four secrets to GitHub without typing or reading them.
# Run it from the project folder:   powershell -ExecutionPolicy Bypass -File monitor\copy-secrets.ps1
# For each secret it tells you the NAME to type and puts the VALUE on your clipboard, so you only paste.
# Nothing is printed or saved, and the clipboard is cleared at the end.
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env.local"
if (-not (Test-Path $envFile)) { Write-Host "Can't find $envFile"; exit 1 }
function Get-EnvValue($name) {
  $line = Get-Content $envFile | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
  if (-not $line) { return $null }
  return ($line -replace "^$name=", "").Trim()
}

Start-Process "https://github.com/posystem-commits/posystem/settings/secrets/actions/new"
Write-Host ""
Write-Host "A GitHub page opened ('New secret'). If it asks you to sign in, do that first." -ForegroundColor Cyan
Write-Host "For each of the 4 secrets below: type the NAME in the 'Name' box, paste the VALUE in the 'Secret' box, click 'Add secret'," -ForegroundColor Cyan
Write-Host "then click 'New repository secret' again for the next one." -ForegroundColor Cyan
Write-Host ""

$items = @(
  @{ Name = "SUPABASE_URL";          Source = "env"; Key = "SUPABASE_URL" },
  @{ Name = "MONITOR_SUPABASE_KEY";  Source = "env"; Key = "SUPABASE_SERVICE_ROLE_KEY" },
  @{ Name = "TELEGRAM_BOT_TOKEN";    Source = "you"; Hint = "the long token @BotFather gave you when you created the bot (copy it in Telegram now)" },
  @{ Name = "TELEGRAM_CHAT_IDS";     Source = "you"; Hint = "your chat id: the number @userinfobot shows you when you message it (copy it now)" }
)

$n = 0
foreach ($item in $items) {
  $n++
  Write-Host "Secret $n of 4" -ForegroundColor Yellow
  Write-Host "  Name to type:  $($item.Name)"
  if ($item.Source -eq "env") {
    $value = Get-EnvValue $item.Key
    if (-not $value) { Write-Host "  Couldn't find $($item.Key) in .env.local" -ForegroundColor Red; exit 1 }
    Set-Clipboard -Value $value
    Write-Host "  The value is now on your clipboard - paste it in the 'Secret' box."
  } else {
    Write-Host "  Value: $($item.Hint)"
    Write-Host "  Copy it yourself, then paste it in the 'Secret' box."
  }
  Read-Host "  When you've clicked 'Add secret', press Enter for the next one" | Out-Null
  Write-Host ""
}
Set-Clipboard -Value " "
Write-Host "All four are added. The clipboard was cleared. Tell Claude 'secrets added'." -ForegroundColor Green
