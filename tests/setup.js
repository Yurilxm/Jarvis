/**
 * Setup global dos testes — evita process.exit do env.js / github client.
 */
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-gemini-key-for-jest';
process.env.GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
process.env.GITHUB_TOKEN = process.env.GITHUB_TOKEN || 'gho_test_token_for_jest_123456789012';
process.env.JIRA_DOMAIN = process.env.JIRA_DOMAIN || 'example.atlassian.net';
process.env.JIRA_EMAIL = process.env.JIRA_EMAIL || 'dev@example.com';
process.env.JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || 'jira-test-token';
process.env.GEMINI_DAILY_LIMIT = process.env.GEMINI_DAILY_LIMIT || '20';
process.env.GEMINI_WARNING_THRESHOLD = process.env.GEMINI_WARNING_THRESHOLD || '15';
