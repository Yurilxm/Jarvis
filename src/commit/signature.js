/**
 * Monta a string de assinatura para o corpo do commit.
 * @param {object} profile
 * @returns {string|null}
 */
export function buildSignature(profile) {
  if (!profile || !profile.signatureEnabled) return null;

  const parts = [];

  if (profile.name && profile.githubUsername) {
    parts.push(`Assinado por: ${profile.name} (@${profile.githubUsername})`);
  } else if (profile.name) {
    parts.push(`Assinado por: ${profile.name}`);
  } else if (profile.githubUsername) {
    parts.push(`Assinado por: @${profile.githubUsername}`);
  }

  return parts.length > 0 ? parts[0] : null;
}