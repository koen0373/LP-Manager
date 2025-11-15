/**
 * Token Price Aliases
 * 
 * Canonical symbol → CoinGecko ID mapping (bundled at build time)
 */

const aliases: Record<string, string> = {
  USDT0: 'tether',
  USDCE: 'usd-coin',
  'USDC.E': 'usd-coin',
  USD0: 'tether',
  EUSDT: 'tether',
  CYFLR: 'flare-networks',
  FLR: 'flare-networks',
  WFLR: 'flare-networks',
  FXRP: 'ripple',
};

export default aliases;
