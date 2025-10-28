/**
 * Deep link builders for DEX providers
 * Follows UTM schema from docs/ACCESS_POLICY.md
 */

type ProviderSlug = 'enosys' | 'blazeswap' | 'sparkdex';

interface PoolDeepLinkParams {
  providerSlug: string;
  poolId: string;
  action?: 'claim' | 'view' | 'manage';
}

const PROVIDER_URLS: Record<ProviderSlug, string> = {
  enosys: 'https://app.enosys.global',
  blazeswap: 'https://app.blazeswap.com',
  sparkdex: 'https://app.sparkdex.io',
};

function buildUTM(campaign: string, content: string): string {
  const params = new URLSearchParams({
    utm_source: 'liquilab',
    utm_medium: 'app',
    utm_campaign: campaign,
    utm_content: content,
  });
  return params.toString();
}

export function buildPoolDeepLink({ providerSlug, poolId, action = 'claim' }: PoolDeepLinkParams): string {
  const slug = providerSlug.toLowerCase().replace(/\s+v\d+$/i, '') as ProviderSlug;
  const baseUrl = PROVIDER_URLS[slug];
  
  if (!baseUrl) {
    console.warn(`[poolDeepLinks] Unknown provider: ${providerSlug}`);
    return '#';
  }

  const utmContent = `${slug}-${poolId}-${action}`;
  const utm = buildUTM('claim_flow', utmContent);

  // Provider-specific URL patterns
  switch (slug) {
    case 'enosys':
      return `${baseUrl}/pools/${poolId}?${utm}`;
    case 'blazeswap':
      return `${baseUrl}/pool/${poolId}?${utm}`;
    case 'sparkdex':
      return `${baseUrl}/liquidity/${poolId}?${utm}`;
    default:
      return `${baseUrl}?${utm}`;
  }
}

export function buildClaimLink(providerSlug: string, poolId: string): string {
  return buildPoolDeepLink({ providerSlug, poolId, action: 'claim' });
}

