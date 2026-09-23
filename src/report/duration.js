/**
 * Converte strings como "7d", "24h", "2w", "1m", "1y" em milissegundos.
 * Retorna null se o formato for inválido.
 *
 * @param {string} str
 * @returns {number|null}
 */
export function parseDuration(str) {
  if (!str) return null;
  const match = String(str).trim().match(/^(\d+)\s*([hdwmy])$/i);
  if (!match) return null;

  const num = parseInt(match[1], 10);
  if (!Number.isFinite(num) || num <= 0) return null;

  const unit = match[2].toLowerCase();
  const HOUR = 3600 * 1000;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;
  const MONTH = 30 * DAY;
  const YEAR = 365 * DAY;

  const factors = {
    h: HOUR,
    d: DAY,
    w: WEEK,
    m: MONTH,
    y: YEAR,
  };

  return num * factors[unit];
}

/**
 * Formata uma duração em ms para texto humano ("7 dias").
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const DAY = 24 * 3600 * 1000;
  const HOUR = 3600 * 1000;

  if (ms >= DAY) {
    const days = Math.round(ms / DAY);
    return `${days} dia${days !== 1 ? 's' : ''}`;
  }
  if (ms >= HOUR) {
    const hours = Math.round(ms / HOUR);
    return `${hours} hora${hours !== 1 ? 's' : ''}`;
  }
  const mins = Math.round(ms / 60000);
  return `${mins} minuto${mins !== 1 ? 's' : ''}`;
}