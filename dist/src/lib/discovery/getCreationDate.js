"use strict";
/**
 * Position Creation Date
 * Get creation timestamp from FlareScan NFT transfer history
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPositionCreationDate = getPositionCreationDate;
const client_1 = require("../adapters/flarescan/client");
const config_1 = require("../onchain/config");
const memo_1 = require("../util/memo");
/**
 * Get position creation date from first NFT transfer (mint)
 */
async function getPositionCreationDate(tokenId) {
    const cacheKey = `creation-date-${tokenId.toString()}`;
    return (0, memo_1.memoize)(cacheKey, async () => {
        try {
            console.log(`[CREATION-DATE] Fetching creation date for position ${tokenId}`);
            // Get NFT transfers for this token
            const response = await (0, client_1.getNFTTransfers)(config_1.ENOSYS_ADDRESSES.POSITION_MANAGER, undefined, // Get all transfers for this contract
            undefined, undefined);
            if (!response || !response.result || !Array.isArray(response.result)) {
                console.warn(`[CREATION-DATE] No transfers found for position ${tokenId}`);
                return null;
            }
            // Filter for transfers matching this tokenId
            const transfers = response.result.filter((t) => t.tokenID === tokenId.toString() || t.tokenId === tokenId.toString());
            if (transfers.length === 0) {
                console.warn(`[CREATION-DATE] No transfers found for position ${tokenId}`);
                return null;
            }
            // Find the first transfer (mint) - from address 0x0
            const mintTransfer = transfers.find((t) => t.from.toLowerCase() === '0x0000000000000000000000000000000000000000');
            if (!mintTransfer) {
                console.warn(`[CREATION-DATE] No mint transfer found for position ${tokenId}`);
                // Fallback to first transfer
                const firstTransfer = transfers[transfers.length - 1]; // Transfers are usually newest first
                if (firstTransfer && firstTransfer.timeStamp) {
                    const date = new Date(parseInt(firstTransfer.timeStamp, 10) * 1000);
                    console.log(`[CREATION-DATE] Using first transfer date for ${tokenId}: ${date.toISOString()}`);
                    return date;
                }
                return null;
            }
            if (!mintTransfer.timeStamp) {
                console.warn(`[CREATION-DATE] Mint transfer has no timestamp for position ${tokenId}`);
                return null;
            }
            const creationDate = new Date(parseInt(mintTransfer.timeStamp, 10) * 1000);
            console.log(`[CREATION-DATE] Position ${tokenId} created at ${creationDate.toISOString()}`);
            return creationDate;
        }
        catch (error) {
            console.error(`[CREATION-DATE] Failed to get creation date for position ${tokenId}:`, error);
            return null;
        }
    }, 300000); // Cache for 5 minutes
}
