# Loads only the two explicitly provisioned Engineer credentials into this process.
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$EngineerArguments)
$ErrorActionPreference = 'Stop'
$credentialDirectory = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'GoAtletaEngineer'
$previousController = $env:OPENAI_API_KEY
$previousExecutor = $env:OPENAI_EXECUTOR_API_KEY
try {
    $registryPath = Join-Path $PSScriptRoot '../docs/operations/engineer/agents.json'
    $registryProject = (Get-Content -LiteralPath $registryPath -Raw | ConvertFrom-Json).project_id
    if ($registryProject -eq 'proj_r74GbuEXeHueUaVasyOi5EW8') {
        $dedicatedPath = Join-Path $PSScriptRoot '../.tmp/engineer-dedicated.env'
        $dedicatedFile = Get-Item -LiteralPath $dedicatedPath
        if ($dedicatedFile.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Credential link refused' }
        $dedicatedValues = @{}
        foreach ($credentialLine in [IO.File]::ReadAllLines($dedicatedFile.FullName)) {
            if ([string]::IsNullOrWhiteSpace($credentialLine) -or $credentialLine.StartsWith('#')) { continue }
            if ($credentialLine -notmatch '^(OPENAI_API_KEY|OPENAI_EXECUTOR_API_KEY)=(sk-[A-Za-z0-9_-]+)$') { throw 'Invalid credential format' }
            if ($dedicatedValues.ContainsKey($Matches[1])) { throw 'Duplicate credential' }
            $dedicatedValues[$Matches[1]] = $Matches[2]
        }
        foreach ($credentialName in @('OPENAI_API_KEY', 'OPENAI_EXECUTOR_API_KEY')) {
            if (-not $dedicatedValues.ContainsKey($credentialName)) { throw 'Missing dedicated credential' }
            [Environment]::SetEnvironmentVariable($credentialName, $dedicatedValues[$credentialName], 'Process')
        }
    } elseif ($registryProject -and $registryProject -ne 'proj_tzDpZUdm5TwQMCqVXyuQN8PV') {
        throw 'Unconfigured credential project'
    } else {
    foreach ($entry in @(@('controller.dpapi', 'OPENAI_API_KEY'), @('executor.dpapi', 'OPENAI_EXECUTOR_API_KEY'))) {
        $credentialPath = Join-Path $credentialDirectory $entry[0]
        $credentialFile = Get-Item -LiteralPath $credentialPath
        if ($credentialFile.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Credential link refused' }
        $encryptedValue = Get-Content -LiteralPath $credentialPath -Raw
        $protectedValue = ConvertTo-SecureString $encryptedValue
        $plainValue = [System.Net.NetworkCredential]::new('', $protectedValue).Password
        [Environment]::SetEnvironmentVariable($entry[1], $plainValue, 'Process')
        $plainValue = $null
    }
    }
    & python (Join-Path $PSScriptRoot 'goatleta-engineer.py') @EngineerArguments
    $engineerExitCode = $LASTEXITCODE
} catch {
    Write-Error 'Não foi possível carregar as credenciais locais protegidas do Engineer. Nenhum valor foi exibido.' -ErrorAction Continue
    $engineerExitCode = 1
} finally {
    $env:OPENAI_API_KEY = $previousController
    $env:OPENAI_EXECUTOR_API_KEY = $previousExecutor
    $plainValue = $null
    $dedicatedValues = $null
    $credentialLine = $null
    $Matches = $null
}
exit $engineerExitCode
