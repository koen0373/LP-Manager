#!/usr/bin/env tsx
import { aggregatePositionCountsViaRpc } from '../../src/services/positionCountService';

async function main() {
  try {
    const summary = await aggregatePositionCountsViaRpc();
    console.info(
      `[position-counts] enosys=${summary.enosys} sparkdex=${summary.sparkdex} total=${summary.total} lastBlock=${summary.lastBlock}`,
    );
    process.exit(0);
  } catch (error) {
    console.error('[position-counts] failed to update counts', error);
    process.exit(1);
  }
}

void main();
