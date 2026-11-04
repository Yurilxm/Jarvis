/**
 * Saudacoes adaptativas por hora do dia.
 *
 * Cada periodo tem um pool de variacoes. A escolha e' sequencial
 * (nunca repete o mesmo indice duas vezes seguidas) pra dar variedade
 * sem parecer aleatorio demais.
 */

/**
 * Retorna o periodo do dia.
 *
 * @param {Date} [date]
 * @returns {"morning" | "afternoon" | "night"}
 */
export function timePeriod(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 18) return "afternoon";
  return "night";
}

/**
 * Compat: versao antiga que devolvia o texto direto.
 *
 * @param {Date} [date]
 * @returns {"Bom dia" | "Boa tarde" | "Boa noite"}
 */
export function timeBasedGreeting(date = new Date()) {
  const p = timePeriod(date);
  if (p === "morning") return "Bom dia";
  if (p === "afternoon") return "Boa tarde";
  return "Boa noite";
}

/**
 * Variacoes por periodo. {name} e' substituido pelo nome do dono.
 */
export const GREETING_VARIATIONS = {
  morning: [
    "Bom dia, {name}",
    "Bom dia, {name}. O que precisa?",
    "Oi, {name}. Estou aqui.",
    "Bom dia, {name}. Em que posso ajudar?",
    "{name}, o que vai querer hoje?",
  ],
  afternoon: [
    "Boa tarde, {name}",
    "Boa tarde, {name}. O que precisa?",
    "Oi, {name}. Estou aqui.",
    "Boa tarde, {name}. Em que posso ajudar?",
    "{name}, o que vai querer hoje?",
  ],
  night: [
    "Boa noite, {name}",
    "Boa noite, {name}. O que precisa?",
    "Oi, {name}. Estou aqui.",
    "Boa noite, {name}. Em que posso ajudar?",
    "{name}, o que vai querer hoje?",
  ],
};

/**
 * Estado interno do modulo: ultimo indice escolhido, por periodo.
 * @type {Record<string, number>}
 */
const lastIndexByPeriod = {
  morning: -1,
  afternoon: -1,
  night: -1,
};

/**
 * Aplica o nome no template.
 *
 * @param {string} template
 * @param {string|null} name
 * @returns {string}
 */
function applyName(template, name) {
  if (!name) {
    // Sem nome: versao enxuta, sem virgula dupla nem " , "
    return template
      .replace("Bom dia, {name}", "Bom dia")
      .replace("Boa tarde, {name}", "Boa tarde")
      .replace("Boa noite, {name}", "Boa noite")
      .replace(", {name}.", ".")
      .replace("Oi, {name}. Estou aqui.", "Oi, estou aqui.")
      .replace("{name}, o que vai querer hoje?", "O que vai querer hoje?")
      .replace("{name}", "")
      .replace(/\\s+/g, " ")
      .trim();
  }
  return template.replace("{name}", name);
}

/**
 * Monta o greeting final. Respeita `custom` se passado.
 *
 * @param {{ name?: string|null, custom?: string, date?: Date }} [opts]
 * @returns {string}
 */
export function buildGreeting(opts = {}) {
  if (opts.custom) return opts.custom;

  const period = timePeriod(opts.date);
  const list = GREETING_VARIATIONS[period];
  if (!list || list.length === 0) return timeBasedGreeting(opts.date);

  let idx;
  do {
    idx = Math.floor(Math.random() * list.length);
  } while (list.length > 1 && idx === lastIndexByPeriod[period]);

  lastIndexByPeriod[period] = idx;
  return applyName(list[idx], opts.name || null);
}

/**
 * Reseta o estado interno (util em testes).
 */
export function _resetGreetingState() {
  lastIndexByPeriod.morning = -1;
  lastIndexByPeriod.afternoon = -1;
  lastIndexByPeriod.night = -1;
}
