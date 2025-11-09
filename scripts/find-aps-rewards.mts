/**
 * Find APS rewards contract
 * Check if there's a MasterChef or distributor for APS
 */

import { createPublicClient, http } from 'viem';
import { flare } from 'viem/chains';

const client = createPublicClient({
  chain: flare,
  transport: http('https://flare-api.flare.network/ext/bc/C/rpc'),
});

const APS_TOKEN = '0xff56eb5b1a7faa972291117e5e9565da29bc808d';

async function main() {
  console.log('[APS] Searching for APS rewards contract...\n');
  console.log('APS Token:', APS_TOKEN, '\n');

  // Check APS token for common functions
  const ABI = [
    { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
    { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
    { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  ] as const;

  try {
    const name = await client.readContract({
      address: APS_TOKEN as any,
      abi: ABI,
      functionName: 'name',
    });
    console.log('✓ Token name:', name);
  } catch (err) {
    console.log('✗ name() failed');
  }

  try {
    const symbol = await client.readContract({
      address: APS_TOKEN as any,
      abi: ABI,
      functionName: 'symbol',
    });
    console.log('✓ Token symbol:', symbol);
  } catch (err) {
    console.log('✗ symbol() failed');
  }

  try {
    const supply = await client.readContract({
      address: APS_TOKEN as any,
      abi: ABI,
      functionName: 'totalSupply',
    });
    console.log('✓ Total supply:', supply.toString());
  } catch (err) {
    console.log('✗ totalSupply() failed');
  }

  console.log('\n[APS] Check: Are there Transfer events FROM a potential distributor?');
  console.log('(Scanning last 1000 blocks for large APS transfers)\n');

  const latestBlock = await client.getBlockNumber();
  const fromBlock = Number(latestBlock) - 1000;

  const transferAbi = [{
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  }] as const;

  try {
    const logs = await client.getLogs({
      address: APS_TOKEN as any,
      event: transferAbi[0],
      fromBlock: BigInt(fromBlock),
      toBlock: latestBlock,
    });

    console.log(`Found ${logs.length} APS Transfer events in last 1000 blocks\n`);

    if (logs.length > 0) {
      // Group by 'from' address to find potential distributor
      const senders = new Map<string, number>();
      
      for (const log of logs) {
        const from = (log.args as any).from?.toLowerCase();
        if (from && from !== '0x0000000000000000000000000000000000000000') {
          senders.set(from, (senders.get(from) || 0) + 1);
        }
      }

      console.log('Top APS senders (potential reward contracts):');
      const sorted = Array.from(senders.entries()).sort((a, b) => b[1] - a[1]);
      sorted.slice(0, 5).forEach(([addr, count]) => {
        console.log(`  ${addr}: ${count} transfers`);
      });
    }
  } catch (err: any) {
    console.log('✗ Transfer scan failed:', err.message);
  }

  console.log('\n[APS] Done!');
}

main().catch(console.error);

