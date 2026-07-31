/**
 * Prompt para a IA sugerir padrões de .jarvisignore.
 * @param {string[]} filePaths
 * @returns {string}
 */
export function buildIgnoreSuggestPrompt(filePaths) {
  const list = filePaths.slice(0, 250).join('\n');

  return `Você analisa a lista de arquivos de um repositório e sugere padrões no estilo .gitignore
para o Jarvis NÃO enviar à IA e NÃO incluir automaticamente no git add.

Foque em:
- secrets, chaves, certificados, credenciais
- dumps, backups, caches, builds, coverage
- arquivos locais de IDE/OS
- pastas de dependências já óbvias (node_modules, vendor, etc.) se aparecerem
- dados sensíveis de usuário

NÃO sugira código-fonte normal (src/, *.js de app, README, etc.).
NÃO repita padrões genéricos demais sem evidência na lista.
Prefira padrões específicos observados nos caminhos.

Responda APENAS com padrões, um por linha, sem numeração, sem markdown, sem comentários.
Máximo 20 linhas.

Arquivos do projeto:
\`\`\`
${list || '(lista vazia)'}
\`\`\`
`;
}
