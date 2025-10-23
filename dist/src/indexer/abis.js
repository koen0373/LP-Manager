"use strict";
/**
 * ABIs and Event Signatures for NonfungiblePositionManager
 *
 * Enosys/Uniswap-v3 compatible on Flare mainnet
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOPIC_TO_EVENT_TYPE = exports.NPM_EVENTS_ABI = exports.COLLECT_ABI = exports.DECREASE_LIQUIDITY_ABI = exports.INCREASE_LIQUIDITY_ABI = exports.TRANSFER_ABI = exports.COLLECT_TOPIC = exports.DECREASE_LIQUIDITY_TOPIC = exports.INCREASE_LIQUIDITY_TOPIC = exports.TRANSFER_TOPIC = void 0;
exports.getEventTopics = getEventTopics;
const viem_1 = require("viem");
// ============================================================================
// Event Signatures (Topic0)
// ============================================================================
// ERC721 Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
exports.TRANSFER_TOPIC = (0, viem_1.keccak256)((0, viem_1.toHex)('Transfer(address,address,uint256)'));
// IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
exports.INCREASE_LIQUIDITY_TOPIC = (0, viem_1.keccak256)((0, viem_1.toHex)('IncreaseLiquidity(uint256,uint128,uint256,uint256)'));
// DecreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
exports.DECREASE_LIQUIDITY_TOPIC = (0, viem_1.keccak256)((0, viem_1.toHex)('DecreaseLiquidity(uint256,uint128,uint256,uint256)'));
// Collect(uint256 indexed tokenId, address recipient, uint256 amount0, uint256 amount1)
exports.COLLECT_TOPIC = (0, viem_1.keccak256)((0, viem_1.toHex)('Collect(uint256,address,uint256,uint256)'));
// ============================================================================
// ABIs for Event Decoding
// ============================================================================
exports.TRANSFER_ABI = {
    anonymous: false,
    inputs: [
        { indexed: true, name: 'from', type: 'address' },
        { indexed: true, name: 'to', type: 'address' },
        { indexed: true, name: 'tokenId', type: 'uint256' },
    ],
    name: 'Transfer',
    type: 'event',
};
exports.INCREASE_LIQUIDITY_ABI = {
    anonymous: false,
    inputs: [
        { indexed: true, name: 'tokenId', type: 'uint256' },
        { indexed: false, name: 'liquidity', type: 'uint128' },
        { indexed: false, name: 'amount0', type: 'uint256' },
        { indexed: false, name: 'amount1', type: 'uint256' },
    ],
    name: 'IncreaseLiquidity',
    type: 'event',
};
exports.DECREASE_LIQUIDITY_ABI = {
    anonymous: false,
    inputs: [
        { indexed: true, name: 'tokenId', type: 'uint256' },
        { indexed: false, name: 'liquidity', type: 'uint128' },
        { indexed: false, name: 'amount0', type: 'uint256' },
        { indexed: false, name: 'amount1', type: 'uint256' },
    ],
    name: 'DecreaseLiquidity',
    type: 'event',
};
exports.COLLECT_ABI = {
    anonymous: false,
    inputs: [
        { indexed: true, name: 'tokenId', type: 'uint256' },
        { indexed: false, name: 'recipient', type: 'address' },
        { indexed: false, name: 'amount0', type: 'uint256' },
        { indexed: false, name: 'amount1', type: 'uint256' },
    ],
    name: 'Collect',
    type: 'event',
};
// Combined ABI for multi-event decoding
exports.NPM_EVENTS_ABI = [
    exports.TRANSFER_ABI,
    exports.INCREASE_LIQUIDITY_ABI,
    exports.DECREASE_LIQUIDITY_ABI,
    exports.COLLECT_ABI,
];
// Map topics to event types
exports.TOPIC_TO_EVENT_TYPE = {
    [exports.TRANSFER_TOPIC]: 'TRANSFER',
    [exports.INCREASE_LIQUIDITY_TOPIC]: 'INCREASE',
    [exports.DECREASE_LIQUIDITY_TOPIC]: 'DECREASE',
    [exports.COLLECT_TOPIC]: 'COLLECT',
};
// Helper to get topic array for getLogs
function getEventTopics(config) {
    const topics = [];
    if (config.transfer)
        topics.push(exports.TRANSFER_TOPIC);
    if (config.increaseLiquidity)
        topics.push(exports.INCREASE_LIQUIDITY_TOPIC);
    if (config.decreaseLiquidity)
        topics.push(exports.DECREASE_LIQUIDITY_TOPIC);
    if (config.collect)
        topics.push(exports.COLLECT_TOPIC);
    return topics;
}
