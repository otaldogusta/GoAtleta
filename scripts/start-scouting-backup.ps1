param(
 [Parameter(Mandatory=$true)][string]$Source,
 [Parameter(Mandatory=$true)][string]$Destination,
 [int]$IntervalSeconds = 30
)
$ErrorActionPreference = 'Stop'
$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$destinationPath = [System.IO.Path]::GetFullPath($Destination)
$scriptPath = Join-Path $PSScriptRoot 'scouting-storage-snapshot.py'
New-Item -ItemType Directory -Path $destinationPath -Force | Out-Null
$backupArguments = '"{0}" --source "{1}" --output "{2}" --watch --interval {3}' -f $scriptPath, $sourcePath, $destinationPath, $IntervalSeconds
$process = Start-Process -FilePath (Get-Command python).Source -ArgumentList $backupArguments -WindowStyle Hidden -RedirectStandardOutput (Join-Path $destinationPath 'watcher-output.log') -RedirectStandardError (Join-Path $destinationPath 'watcher-error.log') -PassThru
$process.PriorityClass = 'BelowNormal'
Write-Output ('Backup watcher started, PID {0}. Status: {1}' -f $process.Id, (Join-Path $destinationPath 'backup-status.json'))
