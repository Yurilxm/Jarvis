#!/usr/bin/env bash
# Jarvis Dev — Onboarding de novo desenvolvedor
# Uso: bash scripts/onboarding-dev.sh

set -e

echo ""
echo "========================================"
echo "  Jarvis Dev — Onboarding de Desenvolvedor"
echo "========================================"
echo ""

# 1. Verificar dependências
for cmd in node npm git; do
  if ! command -v "$cmd" &> /dev/null; then
    echo "[ERRO] $cmd não encontrado. Instale antes de continuar."
    exit 1
  fi
done
echo "✔ Node, npm e Git encontrados."

# 1.1 Garantir permissão de execução do comando cli.js
JARVIS_CLI="/srv/jarvis-dev/src/cli.js"
if [ -f "$JARVIS_CLI" ]; then
  chmod +x "$JARVIS_CLI"
  echo "✔ Permissão de execução verificada para o Jarvis."
fi

# 2. Configurar identidade Git (idempotente)
echo ""
echo ">>> Identidade Git"
current_name="$(git config --global user.name || true)"
current_email="$(git config --global user.email || true)"

if [ -n "$current_name" ] && [ -n "$current_email" ]; then
  echo "Identidade atual:"
  echo "  Nome:  $current_name"
  echo "  Email: $current_email"
  read -r -p "Deseja manter? (Enter para manter, 'n' para alterar): " keep
  if [[ "$keep" != "n" && "$keep" != "N" ]]; then
    git_name="$current_name"
    git_email="$current_email"
  else
    read -r -p "Nome (ex: Nome Sobrenome): " git_name
    read -r -p "Email (ex: usuario@empresa.com): " git_email
  fi
else
  read -r -p "Nome (ex: Nome Sobrenome): " git_name
  read -r -p "Email (ex: usuario@empresa.com): " git_email
fi

if [ -z "$git_name" ] || [ -z "$git_email" ]; then
  echo "Nome e email são obrigatórios."
  exit 1
fi

git config --global user.name "$git_name"
git config --global user.email "$git_email"
echo "✔ Identidade Git configurada."

# 3. Chave SSH e conexão com Gitea (idempotente)
echo ""
echo ">>> Chave SSH e Gitea"

if ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -T git@192.100.0.170 -p 2222 2>&1 | grep -q "successfully authenticated"; then
  echo "✔ Conexão SSH com Gitea já está OK."
  echo "Nenhuma ação extra necessária."
else
  if [ ! -f "$HOME/.ssh/id_ed25519" ]; then
    echo "Gerando chave ED25519..."
    ssh-keygen -t ed25519 -C "$git_email" -f "$HOME/.ssh/id_ed25519" -N ""
    echo "✔ Chave SSH criada."
  else
    echo "✔ Chave SSH já existe."
  fi

  echo ""
  echo "Chave pública (copie para o Gitea):"
  echo "------------------------------------"
  cat "$HOME/.ssh/id_ed25519.pub"
  echo "------------------------------------"
  echo ""
  echo "➡️  Acesse o Gitea:"
  echo "   http://192.100.0.170:3001"
  echo "   Settings → SSH / GPG Keys → Add Key"
  echo "   Cole a chave acima e salve."
  echo ""
  read -r -p "Depois de adicionar a chave no Gitea, pressione Enter para continuar..." _
  echo ""

  echo ">>> Testando conexão SSH com o Gitea..."
  if ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -T git@192.100.0.170 -p 2222 2>&1 | grep -q "successfully authenticated"; then
    echo "✔ Conexão SSH com Gitea OK."
  else
    echo "⚠️  Não foi possível autenticar. Verifique se a chave foi adicionada corretamente."
  fi
fi

# 4. Verificar se o Jarvis está acessível
if command -v jarvis &> /dev/null; then
  echo "✔ Comando 'jarvis' encontrado."
else
  echo "[AVISO] O comando 'jarvis' não está acessível no seu PATH."
  echo "Peça a um admin para executar: sudo npm link --prefix /srv/jarvis-dev"
fi

# 5. Configurar credenciais pessoais do Jarvis
echo ""
echo ">>> Credenciais pessoais do Jarvis"
echo "Vamos configurar suas chaves de API (Gemini, GitHub, Jira)."
echo ""
if command -v jarvis &> /dev/null; then
  jarvis config credentials
else
  echo "Após instalar o Jarvis globalmente, execute: jarvis config credentials"
fi

# 6. Setup Linux (wrapper para cd automático)
echo ""
echo ">>> Setup Linux — integração com o shell"
bash /srv/jarvis-dev/scripts/setup-linux.sh

echo ""
echo "========================================"
echo "  Onboarding concluído!"
echo "========================================"
echo ""
echo "Próximos passos:"
echo "1. Navegue até um projeto:"
echo "     cd /srv/newsrag/frontend-stack"
echo "2. Use o Jarvis:"
echo "     jarvis status"
echo "     jarvis c"
echo "     jarvis use   # agora troca o diretório no shell"
echo ""