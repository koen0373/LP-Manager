// Curated Top LP Wallets for the /demo page.
// TODO: Replace placeholder addresses with verified wallets that meet the stated pool counts
// and maintain non-zero TVL before publishing.

export type CuratedWallet = {
  address: `0x${string}`;
  providers?: Array<'ENOSYS' | 'SPARKDEX' | 'BLAZESWAP'>;
  note?: string;
};

export const WALLETS_GTE_20: CuratedWallet[] = [
  // TODO: replace with real addresses (≥20 pools tracked)
  {
    address: '0x57d294d815968f0efa722f1e8094da65402cd951',
    providers: ['ENOSYS', 'SPARKDEX'],
    note: 'Example only',
  },
  {
    address: '0x1111111111111111111111111111111111111111',
    providers: ['SPARKDEX'],
  },
  {
    address: '0x2222222222222222222222222222222222222222',
    providers: ['BLAZESWAP'],
  },
  {
    address: '0x3333333333333333333333333333333333333333',
    providers: ['ENOSYS'],
  },
  {
    address: '0x4444444444444444444444444444444444444444',
    providers: ['ENOSYS', 'BLAZESWAP'],
  },
];

export const WALLETS_GTE_50: CuratedWallet[] = [
  // TODO: replace with real addresses (≥50 pools tracked)
  {
    address: '0x5555555555555555555555555555555555555555',
    providers: ['SPARKDEX', 'ENOSYS'],
  },
  {
    address: '0x6666666666666666666666666666666666666666',
    providers: ['BLAZESWAP'],
  },
  {
    address: '0x7777777777777777777777777777777777777777',
    providers: ['ENOSYS'],
  },
  {
    address: '0x8888888888888888888888888888888888888888',
    providers: ['SPARKDEX'],
  },
  {
    address: '0x9999999999999999999999999999999999999999',
    providers: ['ENOSYS', 'BLAZESWAP'],
  },
];

export const WALLETS_GTE_100: CuratedWallet[] = [
  // TODO: replace with real addresses (≥100 pools tracked)
  {
    address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    providers: ['ENOSYS', 'SPARKDEX', 'BLAZESWAP'],
  },
  {
    address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    providers: ['SPARKDEX'],
  },
  {
    address: '0xcccccccccccccccccccccccccccccccccccccccc',
    providers: ['ENOSYS'],
  },
  {
    address: '0xdddddddddddddddddddddddddddddddddddddddd',
    providers: ['BLAZESWAP'],
  },
  {
    address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    providers: ['ENOSYS', 'SPARKDEX'],
  },
];

