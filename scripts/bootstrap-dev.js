import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

console.log('Jarvis Dev — Bootstrap\n');

// 1) Dependências
const nodeModulesPath = path.join(repoRoot, 'node_modules');
if (!existsSync(nodeModulesPath)) {
  console.log('Instalando dependências (npm install)...');
  const install = spawnSync(npmCmd, ['install'], { cwd: repoRoot, stdio: 'inherit' });
  if (install.status !== 0) {
    console.error('Falha ao instalar dependências. Abortando.');
    process.exit(1);
  }
} else {
  console.log('Dependências já instaladas.');
}

// 2) Setup específico do SO
if (isWin) {
  // No Windows local, cada dev precisa do npm link para expor o comando jarvis
  console.log('\nGarantindo link global do comando jarvis (npm link --force)...');
  spawnSync(npmCmd, ['link', '--force'], { cwd: repoRoot, stdio: 'inherit' });

  const installWinPs1 = path.join(repoRoot, 'scripts', 'install-windows.ps1');
  if (existsSync(installWinPs1)) {
    console.log('\nExecutando setup Windows...');
    spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', installWinPs1], { stdio: 'inherit' });
  } else {
    console.warn('scripts/install-windows.ps1 não encontrado — pulando.');
  }
} else {
  // Servidor Linux: npm link é responsabilidade do admin, não de cada dev.
  // O onboarding já verifica e orienta isso.
  const onboarding = path.join(repoRoot, 'scripts', 'onboarding-dev.sh');
  if (existsSync(onboarding)) {
    console.log('\nExecutando onboarding Linux (identidade Git, SSH, credenciais, shell)...');
    spawnSync('bash', [onboarding], { stdio: 'inherit' });
    console.log('\nOnboarding concluído. Rode: jarvis scan');
    process.exit(0);
  } else {
    console.warn('scripts/onboarding-dev.sh não encontrado — pulando.');
  }
}

// 3) Credenciais — só chega aqui no fluxo Windows
const userEnvPath = path.join(os.homedir(), '.jarvis-dev', '.env');
if (!existsSync(userEnvPath)) {
  console.log('\nNenhuma credencial configurada ainda.');
  console.log('Abrindo configuração de credenciais (Gemini, GitHub, Jira)...\n');
  spawnSync('node', [path.join(repoRoot, 'src', 'cli.js'), 'config', 'credentials'], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
} else {
  console.log('\nCredenciais já configuradas.');
}

console.log('\nBootstrap concluído!');
console.log('Feche e abra o terminal (para ativar o perfil do PowerShell), depois rode: jarvis scan');