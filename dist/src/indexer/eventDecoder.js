"use strict";
/**
 * Event Decoder
 *
 * Decodes raw blockchain logs into normalized PositionEvent and PositionTransfer records
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventDecoder = void 0;
const viem_1 = require("viem");
const abis_1 = require("./abis");
const client_1 = require("@prisma/client");
class EventDecoder {
    /**
     * Decode a raw log into a normalized event
     */
    decode(log) {
        const topic0 = log.topics[0];
        if (!topic0)
            return null;
        const eventType = abis_1.TOPIC_TO_EVENT_TYPE[topic0];
        if (!eventType)
            return null;
        try {
            switch (eventType) {
                case 'TRANSFER':
                    return this.decodeTransfer(log);
                case 'INCREASE':
                    return this.decodeIncreaseLiquidity(log);
                case 'DECREASE':
                    return this.decodeDecreaseLiquidity(log);
                case 'COLLECT':
                    return this.decodeCollect(log);
                default:
                    return null;
            }
        }
        catch (error) {
            console.warn(`[DECODE] Failed to decode log at ${log.transactionHash}:${log.logIndex}:`, error);
            return null;
        }
    }
    decodeTransfer(log) {
        const decoded = (0, viem_1.decodeEventLog)({
            abi: [abis_1.TRANSFER_ABI],
            data: log.data,
            topics: log.topics,
        });
        return {
            type: 'TRANSFER',
            tokenId: decoded.args.tokenId.toString(),
            from: decoded.args.from,
            to: decoded.args.to,
            blockNumber: Number(log.blockNumber),
            txHash: log.transactionHash,
            logIndex: Number(log.logIndex),
        };
    }
    decodeIncreaseLiquidity(log) {
        const decoded = (0, viem_1.decodeEventLog)({
            abi: [abis_1.INCREASE_LIQUIDITY_ABI],
            data: log.data,
            topics: log.topics,
        });
        return {
            type: client_1.PositionEventType.INCREASE,
            tokenId: decoded.args.tokenId.toString(),
            blockNumber: Number(log.blockNumber),
            txHash: log.transactionHash,
            logIndex: Number(log.logIndex),
            liquidityDelta: decoded.args.liquidity.toString(),
            amount0: decoded.args.amount0.toString(),
            amount1: decoded.args.amount1.toString(),
        };
    }
    decodeDecreaseLiquidity(log) {
        const decoded = (0, viem_1.decodeEventLog)({
            abi: [abis_1.DECREASE_LIQUIDITY_ABI],
            data: log.data,
            topics: log.topics,
        });
        return {
            type: client_1.PositionEventType.DECREASE,
            tokenId: decoded.args.tokenId.toString(),
            blockNumber: Number(log.blockNumber),
            txHash: log.transactionHash,
            logIndex: Number(log.logIndex),
            liquidityDelta: decoded.args.liquidity.toString(),
            amount0: decoded.args.amount0.toString(),
            amount1: decoded.args.amount1.toString(),
        };
    }
    decodeCollect(log) {
        const decoded = (0, viem_1.decodeEventLog)({
            abi: [abis_1.COLLECT_ABI],
            data: log.data,
            topics: log.topics,
        });
        return {
            type: client_1.PositionEventType.COLLECT,
            tokenId: decoded.args.tokenId.toString(),
            blockNumber: Number(log.blockNumber),
            txHash: log.transactionHash,
            logIndex: Number(log.logIndex),
            recipient: decoded.args.recipient,
            amount0: decoded.args.amount0.toString(),
            amount1: decoded.args.amount1.toString(),
        };
    }
    /**
     * Batch decode multiple logs
     */
    decodeBatch(logs) {
        return logs.map((log) => this.decode(log)).filter((e) => e !== null);
    }
}
exports.EventDecoder = EventDecoder;
