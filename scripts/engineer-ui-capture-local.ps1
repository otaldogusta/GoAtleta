param(
  [Parameter(Mandatory=$true)][string]$Run,
  [Parameter(Mandatory=$true)][string]$Snapshot,
  [Parameter(Mandatory=$true)][string]$Image,
  [string]$DependenciesVolume = 'goatleta-engineer-ui-deps-v1'
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$uiRun = (Resolve-Path -LiteralPath $Run).Path
$uiSource = (Resolve-Path -LiteralPath $Snapshot).Path
$uiHarness = Join-Path $PSScriptRoot 'engineer_ui_evidence.mjs'
if ($Image -notmatch '^sha256:[a-f0-9]{64}$') { throw 'Use immutable image ID.' }
if (Test-Path -LiteralPath (Join-Path $uiRun 'evidence')) { throw 'Preserve previous evidence; select a fresh capture directory.' }
$uiManifest = Get-Content -Raw -LiteralPath (Join-Path $uiRun 'manifest.json') | ConvertFrom-Json
if (!$uiManifest.vnext -or !$uiManifest.visual_policy.ui -or $uiManifest.filesystem_policy -ne 'read_only') { throw 'Read-only vNext UI run required.' }
$uiHashBefore = (Get-FileHash -Algorithm SHA256 -LiteralPath $uiHarness).Hash.ToLower()
$uiName = 'goatleta-ui-local-' + [guid]::NewGuid().ToString('N').Substring(0,12)
$uiArgs = @('run','--name',$uiName,'--init','--network','none','--read-only','--user','1000:1000',
  '--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','512','--memory','4g','--cpus','4',
  '--shm-size','256m','--tmpfs','/tmp:rw,exec,size=1g,mode=1777',
  '--tmpfs','/workspace:rw,exec,size=512m,uid=1000,gid=1000',
  '--mount',"type=bind,source=$uiSource,target=/source,readonly",
  '--mount',"type=volume,source=$DependenciesVolume,target=/workspace/node_modules,volume-subpath=node_modules,readonly",
  '--mount',"type=bind,source=$uiHarness,target=/harness/engineer_ui_evidence.mjs,readonly",
  '--mount',"type=bind,source=$uiRun,target=/run",
  '--env','HOME=/tmp','--env','EXPO_OFFLINE=1','--env','EXPO_NO_TELEMETRY=1','--env','EXPO_NO_DOTENV=1',
  '--env','CI=1','--env','EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:9',
  '--env','EXPO_PUBLIC_SUPABASE_ANON_KEY=local-ui-fixture-not-a-secret',
  '--entrypoint','sh',$Image,'-c',
  'cp -r /source/. /workspace/ && node /harness/engineer_ui_evidence.mjs /run /workspace/docs/operations/engineer/scenarios/ui-001.json --workspace /workspace --start-app')
$uiExit = 1
try {
  & docker @uiArgs
  $uiExit = $LASTEXITCODE
} finally {
  $uiInspectRaw = & docker inspect $uiName 2>$null
  if ($LASTEXITCODE -eq 0) {
    $uiInspect = ($uiInspectRaw | ConvertFrom-Json)[0]
    if ($uiInspect.State.Running) { & docker stop --time 5 $uiName | Out-Null }
    & docker rm $uiName | Out-Null
    $uiRemoved = $LASTEXITCODE -eq 0
    $uiProof = @{
      state = 'BLOCKED_RUNTIME'; image = $Image; exit_code = $uiExit
      network = $uiInspect.HostConfig.NetworkMode; container_removed = $uiRemoved
      container = $uiName; checked_at = [DateTime]::UtcNow.ToString('o')
      manifest_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $uiRun 'manifest.json')).Hash.ToLower()
      harness_sha256 = $uiHashBefore
    }
    $uiCaptureFile = Join-Path $uiRun 'evidence/capture.json'
    if (Test-Path -LiteralPath $uiCaptureFile) {
      $uiCapture = Get-Content -Raw -LiteralPath $uiCaptureFile | ConvertFrom-Json
      $uiProof.capture_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $uiCaptureFile).Hash.ToLower()
      if ($uiExit -eq 0 -and $uiRemoved -and $uiInspect.HostConfig.NetworkMode -eq 'none' -and
          $uiCapture.state -eq 'CAPTURED' -and (Get-FileHash -Algorithm SHA256 -LiteralPath $uiHarness).Hash.ToLower() -eq $uiHashBefore) {
        $uiProof.state = 'UI_RUNTIME_READY'
      }
    }
    $uiProof | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 -LiteralPath (Join-Path $uiRun 'ui-runtime-validation.json')
  }
}
exit $uiExit
