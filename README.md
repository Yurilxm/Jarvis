# 🤖 Jarvis Dev

Assistente de desenvolvimento por linha de comando — commits inteligentes, gestão de branches, Pull Requests do GitHub, integração com Jira, revisão de código com IA e geração de documentação.

**Versão:** 1.9.0

## 🚀 Funcionalidades

### Commits com IA
- Analisa alterações com **Gemini API** e gera mensagens no formato **Conventional Commits**
- Sanitiza dados sensíveis antes de enviar informações à IA (`.env`, tokens e chaves)
- Fluxo interativo para aprovar, editar, gerar novamente ou cancelar
- Adiciona assinatura automática no corpo do commit

### Revisão de código com IA
- Analisa alterações locais (todas ou apenas *staged*) usando IA em modo somente leitura
- Identifica potenciais problemas, riscos e sugere melhorias antes do commit
- Nunca modifica código — apenas imprime a análise no terminal

### Documentação automática
- Gera ou atualiza `README.md` do projeto usando IA
- Gera ou atualiza `CHANGELOG.md` com base nas alterações
- Mostra diff visual do que será alterado antes de salvar
- Fluxo de aprovação igual ao commit (aprovar, editar, gerar novamente ou cancelar)

### Gestão de branches e Release
- `main` protegida, com confirmação extra
- `dev` como branch de desenvolvimento padrão
- Criação, listagem e troca de branches com verificações de segurança
- Sugere criar branch quando tenta trocar para uma inexistente
- Fluxo de release automatizado com criação de tag, push e merge automático de `dev → main`

### Pull Requests do GitHub
- Lista, visualiza e revisa Pull Requests com IA
- Permite aprovar, comentar, solicitar alterações, fazer checkout, merge ou fechar PRs
- Permite testar localmente a branch de uma PR antes de aprová-la
- Todas as ações importantes exigem confirmação explícita

### Integração com Jira
- Lista issues do projeto (ativas, todas ou concluídas)
- Exibe detalhes de uma issue com descrição formatada
- Move issues entre status (`To Do`, `In Progress`, `Done`)
- Cria novas tasks com suporte a IA para título e descrição
- Atribuição dinâmica de responsáveis (busca da API do Jira)
- Cria branches automaticamente ao iniciar uma issue
- Configuração interativa por projeto via `jarvis config` ou arquivo `.jarvis-dev.json`

### Segurança
- Nenhuma ação destrutiva é executada sem confirmação
- Proteção da branch `main`
- Nenhum merge ou push é realizado automaticamente sem autorização
- Dados sensíveis são sanitizados antes de serem enviados à IA
- Arquivos sensíveis ignorados automaticamente, com regras adicionais via `.jarvisignore`
- Nenhum ID de usuário, projeto ou configuração específica fica hardcoded no código

### Interface
- Banner ASCII dinâmico com a versão atual
- Spinners para indicar operações em andamento
- Caixas formatadas para melhorar a leitura
- Sistema de ajuda organizado por categorias

## 📋 Comandos

**Projeto**

| Comando | Descrição |
|---|---|
| `jarvis init` | Inicializa um repositório Git |
| `jarvis status` | Mostra o status do repositório |
| `jarvis pull` | Atualiza a branch atual usando `git pull` |
| `jarvis update` | Atualiza o Jarvis usando `git pull` e `npm install` |
| `jarvis config` | Configura o `.jarvis-dev.json` do projeto de forma interativa |
| `jarvis today` | Exibe o resumo do dia (issues, PRs, status) |

**Commit**

| Comando | Descrição |
|---|---|
| `jarvis commit` | Analisa as alterações e gera uma mensagem de commit com IA |
| `jarvis merge [origem] [destino]` | Faz merge entre branches (padrão: `dev → main`) |
| `jarvis release` | Executa o fluxo de release (tag, push e merge dev → main) |

**Branches**

| Comando | Descrição |
|---|---|
| `jarvis branch list` | Lista as branches locais |
| `jarvis branch create <nome>` | Cria uma nova branch |
| `jarvis branch switch <nome>` | Troca para outra branch |

**Revisão e Documentação**

| Comando | Descrição |
|---|---|
| `jarvis review` | Revisa alterações com IA (somente leitura) |
| `jarvis review staged` | Revisa apenas o que está staged |
| `jarvis docs` | Gera/atualiza README.md com IA |
| `jarvis docs changelog` | Gera/atualiza CHANGELOG.md com IA |

**Pull Requests**

| Comando | Descrição |
|---|---|
| `jarvis pr list` | Lista as Pull Requests abertas |
| `jarvis pr view <n>` | Mostra os detalhes de uma Pull Request |
| `jarvis pr diff <n>` | Mostra as alterações de uma Pull Request |
| `jarvis pr review <n>` | Analisa uma Pull Request usando IA |
| `jarvis pr checkout <n>` | Faz checkout da branch de uma Pull Request |
| `jarvis pr approve <n>` | Aprova uma Pull Request |
| `jarvis pr request-changes <n>` | Solicita alterações em uma Pull Request |
| `jarvis pr comment <n>` | Adiciona um comentário a uma Pull Request |
| `jarvis pr merge <n>` | Faz merge de uma Pull Request |
| `jarvis pr close <n>` | Fecha uma Pull Request sem realizar merge |

