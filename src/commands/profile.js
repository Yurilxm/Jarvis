import { loadProfile, saveProfile, deleteProfile } from '../config/profile.js';
import { fetchGitHubUser } from '../github/user.js';
import { GITHUB_TOKEN } from '../config/env.js';
import { confirm, input } from '@inquirer/prompts';
import { execSync } from 'node:child_process';
import {
  printBanner,
  printBox,
  info,
  success,
  warn,
  error,
  dim,
  blank,
  spinner,
  chalk,
  accent,
  muted,
} from '../ui.js';

export async function handleProfileCommand(sub) {
  if (!sub || sub === 'show') {
    showProfile();
  } else if (sub === 'setup') {
    await setupProfile();
  } else if (sub === 'sync') {
    await syncProfile();
  } else if (sub === 'edit') {
    await editProfile();
  } else if (sub === 'reset') {
    await resetProfile();
  } else {
    error(`Subcomando desconhecido: ${sub}`);
    dim('Use: setup, show, sync, edit, reset');
    process.exit(1);
  }
}

function showProfile() {
  const profile = loadProfile();

  if (!profile) {
    info('Nenhum perfil configurado.');
    dim('Execute: jarvis profile setup');
    return;
  }

  blank();
  const body = [
    `${chalk.bold('Nome')}      ${profile.name || muted('não configurado')}`,
    `${chalk.bold('GitHub')}    ${profile.githubUsername ? accent('@' + profile.githubUsername) : muted('não configurado')}`,
    `${chalk.bold('Assinatura')} ${profile.signatureEnabled ? chalk.green('ativada') : muted('desativada')}`,
    `${chalk.bold('Origem')}    ${profile.source || 'manual'}`,
    `${chalk.bold('Atualizado')} ${profile.updatedAt ? new Date(profile.updatedAt).toLocaleString('pt-BR') : '-'}`,
  ].join('\n');

  printBox(body, { title: 'perfil do jarvis' });
  blank();
}

export async function setupProfile() {
  printBanner();
  info('Configuração do perfil do Jarvis');

  let name = null;
  let githubUsername = null;
  let source = 'manual';

  if (GITHUB_TOKEN) {
    const spin = spinner('Procurando informações do desenvolvedor...');
    spin.start();
    try {
      const ghUser = await fetchGitHubUser();
      spin.succeed('Usuário encontrado no GitHub');
      name = ghUser.name;
      githubUsername = ghUser.githubUsername;
      source = 'github';

      blank();
      printBox(
        `${chalk.bold('Nome')}      ${name}\n${chalk.bold('GitHub')}    ${accent('@' + githubUsername)}`,
        { title: 'dados do github' }
      );

      const useGitHub = await confirm({
        message: 'Deseja usar essas informações?',
        default: true,
      });

      if (!useGitHub) {
        name = null;
        githubUsername = null;
        source = 'manual';
      }
    } catch (err) {
      spin.fail('Não foi possível acessar a conta do GitHub.');
      dim('Verifique seu GITHUB_TOKEN e conexão com a internet.');
    }
  }

  if (!name) {
    info('Tentando usar a configuração do Git...');
    try {
      const gitName = execSync('git config user.name', { encoding: 'utf-8' }).trim();
      const gitEmail = execSync('git config user.email', { encoding: 'utf-8' }).trim();

      if (gitName) {
        blank();
        printBox(
          `${chalk.bold('Nome')}      ${gitName}\n${chalk.bold('Email')}    ${gitEmail}`,
          { title: 'dados do git' }
        );

        const useGit = await confirm({
          message: 'Deseja usar essas informações?',
          default: true,
        });

        if (useGit) {
          name = gitName;
          source = 'git';
        }
      }
    } catch {
      // git config falhou
    }
  }

  if (!name) {
    warn('Não foi possível identificar o desenvolvedor automaticamente.');
    blank();

    name = await input({
      message: 'Informe seu nome:',
      validate: (v) => v.trim().length > 0 ? true : 'Nome é obrigatório.',
    });

    githubUsername = await input({
      message: 'Informe seu usuário do GitHub (opcional):',
    });
  }

  if (!githubUsername) {
    githubUsername = await input({
      message: 'Informe seu usuário do GitHub (ex: Yurilxm):',
      default: githubUsername || '',
    });
  }

  const profile = {
    name: name.trim(),
    githubUsername: githubUsername.trim() || null,
    signatureEnabled: true,
    source,
  };

  saveProfile(profile);
  success('Perfil salvo com sucesso!');
  showProfile();
}

async function syncProfile() {
  if (!GITHUB_TOKEN) {
    error('GITHUB_TOKEN não configurado. Não é possível sincronizar.');
    return;
  }

  const currentProfile = loadProfile();
  info('Sincronizando perfil com o GitHub...');

  try {
    const ghUser = await fetchGitHubUser();
    const profile = {
      ...(currentProfile || {}),
      name: ghUser.name,
      githubUsername: ghUser.githubUsername,
      source: 'github',
    };
    saveProfile(profile);
    success('Perfil atualizado!');
    showProfile();
  } catch (err) {
    warn('Não foi possível sincronizar com o GitHub.');
    if (currentProfile) {
      dim('O perfil local atual será mantido.');
    }
  }
}

async function editProfile() {
  const current = loadProfile() || {};

  blank();
  const name = await input({
    message: 'Nome:',
    default: current.name || '',
  });

  const githubUsername = await input({
    message: 'GitHub username:',
    default: current.githubUsername || '',
  });

  const sigEnabled = await confirm({
    message: 'Assinatura ativada?',
    default: current.signatureEnabled !== false,
  });

  const profile = {
    ...current,
    name: name.trim(),
    githubUsername: githubUsername.trim() || null,
    signatureEnabled: sigEnabled,
    source: current.source || 'manual',
  };

  saveProfile(profile);
  success('Perfil atualizado!');
  showProfile();
}

async function resetProfile() {
  const current = loadProfile();
  if (!current) {
    info('Nenhum perfil para remover.');
    return;
  }

  warn('Isso removerá o perfil local do Jarvis.');

  const confirmed = await confirm({
    message: 'Deseja continuar?',
    default: false,
  });

  if (!confirmed) {
    info('Cancelado.');
    return;
  }

  deleteProfile();
  success('Perfil removido.');
}