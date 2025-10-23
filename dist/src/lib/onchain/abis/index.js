"use strict";
/**
 * ABI Exports
 * All contract ABIs used in the app
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.INCENTIVE_ABI = exports.POOL_ABI = exports.FACTORY_ABI = exports.ERC20_ABI = exports.NonfungiblePositionManagerABI = void 0;
// Re-export existing ABIs
var NonfungiblePositionManager_json_1 = require("../../../abis/NonfungiblePositionManager.json");
Object.defineProperty(exports, "NonfungiblePositionManagerABI", { enumerable: true, get: function () { return __importDefault(NonfungiblePositionManager_json_1).default; } });
// Minimal ERC20 ABI
exports.ERC20_ABI = [
    {
        name: 'symbol',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'string' }],
    },
    {
        name: 'name',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'string' }],
    },
    {
        name: 'decimals',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint8' }],
    },
    {
        name: 'totalSupply',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint256' }],
    },
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ type: 'uint256' }],
    },
];
// Uniswap V3 Factory ABI
exports.FACTORY_ABI = [
    {
        name: 'getPool',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'tokenA', type: 'address' },
            { name: 'tokenB', type: 'address' },
            { name: 'fee', type: 'uint24' },
        ],
        outputs: [{ name: 'pool', type: 'address' }],
    },
];
// Uniswap V3 Pool ABI (key functions)
exports.POOL_ABI = [
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
            { name: 'unlocked', type: 'bool' },
        ],
    },
    {
        name: 'liquidity',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint128' }],
    },
    {
        name: 'token0',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
    },
    {
        name: 'token1',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
    },
    {
        name: 'fee',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint24' }],
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
            { name: 'initialized', type: 'bool' },
        ],
    },
    // Events
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: 'sender', type: 'address' },
            { indexed: true, name: 'owner', type: 'address' },
            { indexed: true, name: 'tickLower', type: 'int24' },
            { indexed: true, name: 'tickUpper', type: 'int24' },
            { indexed: false, name: 'amount', type: 'uint128' },
            { indexed: false, name: 'amount0', type: 'uint256' },
            { indexed: false, name: 'amount1', type: 'uint256' },
        ],
        name: 'Mint',
        type: 'event',
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: 'owner', type: 'address' },
            { indexed: true, name: 'tickLower', type: 'int24' },
            { indexed: true, name: 'tickUpper', type: 'int24' },
            { indexed: false, name: 'amount', type: 'uint128' },
            { indexed: false, name: 'amount0', type: 'uint256' },
            { indexed: false, name: 'amount1', type: 'uint256' },
        ],
        name: 'Burn',
        type: 'event',
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: 'sender', type: 'address' },
            { indexed: true, name: 'recipient', type: 'address' },
            { indexed: false, name: 'amount0', type: 'int256' },
            { indexed: false, name: 'amount1', type: 'int256' },
            { indexed: false, name: 'sqrtPriceX96', type: 'uint160' },
            { indexed: false, name: 'liquidity', type: 'uint128' },
            { indexed: false, name: 'tick', type: 'int24' },
        ],
        name: 'Swap',
        type: 'event',
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: 'owner', type: 'address' },
            { indexed: false, name: 'recipient', type: 'address' },
            { indexed: true, name: 'tickLower', type: 'int24' },
            { indexed: true, name: 'tickUpper', type: 'int24' },
            { indexed: false, name: 'amount0', type: 'uint128' },
            { indexed: false, name: 'amount1', type: 'uint128' },
        ],
        name: 'Collect',
        type: 'event',
    },
];
// Incentive Rewards ABI (RFLR/APS)
exports.INCENTIVE_ABI = [
    {
        name: 'earned',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'getReward',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [],
        outputs: [],
    },
];
