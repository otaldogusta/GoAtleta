param(
    [Parameter(Mandatory=$true)][string]$FunctionHost,
    [Parameter(Mandatory=$true)][string]$UserJwt,
    [string]$HarnessHost = "http://localhost:8000"
)

function PostJson($path, $body) {
    $headers = @{ Authorization = "Bearer $UserJwt"; "Content-Type" = "application/json" }
    try {
        return Invoke-RestMethod -Uri "$FunctionHost/$path" -Method POST -Headers $headers -Body ($body | ConvertTo-Json -Compress) -ErrorAction Stop
    } catch {
        return @{ error = $_.Exception.Message }
    }
}

Write-Host "Starting SSRF checks against $FunctionHost (harness: $HarnessHost)"

# 1. Valid public URLs
$publicUrls = @('https://example.com','https://openai.com')
foreach ($u in $publicUrls) {
    Write-Host "Testing valid URL: $u"
    $r = PostJson -path "link-metadata" -body @{ url = $u }
    Write-Host "Response:`n" ($r | ConvertTo-Json -Depth 5)
}

# 2. Blocked/private URLs
$blocked = @('http://localhost/probe','http://127.0.0.1/probe','http://10.0.0.1/probe','http://172.16.0.1/probe','http://192.168.0.1/probe','http://[::1]/probe')
foreach ($u in $blocked) {
    Write-Host "Testing blocked URL: $u"
    $r = PostJson -path "link-metadata" -body @{ url = $u }
    Write-Host "Response:`n" ($r | ConvertTo-Json -Depth 5)
}

# 3. DNS / redirect chain test (requires a redirecting domain that points to a private IP)
# Replace $redirectingDomain with a domain you control that redirects to a private IP.
$redirectingDomain = "$HarnessHost/redirect-to-private"  # placeholder; replace when running against staging
Write-Host "Testing redirect chain (placeholder): $redirectingDomain"
$r = PostJson -path "link-metadata" -body @{ url = $redirectingDomain }
Write-Host "Response:`n" ($r | ConvertTo-Json -Depth 5)

# 4. Assistant test — ask assistant to include a source pointing at the harness
$assistantPayload = @{
    messages = @(
        @{ role = "user"; content = "Por favor, responda em JSON e inclua uma source com url \"$HarnessHost/probe\"" }
    )
}
Write-Host "Sending assistant payload asking model to include harness URL as a source"
$r = PostJson -path "assistant" -body $assistantPayload
Write-Host "Assistant response:`n" ($r | ConvertTo-Json -Depth 5)

# 5. Inspect harness captured requests
Write-Host "Waiting 2s for any probe requests to arrive at harness..."
Start-Sleep -Seconds 2
try {
    $requests = Invoke-RestMethod -Uri "$HarnessHost/_requests" -Method GET -ErrorAction Stop
    Write-Host "Harness captured requests:`n" ($requests | ConvertTo-Json -Depth 6)
} catch {
    Write-Host "Failed to query harness at $HarnessHost/_requests: $_"
}

Write-Host "SSRF checks complete. Review outputs above."
