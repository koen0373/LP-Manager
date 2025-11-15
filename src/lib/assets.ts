import assetMap from '@/config/assets.json';

type AssetMap = {
  brand: {
    logo: string;
    wordmark: string;
    rangeband: string;
    reload: string;
  };
  wallets: {
    metamask: string;
    phantom: string;
    brave: string;
    rabby: string;
    okx: string;
    walletconnect: string;
    bifrost: string;
  };
  tokens: {
    default: string;
  };
};

const assets: AssetMap = assetMap;

export const BRAND_ASSETS = assets.brand;
export const WALLET_ICONS = assets.wallets;
export const TOKEN_ASSETS = assets.tokens;

export type BrandAssetKey = keyof typeof BRAND_ASSETS;
export type WalletIconKey = keyof typeof WALLET_ICONS;
export type TokenAssetKey = keyof typeof TOKEN_ASSETS;

export function getBrandAsset(key: BrandAssetKey): string {
  return BRAND_ASSETS[key];
}

export function getWalletIcon(key: WalletIconKey): string {
  return WALLET_ICONS[key];
}

export function getTokenAsset(key: TokenAssetKey): string {
  return TOKEN_ASSETS[key];
}


