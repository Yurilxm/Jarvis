/**
 * Saudacoes adaptativas por hora do dia.
 *
 * @param {Date} [date]
 * @returns {"Bom dia" | "Boa tarde" | "Boa noite"}
 */
export function timeBasedGreeting(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * Monta a frase de greeting completa.
 *
 * @param {{ name?: string, custom?: string }} [opts]
 * @returns {string}
 */
export function buildGreeting(opts = {}) {
  if (opts.custom) return opts.custom;
  const part = timeBasedGreeting();
  return opts.name ? part + ", " + opts.name : part;
}
