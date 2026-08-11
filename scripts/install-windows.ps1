# Jarvis — setup Windows (PowerShell)
# Libera o comando `jarvis` (sem .cmd) e instala o shim com abertura de projeto.
# Rode com: npm run setup   ou   npm install (postinstall)

$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host 'Jarvis — setup Windows' -ForegroundColor Cyan

# 1) ExecutionPolicy do usuario atual (nao precisa de admin)
try {
    $current = Get-ExecutionPolicy -Scope CurrentUser
    if ($current -eq 'Restricted' -or $current -eq 'AllSigned' -or $current -eq 'Undefined') {
        Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
        Write-Host "ExecutionPolicy CurrentUser: $current -> RemoteSigned" -ForegroundColor Green
    } else {
        Write-Host "ExecutionPolicy CurrentUser: $current (ok)" -ForegroundColor DarkGray
    }
} catch {
    Write-Host "Nao foi possivel alterar ExecutionPolicy: $_" -ForegroundColor Yellow
    Write-Host 'Tente manualmente: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned' -ForegroundColor Yellow
}

# 2) Instalar shim jarvis.ps1 no npm global (sobrescreve o gerado pelo npm)
$repoRoot = Split-Path -Parent $PSScriptRoot
$shimSrc = Join-Path $repoRoot 'bin\jarvis.ps1'
$npmDir = Join-Path $env:APPDATA 'npm'
$shimDst = Join-Path $npmDir 'jarvis.ps1'

if (-not (Test-Path -LiteralPath $shimSrc)) {
    Write-Host "Shim fonte nao encontrado: $shimSrc" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path -LiteralPath $npmDir)) {
    New-Item -ItemType Directory -Path $npmDir -Force | Out-Null
}

if (Test-Path -LiteralPath $shimDst) {
    $bak = "$shimDst.bak"
    if (-not (Test-Path -LiteralPath $bak)) {
        Copy-Item -LiteralPath $shimDst -Destination $bak -Force
        Write-Host "Backup do shim npm: $bak" -ForegroundColor DarkGray
    }
}

Copy-Item -LiteralPath $shimSrc -Destination $shimDst -Force
Write-Host "Shim instalado: $shimDst" -ForegroundColor Green

Write-Host ''
Write-Host 'Pronto. Feche e abra o terminal, depois use:' -ForegroundColor Green
Write-Host '  jarvis' -ForegroundColor White
Write-Host '  jarvis status' -ForegroundColor White
Write-Host '  jarvis use' -ForegroundColor White
Write-Host ''
Write-Host 'Nao precisa mais de jarvis.cmd.' -ForegroundColor DarkGray
Write-Host ''
