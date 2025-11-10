import type { NextApiRequest, NextApiResponse } from 'next';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

type BackfillStatus = {
  running: boolean;
  startedAt?: string;
  currentProcess?: string;
  completedProcesses?: string[];
  failedProcesses?: string[];
  progress?: {
    total: number;
    completed: number;
    failed: number;
  };
};

type BackfillResponse = {
  success: boolean;
  message: string;
  status?: BackfillStatus;
};

// In-memory status (in production, use Redis or database)
let backfillStatus: BackfillStatus = {
  running: false,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BackfillResponse | BackfillStatus>,
) {
  // Note: In production, add proper admin authentication
  // For now, allow access (add auth middleware if needed)

  try {
    if (req.method === 'GET') {
      return res.status(200).json(backfillStatus);
    }

    if (req.method === 'POST') {
      const { action } = req.body;

      if (action === 'start') {
        if (backfillStatus.running) {
          return res.status(400).json({
            success: false,
            message: 'Backfill is already running',
            status: backfillStatus,
          });
        }

        backfillStatus = {
          running: true,
          startedAt: new Date().toISOString(),
          currentProcess: 'Initializing...',
          completedProcesses: [],
          failedProcesses: [],
          progress: {
            total: 10,
            completed: 0,
            failed: 0,
          },
        };

        // Start backfill asynchronously (don't wait for it)
        runBackfillAsync().catch((error) => {
          console.error('[backfill-api] Backfill failed:', error);
          backfillStatus.running = false;
          backfillStatus.failedProcesses = [
            ...(backfillStatus.failedProcesses || []),
            `Fatal error: ${error instanceof Error ? error.message : String(error)}`,
          ];
        });

        // Return immediately
        return res.status(200).json({
          success: true,
          message: 'Backfill started',
          status: backfillStatus,
        });
      }

      if (action === 'stop') {
        backfillStatus.running = false;
        return res.status(200).json({
          success: true,
          message: 'Backfill stop requested',
          status: backfillStatus,
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use: start or stop',
      });
    }

    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
  } catch (error) {
    console.error('[backfill-api] Handler error:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

async function runBackfillAsync() {
  // Ensure Prisma client is generated before running scripts
  try {
    console.log('[backfill-api] Generating Prisma client...');
    await execAsync('npx prisma generate', {
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
      cwd: process.cwd(),
    });
    console.log('[backfill-api] Prisma client generated');
  } catch (error) {
    console.warn('[backfill-api] Prisma generate warning:', error);
    // Continue anyway - client might already be generated
  }

  const scripts = [
    { name: 'APR Calculation', cmd: 'npx tsx scripts/enrich-apr-calculation.ts --limit=500' },
    { name: 'Pool Volume', cmd: 'npx tsx scripts/enrich-pool-volume.ts --limit=500' },
    { name: 'Position Health', cmd: 'npx tsx scripts/enrich-position-health.ts --limit=10000' },
    { name: 'Pool Attribution', cmd: 'npx tsx scripts/enrich-user-engagement-data.ts --skip-fees --limit=5000 --concurrency=12' },
    { name: 'Fees USD', cmd: 'npx tsx scripts/enrich-user-engagement-data.ts --skip-pool --limit=20000 --concurrency=12' },
    { name: 'Range Status', cmd: 'npx tsx scripts/enrich-range-status.ts --limit=5000 --concurrency=12' },
    { name: 'Impermanent Loss', cmd: 'npx tsx scripts/enrich-impermanent-loss.ts --limit=5000 --concurrency=12' },
    { name: 'rFLR Vesting', cmd: 'npx tsx scripts/enrich-rflr-vesting.ts --limit=5000 --concurrency=10' },
    { name: 'Unclaimed Fees', cmd: 'npx tsx scripts/enrich-unclaimed-fees.ts --limit=5000 --concurrency=10' },
    { name: 'Position Snapshots', cmd: 'npx tsx scripts/enrich-position-snapshots.ts --limit=5000 --concurrency=10' },
  ];

  for (const script of scripts) {
    if (!backfillStatus.running) {
      break;
    }

    backfillStatus.currentProcess = script.name;
    console.log(`[backfill-api] Starting: ${script.name}`);

    try {
      const result = await execAsync(script.cmd, {
        timeout: 3600000,
        maxBuffer: 10 * 1024 * 1024,
        cwd: process.cwd(), // Ensure correct working directory
        env: {
          ...process.env,
          INDEXER_BLOCK_WINDOW: '5000',
          NODE_ENV: process.env.NODE_ENV || 'production',
        },
      });

      // Log output for debugging
      if (result.stdout) {
        console.log(`[backfill-api] ${script.name} output:`, result.stdout.substring(0, 500));
      }
      if (result.stderr && !result.stderr.includes('Warning')) {
        console.warn(`[backfill-api] ${script.name} warnings:`, result.stderr.substring(0, 500));
      }

      backfillStatus.completedProcesses = [
        ...(backfillStatus.completedProcesses || []),
        script.name,
      ];
      backfillStatus.progress = {
        total: scripts.length,
        completed: (backfillStatus.completedProcesses?.length || 0),
        failed: backfillStatus.failedProcesses?.length || 0,
      };
      console.log(`[backfill-api] ✅ Completed: ${script.name}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const fullError = error instanceof Error && error.stack ? error.stack.substring(0, 200) : errorMsg;
      
      console.error(`[backfill-api] ❌ Failed: ${script.name}`, fullError);
      
      backfillStatus.failedProcesses = [
        ...(backfillStatus.failedProcesses || []),
        `${script.name}: ${errorMsg.substring(0, 150)}`,
      ];
      backfillStatus.progress = {
        total: scripts.length,
        completed: backfillStatus.completedProcesses?.length || 0,
        failed: (backfillStatus.failedProcesses?.length || 0),
      };
    }
  }

async function runBackfillAsync() {
  // Ensure Prisma client is generated before running scripts
  try {
    console.log('[backfill-api] Generating Prisma client...');
    await execAsync('npx prisma generate', {
      timeout: 30000, // Reduced timeout
      maxBuffer: 10 * 1024 * 1024,
      cwd: process.cwd(),
    });
    console.log('[backfill-api] Prisma client generated');
  } catch (error) {
    console.warn('[backfill-api] Prisma generate warning:', error);
    // Continue anyway - client might already be generated
  }

  const scripts = [
    { name: 'APR Calculation', cmd: 'npx tsx scripts/enrich-apr-calculation.ts --limit=500' },
    { name: 'Pool Volume', cmd: 'npx tsx scripts/enrich-pool-volume.ts --limit=500' },
    { name: 'Position Health', cmd: 'npx tsx scripts/enrich-position-health.ts --limit=10000' },
    { name: 'Pool Attribution', cmd: 'npx tsx scripts/enrich-user-engagement-data.ts --skip-fees --limit=5000 --concurrency=12' },
    { name: 'Fees USD', cmd: 'npx tsx scripts/enrich-user-engagement-data.ts --skip-pool --limit=20000 --concurrency=12' },
    { name: 'Range Status', cmd: 'npx tsx scripts/enrich-range-status.ts --limit=5000 --concurrency=12' },
    { name: 'Impermanent Loss', cmd: 'npx tsx scripts/enrich-impermanent-loss.ts --limit=5000 --concurrency=12' },
    { name: 'rFLR Vesting', cmd: 'npx tsx scripts/enrich-rflr-vesting.ts --limit=5000 --concurrency=10' },
    { name: 'Unclaimed Fees', cmd: 'npx tsx scripts/enrich-unclaimed-fees.ts --limit=5000 --concurrency=10' },
    { name: 'Position Snapshots', cmd: 'npx tsx scripts/enrich-position-snapshots.ts --limit=5000 --concurrency=10' },
  ];

  for (const script of scripts) {
    if (!backfillStatus.running) {
      console.log('[backfill-api] Backfill stopped by user');
      break;
    }

    backfillStatus.currentProcess = script.name;
    console.log(`[backfill-api] Starting: ${script.name}`);

    try {
      const result = await execAsync(script.cmd, {
        timeout: 3600000,
        maxBuffer: 10 * 1024 * 1024,
        cwd: process.cwd(),
        env: {
          ...process.env,
          INDEXER_BLOCK_WINDOW: '5000',
          NODE_ENV: process.env.NODE_ENV || 'production',
        },
      });

      // Log output for debugging
      if (result.stdout) {
        const output = result.stdout.substring(0, 500);
        console.log(`[backfill-api] ${script.name} output:`, output);
      }
      if (result.stderr && !result.stderr.includes('Warning')) {
        const warnings = result.stderr.substring(0, 500);
        console.warn(`[backfill-api] ${script.name} warnings:`, warnings);
      }

      backfillStatus.completedProcesses = [
        ...(backfillStatus.completedProcesses || []),
        script.name,
      ];
      backfillStatus.progress = {
        total: scripts.length,
        completed: (backfillStatus.completedProcesses?.length || 0),
        failed: backfillStatus.failedProcesses?.length || 0,
      };
      console.log(`[backfill-api] ✅ Completed: ${script.name}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const fullError = error instanceof Error && error.stack ? error.stack.substring(0, 200) : errorMsg;
      
      console.error(`[backfill-api] ❌ Failed: ${script.name}`, fullError);
      
      backfillStatus.failedProcesses = [
        ...(backfillStatus.failedProcesses || []),
        `${script.name}: ${errorMsg.substring(0, 150)}`,
      ];
      backfillStatus.progress = {
        total: scripts.length,
        completed: backfillStatus.completedProcesses?.length || 0,
        failed: (backfillStatus.failedProcesses?.length || 0),
      };
    }
  }

  backfillStatus.running = false;
  backfillStatus.currentProcess = undefined;
  console.log('[backfill-api] Backfill complete');
}
