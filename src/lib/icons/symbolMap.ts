import { TOKEN_ASSETS } from '@/lib/assets';

export const DEFAULT_ICON = TOKEN_ASSETS.default;

const SUBSCRIPT_ZERO = /\u2080/g;
const ALIAS_MAP: Record<string, string> = {
  wflr: 'flr',
  'usdc.e': 'usdce',
  usdce: 'usdce',
  usdc: 'usdce',
  usdt0: 'usd0',
  'usdt₀': 'usd0',
  xusd: 'usd0',
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
  const result = alias || normalized.replace(/\./g, '');
  
  return result.toUpperCase().replace(/[^A-Z0-9]/g, '');
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
