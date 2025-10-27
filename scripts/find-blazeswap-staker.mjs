import { createPublicClient, http, parseAbiItem } from 'viem';
import { flare } from 'viem/chains';

const wallet = '0x57d294d815968f0efa722f1e8094da65402cd951';   // jouw wallet
const pairs = [
  '0x3d6efee2e110f13ea22231be6b01b428b38cafc92', // Blaze FXRP/USD₮0 LP
  '0x5ed30e42757e3edd2f8898fbca26cd7c6f391ae1', // Blaze WFLR/USD₮0 LP
  // voeg extra pair-adressen toe als je die hebt
];

const approvalEvent = parseAbiItem(
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
);

const client = createPublicClient({
  chain: flare,
  transport: http(process.env.RPC_URL ?? 'https://flare.flr.finance/ext/bc/C/rpc'),
});

for (const pair of pairs) {
  const logs = await client.getLogs({
    address: pair,
    event: approvalEvent,
    args: { owner: wallet },
    fromBlock: 0n,
  });

  const spenders = [...new Set(logs.map((log) => log.args.spender.toLowerCase()))];
  console.log(`${pair} ->`, spenders.length ? spenders : 'geen approvals gevonden');
}
