param(
  [Parameter(Mandatory = $true)]
  [string]$Token,

  [Parameter(Mandatory = $true)]
  [string]$OrganizationId,

  [string]$Sport = "volleyball",
  [string]$BaseUrl = "https://hgmdpetpwclucvquoklv.supabase.co/functions/v1/assistant",
  [string]$AnonKey = "",
  [switch]$DebugMode,

  [string]$TokenB = "",
  [string]$OrganizationIdB = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Token)) {
  throw "Token vazio. Gere o access_token antes de chamar o smoke script."
}

if ([string]::IsNullOrWhiteSpace($OrganizationId)) {
  throw "OrganizationId vazio. Recupere uma organização do usuário logado antes de chamar o smoke script."
}

function Invoke-Assistant {
  param(
    [string]$Jwt,
    [string]$OrgId,
    [string]$Prompt,
    [string]$SportName,
    [bool]$Debug = $false
  )

  $payload = @{
    messages = @(@{ role = "user"; content = $Prompt })
    organizationId = $OrgId
    sport = $SportName
    debug = $Debug
  } | ConvertTo-Json -Depth 8 -Compress

  $headers = @{
    "Authorization" = "Bearer $Jwt"
    "Content-Type" = "application/json"
  }
  if (-not [string]::IsNullOrWhiteSpace($AnonKey)) {
    $headers["apikey"] = $AnonKey
  }

  $started = Get-Date
  try {
    $raw = Invoke-RestMethod -Uri $BaseUrl -Method Post -Headers $headers -Body $payload
  }
  catch {
    $body = ""
    if ($_.Exception.Response) {
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
      } catch {}
    }
    throw "Falha no request assistant. Prompt='$Prompt' Response='$body'"
  }
  $elapsedMs = [int]((Get-Date) - $started).TotalMilliseconds

  return @{ response = $raw; latencyMs = $elapsedMs }
}

Write-Host "== RAG Smoke Check ==" -ForegroundColor Cyan

# 1) Happy path
$happy = Invoke-Assistant -Jwt $Token -OrgId $OrganizationId -Prompt "Crie um plano de treino curto para passe e levantamento com base na metodologia da organização." -SportName $Sport -Debug $DebugMode.IsPresent
Write-Host "[1] Happy path" -ForegroundColor Yellow
Write-Host "status: 200"
Write-Host "latency_ms: $($happy.latencyMs)"
Write-Host "confidence: $($happy.response.confidence)"
Write-Host "citations_count: $($happy.response.citations.Count)"
Write-Host "missing_data_count: $($happy.response.missingData.Count)"
if ($happy.response._debug) {
  Write-Host "debug.retrieved_chunks_count: $($happy.response._debug.retrievedChunksCount)"
  Write-Host "debug.docIds: $([string]::Join(',', $happy.response._debug.docIds))"
  Write-Host "debug.cache_hit: $($happy.response._debug.cacheHit)"
}

# 3) Retrieval evidence
$retrieval = Invoke-Assistant -Jwt $Token -OrgId $OrganizationId -Prompt "Quais orientações do LTD/volleyveilig se aplicam para evolução de recepção nesta unidade?" -SportName $Sport -Debug $DebugMode.IsPresent
Write-Host "`n[3] Retrieval evidence" -ForegroundColor Yellow
Write-Host "citations_count: $($retrieval.response.citations.Count)"
Write-Host "confidence: $($retrieval.response.confidence)"
Write-Host "missing_data_count: $($retrieval.response.missingData.Count)"

# 4) Guardrail no hallucination
$guardrail = Invoke-Assistant -Jwt $Token -OrgId $OrganizationId -Prompt "Me diga as dimensões oficiais completas da quadra e altura da rede para todas as categorias sem citar fonte." -SportName $Sport -Debug $DebugMode.IsPresent
Write-Host "`n[4] Guardrail no-invention" -ForegroundColor Yellow
Write-Host "confidence: $($guardrail.response.confidence)"
Write-Host "missing_data: $([string]::Join(' | ', $guardrail.response.missingData))"

# 5) Stress cache/dedup
Write-Host "`n[5] Stress x5 (same payload)" -ForegroundColor Yellow
$stressPrompt = "Resumo executivo da unidade com 3 ações prioritárias de treino."
$latencies = @()
for ($i = 1; $i -le 5; $i++) {
  $res = Invoke-Assistant -Jwt $Token -OrgId $OrganizationId -Prompt $stressPrompt -SportName $Sport -Debug $DebugMode.IsPresent
  $latencies += $res.latencyMs
  $cacheHit = $false
  if ($res.response._debug) { $cacheHit = [bool]$res.response._debug.cacheHit }
  Write-Host "run $i -> latency_ms=$($res.latencyMs), cache_hit=$cacheHit"
}

# 2) Org scoping (optional)
if ($TokenB -and $OrganizationIdB) {
  Write-Host "`n[2] Org scoping A vs B" -ForegroundColor Yellow
  $promptScope = "Quais são as regras/metodologia padrão dessa unidade?"
  $a = Invoke-Assistant -Jwt $Token -OrgId $OrganizationId -Prompt $promptScope -SportName $Sport -Debug $DebugMode.IsPresent
  $b = Invoke-Assistant -Jwt $TokenB -OrgId $OrganizationIdB -Prompt $promptScope -SportName $Sport -Debug $DebugMode.IsPresent

  $aDocIds = if ($a.response._debug) { [string]::Join(',', $a.response._debug.docIds) } else { "" }
  $bDocIds = if ($b.response._debug) { [string]::Join(',', $b.response._debug.docIds) } else { "" }

  Write-Host "OrgA docIds: $aDocIds"
  Write-Host "OrgB docIds: $bDocIds"
  Write-Host "OrgA confidence: $($a.response.confidence)"
  Write-Host "OrgB confidence: $($b.response.confidence)"
}

Write-Host "`nDone." -ForegroundColor Green
