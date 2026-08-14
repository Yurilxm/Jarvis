import { jiraList, jiraView, jiraStatus, jiraMove, jiraCreate, jiraEdit, jiraDelete } from './flow.js';
import { error, dim } from '../ui.js';

export async function handleJiraCommand(sub, issueKey) {
  if (!sub || sub === 'list') {
    const filter = issueKey || 'active';
    await jiraList(filter);
  } else if (sub === 'view') {
    if (!issueKey) { error('Chave da issue é obrigatória.'); process.exit(1); }
    await jiraView(issueKey);
  } else if (sub === 'status') {
    if (!issueKey) { error('Chave da issue é obrigatória.'); process.exit(1); }
    await jiraStatus(issueKey);
  } else if (sub === 'move') {
    if (!issueKey) { error('Chave da issue é obrigatória.'); process.exit(1); }
    await jiraMove(issueKey);
  } else if (sub === 'create') {
    await jiraCreate();
  } else if (sub === 'edit') {
    if (!issueKey) { error('Chave da issue é obrigatória.'); process.exit(1); }
    await jiraEdit(issueKey);
  } else if (sub === 'delete') {
    if (!issueKey) { error('Chave da issue é obrigatória.'); process.exit(1); }
    await jiraDelete(issueKey);
  } else {
    error(`Subcomando desconhecido: ${sub}`);
    dim('Use: list [active|all|done], view <issue>, status <issue>, move <issue>, create, edit <issue>, delete <issue>');
    process.exit(1);
  }
}