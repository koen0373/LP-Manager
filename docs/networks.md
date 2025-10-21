# Network Configuration

This document contains the network configuration and contract addresses used by the Enosys LP Manager.

## Flare Network

### Network Details
- **Name**: Flare
- **Chain ID**: `0xe` (14 in decimal)
- **RPC URL**: `https://flare.flr.finance/ext/bc/C/rpc` (Enosys reference endpoint)
- **Block Explorer**: `https://flare.space`
- **Native Currency**: FLR (18 decimals)

### MetaMask/WalletConnect Configuration

When adding the Flare network to MetaMask or other wallet applications, use these settings:

```json
{
  "chainId": "0xe",
  "chainName": "Flare",
  "nativeCurrency": {
    "name": "Flare",
    "symbol": "FLR",
    "decimals": 18
  },
  "rpcUrls": ["https://flare.flr.finance/ext/bc/C/rpc"],
  "blockExplorerUrls": ["https://flare.space"]
}
```

### Core Contract Addresses

#### Position Manager
- **NonfungiblePositionManager**: `0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657`

#### Factory
- **UniswapV3Factory**: `0x17AA157AC8C54034381b840Cb8f6bf7Fc355f0de`

### Token Addresses

#### Flare Native Tokens
- **WFLR** (Wrapped Flare): `0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d`
- **FLR** (Flare): Native token
- **SFLR** (Songbird Flare): `0x5f0155d08eF4aae75358508044C8e8b12345e280`

#### Stablecoins
- **USD₮0** (USD Tether): `0xe7cd86e13AC4309349F30B3435a9d337750fC82D`
- **USDC**: `0x1f573d6fb3f13d689ff844b4ce37794d79a7ff1c`
- **USDT**: `0xdac17f958d2ee523a2206206994597c13d831ec7`
- **DAI**: `0x6b175474e89094c44da98b954eedeac495271d0f`

#### Other Tokens
- **FXRP** (Flare XRP): `0xAd552A648C74D49E10027AB8a618A3ad4901c5bE`
- **eETH** (Ethereum): `0x0000000000000000000000000000000000000000` (placeholder)
- **eQNT** (Equilibria): `0x0000000000000000000000000000000000000000` (placeholder)
- **eUSDT** (Ethereum USDT): `0x0000000000000000000000000000000000000000` (placeholder)
- **HLN** (Holon): `0x0000000000000000000000000000000000000000` (placeholder)
- **APS** (Apollo): `0x0000000000000000000000000000000000000000` (placeholder)
- **BNZ** (Binance): `0x0000000000000000000000000000000000000000` (placeholder)

### Pool Addresses

#### FXRP/USD₮0 Pool
- **Address**: `0x686f53F0950Ef193C887527eC027E6A574A4DbE1`
- **Fee Tier**: 3000 (0.3%)
- **Token0**: FXRP (`0xAd552A648C74D49E10027AB8a618A3ad4901c5bE`)
- **Token1**: USD₮0 (`0xe7cd86e13AC4309349F30B3435a9d337750fC82D`)

#### WFLR/USD₮0 Pool
- **Address**: `0x3C2a7B76795E58829FAAa034486D417dd0155162`
- **Fee Tier**: 3000 (0.3%)
- **Token0**: WFLR (`0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d`)
- **Token1**: USD₮0 (`0xe7cd86e13AC4309349F30B3435a9d337750fC82D`)

## Development Notes

### RPC Endpoint
The application uses the Enosys reference RPC endpoint (`https://flare.flr.finance/ext/bc/C/rpc`) instead of the generic Flare API endpoint for better reliability and consistency with the Enosys platform.

### Token Price Sources
- Hardcoded prices for known tokens in `src/services/tokenPrices.ts`
- Fallback to CoinGecko API for additional tokens
- Cache TTL: 30 seconds

### Stable Token Recognition
The following tokens are recognized as stablecoins for price calculation purposes:
- USDT, USDT0, USDTO, USDC, USDCG, USD0, USDX, DAI, DAI0, USD₮0, EUSDT

### Pool Ratio Fallback
When calculating position values, the system uses Uniswap V3 pool ratios (`sqrtPriceX96`) for more accurate pricing, falling back to external price feeds only when necessary.

## Troubleshooting

### Common Issues
1. **Network Connection**: Ensure you're connected to the Flare network (Chain ID: 0xe)
2. **RPC Endpoint**: If experiencing connection issues, verify the RPC endpoint is accessible
3. **Token Prices**: Check the hardcoded prices in `tokenPrices.ts` for accuracy
4. **Pool Addresses**: Verify pool addresses match the current deployment

### Support
For technical support or questions about network configuration, please refer to the main project documentation or contact the development team.
