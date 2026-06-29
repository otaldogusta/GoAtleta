param(
  [string]$Mode = "web",
  [int]$Port = 8081
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

if ($Mode -in @("help", "--help", "-h")) {
  Write-Host "usage: powershell -ExecutionPolicy Bypass -File ./script/start_clean_local.ps1 [web|start|android|ios|dev-client|export-web]"
  exit 0
}

function Stop-GoAtletaExpoOnPort {
  param([int]$TargetPort)

  $connections = Get-NetTCPConnection -LocalPort $TargetPort -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq "Listen" -or $_.State -eq "Established" }

  $processIds = $connections |
    Select-Object -ExpandProperty OwningProcess -Unique |
    Where-Object { $_ -gt 0 }

  foreach ($processId in $processIds) {
    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
    if (-not $processInfo) {
      continue
    }

    $commandLine = [string]$processInfo.CommandLine
    $isGoAtletaExpo =
      $commandLine.Contains([string]$root) -and
      ($commandLine.Contains("expo") -or $commandLine.Contains("npm-cli.js"))

    if ($isGoAtletaExpo) {
      Write-Host "Stopping stale GoAtleta Expo process $processId on port $TargetPort"
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  }
}

Stop-GoAtletaExpoOnPort -TargetPort $Port

$expoArgs = @("expo")

switch ($Mode) {
  "start" {
    $expoArgs += @("start", "--port", "$Port", "--clear")
  }
  "web" {
    $expoArgs += @("start", "--web", "--port", "$Port", "--clear")
  }
  "android" {
    $expoArgs += @("start", "--android", "--port", "$Port", "--clear")
  }
  "ios" {
    $expoArgs += @("start", "--ios", "--port", "$Port", "--clear")
  }
  "dev-client" {
    $expoArgs += @("start", "--dev-client", "--port", "$Port", "--clear")
  }
  "export-web" {
    $expoArgs += @("export", "--platform", "web")
  }
  default {
    Write-Error "Unknown mode: $Mode"
  }
}

Write-Host "Starting GoAtleta Expo: npx $($expoArgs -join ' ')"
& npx @expoArgs
