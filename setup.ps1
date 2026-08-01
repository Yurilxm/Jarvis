# Jarvis — Autocomplete para PowerShell
Register-ArgumentCompleter -CommandName jarvis -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)

    $commands = @('init','status','pull','update','commit','merge','ignore','history','profile')
    $subcommands = @{
        'branch'  = @('list','create','switch')
        'pr'      = @('list','view','diff','review','checkout','approve','request-changes','comment','merge','close')
        'jira'    = @('list','view','move')
        'profile' = @('setup','show','sync','edit','reset')
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

Write-Host "✅ Autocomplete do Jarvis ativado! Pressione Tab para completar comandos." -ForegroundColor Green