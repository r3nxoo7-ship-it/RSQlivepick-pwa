export function normalizeCompetitionName(value: string | null | undefined): string {
  if (typeof value !== 'string') return '';

  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (!normalized) return '';

  const aliases: Record<string, string> = {
    'champions league': 'champions league',
    'uefa champions league': 'champions league',
    'ucl': 'champions league',
    'europa league': 'europa league',
    'uefa europa league': 'europa league',
    'uel': 'europa league',
    'conference league': 'conference league',
    'uefa conference league': 'conference league',
    'uefa conference': 'conference league',
    'uecl': 'conference league',
    'nations league': 'nations league',
    'uefa nations league': 'nations league',
  };

  if (aliases[normalized]) return aliases[normalized];
  if (normalized.startsWith('uefa ')) {
    return normalizeCompetitionName(normalized.replace(/^uefa\s+/, ''));
  }

  return normalized;
}

export function isUEFACompetition(value: string | null | undefined): boolean {
  const normalized = normalizeCompetitionName(value);
  return ['champions league', 'europa league', 'conference league', 'nations league'].includes(normalized);
}
