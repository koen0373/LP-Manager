import { createPublicClient, getAddress, http, parseAbi } from 'viem';
import { flare } from 'viem/chains';

const args = Object.fromEntries(
  process.argv.slice(2).map((entry) => {
    const [rawKey, rawValue = ''] = entry.replace(/^--/, '').split('=');
    return [rawKey, rawValue];
  }),
);

const rpcUrl = process.env.FLARE_RPC_URL;
if (!rpcUrl) {
  console.error('FLARE_RPC_URL missing');
  process.exit(1);
}

const nfpmArg = args.nfpm;
const idArg = args.id;

if (!nfpmArg || !idArg) {
  console.error('Usage: node scripts/dev/verify-nfpm.mjs --nfpm=0x... --id=1234');
  process.exit(1);
}

const client = createPublicClient({
  chain: flare,
  transport: http(rpcUrl),
});

const abi = parseAbi([
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
]);

try {
  const nfpmAddress = getAddress(nfpmArg);
  const tokenId = BigInt(idArg);

  const [name, symbol, owner] = await Promise.all([
    client.readContract({ address: nfpmAddress, abi, functionName: 'name' }),
    client.readContract({ address: nfpmAddress, abi, functionName: 'symbol' }),
    client.readContract({ address: nfpmAddress, abi, functionName: 'ownerOf', args: [tokenId] }),
  ]);

  console.log(
    JSON.stringify(
      {
        nfpm: nfpmAddress,
        positionId: String(tokenId),
        name,
        symbol,
        owner,
      },
      null,
      2,
    ),
  );
  process.exit(0);
} catch (error) {
  console.error(
    JSON.stringify(
      {
        nfpm: nfpmArg,
        positionId: String(idArg),
        error: String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
