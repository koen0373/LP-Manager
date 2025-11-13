// Stub: Dexscreener integration removed; local-only icons enforced.
// This file is kept for backwards compatibility but exports no-op functions.

export function resolveChainSlug(chain?: string | null): string {
  return 'flare';
}

export function buildTokenIconUrls(_opts: {
  symbol?: string | null;
  address?: string | null;
  chain?: string | null;
}): string[] {
  return [];
}

export function isRemoteIcon(_source: string): boolean {
  return false;
}

export function iconUrlForToken(_symbol?: string | null, _address?: string | null): string | null {
  return null;
}
