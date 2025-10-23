"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dedupeLogs = dedupeLogs;
function dedupeLogs(logs) {
    const map = new Map();
    for (const log of logs) {
        const key = `${log.transactionHash}-${log.logIndex}`;
        if (!map.has(key)) {
            map.set(key, log);
        }
    }
    return Array.from(map.values()).sort((a, b) => {
        if (a.blockNumber === b.blockNumber) {
            return a.logIndex - b.logIndex;
        }
        return a.blockNumber - b.blockNumber;
    });
}
