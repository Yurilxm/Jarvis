# Changelog

## [Não publicado]

### Adicionado
- Comando `jarvis jira edit <issue>` para editar título, descrição e responsável de issues existentes no Jira, incluindo pré-visualização das alterações antes da confirmação.
- Comando `jarvis jira delete <issue>` para exclusão permanente de issues com fluxo de segurança de dupla confirmação (exigindo digitação da chave da issue).
- Métodos `updateIssue` e `deleteIssue` no cliente da API do Jira.
- Novos testes unitários cobrindo as operações de edição e exclusão de issues no Jira (expandindo a suíte para 31 suítes e 125 testes).

### Alterado
- Catálogo de comandos e menu interativo da CLI atualizados com as novas opções de gerenciamento de issues do Jira (`jira-edit` e `jira-delete`).
- Documentação no `README.md` atualizada com instruções, tabela de comandos e exemplos de uso para edição e remoção de tasks no Jira.