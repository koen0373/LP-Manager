const TUGRIK = /\u20AE/g;
const DIACRITICS = /[\u0300-\u036f]/g;
const NON_ALNUM_DOT = /[^A-Za-z0-9.]/g;
const WHITESPACE = /\s+/g;

export function canonicalizeSymbol(sym: string): string {
  if (!sym) return '';
  const normalized = sym.normalize('NFKD').replace(TUGRIK, 'T');
  const withoutDiacritics = normalized.replace(DIACRITICS, '');
  const collapsed = withoutDiacritics.replace(WHITESPACE, '');
  const cleaned = collapsed.replace(NON_ALNUM_DOT, '');
  if (!cleaned) return '';
  return cleaned;
}

export function intelSynonyms(sym: string): string[] {
  const canonical = canonicalizeSymbol(sym);
  const upper = canonical.toUpperCase();
  switch (upper) {
    case 'WFLR':
      return ['WFLR', 'Wrapped FLR', 'FLR'];
    case 'SFLR':
      return ['sFLR', 'Staked FLR', 'FLR staking'];
    case 'FXRP':
      return ['FXRP', 'XRP on Flare', 'XRP'];
    case 'USDT0':
      return ['USDT0', 'USDT.e', 'USDT', 'Tether'];
    case 'USDT.E':
    case 'USDTE':
      return ['USDT.e', 'USDT0', 'USDT', 'Tether'];
    default:
      return canonical ? [canonical] : [];
  }
}

export function buildIntelTerms(tokens: string[], chain = 'Flare'): string[] {
  const terms = new Set<string>();
  const cleanedTokens = tokens
    .map((token) => canonicalizeSymbol(token))
    .filter(Boolean);

  if (cleanedTokens.length >= 2) {
    terms.add(`${cleanedTokens[0]}-${cleanedTokens[1]}`);
  }

  cleanedTokens.forEach((token) => {
    intelSynonyms(token).forEach((syn) => terms.add(syn));
  });

  const ecosystemHints = [
    chain,
    chain.toLowerCase(),
    'Flare',
    'SparkDEX',
    'Ēnosys',
    'Enosys',
    'BlazeSwap',
    'Uniswap v3 on Flare',
  ];

  ecosystemHints.forEach((hint) => {
    if (hint) terms.add(hint);
  });

  return Array.from(terms);
}

export type IntelTermsOptions = {
  tokens: string[];
  chain?: string;
};
