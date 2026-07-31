import dotenv from 'dotenv';
import chalk from 'chalk';
import logSymbols from 'log-symbols';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// __dirname aqui é .../jarvis/src/config
// o .env fica em .../jarvis/.env → sobe dois níveis
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

if (!GEMINI_API_KEY) {
  console.error(chalk.red(`${logSymbols.error} GEMINI_API_KEY não encontrada no arquivo .env`));
  console.error(chalk.dim('Adicione: GEMINI_API_KEY=sua-chave-aqui'));
  process.exit(1);
}

export { GEMINI_API_KEY, GEMINI_MODEL };