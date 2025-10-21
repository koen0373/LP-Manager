import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createPublicClient, http } from 'viem';

const flare = {
  id: 14,
  name: 'Flare',
  nativeCurrency: {
    decimals: 18,
    name: 'Flare',
    symbol: 'FLR',
  },
  rpcUrls: {
    default: {
      http: [
        'https://flare-api.flare.network/ext/C/rpc',
        'https://flare.public-rpc.com',
      ],
    },
  },
};

const pmAddress = '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657';

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: node scripts/checkPosition.mjs <tokenId>');
    process.exit(1);
  }

  const tokenId = BigInt(id);

  const abiPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/abis/NonfungiblePositionManager.json');
  const abiContent = await readFile(abiPath, 'utf8');
  const abi = JSON.parse(abiContent);

  const client = createPublicClient({
    chain: flare,
    transport: http(flare.rpcUrls.default.http[0]),
  });

  const position = await client.readContract({
    address: pmAddress,
    abi,
    functionName: 'positions',
    args: [tokenId],
  });

  console.log(JSON.stringify(position, (_key, value) => (typeof value === 'bigint' ? value.toString() : value), 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
