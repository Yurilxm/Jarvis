import { Octokit } from 'octokit';
import { getGitHubToken } from '../config/github.js';

const token = getGitHubToken();

export const octokit = new Octokit({ auth: token });