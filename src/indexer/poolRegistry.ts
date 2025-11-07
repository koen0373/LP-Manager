import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';

const DEFAULT_ALLOWLIST = path.join(process.cwd(), 'data/config/pools.allowlist.json');

export class PoolRegistry {
  constructor(private prisma: PrismaClient) {}

  async getPools(allowlistPath = DEFAULT_ALLOWLIST): Promise<string[]> {
    const result = await this.prisma.poolEvent.findMany({
      where: { eventName: 'PoolCreated' },
      distinct: ['pool'],
      select: { pool: true },
    });

    const pools = result.map((row) => row.pool.toLowerCase());

    const allowlist = await this.loadAllowlist(allowlistPath);
    if (!allowlist) {
      return pools;
    }

    const allowset = new Set(allowlist.map((address) => address.toLowerCase()));
    return pools.filter((pool) => allowset.has(pool));
  }

  async getMinCreatedBlock(): Promise<number | null> {
    const aggregate = await this.prisma.poolEvent.aggregate({
      where: { eventName: 'PoolCreated' },
      _min: { blockNumber: true },
    });
    return aggregate._min.blockNumber ?? null;
  }

  private async loadAllowlist(filePath: string): Promise<string[] | null> {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((value) => (typeof value === 'string' ? value : null))
          .filter((value): value is string => Boolean(value));
      }
      return null;
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }
}
