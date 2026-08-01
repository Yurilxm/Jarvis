# 🤖 Jarvis

Assistente pessoal de automação por linha de comando — commits inteligentes, gestão de branches, Pull Requests do GitHub e muito mais.

**Versão:** 1.0.0

---

## 🚀 Funcionalidades

### Commits inteligentes

- Analisa alterações com **Gemini API** e gera mensagens no formato **Conventional Commits**
- Sanitiza dados sensíveis antes de enviar informações à IA (`.env`, tokens e chaves)
- Possui um fluxo interativo para aprovar, editar, gerar novamente ou cancelar o commit
- Assinatura automática no corpo do commit — **em breve**

### Gestão de branches

- `main` protegida com confirmação extra
- `dev` como branch de desenvolvimento padrão
- Criação, listagem e troca de branches com verificações de segurança
- Não força a troca de branch quando existem alterações pendentes
- Não realiza `stash` automaticamente

### Pull Requests do GitHub

- Listar Pull Requests abertas
- Visualizar detalhes e alterações de uma PR
- Revisar PRs com IA
- Aprovar PRs
- Solicitar alterações
- Adicionar comentários
- Fazer checkout da branch da PR para testes locais
- Fazer merge de PRs
- Fechar PRs sem realizar merge
- Todas as ações importantes exigem confirmação explícita

### Segurança

- Nenhuma ação destrutiva é executada sem confirmação
- Proteção adicional da branch `main`
- Nenhum merge é realizado automaticamente
- Nenhum push é realizado sem confirmação
- Arquivos e dados sensíveis são sanitizados antes do envio à IA
- O arquivo `.jarvisignore` permite configurar padrões adicionais de exclusão

### Interface

- Banner ASCII personalizado
- Spinners para indicar operações em andamento
- Caixas e mensagens formatadas
- Interface de terminal organizada e mais agradável de utilizar

---

## 📋 Comandos

| Comando | Descrição |
|---|---|
| `jarvis init` | Inicializa um repositório Git |
| `jarvis commit` | Analisa as alterações e gera uma mensagem de commit com IA |
| `jarvis merge [origem] [destino]` | Realiza merge entre branches. O padrão é `dev → main` |
| `jarvis status` | Exibe a branch atual, branches disponíveis e arquivos alterados |
| `jarvis ignore` | Gerencia a lista de arquivos e padrões ignorados |
| `jarvis history` | Exibe o histórico de commits e operações |
| `jarvis branch list` | Lista as branches do repositório |
| `jarvis branch create <nome>` | Cria uma nova branch |
| `jarvis branch switch <nome>` | Troca para outra branch com verificações de segurança |
| `jarvis pr list` | Lista Pull Requests abertas |
| `jarvis pr view <número>` | Exibe os detalhes de uma Pull Request |
| `jarvis pr diff <número>` | Exibe as alterações de uma Pull Request |
| `jarvis pr review <número>` | Analisa uma Pull Request utilizando IA |
| `jarvis pr checkout <número>` | Faz checkout da branch associada à Pull Request |
| `jarvis pr approve <número>` | Aprova uma Pull Request |
| `jarvis pr request-changes <número>` | Solicita alterações em uma Pull Request |
| `jarvis pr comment <número>` | Adiciona um comentário a uma Pull Request |
| `jarvis pr merge <número>` | Realiza o merge de uma Pull Request |
| `jarvis pr close <número>` | Fecha uma Pull Request sem realizar merge |

---

## 🛠️ Requisitos

Antes de utilizar o Jarvis, verifique se os seguintes requisitos estão instalados:

- **Node.js 18 ou superior**
  - Recomendado: **Node.js 20 ou superior**
- **Git** instalado e configurado
- Sistema operacional:
  - Windows
  - macOS
  - Linux

---

