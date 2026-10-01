/**
 * Lista de variantes foneticas de "jarvis" que o Vosk (modelo PT)
 * pode produzir. Espelha a lista em scripts/vosk_stream.py.
 *
 * Manter em sincronia: se adicionar/remover aqui, ajuste la tambem.
 */
export const WAKE_VARIANTS = [
  "jarvis",
  "jarvi",
  "jarvisk",
  "jervis",
  "jervi",
  "jarvs",
  "jarves",
  "jarvez",
  "jarviz",
  "jarwis",
  "jarvys",
  "jardis",
  "jardi",
  "jardim",
  "jardins",
  "jarbas",
];

/**
 * Remove acentos e coloca em minusculas.
 * Funcao pura — testavel.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Verifica se o texto contem alguma variante da wake word como palavra.
 * Usa match de palavra completa para evitar falsos positivos.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function isWakeWordMatch(text) {
  if (!text) return false;
  const norm = normalizeText(text);
  for (const variant of WAKE_VARIANTS) {
    const re = new RegExp(`\\b${variant}\\b`);
    if (re.test(norm)) return true;
  }
  return false;
}

/**
 * Retorna a variante da wake word encontrada (ou null).
 *
 * @param {string} text
 * @returns {string|null}
 */
export function findWakeWordInText(text) {
  if (!text) return null;
  const norm = normalizeText(text);
  for (const variant of WAKE_VARIANTS) {
    const re = new RegExp(`\\b${variant}\\b`);
    if (re.test(norm)) return variant;
  }
  return null;
}
