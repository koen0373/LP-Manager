export type ExplorerLog = {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  timestamp?: string;
};

export function dedupeLogs(logs: ExplorerLog[]): ExplorerLog[] {
  const map = new Map<string, ExplorerLog>();
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

