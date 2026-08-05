import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { confirm, input, select } from '@inquirer/prompts';
import {
  printBanner,
  info,
  success,
  warn,
  error,
  dim,
  blank,
  accent,
  chalk,
} from '../ui.js';

export async function runRelease() {
  printBanner();
  info('Preparando nova release...\n');

  const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const current = pkg.version;
  info(`Versão atual: ${accent(current)}`);

  const bump = await select({
    message: 'Tipo de versão:',
    choices: [
      { name: `patch  (${semverBump(current, 'patch')})  — correção de bug`, value: 'patch' },
      { name: `minor  (${semverBump(current, 'minor')})  — nova funcionalidade`, value: 'minor' },
      { name: `major  (${semverBump(current, 'major')})  — mudança incompatível`, value: 'major' },
      { name: 'personalizado', value: 'custom' },
      { name: 'Cancelar', value: 'cancel' },
    ],
  });

  if (bump === 'cancel') {
    info('Release cancelada.');
    return;
  }

  let newVersion;
  if (bump === 'custom') {
    newVersion = await input({
      message: 'Informe a nova versão:',
      validate: (v) => /^\d+\.\d+\.\d+$/.test(v) ? true : 'Formato inválido. Use: X.Y.Z',
    });
  } else {
    newVersion = semverBump(current, bump);
  }

  const tagName = `v${newVersion}`;
  blank();
  warn(`Versão atual:  ${current}`);
  info(`Nova versão:   ${chalk.green(newVersion)}`);
  info(`Tag:           ${chalk.green(tagName)}`);

  const confirmed = await confirm({
    message: 'Criar release?',
    default: false,
  });

  if (!confirmed) {
    info('Release cancelada.');
    return;
  }

  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  success('package.json atualizado.');

  try {
    execSync(`git add package.json`, { encoding: 'utf-8', stdio: 'inherit' });
    execSync(`git commit -m "chore: bump version to ${tagName}"`, { encoding: 'utf-8', stdio: 'inherit' });
    success('Commit criado.');
  } catch (err) {
    error(`Erro ao criar commit: ${err.message}`);
    process.exit(1);
  }

  try {
    execSync(`git tag ${tagName}`, { encoding: 'utf-8', stdio: 'inherit' });
    success(`Tag ${tagName} criada.`);
  } catch (err) {
    error(`Erro ao criar tag: ${err.message}`);
    process.exit(1);
  }

  const shouldPush = await confirm({
    message: 'Fazer push do commit e da tag?',
    default: true,
  });

  if (shouldPush) {
    try {
      execSync('git push', { encoding: 'utf-8', stdio: 'inherit' });
      execSync(`git push origin ${tagName}`, { encoding: 'utf-8', stdio: 'inherit' });
      success('Push realizado com sucesso!');
    } catch (err) {
      error(`Erro ao fazer push: ${err.message}`);
      dim('O commit e a tag foram criados localmente.');
      process.exit(1);
    }
  } else {
    dim('Push não realizado. Execute git push e git push origin tag manualmente.');
  }
}

export function semverBump(version, bump) {
  const parts = version.split('.').map(Number);
  if (bump === 'patch') { parts[2]++; parts[1] = parts[1] || 0; parts[0] = parts[0] || 0; }
  if (bump === 'minor') { parts[1]++; parts[2] = 0; }
  if (bump === 'major') { parts[0]++; parts[1] = 0; parts[2] = 0; }
  return parts.join('.');
}