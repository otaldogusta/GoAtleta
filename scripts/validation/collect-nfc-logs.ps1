# Collect NFC-related logs via adb and filter important events
# Usage: powershell -File collect-nfc-logs.ps1 -OutFile nfc-log.txt -DurationMinutes 60
param(
  [string]$OutFile = "nfc-log.txt",
  [int]$DurationMinutes = 60
)
Write-Host "Starting adb logcat capture for $DurationMinutes minutes -> $OutFile"
# Clear previous logs
adb logcat -c
# Capture logs, filter for relevant tags and keywords
adb logcat *:S ReactNative:V GoAtleta:N | Select-String -Pattern "cache_gc_cleanup|cache_size_snapshot|tag_detected|scan_duplicate_blocked|checkin_pending_offline" -SimpleMatch | Tee-Object -FilePath $OutFile
# Note: Run this from PowerShell; stop with Ctrl+C if you want to end earlier.
