import fs from 'node:fs';
import path from 'node:path';
import { getProjectConfig } from '../config/project.js';
import { confirm, input, select } from '@inquirer/prompts';
import {
  printBanner,
  printBox,
  info,
  success,
  warn,
  error,
  dim,
  blank,
  chalk,
  accent,
  muted,
} from '../ui.js';

export async function runConfig() {
  printBanner();
  info('Configuração do projeto\n');

  const cwd = process.cwd();
  const configPath = path.join(cwd, '.jarvis-dev.json');

  // Carregar config existente
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {
      // inválido, começar vazio
    }
  }

  // Garantir estrutura mínima
  config.jira = config.jira || {};
  config.git = config.git || {};

  while (true) {
    const currentJira = [
      `${chalk.bold('projectKey')}  ${config.jira.projectKey || muted('não configurado')}`,
      `${chalk.bold('projectId')}  ${config.jira.projectId || muted('não configurado')}`,
      `${chalk.bold('issueType')}  ${config.jira.issueType || muted('não configurado')}`,
    ].join('\n');

    const currentGit = [
      `${chalk.bold('protectedBranch')}      ${config.git.protectedBranch || muted('não configurado')}`,
      `${chalk.bold('developmentBranch')}    ${config.git.developmentBranch || muted('não configurado')}`,
    ].join('\n');

    blank();
    printBox(currentJira, { title: 'jira' });
    printBox(currentGit, { title: 'git' });

    const action = await select({
      message: 'O que deseja configurar?',
      choices: [
        { name: 'Jira — projectKey', value: 'jira.projectKey' },
        { name: 'Jira — projectId', value: 'jira.projectId' },
        { name: 'Jira — issueType', value: 'jira.issueType' },
        { name: 'Git — branch protegida', value: 'git.protectedBranch' },
        { name: 'Git — branch de desenvolvimento', value: 'git.developmentBranch' },
        { name: 'Salvar e sair', value: 'save' },
        { name: 'Sair sem salvar', value: 'exit' },
      ],
    });

    if (action === 'exit') {
      info('Configuração cancelada.');
      return;
    }

    if (action === 'save') {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
      success('.jarvis-dev.json salvo com sucesso!');
      blank();
      dim('Este arquivo pode ser commitado no Git (não contém dados sensíveis).');
      return;
    }

    // Editar campo
    const [section, key] = action.split('.');
    const currentValue = config[section][key] || '';

    const newValue = await input({
      message: `${action}:`,
      default: currentValue,
    });

    config[section][key] = newValue.trim() || undefined;
    if (!newValue.trim()) delete config[section][key];
  }
}