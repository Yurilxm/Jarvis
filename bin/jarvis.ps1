#!/usr/bin/env pwsh
# Jarvis PowerShell shim — roda a CLI e aplica cd na sessao atual apos trocar de projeto.
$basedir = Split-Path $MyInvocation.MyCommand.Definition -Parent

$exe = ''
if ($PSVersionTable.PSVersion -lt '6.0' -or $IsWindows) {
  $exe = '.exe'
}

$cli = Join-Path $basedir 'node_modules\jarvis\src\cli.js'
if (-not (Test-Path -LiteralPath $cli)) {
  # npm link / install local
  $cli = Join-Path $basedir '..\src\cli.js'
}
if (-not (Test-Path -LiteralPath $cli)) {
  Write-Host "Jarvis CLI nao encontrado (cli.js)." -ForegroundColor Red
  exit 1
}

$nextCwd = Join-Path (Join-Path $HOME '.jarvis') 'next-cwd'
if (Test-Path -LiteralPath $nextCwd) {
  Remove-Item -LiteralPath $nextCwd -Force -ErrorAction SilentlyContinue
}

$env:JARVIS_SHELL_WRAPPER = '1'
$ret = 0
try {
  $node = "node$exe"
  if (Test-Path (Join-Path $basedir "node$exe")) {
    $node = Join-Path $basedir "node$exe"
  }

  if ($MyInvocation.ExpectingInput) {
    $input | & $node $cli $args
  } else {
    & $node $cli $args
  }
  $ret = $LASTEXITCODE
} finally {
  Remove-Item Env:JARVIS_SHELL_WRAPPER -ErrorAction SilentlyContinue
}

if (Test-Path -LiteralPath $nextCwd) {
  $target = (Get-Content -LiteralPath $nextCwd -Raw -ErrorAction SilentlyContinue).Trim()
  Remove-Item -LiteralPath $nextCwd -Force -ErrorAction SilentlyContinue
  if ($target -and (Test-Path -LiteralPath $target)) {
    Set-Location -LiteralPath $target
    Write-Host "cd -> $target" -ForegroundColor Cyan
  }
}

if ($null -eq $ret) { $ret = 0 }
exit $ret
