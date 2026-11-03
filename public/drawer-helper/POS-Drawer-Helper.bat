@echo off
rem POS cash drawer helper for Windows. One file: double-click it once on the till PC to install.
rem It listens only on this computer (127.0.0.1) and, when the POS asks, sends the standard
rem "open drawer" command to the receipt printer, which the drawer's cable is plugged into.
setlocal
set "DIR=%LOCALAPPDATA%\POSDrawer"
if /i "%~1"=="run" goto run

title POS cash drawer helper - setup
echo.
echo  POS cash drawer helper
echo  ----------------------
echo  The printer name must be exactly as Windows shows it (Settings - Printers).
set "PRN=XP-80C"
set /p "PRN=Printer name [press Enter for XP-80C]: "
if not exist "%DIR%" mkdir "%DIR%"
copy /y "%~f0" "%DIR%\drawer-helper.bat" >nul
>"%DIR%\printer.txt" echo %PRN%
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
>"%STARTUP%\POS-Drawer-Helper.vbs" echo CreateObject("WScript.Shell").Run """%DIR%\drawer-helper.bat"" run", 0, False
rem stop an older copy first, then start the new one
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'powershell.exe' -and $_.ProcessId -ne $PID -and $_.CommandLine -like '*POSDrawer*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
wscript "%STARTUP%\POS-Drawer-Helper.vbs"
timeout /t 3 /nobreak >nul
echo.
powershell -NoProfile -Command "try { $r = Invoke-RestMethod -UseBasicParsing http://127.0.0.1:9187/ping; Write-Host ('Helper is running. Printer: ' + $r.printer) -ForegroundColor Green } catch { Write-Host 'The helper did not start. Tell your support person.' -ForegroundColor Red }"
echo.
set "TESTNOW=N"
set /p "TESTNOW=Open the drawer now to test it? (Y/N): "
if /i "%TESTNOW%"=="Y" powershell -NoProfile -Command "try { $r = Invoke-RestMethod -UseBasicParsing -Method Post -Headers @{Origin='https://posystem-steel.vercel.app'} http://127.0.0.1:9187/open; Write-Host 'Sent the open command to the printer.' -ForegroundColor Green } catch { Write-Host ('Could not reach the printer: ' + $_) -ForegroundColor Red }"
echo.
echo  Done. It starts by itself whenever this computer starts. You can close this window.
pause
exit /b

:run
powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "$f = Get-Content -Raw -LiteralPath '%~f0'; Invoke-Expression $f.Substring($f.IndexOf('#PS1' + 'START'))"
exit /b

#PS1START
$ErrorActionPreference = 'Stop'
$dir = Join-Path $env:LOCALAPPDATA 'POSDrawer'
$printer = 'XP-80C'
try { $p = (Get-Content -LiteralPath (Join-Path $dir 'printer.txt') -TotalCount 1).Trim(); if ($p) { $printer = $p } } catch { }
$port = 9187
# Only the POS itself (and a local test copy) may ask for the drawer to open.
$allowed = @('https://posystem-steel.vercel.app', 'http://localhost:3000')

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class RawPrint {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DocInfo {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool OpenPrinter(string name, out IntPtr h, IntPtr defaults);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool StartDocPrinter(IntPtr h, int level, [In] DocInfo di);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool WritePrinter(IntPtr h, byte[] data, int count, out int written);

  // Returns null when the bytes were handed to the printer, otherwise a short error text.
  public static string Send(string printer, byte[] data) {
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero)) return "Printer '" + printer + "' was not found (Windows error " + Marshal.GetLastWin32Error() + ")";
    try {
      DocInfo di = new DocInfo();
      di.pDocName = "Open cash drawer";
      di.pDataType = "RAW";
      if (!StartDocPrinter(h, 1, di)) return "The printer refused the job (Windows error " + Marshal.GetLastWin32Error() + ")";
      try {
        if (!StartPagePrinter(h)) return "The printer refused the page (Windows error " + Marshal.GetLastWin32Error() + ")";
        int written;
        bool ok = WritePrinter(h, data, data.Length, out written);
        EndPagePrinter(h);
        if (!ok) return "Could not write to the printer (Windows error " + Marshal.GetLastWin32Error() + ")";
      } finally { EndDocPrinter(h); }
    } finally { ClosePrinter(h); }
    return null;
  }
}
'@

# ESC p m t1 t2 — a pulse on drawer pin 2 (m=0) and on pin 5 (m=1), so either wiring works.
$kick = [byte[]](0x1B, 0x70, 0x00, 0x19, 0xFA, 0x1B, 0x70, 0x01, 0x19, 0xFA)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
try { $listener.Start() } catch { exit }   # already running

function Reply($ctx, [int]$code, $obj) {
  $bytes = [Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Compress))
  $ctx.Response.StatusCode = $code
  $ctx.Response.ContentType = 'application/json'
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $ctx.Response.Close()
}

while ($listener.IsListening) {
  $ctx = $null
  try {
    $ctx = $listener.GetContext()
    $origin = $ctx.Request.Headers['Origin']
    $originOk = [bool]$origin -and ($allowed -contains $origin)
    if ($originOk) {
      $ctx.Response.Headers.Add('Access-Control-Allow-Origin', $origin)
      $ctx.Response.Headers.Add('Vary', 'Origin')
      $ctx.Response.Headers.Add('Access-Control-Allow-Private-Network', 'true')
      $ctx.Response.Headers.Add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      $ctx.Response.Headers.Add('Access-Control-Allow-Headers', 'Content-Type')
    }
    $path = $ctx.Request.Url.AbsolutePath
    $method = $ctx.Request.HttpMethod
    if ($method -eq 'OPTIONS') { $ctx.Response.StatusCode = 204; $ctx.Response.Close(); continue }
    if ($method -eq 'GET' -and $path -eq '/ping') { Reply $ctx 200 @{ ok = $true; printer = $printer }; continue }
    if ($method -eq 'POST' -and $path -eq '/open') {
      if (-not $originOk) { Reply $ctx 403 @{ ok = $false; error = 'not allowed' }; continue }
      $err = [RawPrint]::Send($printer, $kick)
      if ($err) { Reply $ctx 500 @{ ok = $false; error = $err } } else { Reply $ctx 200 @{ ok = $true } }
      continue
    }
    Reply $ctx 404 @{ ok = $false }
  } catch {
    try { if ($ctx) { $ctx.Response.Abort() } } catch { }
  }
}
