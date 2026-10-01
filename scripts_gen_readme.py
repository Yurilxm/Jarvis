from pathlib import Path
import json

readme = r'''# 🤖 Jarvis Dev

Assistente de desenvolvimento por linha de comando — commits inteligentes, gestão de branches, Pull Requests do GitHub, integração com Jira, revisão de código com IA, geração de documentação, OCR híbrido e wake word local por voz.

**Versão:** 2.1.0

## 🚀 Funcionalidades

### Commits com IA
- Analisa alterações com **Gemini API** e gera mensagens no formato **Conventional Commits**
- Permite escolher entre commitar todos os arquivos alterados (`git add .`) ou selecionar manualmente quais arquivos incluir
- Sanitiza dados sensíveis antes de enviar informações à IA (`.env`, tokens e chaves)
- Fluxo interativo para aprovar, editar, gerar novamente ou cancelar
- Adiciona assinatura automática no corpo do commit
- Sugestão de nova versão do Jarvis só aparece quando o comando é executado dentro do próprio repositório do Jarvis — nunca em outros projetos

### Revisão de código com IA
- Analisa alterações locais (todas ou apenas *staged*) usando IA em modo somente leitura
- Identifica potenciais problemas, riscos e sugere melhorias antes do commit
- Nunca modifica código — apenas imprime a análise no terminal

### Documentação automática
- Gera ou atualiza `README.md` do projeto usando IA
- Gera ou atualiza `CHANGELOG.md` com base nas alterações
- Coleta contexto do projeto (árvore de diretórios + arquivos relevantes por módulo)
- Prioriza arquivos por relevância arquitetural (não apenas por tamanho)
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
- Verificação prévia da presença de `GITHUB_TOKEN` com orientação direta caso ausente
- Todas as ações importantes exigem confirmação explícita

### Integração com Jira
- Lista issues do projeto (ativas, todas ou concluídas)
- Exibe detalhes de uma issue com descrição formatada
- Move issues entre status (`To Do`, `In Progress`, `Done`)
- Cria novas tasks com suporte a IA para título e descrição, com fluxo de revisão completo
- Edita título, descrição ou responsável de issues existentes com pré-visualização
- Exclui issues permanentemente com confirmação dupla (digitação da chave)
- Atribuição dinâmica de responsáveis (busca da API do Jira)
- Cria branches automaticamente ao iniciar uma issue
- Configuração interativa por projeto via `jarvis config`, arquivo `.jarvis-dev.json`, ou fallback global em `~/.jarvis/preferences.json`

### Relatórios de desenvolvimento (novo na 2.1)
- `jarvis report <issue>` — relatório cruzando a issue do Jira + commits + diffs do histórico, uma única chamada à IA
- `jarvis report --since 7d` — relatório de commits por período, sem depender de issue
- Salva em `reports/<chave>-<data>.md` (e adiciona `reports/` ao `.gitignore` automaticamente)

### OCR híbrido (novo na 2.1)
- `jarvis transcrever <imagem>` — extrai texto de imagens
- **Motor local (RapidOCR via Python)** por padrão — offline, sem API, sem cota
- **Fallback automático para Gemini Vision** quando a leitura local tem qualidade ruim (detectada por heurísticas)
- Flags: `--local` (força só local) e `--ia` (força só Gemini)
- Copia para o clipboard e/ou salva em `transcricoes/<nome>-<timestamp>.txt`
- Cache de modelos em `~/.jarvis-dev/`

### Jarvis Voz (novo na 2.1)
- **Wake word contínua com Vosk** (open source, offline, sem API key)
- Modo sessão: depois de falar "Jarvis", continua escutando por 30s sem precisar repetir a wake word
- Transcrição de fala com whisper.cpp local
- Intent matcher em português (aceita variações, conjugações, cortesias, cortesias)
- Execução direta após reconhecer (`--confirm` opcional)
- Pode abrir o resultado em nova aba/janela do terminal (`voiceOutputMode`)
- Auto-restart do listener Vosk e detecção de microfone desconectado
- Instalação no startup do Windows (`jarvis voz --instalar-startup`)

### Segurança
- Nenhuma ação destrutiva é executada sem confirmação
- Proteção da branch `main`
- Nenhum merge ou push é realizado automaticamente sem autorização
- Dados sensíveis são sanitizados antes de serem enviados à IA
- Arquivos sensíveis ignorados automaticamente, com regras adicionais via `.jarvisignore`
- O diretório `.jarvis/` (histórico de comandos e cache local) é ignorado automaticamente pelo Git em todos os repositórios onde o Jarvis é usado
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

### Histórico de eventos
- `jarvis history` — timeline de commits e pushes feitos pelo Jarvis
- `jarvis history sync` — sincroniza commits manuais (feitos fora do Jarvis)
- Distingue origem de cada evento (`jarvis` vs `git`)
- Agrupa por chave de issue do Jira quando a branch tem o padrão `feature/SDG-71-...`

### Testes
- **44 suítes / 315 testes** com Jest, cobrindo: fluxo de commit (mensagem, assinatura, seleção manual de arquivos), Git (status, diff, branch), Gemini (retry, multimodal), Jira (client, config, criação/edição/exclusão, fallback global, report), GitHub PR, gestão de projetos e workspace, menu interativo, roteamento de CLI, preferências, sanitização de dados sensíveis, geração de prompts (review/docs), versionamento semântico, controle de uso/cota, abertura de terminal, ignore de arquivos, OCR híbrido (RapidOCR local + fallback IA, detecção de qualidade) e voz (Vosk, wake words, listener, intent matcher, modo sessão, terminal output)

## 🛠️ Requisitos

**Obrigatórios:**
- Node.js 18 ou superior (recomendado: 20+)
- Git instalado e configurado
- Windows, macOS ou Linux

**Para OCR local (opcional):**
- Python 3.10+ (recomendado: 3.12)
- Pacotes: `pip install rapidocr onnxruntime`

**Para transcrição de voz (opcional):**
- ffmpeg (grava áudio do microfone)
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) (transcrição de fala local)

**Para wake word (opcional):**
- Python 3.10+ (recomendado: 3.12)
- Pacote: `pip install vosk`
- Modelo Vosk em português (baixado via `jarvis voz --setup --engine vosk`)

**No Windows:** PowerShell (recomendado) e, para abrir projetos em aba, [Windows Terminal](https://aka.ms/terminal)

## 📦 Instalação

```bash
git clone https://github.com/Yurilxm/Jarvis.git
cd Jarvis
npm run bootstrap
O comando npm run bootstrap automatiza a inicialização do ambiente:

Instala dependências e realiza o npm link

No Windows: ajusta a ExecutionPolicy, instala o shim e registra o script no perfil do PowerShell

No Linux: executa o script de onboarding do ambiente

Se nenhuma credencial for detectada, abre automaticamente a tela de configuração de credenciais pessoais (.env)

Você também pode rodar o setup manual a qualquer momento:

bash
npm run setup
# ou
jarvis setup
Depois disso, o comando jarvis estará disponível em qualquer terminal e poderá ser utilizado em qualquer projeto Git.

Onboarding no servidor compartilhado
Cada desenvolvedor deve usar seu próprio usuário no servidor.

Para configurar:

Conecte-se ao servidor com seu usuário.

Execute:

bash
  jarvis-onboarding
O script irá:

Configurar a identidade do Git (user.name e user.email);

Gerar uma chave SSH para o Gitea;

Exibir a chave pública para cadastro no Gitea;

Testar a conexão SSH;

Configurar credenciais pessoais via jarvis config credentials;

Instalar o wrapper de shell para cd automático.

Após adicionar a chave no Gitea (conforme instruções exibidas pelo script), teste:

bash
  jarvis status
  jarvis c
  jarvis use
Windows (máquinas locais): execute npm run bootstrap ou jarvis setup para liberar o comando jarvis sem .cmd, registrar no perfil do PowerShell e instalar o autocomplete/wrapper.

Linux (servidor): o onboarding já instala o wrapper e define projectOpenMode como shell-cd. Caso queira alterar para abrir em outra janela, use jarvis config.

⚙️ Configuração
A configuração do Jarvis é dividida em camadas, cada uma com um propósito claro:

ConfiguraçãoArquivoConteúdoVersiona no Git?
Usuário (credenciais)~/.jarvis-dev/.envChaves de API, tokens, credenciais❌ Nunca
Preferências globais~/.jarvis/preferences.jsonMenu, workspace, projetos, fallback Jira❌ Local
Voz~/.jarvis-dev/voice.jsonCaminhos de binários, modelo, sessão, microfone❌ Local
OCR~/.jarvis-dev/ocr.jsonPython detectado para RapidOCR❌ Local
Projeto.jarvis-dev.jsonProjeto Jira, branches, convenções✅ Sim (se seguro)
1. Configuração do usuário (.env)

Crie o arquivo .env na sua pasta pessoal:

Linux/macOS: ~/.jarvis-dev/.env

Windows: C:\Users\seu-usuario\.jarvis-dev\.env

Você pode criá-lo manualmente ou ir direto para o assistente de credenciais usando:

bash
jarvis config credentials
Ou através do menu interativo de jarvis config selecionando "Credenciais — configurar .env pessoal".

Edite com suas credenciais:

env
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
2. Configuração do projeto (.jarvis-dev.json)

Você pode configurar o arquivo .jarvis-dev.json do seu projeto de forma interativa através do comando:

bash
jarvis config
Se executado fora de um repositório Git, o jarvis config ajusta as opções contextualmente e permite configurar um fallback global do Jira — salvo em ~/.jarvis/preferences.json, junto das demais preferências — usado automaticamente quando não há .jarvis-dev.json local.

Ou, se preferir, crie o arquivo .jarvis-dev.json manualmente na raiz do seu projeto:

json
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
CampoDescriçãoExemplo
jira.projectKeyChave do projeto no Jira"SDG"
jira.projectIdID numérico do projeto"10033"
jira.issueTypeTipo de issue ao criar tasks"Tarefa"
git.protectedBranchBranch protegida"main"
git.developmentBranchBranch de desenvolvimento"dev"
Se o arquivo .jarvis-dev.json não existir, os comandos Git funcionam normalmente. Para o Jira, o Jarvis busca a configuração nesta ordem: .jarvis-dev.json do projeto → fallback global em ~/.jarvis/preferences.json (jiraProjectKey, jiraProjectId, jiraIssueType) → solicitação interativa, se nada estiver configurado.

Preferências globais (jarvis config)

Além do .jarvis-dev.json, o jarvis config permite ajustar (salvos em ~/.jarvis/preferences.json):

PreferênciaOpçõesPadrão
Ao abrir jarvis sem argsmenu (interativo Clack) ou commands (só lista CLI)menu
Estilo do menulive ou classic (ambos Clack autocomplete)live
Ao selecionar projetonew-tab, new-window, shell-cd, nonenew-tab
Workspace / projetospasta-pai, lista gerenciada, seletor no lançamento—
Como descobrir o projectId:

bash
jarvis jira list
Se ainda não tiver o .jarvis-dev.json, o comando exibirá uma mensagem com instruções. Você também pode consultar o administrador do Jira ou verificar a URL ao acessar o projeto no navegador.

3. Configuração de voz (~/.jarvis-dev/voice.json)

Criado automaticamente por jarvis voz --setup e jarvis voz --config. Edite manualmente se precisar:

json
{
  "audioDevice": "Microphone Array (Realtek Audio)",
  "whisperPath": "C:\\Users\\voce\\whisper.cpp\\Release\\whisper-cli.exe",
  "modelPath": "C:\\Users\\voce\\whisper.cpp\\models\\ggml-small.bin",
  "voskModelPath": "C:\\Users\\voce\\.jarvis-dev\\vosk-models\\vosk-model-small-pt-0.3",
  "voskPythonCmd": "py",
  "voskPythonArgs": ["-3.12"],
  "language": "pt",
  "whisperThreads": 4,
  "commandMaxMs": 12000,
  "commandSilenceMs": 2200,
  "sessionTimeoutMs": 30000,
  "voiceOutputMode": "same-terminal"
}
CampoDescriçãoPadrão
audioDeviceNome do microfone (Windows)auto-detectado
whisperPathCaminho do whisper-cli.exedetectado pelo setup
modelPathCaminho do modelo .bin do whisperdetectado pelo setup
voskModelPathCaminho do modelo Voskdetectado pelo setup
voskPythonCmd / voskPythonArgsComando Python para o Voskdetectado pelo setup
languageIdioma do whisper"pt"
whisperThreadsThreads de CPU para o whisper4
commandMaxMsTempo máximo de gravação de um comando8000
commandSilenceMsSilêncio para encerrar a gravação1500
sessionTimeoutMsDuração da sessão após wake word30000
voiceOutputModesame-terminal, new-tab ou new-windowsame-terminal
4. Configuração de OCR (~/.jarvis-dev/ocr.json)

Criado automaticamente na primeira execução de jarvis transcrever. Guarda o Python detectado (com a biblioteca RapidOCR):

json
{
  "pythonCmd": "py",
  "pythonArgs": ["-3.12"],
  "pythonLabel": "py -3.12",
  "detectedAt": "2026-10-01T12:00:00.000Z"
}
5. Configure o perfil do desenvolvedor (opcional)

bash
jarvis profile setup
O Jarvis tentará identificar automaticamente os dados do desenvolvedor usando o perfil do Git e a conta autenticada do GitHub.

🔑 Onde obter as chaves
ServiçoLocal
Gemini APIhttps://aistudio.google.com/apikey
GitHub Tokenhttps://github.com/settings/tokens
Jira API Tokenhttps://id.atlassian.com/manage-profile/security/api-tokens
Para usar os comandos de Pull Request, o token do GitHub precisa ter permissões suficientes para acessar e gerenciar os repositórios utilizados.

📋 Uso e Comandos
Rode jarvis sem argumentos para o menu (ou a lista de comandos, conforme a preferência). Comandos diretos sempre funcionam: jarvis status, jarvis commit, etc. Force o menu com jarvis menu e a lista com jarvis help.

Projeto

ComandoDescrição
jarvis initInicializa um repositório Git
jarvis statusMostra o status do repositório
jarvis pullAtualiza a branch atual usando git pull
jarvis updateAtualiza o Jarvis usando git pull e npm install
jarvis configConfigura projeto e preferências (menu, workspace, abertura de pasta)
jarvis config credentialsAbre diretamente a configuração das credenciais pessoais (.env)
jarvis todayExibe o resumo do dia (issues, PRs, status)
jarvis scan [n]Varre subpastas e lista repos Git (até n níveis, padrão 4)
jarvis add [path]Valida a pasta e adiciona à lista de projetos gerenciados
jarvis useSeleciona um projeto e abre o caminho no terminal
jarvis setupSetup Windows: libera jarvis sem .cmd, instala shim e perfil PS
jarvis menuAbre o menu interativo
jarvis helpLista os comandos no terminal
Commit

ComandoDescrição
jarvis commitAnalisa as alterações, permite escolher todos os arquivos ou selecionar manualmente, e gera uma mensagem de commit com IA
jarvis merge [origem] [destino]Faz merge entre branches (padrão: dev → main)
jarvis releaseExecuta o fluxo de release (tag, push e merge dev → main)
jarvis undoDesfaz o último commit (soft reset)
Branches

ComandoDescrição
jarvis branch listLista as branches locais
jarvis branch create <nome>Cria uma nova branch
jarvis branch switch <nome>Troca para outra branch
Revisão e Documentação

ComandoDescrição
jarvis reviewRevisa alterações com IA (somente leitura)
jarvis review stagedRevisa apenas o que está staged
jarvis docsGera/atualiza README.md com IA
jarvis docs changelogGera/atualiza CHANGELOG.md com IA
jarvis analyzeAnalisa arquitetura do projeto (somente leitura)
jarvis uxAnalisa usabilidade do frontend (somente leitura)
jarvis checkVerifica vulnerabilidades e segredos no código
Pull Requests

ComandoDescrição
jarvis pr listLista as Pull Requests abertas
jarvis pr view <n>Mostra os detalhes de uma Pull Request
jarvis pr diff <n>Mostra as alterações de uma Pull Request
jarvis pr review <n>Analisa uma Pull Request usando IA
jarvis pr checkout <n>Faz checkout da branch de uma Pull Request
jarvis pr approve <n>Aprova uma Pull Request
jarvis pr request-changes <n>Solicita alterações em uma Pull Request
jarvis pr comment <n>Adiciona um comentário a uma Pull Request
jarvis pr merge <n>Faz merge de uma Pull Request
jarvis pr close <n>Fecha uma Pull Request sem realizar merge
Jira

ComandoDescrição
jarvis jira list [active|all|done]Lista issues do Jira por status
jarvis jira view <issue>Mostra os detalhes de uma issue
jarvis jira move <issue>Move uma issue para outro status
jarvis jira createCria uma nova task, com IA e fluxo de revisão
jarvis jira edit <issue>Edita título, descrição ou responsável de uma issue
jarvis jira delete <issue>Exclui uma issue permanentemente
jarvis report <issue>Gera relatório de desenvolvimento (Jira + commits + diffs)
jarvis report --since 7dGera relatório de commits de um período (sem issue)
OCR

ComandoDescrição
jarvis transcrever <imagem>Extrai texto da imagem com OCR híbrido (RapidOCR local + Gemini Vision)
jarvis transcrever <imagem> --localForça o OCR local (sem IA)
jarvis transcrever <imagem> --iaForça transcrição via Gemini Vision
jarvis tr <imagem>Alias de transcrever
Voz

ComandoDescrição
jarvis voz "frase"Simula o reconhecimento de voz (modo simulação)
jarvis voz --ouvirPush-to-talk: grava, transcreve e executa
jarvis voz --wakeEscuta contínua da wake word (Vosk) com modo sessão
jarvis voz --setup --engine whisperBaixa e configura whisper.cpp + modelo
jarvis voz --setup --engine voskBaixa e configura o Vosk (wake word)
jarvis voz --configConfigura caminhos, microfone e idioma manualmente
jarvis voz --listar-microfonesLista microfones disponíveis (Windows)
jarvis voz --instalar-startupInstala wake word no startup do Windows
jarvis voz --remover-startupRemove wake word do startup
Histórico

ComandoDescrição
jarvis historyMostra o histórico de eventos do Jarvis
jarvis history syncSincroniza commits manuais (feitos fora do Jarvis)
Perfil

ComandoDescrição
jarvis profile setupConfigura o perfil do desenvolvedor
jarvis profile showMostra o perfil atualmente configurado
jarvis profile editPermite editar manualmente o perfil
Outros

ComandoDescrição
jarvis ignoreGerencia a lista de arquivos ignorados com IA ou manualmente
⌨️ Atalhos: jarvis c (commit), jarvis s (status), jarvis m (merge), jarvis b (branch), jarvis p (pull), jarvis u (update), jarvis r (review), jarvis d (docs), jarvis h (history), jarvis i (init), jarvis j (jira), jarvis t (today), jarvis a (analyze), jarvis w (scan), jarvis tr (transcrever)

🧪 Exemplos de uso
Vários projetos numa pasta-pai

bash
cd pasta-com-varios-repos
jarvis add          # dentro de cada repo, registra na lista
jarvis use          # escolhe o projeto -> abre aba no Windows Terminal
jarvis scan         # so lista o que foi detectado nas subpastas
Commit com IA

bash
cd meu-projeto
jarvis commit
O Jarvis vai: verificar a branch atual -> analisar o status do repositório -> perguntar se você quer commitar todos os arquivos ou selecionar manualmente -> sanitizar informações sensíveis -> enviar o conteúdo seguro para a Gemini API -> gerar uma mensagem no padrão Conventional Commits -> exibir para aprovação -> permitir aprovar, editar, gerar novamente ou cancelar -> commitar após confirmação -> perguntar se deve fazer push.

Relatório de desenvolvimento

bash
jarvis report SDG-71
jarvis report --since 7d
O primeiro cruzará a issue SDG-71 com todos os commits registrados no histórico do Jarvis cujo nome de branch tinha SDG-71. O segundo fará um relatório consolidado dos últimos 7 dias (útil para retros, status reports, etc.).

OCR de imagens

bash
jarvis tr captura.png
jarvis tr foto-do-caderno.jpg          # RapidOCR local; se ruim, oferece Gemini Vision
jarvis tr contrato.png --ia            # forca Gemini Vision (melhor para manuscrito)
jarvis tr print.png --local            # forca OCR local (offline, sem cota)
Voz com wake word

bash
# Primeira vez: baixa e configura
jarvis voz --setup --engine vosk                     # wake word (~31MB)
jarvis voz --setup --engine whisper --model small    # transcricao (~500MB)

# Rodar
jarvis voz --wake
# > Diga "Jarvis" para ativar. Ctrl+C para sair.
# [voce fala] "Jarvis"
# > Wake word detectada!
# [voce fala] "lista do jira"
# > Executando: jarvis jira list
# ... (continua em sessao por 30s)
Gerenciar issues do Jira

bash
jarvis jira list
jarvis jira list all
jarvis jira list done
jarvis jira view SDG-68
jarvis jira move SDG-68
jarvis jira create
jarvis jira edit SDG-68
jarvis jira delete SDG-68
Iniciar um projeto novo

bash
mkdir novo-projeto
cd novo-projeto
jarvis init
🌍 Usando o Jarvis em qualquer projeto
Depois de rodar npm link ou npm run bootstrap, o Jarvis fica disponível globalmente. Basta entrar em qualquer projeto Git e executar jarvis status ou jarvis commit — os comandos Git usam o projeto atual, mas o .env é carregado a partir da pasta pessoal do usuário (~/.jarvis-dev/.env), não da pasta do projeto em que o comando está sendo executado.

🔒 Segurança
O .env nunca deve ser enviado ao Git e já está incluído no .gitignore

Tokens e chaves não aparecem nos logs nem na saída do terminal

O conteúdo dos diffs é sanitizado antes de ser enviado à IA

Arquivos sensíveis são ignorados automaticamente, com regras adicionais via .jarvisignore

O diretório .jarvis/ (histórico local) é ignorado automaticamente em todos os projetos onde o Jarvis é usado

A branch main possui uma camada extra de proteção

Nenhuma ação destrutiva é executada sem confirmação explícita

O Jarvis não realiza stash automático nem resolve conflitos automaticamente

Nenhum ID de usuário, projeto ou configuração específica fica hardcoded no código

OCR local (RapidOCR) roda offline, sem enviar nada para a internet

Gemini Vision só é usado sob demanda (fallback do OCR, ou quando forçado com --ia)

Vosk roda 100% offline — nenhuma chamada de rede para wake word

⚠️ Nunca compartilhe ou publique os valores do seu arquivo .env.

⌨️ PowerShell no Windows
Após npm install / npm run bootstrap / npm run setup, use jarvis (não é necessário jarvis.cmd).

O setup:

Ajusta ExecutionPolicy -Scope CurrentUser RemoteSigned

Instala o shim em %APPDATA%\npm\jarvis.ps1

Adiciona o carregamento automático do setup.ps1 no seu perfil do PowerShell ($PROFILE)

Caso o autocomplete precise ser recarregado na sessão atual sem reiniciar o terminal:

powershell
. .\setup.ps1
🐛 Solução de problemas
ProblemaSolução
jarvis não é reconhecido como comandoExecute npm link e npm run setup na pasta do Jarvis
PowerShell bloqueia jarvis / pede jarvis.cmdnpm run setup ou Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
GEMINI_API_KEY não encontradaExecute jarvis config credentials e preencha a chave
Erro 503 da GeminiA API pode estar temporariamente sobrecarregada — aguarde e tente novamente
Erro 429 (cota excedida)Aguarde algumas horas ou verifique seu plano em https://ai.google.dev/gemini-api/docs/rate-limits
Jarvis não encontra o repositório GitExecute o comando dentro de uma pasta com repositório Git, ou use jarvis use
Jira retorna erro de autenticaçãoVerifique JIRA_DOMAIN, JIRA_EMAIL e JIRA_API_TOKEN com jarvis config credentials
Jira pede configuração do projetoExecute jarvis config ou crie o .jarvis-dev.json na raiz do projeto
OCR: "RapidOCR não instalado"Rode pip install rapidocr onnxruntime (de preferência em Python 3.12)
OCR: leitura ruim em manuscritoAceite a oferta de usar Gemini Vision, ou rode com --ia
Vosk: "modelo não encontrado"Rode jarvis voz --setup --engine vosk
Vosk: microfone não detectadoRode jarvis voz --listar-microfones e depois jarvis voz --config
Voz: microfone captura mas wake word não disparaVerifique se o volume está alto o suficiente e fale "Jarvis" com pausa clara
Voz: nenhuma fala detectada após wakeFale mais alto/perto do microfone; aumente commandSilenceMs em voice.json
Voz: comando cortado no meioAumente commandSilenceMs (ex: 2500) e commandMaxMs (ex: 15000) em voice.json
Selecionar projeto não abre pastaConfirme o Windows Terminal (wt) e a preferência projectOpenMode em jarvis config
Autocomplete não funcionaExecute novamente . .\setup.ps1 no PowerShell ou reinicie o terminal
🗺️ Roadmap
VersãoFuncionalidades
v1.0Commits com IA, branches, merge, Pull Requests e interface
v1.1Assinatura automática nos commits e perfil do desenvolvedor
v1.2Integração com Jira e configuração por projeto (.jarvis-dev.json)
v1.3Revisão de código com IA e geração de documentação
v1.4Aliases, undo, today, aviso de cota Gemini, release automatizado, config interativo e modularização do CLI
v1.5Testes automatizados com Jest
v1.6Análise de arquitetura e usabilidade com IA (analyze, ux)
v1.7Verificação de segurança (check — npm audit + secretlint + IA)
v1.8Workspace multi-projeto, menu configurável, setup Windows, testes Jest
v1.9Configuração por perfil individual (.env em ~/.jarvis-dev/)
v2.0Primeira versão em uso real pela equipe. Onboarding no servidor, suporte a múltiplos usuários, wrapper de shell no Linux, script de bootstrap, validação de token do GitHub, seleção manual de arquivos no commit, edição de título/descrição no jarvis jira create, fallback global de configuração do Jira
v2.1Relatórios, OCR híbrido e voz local. jarvis report <issue> e --since (relatório de desenvolvimento), jarvis transcrever (OCR local com RapidOCR + fallback Gemini Vision), jarvis voz com wake word contínua via Vosk (open source, offline), modo sessão (30s sem repetir a wake word), abertura automática em nova aba/janela do terminal, auto-restart do listener, sincronização automática de commits manuais no histórico, e melhorias internas de robustez (retry Gemini, sanitização, cache local)
📝 Licença
Projeto pessoal de estudo e automação. Sinta-se livre para usar, modificar e contribuir.
'''

Path("README.md").write_text(readme, encoding="utf-8")
print("OK: README.md atualizado (v2.1.0)")

pkg = Path("package.json")
data = json.loads(pkg.read_text(encoding="utf-8"))
data["version"] = "2.1.0"
pkg.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("OK: package.json atualizado (version: 2.1.0)")

print("Tudo pronto.")