**Jira**

| Comando | Descrição |
|---|---|
| `jarvis jira list [active\|all\|done]` | Lista issues do Jira por status |
| `jarvis jira view <issue>` | Mostra os detalhes de uma issue |
| `jarvis jira move <issue>` | Move uma issue para outro status |
| `jarvis jira create` | Cria uma nova task (com IA opcional) |

**Perfil**

| Comando | Descrição |
|---|---|
| `jarvis profile setup` | Configura o perfil do desenvolvedor |
| `jarvis profile show` | Mostra o perfil atualmente configurado |
| `jarvis profile edit` | Permite editar manualmente o perfil |

**Outros**

| Comando | Descrição |
|---|---|
| `jarvis ignore` | Gerencia a lista de arquivos ignorados com IA ou manualmente |
| `jarvis history` | Mostra o histórico de commits e pushes realizados pelo Jarvis |


> ⌨️ **Atalhos:** `jarvis c` (commit), `jarvis s` (status), `jarvis m` (merge), `jarvis b` (branch), `jarvis p` (pull), `jarvis u` (update), `jarvis r` (review), `jarvis d` (docs), `jarvis h` (history), `jarvis i` (init), `jarvis j` (jira), `jarvis t` (today)

## 🛠️ Requisitos

- Node.js 18 ou superior (recomendado: 20+)
- Git instalado e configurado
- Windows, macOS ou Linux

## 📦 Instalação

```bash
git clone https://github.com/Yurilxm/Jarvis.git
cd Jarvis
npm install
npm link
```

Depois disso, o comando `jarvis` estará disponível em qualquer terminal e poderá ser utilizado em qualquer projeto Git.

## ⚙️ Configuração

A configuração do Jarvis é dividida em duas partes:

| Configuração | Arquivo | Conteúdo | Versiona no Git? |
|---|---|---|---|
| Usuário | `.env` | Chaves de API, tokens, credenciais | ❌ Nunca |
| Projeto | `.jarvis-dev.json` | Projeto Jira, branches, convenções | ✅ Sim (se seguro) |

**1. Configuração do usuário (`.env`)**

Crie o arquivo `.env` na pasta de instalação do Jarvis:

```bash
cp .env.example .env
```

Edite com suas credenciais:

```env
# Gemini API — obrigatória para funcionalidades de IA
GEMINI_API_KEY=sua-chave-do-gemini

# Modelo Gemini — opcional (padrão: gemini-flash-latest)
GEMINI_MODEL=gemini-flash-latest

# GitHub — necessário para os comandos de Pull Request
GITHUB_TOKEN=ghp_seu-token

# Jira — necessário para os comandos do Jira
JIRA_DOMAIN=sua-empresa.atlassian.net
JIRA_EMAIL=seu-email@empresa.com
JIRA_API_TOKEN=seu-token-jira
```

**2. Configuração do projeto (`.jarvis-dev.json`)**

Você pode configurar o arquivo `.jarvis-dev.json` do seu projeto de forma interativa através do comando:

```bash
jarvis config
```

Ou, se preferir, crie o arquivo `.jarvis-dev.json` manualmente na raiz do seu projeto:

```json
{
  "jira": {
    "projectKey": "SDG",
    "projectId": "10033",
    "issueType": "Tarefa"
  },
  "git": {
    "protectedBranch": "main",
    "developmentBranch": "dev"
  }
}
```

| Campo | Descrição | Exemplo |
|---|---|---|
| `jira.projectKey` | Chave do projeto no Jira | `"SDG"` |
| `jira.projectId` | ID numérico do projeto | `"10033"` |
| `jira.issueType` | Tipo de issue ao criar tasks | `"Tarefa"` |
| `git.protectedBranch` | Branch protegida | `"main"` |
| `git.developmentBranch` | Branch de desenvolvimento | `"dev"` |

Se o arquivo `.jarvis-dev.json` não existir, os comandos Git funcionam normalmente. Apenas os comandos do Jira solicitarão a configuração.

Como descobrir o `projectId`:

```bash
jarvis jira list
```

Se ainda não tiver o `.jarvis-dev.json`, o comando exibirá uma mensagem com instruções. Você também pode consultar o administrador do Jira ou verificar a URL ao acessar o projeto no navegador.

**3. Configure o perfil do desenvolvedor (opcional)**

```bash
jarvis profile setup
```

O Jarvis tentará identificar automaticamente os dados do desenvolvedor usando o perfil do Git e a conta autenticada do GitHub.

## 🔑 Onde obter as chaves

| Serviço | Local |
|---|---|
| Gemini API | https://aistudio.google.com/apikey |
| GitHub Token | https://github.com/settings/tokens |
| Jira API Token | https://id.atlassian.com/manage-profile/security/api-tokens |

