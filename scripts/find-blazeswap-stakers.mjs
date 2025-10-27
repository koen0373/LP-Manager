import { createPublicClient, http, parseAbiItem } from 'viem';
import { flare } from 'viem/chains';

const wallet = (process.env.BLAZE_WALLET ?? '0x57d294d815968f0efa722f1e8094da65402cd951').toLowerCase();
const pairs = (process.env.BLAZE_PAIRS ?? '0x3d6efee2e110f13ea22231be6b01b428b38cafc92,0x5ed30e42757e3edd2f8898fbca26cd7c6f391ae1')
  .split(',')
  .map((addr) => addr.trim().toLowerCase())
  .filter(Boolean);

const approvalEvent = parseAbiItem('event Approval(address indexed owner, address indexed spender, uint256 value)');
const client = createPublicClient({
  chain: flare,
  transport: http(process.env.RPC_URL ?? 'https://flare.public-rpc.com'),
});

const CHUNK = 10_000n;
const START_BLOCK = BigInt(process.env.START_BLOCK ?? 3_400_000);

async function fetchSpenders(pair) {
  const latest = await client.getBlockNumber();
  const spenders = new Set();

  for (let from = START_BLOCK; from <= latest; from += CHUNK) {
    const to = from + CHUNK - 1n > latest ? latest : from + CHUNK - 1n;

    const logs = await client.getLogs({
      address: pair,
      event: approvalEvent,
      args: { owner: wallet },
      fromBlock: from,
      toBlock: to,
    });

    for (const log of logs) {
      spenders.add(log.args.spender.toLowerCase());
    }
  }

  return spenders;
}

for (const pair of pairs) {
  const spenders = await fetchSpenders(pair);
  console.log(`${pair} ->`, spenders.size ? [...spenders].join(', ') : 'geen approvals gevonden');
}
