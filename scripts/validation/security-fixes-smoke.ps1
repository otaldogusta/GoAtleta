# Smoke tests for security fixes (#2-#5)
# Usage:
#   powershell -File scripts/validation/security-fixes-smoke.ps1 `
#     -SupabaseUrl "https://<project-ref>.supabase.co" `
#     -AccessToken "<jwt>"
#
# Notes:
# - Requires a valid authenticated JWT for your project.
# - These are negative tests (invalid payloads) and should return 400 (or 401 if token is invalid).

param(
  [Parameter(Mandatory = $true)]
  [string]$SupabaseUrl,
  [Parameter(Mandatory = $true)]
  [string]$AccessToken
)

$ErrorActionPreference = "Stop"

function Invoke-EdgeTest {
  param(
    [string]$Name,
    [string]$FunctionName,
    [hashtable]$Payload,
    [int[]]$AllowedStatusCodes
  )

  $url = ($SupabaseUrl.TrimEnd("/")) + "/functions/v1/" + $FunctionName
  $body = $Payload | ConvertTo-Json -Depth 20
  $headers = @{
    "Authorization" = "Bearer $AccessToken"
    "Content-Type" = "application/json"
  }

  $status = 0
  $responseBody = ""
  try {
    $response = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $body
    $status = [int]$response.StatusCode
    $responseBody = $response.Content
  } catch {
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode.value__
      $stream = $_.Exception.Response.GetResponseStream()
      if ($stream) {
        $reader = New-Object System.IO.StreamReader($stream)
        $responseBody = $reader.ReadToEnd()
      }
    } else {
      throw
    }
  }

  $ok = $AllowedStatusCodes -contains $status
  $result = if ($ok) { "PASS" } else { "FAIL" }
  Write-Host ("[{0}] {1} -> status {2}" -f $result, $Name, $status)
  if (-not $ok) {
    Write-Host "  URL: $url"
    Write-Host "  Body: $responseBody"
  }
}

$rows = @()
for ($i = 0; $i -lt 501; $i++) {
  $rows += @{ name = "Aluno $i" }
}

Invoke-EdgeTest `
  -Name "students-import blocks oversized rows" `
  -FunctionName "students-import" `
  -Payload @{
    organizationId = "00000000-0000-0000-0000-000000000000"
    mode = "preview"
    policy = "misto"
    rows = $rows
  } `
  -AllowedStatusCodes @(400, 401)

Invoke-EdgeTest `
  -Name "kb_ingest blocks oversized query" `
  -FunctionName "kb_ingest" `
  -Payload @{
    action = "search"
    query = ("x" * 300)
    maxResults = 8
  } `
  -AllowedStatusCodes @(400, 401)

Invoke-EdgeTest `
  -Name "send-push blocks oversized title/body" `
  -FunctionName "send-push" `
  -Payload @{
    organizationId = "00000000-0000-0000-0000-000000000000"
    targetUserId = "00000000-0000-0000-0000-000000000000"
    title = ("t" * 180)
    body = ("b" * 700)
    data = @{ key = "value" }
  } `
  -AllowedStatusCodes @(400, 401)

Invoke-EdgeTest `
  -Name "claim-trainer-invite blocks invalid code format" `
  -FunctionName "claim-trainer-invite" `
  -Payload @{
    code = "%%%INVALID%%%"
  } `
  -AllowedStatusCodes @(400, 401)

Invoke-EdgeTest `
  -Name "create-student-invite blocks missing studentId" `
  -FunctionName "create-student-invite" `
  -Payload @{
    studentId = ""
    invitedVia = "whatsapp"
    invitedTo = "5511999999999"
  } `
  -AllowedStatusCodes @(400, 401)

Write-Host "Done."
