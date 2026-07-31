import { checkbox, input, select } from '@inquirer/prompts';
import {
  getIgnoreInventory,
  addIgnorePatterns,
  removeIgnorePatterns,
  restoreDefaultPatterns,
} from '../config/ignore.js';
import { suggestIgnorePatterns } from './analyze.js';
import {
  printBanner,
  printBox,
  info,
  success,
  warn,
  error,
  dim,
  blank,
  section,
  spinner,
  chalk,
  muted,
} from '../ui.js';

/**
 * Menu interativo para gerenciar a lista de ignore.
 */
export async function runIgnoreMenu() {
  printBanner();
  printBox(
    `${muted('Gerencie o que o Jarvis ignora na IA e no git add.')}\n` +
    `${muted('Arquivo:')} ${chalk.green('.jarvisignore')}`,
    { title: 'ignore' }
  );

  while (true) {
    const action = await select({
      message: 'O que deseja fazer?',
      choices: [
        { name: 'Ver lista atual', value: 'list' },
        { name: 'Adicionar padrão', value: 'add' },
        { name: 'Remover padrão', value: 'remove' },
        { name: 'Sugerir com IA', value: 'suggest' },
        { name: 'Reativar defaults desligados', value: 'restore' },
        { name: 'Sair', value: 'exit' },
      ],
    });

    if (action === 'exit') {
      info('Saindo do menu de ignore.');
      break;
    }

    if (action === 'list') {
      showIgnoreList();
      continue;
    }

    if (action === 'add') {
      await addPatternFlow();
      continue;
    }

    if (action === 'remove') {
      await removePatternFlow();
      continue;
    }

    if (action === 'suggest') {
      await suggestFlow();
      continue;
    }

    if (action === 'restore') {
      await restoreFlow();
    }
  }
}

function showIgnoreList() {
  const { activeDefaults, inactiveDefaults, custom } = getIgnoreInventory();

  section('Defaults ativos');
  if (activeDefaults.length === 0) {
    dim('  (nenhum)');
  } else {
    for (const pattern of activeDefaults) {
      console.log(`  ${chalk.cyan('●')} ${pattern}`);
    }
  }

  if (inactiveDefaults.length > 0) {
    section('Defaults desativados');
    for (const pattern of inactiveDefaults) {
      console.log(`  ${muted('○')} ${pattern}`);
    }
  }

  section('Padrões do projeto (.jarvisignore)');
  if (custom.length === 0) {
    dim('  (nenhum ainda — use Adicionar ou Sugerir com IA)');
  } else {
    for (const pattern of custom) {
      console.log(`  ${chalk.green('+')} ${pattern}`);
    }
  }

  blank();
}

async function addPatternFlow() {
  const pattern = await input({
    message: 'Novo padrão (ex: dist/, *.local, config/private/**):',
    validate: (value) => {
      const v = value.trim();
      if (!v) return 'Digite um padrão';
      if (v.startsWith('# @disable')) return 'Use o menu Remover/Reativar para defaults';
      return true;
    },
  });

  const added = addIgnorePatterns([pattern]);
  if (added.length === 0) {
    info('Esse padrão já estava na lista (ou é um default ativo).');
  } else {
    success(`Adicionado: ${added.join(', ')}`);
  }
  blank();
}

async function removePatternFlow() {
  const { activeDefaults, custom } = getIgnoreInventory();
  const choices = [
    ...custom.map((p) => ({
      name: `${p} ${muted('(projeto)')}`,
      value: p,
    })),
    ...activeDefaults.map((p) => ({
      name: `${p} ${muted('(default)')}`,
      value: p,
    })),
  ];

  if (choices.length === 0) {
    info('Lista vazia — nada para remover.');
    return;
  }

  const selected = await checkbox({
    message: 'Selecione o que remover (espaço marca, enter confirma):',
    choices,
  });

  if (selected.length === 0) {
    info('Nada selecionado.');
    return;
  }

  const { removedCustom, disabledDefaults } = removeIgnorePatterns(selected);

  if (removedCustom.length > 0) {
    success(`Removidos do projeto: ${removedCustom.join(', ')}`);
  }
  if (disabledDefaults.length > 0) {
    warn(`Defaults desativados: ${disabledDefaults.join(', ')}`);
    dim('Você pode reativá-los pelo menu.');
  }
  blank();
}

async function suggestFlow() {
  const spin = spinner('Analisando arquivos do projeto com IA...');
  spin.start();

  let suggestions;
  try {
    suggestions = await suggestIgnorePatterns();
    spin.succeed('Análise concluída.');
  } catch (err) {
    spin.fail(`Falha na análise: ${err.message}`);
    return;
  }

  if (suggestions.length === 0) {
    info('A IA não sugeriu padrões novos (ou a lista já cobre o projeto).');
    return;
  }

  const selected = await checkbox({
    message: 'Sugestões da IA — marque as que deseja adicionar:',
    choices: suggestions.map((p) => ({ name: p, value: p, checked: true })),
  });

  if (selected.length === 0) {
    info('Nenhuma sugestão adicionada.');
    return;
  }

  const added = addIgnorePatterns(selected);
  if (added.length === 0) {
    info('Nada novo para adicionar.');
  } else {
    success(`Adicionados (${added.length}):`);
    for (const pattern of added) {
      console.log(`  ${chalk.green('+')} ${pattern}`);
    }
  }
  blank();
}

async function restoreFlow() {
  const { inactiveDefaults } = getIgnoreInventory();

  if (inactiveDefaults.length === 0) {
    info('Nenhum default desativado.');
    return;
  }

  const selected = await checkbox({
    message: 'Selecione defaults para reativar:',
    choices: inactiveDefaults.map((p) => ({ name: p, value: p })),
  });

  if (selected.length === 0) {
    info('Nada selecionado.');
    return;
  }

  const restored = restoreDefaultPatterns(selected);
  success(`Reativados: ${restored.join(', ')}`);
  blank();
}
