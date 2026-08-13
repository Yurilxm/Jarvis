#!/usr/bin/env bash
# Jarvis Dev — Setup Linux: wrapper para cd automático no shell.
# Uso: bash scripts/setup-linux.sh

set -e

# Garante permissão de execução do comando cli.js
JARVIS_CLI="/srv/jarvis-dev/src/cli.js"
if [ -f "$JARVIS_CLI" ]; then
  chmod +x "$JARVIS_CLI"
fi

echo ""
echo ">>> Configurando integração do Jarvis com o shell"

JARVIS_FUNC='
# Jarvis Dev — wrapper para cd automático ao trocar de projeto
jarvis() {
  local exit_code
  JARVIS_SHELL_WRAPPER=1 command jarvis "$@"
  exit_code=$?

  local next_cwd="$HOME/.jarvis/next-cwd"
  if [ -f "$next_cwd" ]; then
    local target
    target=$(cat "$next_cwd")
    rm -f "$next_cwd"
    if [ -n "$target" ] && [ -d "$target" ]; then
      cd "$target" || return 1
      echo "cd -> $target"
    fi
  fi

  return $exit_code
}
'

# Adiciona a função ao .bashrc se ainda não existir
if ! grep -q "Jarvis Dev — wrapper para cd automático" "$HOME/.bashrc"; then
  echo "$JARVIS_FUNC" >> "$HOME/.bashrc"
  echo "✔ Função jarvis adicionada ao ~/.bashrc"
else
  echo "✔ Função jarvis já configurada"
fi

# Ajusta a preferência projectOpenMode para shell-cd
PREF_FILE="$HOME/.jarvis/preferences.json"
if [ ! -f "$PREF_FILE" ]; then
  mkdir -p "$HOME/.jarvis"
  cat > "$PREF_FILE" <<'EOF'
{
  "projectOpenMode": "shell-cd"
}
EOF
else
  node -e '
    const fs = require("fs");
    const path = require("path");
    const file = process.env.HOME + "/.jarvis/preferences.json";
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    data.projectOpenMode = "shell-cd";
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  '
fi
echo "✔ Preferência projectOpenMode definida como shell-cd"

echo ""
echo ">>> Recarregando .bashrc"
# shellcheck disable=SC1090
source "$HOME/.bashrc"
echo "✔ Integração ativa"