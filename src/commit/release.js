import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { success, error, info } from '../ui.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runReleaseFromCommit(bump) {
  const pkgPath = path.join(__dirname, '..', '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const parts = pkg.version.split('.').map(Number);
  
  if (bump === 'patch') { parts[2]++; }
  if (bump === 'minor') { parts[1]++; parts[2] = 0; }
  if (bump === 'major') { parts[0]++; parts[1] = 0; parts[2] = 0; }
  
  const newVersion = parts.join('.');
  const tagName = `v${newVersion}`;

  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  success(`Versão atualizada para ${newVersion}.`);

  try {
    execSync(`git add package.json`, { encoding: 'utf-8', stdio: 'inherit' });
    execSync(`git commit -m "chore: bump version to ${tagName}"`, { encoding: 'utf-8', stdio: 'inherit' });
    execSync(`git tag ${tagName}`, { encoding: 'utf-8', stdio: 'inherit' });
    execSync('git push', { encoding: 'utf-8', stdio: 'inherit' });
    execSync(`git push origin ${tagName}`, { encoding: 'utf-8', stdio: 'inherit' });
    success(`Release ${tagName} concluída!`);

    // Após o release, fazer merge dev → main e voltar para dev
    info('Iniciando merge dev → main...');
    const { runMergeFlow } = await import('./merge.js');
    await runMergeFlow();
  } catch (err) {
    error(`Erro na release: ${err.message}`);
  }
}