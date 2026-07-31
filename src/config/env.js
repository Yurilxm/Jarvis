import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('Erro: GEMINI_API_KEY não encontrada no arquivo .env');
  console.error('Adicione: GEMINI_API_KEY=sua-chave-aqui');
  process.exit(1);
}

export { GEMINI_API_KEY };
