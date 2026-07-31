#!/usr/bin/env node

import { runCommitFlow } from './commit/flow.js';

const command = process.argv[2];

if (command === 'commit') {
  runCommitFlow();
} else {
  console.log('Jarvis v1 — Assistente de Commit');
  console.log('');
  console.log('Uso:');
  console.log('  jarvis commit    Gera mensagem de commit com IA e auxilia no commit/push');
  console.log('');
  console.log('Execute dentro de um repositório Git.');
}