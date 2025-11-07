export const FLARE_HOSTS = [
  'flare.network',
  'blog.flare.network',
  'flarescan.com',
  'enosys.global',
  'docs.enosys.global',
  'sparkdex.fi',
  'docs.sparkdex.fi',
  'blazeswap.xyz',
  'docs.blazeswap.xyz',
  'x.com',
] as const;

export type FlareHost = (typeof FLARE_HOSTS)[number];
