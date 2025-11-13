import { iconCandidates, DEFAULT_ICON } from './symbolMap';

export const DEXS_HOST = 'static.dexscreener.com';

const DEFAULT_CHAIN_SLUG = 'flare';
const CHAIN_SLUG_MAP: Record<string, string> = {
  flare: 'flare',
  songbird: 'songbird',
  coston: 'coston',
  coston2: 'coston2',
};

function normalizeAddress(address?: string | null): string | null {
  if (!address) return null;
  const lower = address.toLowerCase();
  return lower.startsWith('0x') ? lower : null;
}

export function resolveChainSlug(chain?: string | null): string {
  if (!chain) return DEFAULT_CHAIN_SLUG;
  const key = chain.trim().toLowerCase();
  return CHAIN_SLUG_MAP[key] ?? DEFAULT_CHAIN_SLUG;
}

function buildRemoteIconUrls(address?: string | null, chain?: string | null): string[] {
  const normalizedAddress = normalizeAddress(address);
  if (!normalizedAddress) return [];

  const primarySlug = resolveChainSlug(chain);
  const slugs = Array.from(new Set([primarySlug, DEFAULT_CHAIN_SLUG]));

  return slugs.map((slug) => `https://${DEXS_HOST}/token-icons/${slug}/${normalizedAddress}.png`);
}

export function buildTokenIconUrls(opts: {
  symbol?: string | null;
  address?: string | null;
  chain?: string | null;
}): string[] {
  const localSources = iconCandidates(opts.symbol);
  const remoteSources = buildRemoteIconUrls(opts.address, opts.chain);
  return [...localSources, ...remoteSources, DEFAULT_ICON];
}

const HTTP_PATTERN = /^https?:\/\//i;

export function isRemoteIcon(source: string): boolean {
  return HTTP_PATTERN.test(source);
}
