/**
 * Position Creation Date
 * Get creation timestamp from FlareScan NFT transfer history
 */

import { getNFTTransfers } from '../adapters/flarescan/client';
import { ENOSYS_ADDRESSES } from '../onchain/config';
import { memoize } from '../util/memo';

/**
 * NFT Transfer (from Flarescan API)
 */
interface NFTTransfer {
  from: string;
  to: string;
  tokenID?: string;
  tokenId?: string;
  timeStamp?: string;
  blockNumber?: string;
  hash?: string;
}

/**
 * Get position creation date from first NFT transfer (mint)
 */
export async function getPositionCreationDate(
  tokenId: bigint
): Promise<Date | null> {
  const cacheKey = `creation-date-${tokenId.toString()}`;
  
  return memoize(cacheKey, async () => {
    try {
      console.log(`[CREATION-DATE] Fetching creation date for position ${tokenId}`);
      
      // Get NFT transfers for this token
      const response = await getNFTTransfers(
        ENOSYS_ADDRESSES.POSITION_MANAGER,
        undefined, // Get all transfers for this contract
        undefined,
        undefined
      );

      if (!response || !response.result || !Array.isArray(response.result)) {
        console.warn(`[CREATION-DATE] No transfers found for position ${tokenId}`);
        return null;
      }

      // Filter for transfers matching this tokenId
      const transfers = (response.result as NFTTransfer[]).filter(
        (t) => t.tokenID === tokenId.toString() || t.tokenId === tokenId.toString()
      );

      if (transfers.length === 0) {
        console.warn(`[CREATION-DATE] No transfers found for position ${tokenId}`);
        return null;
      }

      // Find the first transfer (mint) - from address 0x0
      const mintTransfer = transfers.find(
        (t) => t.from.toLowerCase() === '0x0000000000000000000000000000000000000000'
      );

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
    } catch (error) {
      console.error(`[CREATION-DATE] Failed to get creation date for position ${tokenId}:`, error);
      return null;
    }
  }, 300_000); // Cache for 5 minutes
}

