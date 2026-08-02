import { getJiraBaseUrl, getJiraAuthHeader } from '../config/jira.js';

function getBaseUrl() {
  return getJiraBaseUrl();
}

function getAuth() {
  return getJiraAuthHeader();
}

async function jiraRequest(endpoint, options = {}) {
  const response = await fetch(`${getBaseUrl()}${endpoint}`, {
    headers: {
      'Authorization': getAuth(),
      'Accept': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Jira API: ${response.status} — ${body.substring(0, 200)}`);
  }

  return response.json();
}

export async function listIssues(jql = 'project=SDG ORDER BY updated DESC') {
  return jiraRequest(`/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=summary,status,priority,issuetype,assignee,reporter,created,updated`);
}

export async function getIssue(issueKey) {
  return jiraRequest(`/rest/api/3/issue/${issueKey}?fields=summary,description,status,priority,issuetype,assignee,reporter,created,updated`);
}

export async function searchIssues(jql) {
  return jiraRequest(`/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=summary,status,priority,issuetype,assignee`);
}

export async function getTransitions(issueKey) {
  return jiraRequest(`/rest/api/3/issue/${issueKey}/transitions`);
}

export async function transitionIssue(issueKey, transitionId) {
  const response = await fetch(`${getBaseUrl()}/rest/api/3/issue/${issueKey}/transitions`, {
    method: 'POST',
    headers: {
      'Authorization': getAuth(),
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ transition: { id: String(transitionId) } }),
  });

  if (!response.ok && response.status !== 204) {
    const body = await response.text();
    throw new Error(`Jira API: ${response.status} — ${body.substring(0, 200)}`);
  }
}

function toADF(text) {
  if (!text) return undefined;
  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  };
}

export async function createIssue(projectId, summary, description, issueTypeId, assigneeId = null) {
  const fields = {
    project: { id: projectId },
    summary,
    issuetype: { id: issueTypeId },
  };
  if (description) {
    fields.description = toADF(description);
  }
  if (assigneeId) fields.assignee = { id: assigneeId };

  const response = await fetch(`${getBaseUrl()}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      'Authorization': getAuth(),
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok && response.status !== 201) {
    const body = await response.text();
    throw new Error(`Jira API: ${response.status} — ${body.substring(0, 200)}`);
  }

  return response.json();
}