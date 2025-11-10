import fs from 'fs/promises';
import path from 'path';

import { Prisma, PrismaClient } from '@prisma/client';

import { parseIncentiveRecords } from '@/lib/incentives/schema';

const prisma = new PrismaClient();
const DATA_DIR = path.join(process.cwd(), 'data', 'incentives');
const SINGLE_FILE = path.join(process.cwd(), 'data', 'incentives.json');

async function listJsonFiles(): Promise<string[]> {
  try {
    const stat = await fs.stat(DATA_DIR);
    if (!stat.isDirectory()) return [];
    const files = await fs.readdir(DATA_DIR);
    return files.filter((file) => file.endsWith('.json')).map((file) => path.join(DATA_DIR, file));
  } catch (error) {
    return [];
  }
}

async function loadPayloads(): Promise<unknown[]> {
  const files = await listJsonFiles();
  const targets = files.length > 0 ? files : [SINGLE_FILE];
  const payloads: unknown[] = [];

  for (const target of targets) {
    try {
      const content = await fs.readFile(target, 'utf8');
      payloads.push(JSON.parse(content));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue;
      }
      throw error;
    }
  }

  return payloads;
}

async function main() {
  try {
    const payloads = await loadPayloads();
    const records = payloads.flatMap((payload) => parseIncentiveRecords(payload));

    if (records.length === 0) {
      console.log(JSON.stringify({ inserted: 0, updated: 0 }));
      return;
    }

    const existing = await prisma.poolIncentiveSnapshot.findMany({
      select: { poolAddress: true },
    });
    const existingSet = new Set(existing.map((row) => row.poolAddress));

    let inserted = 0;
    let updated = 0;

    for (const record of records) {
      const poolAddress = record.pool.toLowerCase();
      const data = {
        poolAddress,
        provider: record.provider,
        usdPerDay: new Prisma.Decimal(record.usdPerDay),
        tokens: record.tokens,
        updatedAt: new Date(record.updatedAt),
      };

      if (existingSet.has(poolAddress)) {
        await prisma.poolIncentiveSnapshot.update({ where: { poolAddress }, data });
        updated += 1;
      } else {
        await prisma.poolIncentiveSnapshot.create({ data });
        inserted += 1;
        existingSet.add(poolAddress);
      }
    }

    console.log(JSON.stringify({ inserted, updated }));
  } catch (error) {
    console.error(JSON.stringify({ error: (error as Error).message }));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
