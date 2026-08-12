# Jarvis — wrapper PowerShell: autocomplete + cd real no terminal após selecionar projeto.
# Uso (nesta sessão):
#   . .\setup.ps1
# Permanente: adicione a linha acima no seu $PROFILE.

function global:jarvis {
    [CmdletBinding()]
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]] $JarvisArgs
    )

    $nextCwd = Join-Path (Join-Path $HOME '.jarvis') 'next-cwd'
    if (Test-Path -LiteralPath $nextCwd) {
        Remove-Item -LiteralPath $nextCwd -Force -ErrorAction SilentlyContinue
    }

    $exe = $null
    $cmd = Get-Command jarvis.cmd -ErrorAction SilentlyContinue |
        Where-Object { $_.Source -notmatch '\\setup\.ps1$' } |
        Select-Object -First 1
    if ($cmd) {
        $exe = $cmd.Source
    } else {
        $npmCmd = Join-Path $env:APPDATA 'npm\jarvis.cmd'
        if (Test-Path -LiteralPath $npmCmd) { $exe = $npmCmd }
    }

    if (-not $exe) {
        Write-Host 'jarvis.cmd nao encontrado. Rode npm link na pasta do Jarvis.' -ForegroundColor Red
        return
    }

    $env:JARVIS_SHELL_WRAPPER = '1'
    try {
        & $exe @JarvisArgs
        $exitCode = $LASTEXITCODE
    } finally {
        Remove-Item Env:JARVIS_SHELL_WRAPPER -ErrorAction SilentlyContinue
    }

    if (Test-Path -LiteralPath $nextCwd) {
        $target = (Get-Content -LiteralPath $nextCwd -Raw -ErrorAction SilentlyContinue).Trim()
        Remove-Item -LiteralPath $nextCwd -Force -ErrorAction SilentlyContinue
        if ($target -and (Test-Path -LiteralPath $target)) {
            Set-Location -LiteralPath $target
            Write-Host "pwd -> $target" -ForegroundColor Cyan
        }
    }

    if ($null -ne $exitCode) {
        $global:LASTEXITCODE = $exitCode
    }
}

Register-ArgumentCompleter -CommandName jarvis -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)

    $commands = @(
        'init', 'status', 'pull', 'update', 'commit', 'merge', 'ignore', 'history',
        'profile', 'config', 'today', 'projects', 'use', 'add', 'menu', 'help',
        'review', 'docs', 'analyze', 'ux', 'check', 'release', 'undo', 'branch', 'pr', 'jira'
    )
    $subcommands = @{
        'branch'  = @('list', 'create', 'switch')
        'pr'      = @('list', 'view', 'diff', 'review', 'checkout', 'approve', 'request-changes', 'comment', 'merge', 'close')
        'jira'    = @('list', 'view', 'move', 'create')
        'profile' = @('setup', 'show', 'sync', 'edit', 'reset')
        'docs'    = @('changelog')
        'review'  = @('staged')
    }

    $parts = $commandAst.ToString() -split '\s+'

    if ($parts.Length -eq 2) {
        $commands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
            [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
        }
    } elseif ($parts.Length -eq 3 -and $subcommands.ContainsKey($parts[1])) {
        $subcommands[$parts[1]] | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
            [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
        }
    }
}

Write-Host 'Jarvis: funcao jarvis ativada (cd automatico ao trocar de projeto).' -ForegroundColor Green
Write-Host 'Use: jarvis   |   jarvis use   |   jarvis status' -ForegroundColor DarkGray
