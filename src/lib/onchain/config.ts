/**
 * On-chain configuration for Flare/Enosys
 * Central source of truth for all blockchain addresses and settings
 */

export const FLARE_CHAIN_ID = 14;

// RPC Endpoints (ordered by priority)
export const RPC_ENDPOINTS = [
  'https://flare.flr.finance/ext/bc/C/rpc',
  'https://flare.public-rpc.com',
  'https://rpc-enosys.flare.network',
  'https://1rpc.io/flare',
] as const;

// Enosys Contract Addresses
export const ENOSYS_ADDRESSES = {
  POSITION_MANAGER: '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657' as `0x${string}`,
  FACTORY: '0x17AA157AC8C54034381b840Cb8f6bf7Fc355f0de' as `0x${string}`,
  ROUTER: '0xEE4F91f34E649F0eC8D7Aa0e96D22D50C9D3e06D' as `0x${string}`,
  QUOTER: '0x86c9A5E69d12e7586C3b25a68BA3c9B7F8c8e6e3' as `0x${string}`,
  // Incentive contracts (rewards)
  RFLR_INCENTIVES: '0xCae8c9e1ccE365fdFebE5Ec1F68C3088a6c70E66' as `0x${string}`,
  APS_INCENTIVES: '0xcF93d54E7Fea895375667Fa071d5b48C81E76d7d' as `0x${string}`,
} as const;

// Known token addresses on Flare
export const TOKEN_ADDRESSES = {
  WFLR: '0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d' as `0x${string}`,
  RFLR: '0xffA188493C15DfAf2C206c97D8633377847b6a52' as `0x${string}`,
  APS: '0xfF56Eb5b1a7FAa972291117E5E9565dA29bc808d' as `0x${string}`,
  EUSDT: '0x96B41289D90444B8adD57e6F265DB5aE8651DF29' as `0x${string}`,
  EETH: '0xdbCA67eaFE5fC5CDB83EC5EF1E0e7E0D7e40A06c' as `0x${string}`,
  FXRP: '0xE63BE3d402f2a65D0Ea4880FCd1c1A5d2eb821b3' as `0x${string}`,
  USD0: '0xb2aefb8b9f7e0e8a04e5cc49e50da6fa97a2a69b' as `0x${string}`,
  USDX: '0x4b64e7793C1912af8DD38F04095699Ddc48D5857' as `0x${string}`,
  USDCSG: '0x3c90b1C0b56e4dC10bdE9c01d8004Dd03D0A7Bc5' as `0x${string}`,
  EQNT: '0xD39b46f18bbD1FA864cDe38f7cE3bD18C225B067' as `0x${string}`,
  HLN: '0xA20e10B9D3E5e0a4f5A2AABDd76a6a8FDc71a2cB' as `0x${string}`,
  SFLR: '0x12e605bc104e93B45e1aD99F9e555f659051c2BB' as `0x${string}`,
} as const;

// Event signatures
export const EVENT_TOPICS = {
  // Uniswap V3 Pool events
  MINT: '0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde',
  BURN: '0x0c396cd989a39f4459b5fa1aed6a9a8dcdbc45908acfd67e028cd568da98982c',
  SWAP: '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67',
  COLLECT: '0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610b388e6ca9c0',
  FLASH: '0xbdbdb71d7860376ba52b25a5028beea23581364a40522f6bcfb86bb1f2dca633',
  
  // NonfungiblePositionManager events
  PM_INCREASE: '0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f',
  PM_DECREASE: '0x26f6a048ee9138f2c0ce266f322cb99228e8d619ae2bff30c67f8dcf9d2377b4',
  PM_COLLECT: '0x40d0efd1a53d60ecbf40971b9daf7dc90178c3aadc7aab1765632738fa8b8f01',
  PM_TRANSFER: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
} as const;

// Rate limiting
export const RATE_LIMITS = {
  FLARESCAN_RPS: 2,
  FLARESCAN_DAILY: 10_000,
  RPC_BATCH_SIZE: 25,
  RPC_BATCH_WAIT: 30,
} as const;

// Cache TTLs (milliseconds)
export const CACHE_TTL = {
  TOKEN_METADATA: 24 * 60 * 60 * 1000, // 24 hours
  POSITION: 2 * 60 * 1000, // 2 minutes
  PRICE: 30 * 1000, // 30 seconds
  BLOCK_NUMBER: 10 * 1000, // 10 seconds
  CONTRACT_CREATION: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;

// Blockchain constants
export const BLOCKS_PER_DAY = 43200; // ~2s per block
export const GENESIS_BLOCK = 0; // Start from genesis or known deployment block

// Ingest configuration
export const INGEST_CONFIG = {
  MAX_BLOCK_RANGE: 10_000, // Max blocks per chunk
  CONFIRMATIONS: 0, // Wait for confirmations before considering block final
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
  CONCURRENCY_LIMIT: 5,
} as const;

// Decimal precision
export const DECIMALS = {
  PRICE_DISPLAY: 6,
  AMOUNT_DISPLAY: 4,
  PERCENT_DISPLAY: 2,
} as const;

