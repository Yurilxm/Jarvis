# 🤖 Jarvis Dev

Assistente de desenvolvimento por linha de comando — commits inteligentes, gestão de branches, Pull Requests do GitHub, integração com Jira, revisão de código com IA e geração de documentação.

**Versão:** 4.5.0

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

### Análise de projeto com IA
- Analisa a arquitetura completa do projeto (`jarvis analyze`)
- Revisa usabilidade e acessibilidade do frontend (`jarvis ux`)
- Verifica vulnerabilidades em dependências e segredos expostos (`jarvis check`)
- Scanner de segredos integrado (secretlint) com explicação dos achados por IA

### Interface
- Banner ASCII dinâmico com a versão atual
- Menu interativo via **@clack/prompts** (autocomplete estável) ao rodar `jarvis`
- Modo CLI configurável: só lista os comandos sem abrir o menu
- Spinners para indicar operações em andamento
- Caixas formatadas para melhorar a leitura
- Sistema de ajuda organizado por categorias

### Workspace e múltiplos projetos
- Detecta repositórios Git em subpastas (`jarvis scan`)
- Lista de projetos gerenciados (`jarvis add`, `jarvis use`)
- Ao selecionar um projeto, abre o caminho em **nova aba do Windows Terminal** (padrão)
- Preferências globais em `~/.jarvis/preferences.json`

### Testes
- Suíte Jest cobrindo ignore, git, Jira, Gemini, menu, preferências e mais (`npm test`)

## 🛠️ Requisitos

