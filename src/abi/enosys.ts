// --- NonfungiblePositionManager (Enosys V3) ---
export const positionManagerAbi = [
  // ERC721 enumerable
  { name: "balanceOf", type: "function", stateMutability: "view",
    inputs: [{name:"owner", type:"address"}], outputs: [{type:"uint256"}] },
  { name: "tokenOfOwnerByIndex", type: "function", stateMutability: "view",
    inputs: [{name:"owner", type:"address"}, {name:"index", type:"uint256"}], outputs: [{type:"uint256"}] },

  // V3 posities
  { name: "positions", type: "function", stateMutability: "view",
    inputs: [{name:"tokenId", type:"uint256"}],
    outputs: [
      {type:"uint96",  name:"nonce"},
      {type:"address", name:"operator"},
      {type:"address", name:"token0"},
      {type:"address", name:"token1"},
      {type:"uint24",  name:"fee"},
      {type:"int24",   name:"tickLower"},
      {type:"int24",   name:"tickUpper"},
      {type:"uint128", name:"liquidity"},
      {type:"uint256", name:"feeGrowthInside0LastX128"},
      {type:"uint256", name:"feeGrowthInside1LastX128"},
      {type:"uint128", name:"tokensOwed0"},
      {type:"uint128", name:"tokensOwed1"},
    ] },

  // Heel handig: direct pool bij tokenId
  { name: "poolByTokenId", type: "function", stateMutability: "view",
    inputs: [{name:"tokenId", type:"uint256"}], outputs: [{type:"address"}] },
] as const;

// --- UniswapV3-like Factory ---
export const factoryV3Abi = [
  { name: "getPool", type: "function", stateMutability: "view",
    inputs: [
      {name:"tokenA", type:"address"},
      {name:"tokenB", type:"address"},
      {name:"fee",    type:"uint24"},
    ],
    outputs: [{type:"address"}] },
] as const;

// --- UniswapV3-like Pool ---
export const poolAbi = [
  { name: "slot0", type: "function", stateMutability: "view", inputs: [], outputs: [
      {type:"uint160", name:"sqrtPriceX96"},
      {type:"int24",   name:"tick"},
      {type:"uint16",  name:"observationIndex"},
      {type:"uint16",  name:"observationCardinality"},
      {type:"uint16",  name:"observationCardinalityNext"},
      {type:"uint8",   name:"feeProtocol"},
      {type:"bool",    name:"unlocked"},
    ] },
  { name: "liquidity", type: "function", stateMutability: "view", inputs: [], outputs: [{type:"uint128"}] },
] as const;
