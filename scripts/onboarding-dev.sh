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

# 2. Configurar identidade Git
echo ""
echo ">>> Configurando identidade do Git"
read -r -p "Nome (ex: Nome Sobrenome): " git_name
read -r -p "Email (ex: usuario@empresa.com): " git_email
if [ -z "$git_name" ] || [ -z "$git_email" ]; then
  echo "Nome e email são obrigatórios."
  exit 1
fi
git config --global user.name "$git_name"
git config --global user.email "$git_email"
echo "✔ Identidade Git configurada."

# 3. Chave SSH para o Gitea
echo ""
echo ">>> Chave SSH para o Gitea"
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
echo "No Gitea, acesse: Settings → SSH / GPG Keys → Add Key"
echo "Depois teste com: ssh -T git@192.100.0.170 -p 2222"
echo ""

# 4. Verificar se o Jarvis está acessível
if command -v jarvis &> /dev/null; then
  echo "✔ Comando 'jarvis' encontrado."
else
  echo "[AVISO] O comando 'jarvis' não está acessível no seu PATH."
  echo "Peça a um admin para executar: sudo npm link --prefix /srv/jarvis-dev"
fi

# 5. Configurar credenciais pessoais do Jarvis
...
if command -v jarvis &> /dev/null; then
  jarvis config
else
  echo "Após instalar o Jarvis globalmente, execute: jarvis config"
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
echo "1. Adicione sua chave SSH ao Gitea (mostrada acima)."
echo "2. Teste a conexão: ssh -T git@192.100.0.170 -p 2222"
echo "3. Navegue até um projeto e use:"
echo "     jarvis status"
echo "     jarvis c"
echo "     jarvis use   # agora troca o diretório no shell"
echo ""