## 📦 Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/Yurilxm/Jarvis.git
```

### 2. Entre na pasta do projeto

```bash
cd Jarvis
```

### 3. Instale as dependências

```bash
npm install
```

### 4. Torne o comando disponível globalmente

Execute:

```bash
npm link
```

Depois disso, o comando `jarvis` poderá ser utilizado em qualquer terminal e em qualquer projeto Git da máquina.

---

## ⚙️ Configuração

### 1. Crie o arquivo `.env`

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

No Windows PowerShell, caso o comando acima não funcione, utilize:

```powershell
Copy-Item .env.example .env
```

### 2. Configure as chaves de API

Abra o arquivo `.env` e adicione suas credenciais:

```env
# Gemini API — obrigatória para recursos de IA
GEMINI_API_KEY=sua-chave-do-gemini

# Modelo Gemini — opcional
# Valor padrão: gemini-flash-latest
GEMINI_MODEL=gemini-flash-latest

# GitHub — necessário apenas para os comandos de Pull Request
GITHUB_TOKEN=ghp_seu-token
```

---

## 🔑 Onde obter as chaves

### Gemini API Key

A chave da Gemini pode ser criada no Google AI Studio:

https://aistudio.google.com/apikey

### GitHub Personal Access Token

O token do GitHub pode ser criado nas configurações da conta:

https://github.com/settings/tokens

Para utilizar os comandos relacionados a Pull Requests, configure as permissões necessárias para acessar os repositórios utilizados.

---

## 🔒 Segurança

O Jarvis foi desenvolvido para evitar ações automáticas perigosas e reduzir o risco de exposição de informações sensíveis.

- O arquivo `.env` não deve ser enviado para o GitHub
- O `.env` está incluído no `.gitignore`
- Chaves e tokens não devem aparecer nos logs ou na saída do terminal
- O conteúdo das alterações é sanitizado antes de ser enviado à IA
- Arquivos sensíveis, como `.env`, `.pem` e chaves privadas, são ignorados automaticamente
- O arquivo `.jarvisignore` permite adicionar padrões personalizados de exclusão
- A branch `main` possui proteção adicional
- Commits, pushes, merges e ações importantes exigem confirmação do usuário
- O Jarvis não resolve conflitos automaticamente
- O Jarvis não executa `stash` automaticamente

> ⚠️ Nunca publique o arquivo `.env` e nunca compartilhe suas chaves de API ou tokens do GitHub.

---

## 🧪 Exemplos de uso

### Criar um commit com IA

Entre na pasta de qualquer projeto Git:

```bash
cd caminho/do/meu-projeto
```

Execute:

```bash
jarvis commit
```

O Jarvis irá:

1. Verificar a branch atual
2. Alertar caso você esteja trabalhando diretamente na `main`
3. Analisar o status do repositório
4. Ler as alterações relevantes
5. Sanitizar informações sensíveis
6. Enviar o contexto para a Gemini API
7. Gerar uma mensagem de commit
8. Exibir a mensagem para revisão
9. Permitir aprovar, editar, gerar novamente ou cancelar
10. Executar o commit após sua confirmação
11. Perguntar se você deseja realizar o push

---

### Verificar o status do projeto

```bash
jarvis status
```

O comando exibe informações como:

- Branch atual
- Branches disponíveis
- Arquivos modificados
- Estado do repositório

---

### Criar uma nova branch

```bash
jarvis branch create minha-feature
```

O Jarvis cria a branch e pergunta se você deseja trocar para ela.

---

### Trocar de branch

```bash
jarvis branch switch dev
```

O Jarvis verifica se existem alterações pendentes antes de realizar a troca.

---

### Fazer merge entre branches

Para realizar o fluxo padrão:

```bash
jarvis merge
```

O fluxo padrão utiliza:

```text
dev → main
```

Também é possível informar a origem e o destino:

```bash
jarvis merge feature-login dev
```

O Jarvis realiza verificações antes do merge e solicita confirmação para ações importantes.

---

### Revisar uma Pull Request

Liste as Pull Requests abertas:

```bash
jarvis pr list
```

Visualize os detalhes de uma PR:

```bash
jarvis pr view 1
```

Veja as alterações:

```bash
jarvis pr diff 1
```

Peça uma revisão utilizando IA:

```bash
jarvis pr review 1
```

Faça checkout da branch da PR para testar localmente:

```bash
jarvis pr checkout 1
```

Depois dos testes, você pode aprovar:

```bash
jarvis pr approve 1
```

Ou solicitar alterações:

```bash
jarvis pr request-changes 1
```

Para realizar o merge:

```bash
jarvis pr merge 1
```

---

### Comentar em uma Pull Request

```bash
jarvis pr comment 1
```

O Jarvis solicitará o conteúdo do comentário.

---

### Fechar uma Pull Request sem merge

```bash
jarvis pr close 1
```

---

### Iniciar um novo projeto

Crie uma pasta:

```bash
mkdir novo-projeto
```

Entre nela:

```bash
cd novo-projeto
```

Inicialize o Git utilizando o Jarvis:

```bash
jarvis init
```

---

## 🌍 Utilizando o Jarvis em qualquer projeto

Depois de executar:

```bash
npm link
```

dentro da pasta do Jarvis, o comando fica disponível globalmente na máquina.

Isso significa que você não precisa copiar o Jarvis para dentro de cada projeto.

Exemplo:

```bash
cd C:\Projetos\meu-projeto
```

Depois:

```bash
jarvis commit
```

O Jarvis será executado a partir da instalação global, mas analisará o repositório Git localizado na pasta atual.

---

## 🗺️ Roadmap

| Versão | Funcionalidades |
|---|---|
| `v1.0` | Commits com IA, branches, merges, Pull Requests e interface de terminal |
| `v1.1` | Assinatura automática nos commits |
| `v2.0` | Integração com Jira |
| `v2.x` | Configurações personalizadas por usuário e por projeto |
| `v3.x` | Revisão de código e documentação automática |
| `v4.x` | Controle básico do computador |
| `v5.x` | Comandos de voz e ativação pelo nome "Jarvis" |
| `v6.x` | Servidor doméstico, automações contínuas e integração com casa inteligente |

---

## 🐛 Solução de problemas

### O comando `jarvis` não é reconhecido

Execute novamente dentro da pasta do projeto Jarvis:

```bash
npm link
```

Depois, feche e abra um novo terminal.

---

### Erro: `GEMINI_API_KEY` não encontrada

Verifique se:

1. O arquivo `.env` existe na raiz do projeto Jarvis
2. A variável está escrita corretamente
3. A chave foi adicionada ao arquivo

Exemplo:

```env
GEMINI_API_KEY=sua-chave-aqui
```

---

### Erro: `GITHUB_TOKEN` não encontrada

O token do GitHub é necessário apenas para os comandos relacionados a Pull Requests.

Adicione a variável ao arquivo `.env`:

```env
GITHUB_TOKEN=ghp_seu-token
```

---

### Erro `503` da Gemini

A API pode estar temporariamente sobrecarregada.

Aguarde alguns segundos e tente novamente.

---

### O comando funciona, mas não encontra o `.env`

A partir da versão `1.0.0`, o arquivo `.env` é carregado a partir do diretório de instalação do Jarvis, e não da pasta do projeto em que o comando está sendo executado.

Verifique se o arquivo está localizado em:

```text
Jarvis/.env
```

---

### O Jarvis não encontra o repositório Git

Certifique-se de que você está dentro da pasta de um projeto Git:

```bash
git status
```

Se o comando retornar informações sobre a branch e os arquivos, o repositório está configurado corretamente.

Caso o projeto ainda não possua Git, execute:

```bash
jarvis init
```

---

## 📝 Licença

Projeto pessoal de estudo, automação e aprendizado.

Sinta-se livre para utilizar, modificar, estudar e contribuir com o projeto.