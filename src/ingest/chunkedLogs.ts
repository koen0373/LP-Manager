import { Address, Hex } from 'viem';
import { flare } from '@/chains/flare';

export type ChunkOpts = {
  address: Address;
  topics?: (Hex | null)[];
  fromBlock: bigint;
  toBlock: bigint;
  step?: bigint;         // b.v. 3_000n
  confirmations?: bigint; // b.v. 6n
};

export async function* chunkedLogs(opts: ChunkOpts) {
  const step = opts.step ?? 3_000n;
  const conf = opts.confirmations ?? 6n;
  const latest = (await flare.getBlockNumber()) - conf;
  const end = opts.toBlock > latest ? latest : opts.toBlock;

  for (let from = opts.fromBlock; from <= end; from += step + 1n) {
    const to = from + step > end ? end : from + step;
    const logs = await flare.getLogs({
      address: opts.address,
      topics: opts.topics,
      fromBlock: from,
      toBlock: to,
    } as Parameters<typeof flare.getLogs>[0]);
    yield logs;
  }
}
