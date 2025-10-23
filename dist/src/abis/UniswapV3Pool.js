"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNISWAP_V3_POOL_ABI = void 0;
// Uniswap V3 Pool ABI with events
exports.UNISWAP_V3_POOL_ABI = [
    // Events
    {
        name: 'Mint',
        type: 'event',
        inputs: [
            { name: 'sender', type: 'address', indexed: true },
            { name: 'owner', type: 'address', indexed: true },
            { name: 'tickLower', type: 'int24', indexed: true },
            { name: 'tickUpper', type: 'int24', indexed: true },
            { name: 'amount', type: 'uint128', indexed: false },
            { name: 'amount0', type: 'uint256', indexed: false },
            { name: 'amount1', type: 'uint256', indexed: false }
        ]
    },
    {
        name: 'Burn',
        type: 'event',
        inputs: [
            { name: 'owner', type: 'address', indexed: true },
            { name: 'tickLower', type: 'int24', indexed: true },
            { name: 'tickUpper', type: 'int24', indexed: true },
            { name: 'amount', type: 'uint128', indexed: false },
            { name: 'amount0', type: 'uint256', indexed: false },
            { name: 'amount1', type: 'uint256', indexed: false }
        ]
    },
    {
        name: 'Swap',
        type: 'event',
        inputs: [
            { name: 'sender', type: 'address', indexed: true },
            { name: 'recipient', type: 'address', indexed: true },
            { name: 'amount0', type: 'int256', indexed: false },
            { name: 'amount1', type: 'int256', indexed: false },
            { name: 'sqrtPriceX96', type: 'uint160', indexed: false },
            { name: 'liquidity', type: 'uint128', indexed: false },
            { name: 'tick', type: 'int24', indexed: false }
        ]
    },
    {
        name: 'Collect',
        type: 'event',
        inputs: [
            { name: 'owner', type: 'address', indexed: true },
            { name: 'recipient', type: 'address', indexed: true },
            { name: 'tickLower', type: 'int24', indexed: true },
            { name: 'tickUpper', type: 'int24', indexed: true },
            { name: 'amount0', type: 'uint128', indexed: false },
            { name: 'amount1', type: 'uint128', indexed: false }
        ]
    },
    {
        name: 'Flash',
        type: 'event',
        inputs: [
            { name: 'sender', type: 'address', indexed: true },
            { name: 'recipient', type: 'address', indexed: true },
            { name: 'amount0', type: 'uint256', indexed: false },
            { name: 'amount1', type: 'uint256', indexed: false },
            { name: 'paid0', type: 'uint256', indexed: false },
            { name: 'paid1', type: 'uint256', indexed: false }
        ]
    },
    {
        name: 'CollectProtocol',
        type: 'event',
        inputs: [
            { name: 'sender', type: 'address', indexed: true },
            { name: 'recipient', type: 'address', indexed: true },
            { name: 'amount0', type: 'uint128', indexed: false },
            { name: 'amount1', type: 'uint128', indexed: false }
        ]
    },
    // Functions
    {
        name: 'slot0',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [
            { name: 'sqrtPriceX96', type: 'uint160' },
            { name: 'tick', type: 'int24' },
            { name: 'observationIndex', type: 'uint16' },
            { name: 'observationCardinality', type: 'uint16' },
            { name: 'observationCardinalityNext', type: 'uint16' },
            { name: 'feeProtocol', type: 'uint8' },
            { name: 'unlocked', type: 'bool' }
        ]
    },
    {
        name: 'feeGrowthGlobal0X128',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }]
    },
    {
        name: 'feeGrowthGlobal1X128',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }]
    },
    {
        name: 'ticks',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'tick', type: 'int24' }],
        outputs: [
            { name: 'liquidityGross', type: 'uint128' },
            { name: 'liquidityNet', type: 'int128' },
            { name: 'feeGrowthOutside0X128', type: 'uint256' },
            { name: 'feeGrowthOutside1X128', type: 'uint256' },
            { name: 'tickCumulativeOutside', type: 'int56' },
            { name: 'secondsPerLiquidityOutsideX128', type: 'uint160' },
            { name: 'secondsOutside', type: 'uint32' },
            { name: 'initialized', type: 'bool' }
        ]
    }
];
