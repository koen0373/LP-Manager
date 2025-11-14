/**
 * Token Price Address Map
 * 
 * Flare chain contract → CoinGecko ID
 * Keys lowercase
 */

const byChain: Record<string, Record<string, string>> = {
  flare: {
    '0x96b41289d90444b8add57e6f265db5ae8651df29': 'tether', // USDT0
    '0xad552a648c74d49e10027ab8a618a3ad4901c5be': 'ripple', // FXRP
  },
};

export default byChain;
