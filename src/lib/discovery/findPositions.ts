/**
 * Position Discovery
 * Find all NFT positions owned by a wallet
 */

import { type Address } from 'viem';
import { publicClient } from '../onchain/client';
import { ENOSYS_ADDRESSES } from '../onchain/config';
import { memoize } from '../util/memo';
import { withTimeout } from '../util/withTimeout';

/**
 * Get token IDs owned by a wallet using balanceOf + tokenOfOwnerByIndex
 */
export async function findPositionsByWallet(
  walletAddress: Address,
  options: { refresh?: boolean } = {}
): Promise<bigint[]> {
  const cacheKey = `wallet-positions-${walletAddress}`;
  
  if (options.refresh) {
    // Clear cache if refresh requested
    const { clearCache } = await import('../util/memo');
    clearCache(cacheKey);
  }

  return memoize(cacheKey, async () => {
    try {
      console.log(`[DISCOVERY] Finding positions for wallet: ${walletAddress}`);
      
      // Step 1: Get balance of NFTs owned by this wallet
      const balance = await withTimeout(
        publicClient.readContract({
          address: ENOSYS_ADDRESSES.POSITION_MANAGER,
          abi: [
            {
              name: 'balanceOf',
              type: 'function',
              stateMutability: 'view',
              inputs: [{ name: 'owner', type: 'address' }],
              outputs: [{ name: '', type: 'uint256' }],
            },
          ],
          functionName: 'balanceOf',
          args: [walletAddress],
        }),
        15000,
        'balanceOf read timeout'
      );

      const balanceNum = Number(balance);
      console.log(`[DISCOVERY] Wallet ${walletAddress} has ${balanceNum} positions`);

      if (balanceNum === 0) {
        return [];
      }

      // Step 2: Get each token ID by index
      const tokenIds: bigint[] = [];
      const batchSize = 10; // Process 10 at a time to avoid overwhelming RPC

      for (let i = 0; i < balanceNum; i += batchSize) {
        const batch = Array.from(
          { length: Math.min(batchSize, balanceNum - i) },
          (_, idx) => i + idx
        );

        const batchResults = await Promise.allSettled(
          batch.map(async (index) => {
            try {
              const tokenId = await withTimeout(
                publicClient.readContract({
                  address: ENOSYS_ADDRESSES.POSITION_MANAGER,
                  abi: [
                    {
                      name: 'tokenOfOwnerByIndex',
                      type: 'function',
                      stateMutability: 'view',
                      inputs: [
                        { name: 'owner', type: 'address' },
                        { name: 'index', type: 'uint256' },
                      ],
                      outputs: [{ name: '', type: 'uint256' }],
                    },
                  ],
                  functionName: 'tokenOfOwnerByIndex',
                  args: [walletAddress, BigInt(index)],
                }),
                10000,
                `tokenOfOwnerByIndex read timeout for index ${index}`
              );
              return BigInt(tokenId);
            } catch (error) {
              console.warn(`[DISCOVERY] Failed to get token ID at index ${index}:`, error);
              return null;
            }
          })
        );

        // Collect successful results
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value !== null) {
            tokenIds.push(result.value);
          }
        }
      }

      console.log(`[DISCOVERY] Found ${tokenIds.length} token IDs:`, tokenIds.map(id => id.toString()));
      return tokenIds;
    } catch (error) {
      console.error(`[DISCOVERY] Failed to find positions for wallet ${walletAddress}:`, error);
      return [];
    }
  }, 120_000); // Cache for 2 minutes
}

/**
 * Check if a wallet owns a specific position
 */
export async function isPositionOwnedBy(
  tokenId: bigint,
  walletAddress: Address
): Promise<boolean> {
  try {
    const owner = await withTimeout(
      publicClient.readContract({
        address: ENOSYS_ADDRESSES.POSITION_MANAGER,
        abi: [
          {
            name: 'ownerOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'tokenId', type: 'uint256' }],
            outputs: [{ name: '', type: 'address' }],
          },
        ],
        functionName: 'ownerOf',
        args: [tokenId],
      }),
      10000,
      'ownerOf read timeout'
    );

    return (owner as Address).toLowerCase() === walletAddress.toLowerCase();
  } catch (error) {
    console.warn(`[DISCOVERY] Failed to check ownership of position ${tokenId}:`, error);
    return false;
  }
}

/**
 * Get owner of a position
 */
export async function getPositionOwner(tokenId: bigint): Promise<Address | null> {
  try {
    const owner = await withTimeout(
      publicClient.readContract({
        address: ENOSYS_ADDRESSES.POSITION_MANAGER,
        abi: [
          {
            name: 'ownerOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'tokenId', type: 'uint256' }],
            outputs: [{ name: '', type: 'address' }],
          },
        ],
        functionName: 'ownerOf',
        args: [tokenId],
      }),
      10000,
      'ownerOf read timeout'
    );

    return owner as Address;
  } catch (error) {
    console.warn(`[DISCOVERY] Failed to get owner of position ${tokenId}:`, error);
    return null;
  }
}