> Para usar os comandos de Pull Request, o token do GitHub precisa ter permissões suficientes para acessar e gerenciar os repositórios utilizados.

## 🔒 Segurança

- O `.env` nunca deve ser enviado ao Git e já está incluído no `.gitignore`
- Tokens e chaves não aparecem nos logs nem na saída do terminal
- O conteúdo dos diffs é sanitizado antes de ser enviado à IA
- Arquivos sensíveis são ignorados automaticamente, com regras adicionais via `.jarvisignore`
- A branch `main` possui uma camada extra de proteção
- Nenhuma ação destrutiva é executada sem confirmação explícita
- O Jarvis não realiza stash automático nem resolve conflitos automaticamente
- Nenhum ID de usuário, projeto ou configuração específica fica hardcoded no código

> ⚠️ Nunca compartilhe ou publique os valores do seu arquivo `.env`.

## ⌨️ Autocomplete no PowerShell (opcional)

```powershell
. .\setup.ps1
```

Depois, digite `jarvis` e pressione `Tab` para completar os comandos disponíveis.

## 🧪 Exemplos de uso

**Configurar o projeto interativamente**

```bash
cd meu-projeto
jarvis config
```

**Commit com IA**

```bash
cd meu-projeto
jarvis commit
```

O Jarvis vai: verificar a branch atual → analisar o status do repositório → coletar as alterações → sanitizar informações sensíveis → enviar o conteúdo seguro para a Gemini API → gerar uma mensagem no padrão Conventional Commits → exibir para aprovação → permitir aprovar, editar, gerar novamente ou cancelar → commitar após confirmação → perguntar se deve fazer push.

**Revisão de código**

```bash
jarvis review
jarvis review staged
```

**Revisar uma Pull Request**

```bash
jarvis pr list
jarvis pr review 1
jarvis pr checkout 1
jarvis pr approve 1
jarvis pr merge 1
```

**Gerenciar issues do Jira**

```bash
jarvis jira list
jarvis jira list all
jarvis jira list done
jarvis jira view SDG-68
jarvis jira move SDG-68
jarvis jira create
```

**Iniciar um projeto novo**

```bash
mkdir novo-projeto
cd novo-projeto
jarvis init
```

**Configurar o perfil**

```bash
jarvis profile setup
jarvis profile show
jarvis profile edit
```

## 🌍 Usando o Jarvis em qualquer projeto

Depois de rodar `npm link`, o Jarvis fica disponível globalmente. Basta entrar em qualquer projeto Git e executar `jarvis status` ou `jarvis commit` — os comandos Git usam o projeto atual, mas o `.env` sempre é carregado a partir da pasta de instalação do Jarvis, não da pasta do projeto em que o comando está sendo executado.

## 🐛 Solução de problemas

| Problema | Solução |
|---|---|
| `jarvis` não é reconhecido como comando | Execute `npm link` novamente dentro da pasta do Jarvis |
| `GEMINI_API_KEY` não encontrada | Verifique se o `.env` existe na pasta do Jarvis e se a chave está configurada |
| `GITHUB_TOKEN` não encontrada | Adicione o token ao `.env` — necessário apenas para comandos de Pull Request |
| Erro `503` da Gemini | A API pode estar temporariamente sobrecarregada — aguarde e tente novamente |
| Jarvis não encontra o repositório Git | Execute o comando dentro de uma pasta com repositório Git |
| Comando funciona, mas não encontra o `.env` | Verifique se o `.env` está na pasta de instalação do Jarvis |
| Jira retorna erro de autenticação | Verifique `JIRA_DOMAIN`, `JIRA_EMAIL` e `JIRA_API_TOKEN` |
| Jira pede configuração do projeto | Execute `jarvis config` ou crie o arquivo `.jarvis-dev.json` na raiz do projeto |
| GitHub retorna erro de permissão | Verifique as permissões do token e o acesso ao repositório |
| Autocomplete não funciona | Execute novamente `. .\setup.ps1` no PowerShell |

## 🗺️ Roadmap

| Versão | Funcionalidades |
|---|---|
| `v1.0` | Commits com IA, branches, merge, Pull Requests e interface |
| `v1.1` | Assinatura automática nos commits e perfil do desenvolvedor |
| `v1.2` | Integração com Jira e configuração por projeto (`.jarvis-dev.json`) |
| `v1.3` | Revisão de código com IA e geração de documentação |
| `v1.4` | Aliases, undo, today e aviso de cota Gemini |
| `v1.5` | Release automatizado, config interativo e modularização do CLI |
| `v2.x` | Testes automatizados |
| `v3.x` | Comandos de voz (Voice/Whisper) |
| `v4.x` | Controle básico do computador (Jarvis Personal) |
| `v5.x` | Servidor doméstico e automação residencial |

## 📝 Licença

Projeto pessoal de estudo e automação. Sinta-se livre para usar, modificar e contribuir.