- Node.js 18 ou superior (recomendado: 20+)
- Git instalado e configurado
- Windows, macOS ou Linux
- No Windows: PowerShell (recomendado) e, para abrir projetos em aba, [Windows Terminal](https://aka.ms/terminal)

## 📦 Instalação

```bash
git clone https://github.com/Yurilxm/Jarvis.git
cd Jarvis
npm install
npm link
```

No Windows, o `postinstall` / `npm run setup` também:
1. Define `ExecutionPolicy` do usuário como `RemoteSigned` (libera o comando `jarvis`)
2. Instala o shim PowerShell — **use `jarvis`, não precisa de `jarvis.cmd`**

```powershell
# Se ainda pedir jarvis.cmd, rode:
npm run setup
# ou
jarvis setup
```

Depois disso, o comando `jarvis` estará disponível em qualquer terminal e poderá ser utilizado em qualquer projeto Git.

### Onboarding no servidor compartilhado

Cada desenvolvedor deve usar seu próprio usuário no servidor.

Para configurar:

1. Conecte-se ao servidor com seu usuário.
2. Execute:

   ```bash
   jarvis-onboarding
   ```

O script irá:

- Configurar a identidade do Git (`user.name` e `user.email`);
- Gerar uma chave SSH para o Gitea;
- Exibir a chave pública para cadastro no Gitea;
- Testar a conexão SSH
- Configurar credencias pessoais via `jarvis config`
- Instalar o wrapper de shell para `cd` automático

3. Após adicionar a chave no Gitea (conforme instruções exibidas pelo script), teste:

   ```bash
   jarvis status
   jarvis c
   jarvis use
   ```

> **Windows (máquinas locais):** execute `npm run setup` ou `jarvis setup` para liberar o comando `jarvis` sem `.cmd` e instalar o autocomplete/wrapper.

> **Linux (servidor):** o onboarding já instala o wrapper e define `projectOpenMode` como `shell-cd`. Caso queira alterar para abrir em outra janela, use `jarvis config`.

---

## ⚙️ Configuração

A configuração do Jarvis é dividida em duas partes:

| Configuração | Arquivo | Conteúdo | Versiona no Git? |
|---|---|---|---|
| Usuário | `.env` | Chaves de API, tokens, credenciais | ❌ Nunca |
| Preferências | `~/.jarvis/preferences.json` | Menu, workspace, projetos, abertura de pasta | ❌ Local |
| Projeto | `.jarvis-dev.json` | Projeto Jira, branches, convenções | ✅ Sim (se seguro) |

**1. Configuração do usuário (`.env`)**

Crie o arquivo `.env` na sua pasta pessoal:

- **Linux/macOS:** `~/.jarvis-dev/.env`
- **Windows:** `C:\Users\seu-usuario\.jarvis-dev\.env`

Você pode criá-lo manualmente ou usar o comando interativo:

```bash
jarvis config
```

Depois selecione a opção "Credenciais — configurar .env pessoal".

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

**Preferências globais (`jarvis config`)**

Além do `.jarvis-dev.json`, o `jarvis config` permite ajustar (salvos em `~/.jarvis/preferences.json`):

| Preferência | Opções | Padrão |
|---|---|---|
| Ao abrir `jarvis` sem args | `menu` (interativo Clack) ou `commands` (só lista CLI) | `menu` |
| Estilo do menu | `live` ou `classic` (ambos Clack autocomplete) | `live` |
| Ao selecionar projeto | `new-tab`, `new-window`, `shell-cd`, `none` | `new-tab` |
| Workspace / projetos | pasta-pai, lista gerenciada, seletor no lançamento | — |

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

## 📋 Uso e Comandos

Rode `jarvis` sem argumentos para o menu (ou a lista de comandos, conforme a preferência). Comandos diretos sempre funcionam: `jarvis status`, `jarvis commit`, etc. Force o menu com `jarvis menu` e a lista com `jarvis help`.

**Projeto**

| Comando | Descrição |
|---|---|
| `jarvis init` | Inicializa um repositório Git |
| `jarvis status` | Mostra o status do repositório |
| `jarvis pull` | Atualiza a branch atual usando `git pull` |
| `jarvis update` | Atualiza o Jarvis usando `git pull` e `npm install` |
| `jarvis config` | Configura projeto e preferências (menu, workspace, abertura de pasta) |
| `jarvis today` | Exibe o resumo do dia (issues, PRs, status) |
| `jarvis scan [n]` | Varre subpastas e lista repos Git (até n níveis, padrão 4) |
| `jarvis add [path]` | Valida a pasta e adiciona à lista de projetos gerenciados |
| `jarvis use` | Seleciona um projeto e abre o caminho no terminal |
| `jarvis setup` | Setup Windows: libera `jarvis` sem `.cmd` + shim PowerShell |
| `jarvis menu` | Abre o menu interativo |
| `jarvis help` | Lista os comandos no terminal |

**Commit**

| Comando | Descrição |
|---|---|
| `jarvis commit` | Analisa as alterações e gera uma mensagem de commit com IA |
| `jarvis merge [origem] [destino]` | Faz merge entre branches (padrão: `dev → main`) |
| `jarvis release` | Executa o fluxo de release (tag, push e merge dev → main) |
| `jarvis undo` | Desfaz o último commit (soft reset) |

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
| `jarvis analyze` | Analisa arquitetura do projeto (somente leitura) |
| `jarvis ux` | Analisa usabilidade do frontend (somente leitura) |
| `jarvis check` | Verifica vulnerabilidades e segredos no código |

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

> ⌨️ **Atalhos:** `jarvis c` (commit), `jarvis s` (status), `jarvis m` (merge), `jarvis b` (branch), `jarvis p` (pull), `jarvis u` (update), `jarvis r` (review), `jarvis d` (docs), `jarvis h` (history), `jarvis i` (init), `jarvis j` (jira), `jarvis t` (today), `jarvis a` (analyze), `jarvis w` (scan)

## 🧪 Exemplos de uso

**Vários projetos numa pasta-pai**

```bash
cd pasta-com-varios-repos
jarvis add          # dentro de cada repo, registra na lista
jarvis use          # escolhe o projeto → abre aba no Windows Terminal
jarvis scan         # só lista o que foi detectado nas subpastas
```

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

Depois de rodar `npm link`, o Jarvis fica disponível globalmente. Basta entrar em qualquer projeto Git e executar `jarvis status` ou `jarvis commit` — os comandos Git usam o projeto atual, mas o `.env` é carregado a partir da pasta pessoal do usuário (`~/.jarvis-dev/.env`), não da pasta do projeto em que o comando está sendo executado.

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

## ⌨️ PowerShell no Windows

Após `npm install` / `npm link` / `npm run setup`, use **`jarvis`** (não é necessário `jarvis.cmd`).

O setup:
- Ajusta `ExecutionPolicy -Scope CurrentUser RemoteSigned`
- Instala o shim em `%APPDATA%\npm\jarvis.ps1`

Autocomplete opcional (sessão atual):

```powershell
. .\setup.ps1
```

## 🐛 Solução de problemas

| Problema | Solução |
|---|---|
| `jarvis` não é reconhecido como comando | Execute `npm link` e `npm run setup` na pasta do Jarvis |
| PowerShell bloqueia `jarvis` / pede `jarvis.cmd` | `npm run setup` ou `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `GEMINI_API_KEY` não encontrada | Execute `jarvis config` → Credenciais e preencha a chave |
| `GITHUB_TOKEN` não encontrada | Adicione o token ao `.env` — necessário apenas para comandos de Pull Request |
| Erro `503` da Gemini | A API pode estar temporariamente sobrecarregada — aguarde e tente novamente |
| Jarvis não encontra o repositório Git | Execute o comando dentro de uma pasta com repositório Git, ou use `jarvis use` |
| Comando funciona, mas não encontra o `.env` | Confirme se `~/.jarvis-dev/.env` (ou `%USERPROFILE%\.jarvis-dev\.env`) existe e está acessível |
| Jira retorna erro de autenticação | Verifique `JIRA_DOMAIN`, `JIRA_EMAIL` e `JIRA_API_TOKEN` |
| Jira pede configuração do projeto | Execute `jarvis config` ou crie o arquivo `.jarvis-dev.json` na raiz do projeto |
| GitHub retorna erro de permissão | Verifique as permissões do token e o acesso ao repositório |
| Selecionar projeto não abre pasta | Confirme o Windows Terminal (`wt`) e a preferência `projectOpenMode` em `jarvis config` |
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
| `v2.0` | Testes automatizados com Jest |
| `v2.5` | Análise de arquitetura e usabilidade com IA (analyze, ux) |
| `v3.0` | Verificação de segurança (check — npm audit + secretlint + IA) |
| `v3.5` | Workspace multi-projeto, menu configurável, setup Windows, testes Jest |
| `v4.0` | Configuração por perfil individual (`.env` em `~/.jarvis-dev/`) |
| `v4.5` | Onboarding no servidor e suporte a múltiplos usuários + Wrapper de shell para cd automático no Linux |
| `v5.x` | Comandos de voz (Voice/Whisper) |
| `v6.x` | Controle básico do computador (Jarvis Personal) |
| `v7.x` | Servidor doméstico e automação residencial |

## 📝 Licença

Projeto pessoal de estudo e automação. Sinta-se livre para usar, modificar e contribuir.