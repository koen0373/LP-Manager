export const DEFAULT_ICON = '/media/icons/token-default.svg';

const SUBSCRIPT_ZERO = /\u2080/g;
const ALIAS_MAP: Record<string, string> = {
  wflr: 'flr',
  'usdc.e': 'usdce',
  usdce: 'usdce',
  usdc: 'usdce',
  usdt0: 'usd0',
  'usdt₀': 'usd0',
  joule: 'joule',
};

export function canonicalSymbol(input?: string | null): string {
  if (!input) return '';

  const normalized = input
    .normalize('NFKD')
    .toLowerCase()
    .replace(SUBSCRIPT_ZERO, '0')
    .replace(/[^a-z0-9.]/g, '');

  if (!normalized) return '';

  const alias = ALIAS_MAP[normalized];
  if (alias) return alias;

  return normalized.replace(/\./g, '');
}

export function iconCandidates(symbol?: string | null): string[] {
  const canonical = canonicalSymbol(symbol);
  if (!canonical) return [];

  return [
    `/media/tokens/${canonical}.webp`,
    `/media/tokens/${canonical}.png`,
    `/media/tokens/${canonical}.svg`,
  ];
}
