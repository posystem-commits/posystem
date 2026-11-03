// A small Windows file that makes a till print silently: it makes the receipt printer the default printer and puts a
// desktop shortcut on the desktop that opens this POS in Chrome (or Edge) with --kiosk-printing, which skips the print
// window every time. Built in the browser so the shortcut points at the exact page the user is on.
export const buildAutoPrintSetupBat = (url) => {
  const lines = [
    "@echo off",
    "setlocal",
    "title POS silent printing setup",
    "echo.",
    "echo  Silent printing for the POS",
    "echo  --------------------------",
    'set "PRN=XP-80C"',
    'set /p "PRN=Receipt printer name as Windows shows it [press Enter for XP-80C]: "',
    `powershell -NoProfile -Command "try { (New-Object -ComObject WScript.Network).SetDefaultPrinter('%PRN%'); Write-Host 'Default printer is now %PRN%' -ForegroundColor Green } catch { Write-Host 'Could not set the default printer - check the name and run this again.' -ForegroundColor Red }"`,
    'set "BROWSER="',
    'for %%P in ("%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" "%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe" "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe") do if not defined BROWSER if exist %%P set "BROWSER=%%~P"',
    "if not defined BROWSER goto nobrowser",
    `powershell -NoProfile -Command "$s = (New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop') + '\\POS (auto print).lnk'); $s.TargetPath = '%BROWSER%'; $s.Arguments = '--kiosk-printing ${url}'; $s.Save()"`,
    "echo.",
    "echo  Done. There is now a shortcut on the desktop called: POS (auto print)",
    "echo.",
    "echo  1. Close EVERY Chrome window first, also the small Chrome icon near the clock.",
    "echo  2. From now on open the POS with that shortcut. Receipts then print with no print window.",
    'tasklist /fi "imagename eq chrome.exe" 2>nul | "%SystemRoot%\\System32\\find.exe" /i "chrome.exe" >nul && echo.',
    'tasklist /fi "imagename eq chrome.exe" 2>nul | "%SystemRoot%\\System32\\find.exe" /i "chrome.exe" >nul && echo  Chrome is open right now - close it completely before using the new shortcut.',
    "echo.",
    "pause",
    "exit /b",
    ":nobrowser",
    "echo.",
    "echo  Chrome or Edge was not found on this computer.",
    "pause",
  ];
  return lines.join("\r\n") + "\r\n";
};
