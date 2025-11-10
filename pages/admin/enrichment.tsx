import { useEffect, useState } from 'react';
import Head from 'next/head';

type IndexerStats = {
  lastSync: {
    timestamp: string | null;
    blockNumber: number | null;
    eventsCount: number;
  };
  checkpoints: Array<{
    source: string;
    key: string;
    lastBlock: number;
    eventsCount: number;
    updatedAt: string;
  }>;
  recentActivity: {
    eventsLast24h: number;
    eventsLastHour: number;
    latestEvent: string | null;
  };
  status: 'active' | 'stale' | 'inactive';
};

type EnrichmentStats = {
  poolAttribution: {
    totalUnknown: number;
    totalPositions: number;
    percentageUnknown: number;
    recentResolved: number;
  };
  feesUsd: {
    totalCollectEvents: number;
    withoutUsdValue: number;
    withUsdValue: number;
    percentageComplete: number;
    recentCalculated: number;
  };
  rangeStatus: {
    totalPositions: number;
    withRangeStatus: number;
    inRange: number;
    outOfRange: number;
    percentageComplete: number;
    recentCalculated: number;
  };
  lastUpdated: string;
};

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

function formatPercentage(value: number): string {
  return value.toFixed(1) + '%';
}

function ProgressBar({ value, max, color = 'bg-blue-500' }: { value: number; max: number; color?: string }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
      <div
        className={`h-full ${color} transition-all duration-300`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );
}

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

function BackfillControls() {
  const [backfillStatus, setBackfillStatus] = useState<BackfillStatus | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadBackfillStatus() {
    try {
      const res = await fetch('/api/admin/backfill');
      if (res.ok) {
        const data = await res.json();
        setBackfillStatus(data);
      }
    } catch (e) {
      console.error('Failed to load backfill status:', e);
    }
  }

  async function startBackfill() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/backfill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start' }),
      });
      if (res.ok) {
        const data = await res.json();
        setBackfillStatus(data.status);
        // Start polling for updates
        const interval = setInterval(() => {
          loadBackfillStatus();
          if (!backfillStatus?.running) {
            clearInterval(interval);
          }
        }, 5000);
      }
    } catch (e) {
      console.error('Failed to start backfill:', e);
    } finally {
      setLoading(false);
    }
  }

  async function stopBackfill() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/backfill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'stop' }),
      });
      if (res.ok) {
        const data = await res.json();
        setBackfillStatus(data.status);
      }
    } catch (e) {
      console.error('Failed to stop backfill:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBackfillStatus();
    const interval = setInterval(loadBackfillStatus, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const progress = backfillStatus?.progress;
  const progressPercent = progress && progress.total > 0
    ? ((progress.completed + progress.failed) / progress.total) * 100
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium mb-2">ANKR Historical Backfill</h3>
          <p className="text-sm text-gray-400">
            One-time enrichment of all historical data using ANKR RPC (5000 block batches)
          </p>
        </div>
        <div className="flex gap-2">
          {!backfillStatus?.running ? (
            <button
              onClick={startBackfill}
              disabled={loading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm font-medium"
            >
              {loading ? 'Starting...' : 'Start Backfill'}
            </button>
          ) : (
            <button
              onClick={stopBackfill}
              disabled={loading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm font-medium"
            >
              {loading ? 'Stopping...' : 'Stop Backfill'}
            </button>
          )}
        </div>
      </div>

      {backfillStatus?.running && (
        <div className="p-4 bg-[#0B1530] rounded border border-gray-700">
          <div className="flex justify-between text-sm mb-2">
            <span>Progress</span>
            <span className="tabular-nums">
              {progress?.completed || 0}/{progress?.total || 10} completed
              {progress?.failed ? ` (${progress.failed} failed)` : ''}
            </span>
          </div>
          <ProgressBar
            value={progress?.completed || 0}
            max={progress?.total || 10}
            color="bg-green-500"
          />
          {backfillStatus.currentProcess && (
            <div className="mt-2 text-sm text-gray-400">
              Current: {backfillStatus.currentProcess}
            </div>
          )}
          {backfillStatus.startedAt && (
            <div className="mt-1 text-xs text-gray-500">
              Started: {new Date(backfillStatus.startedAt).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}
            </div>
          )}
        </div>
      )}

      {backfillStatus?.completedProcesses && backfillStatus.completedProcesses.length > 0 && (
        <div className="p-4 bg-[#0B1530] rounded border border-gray-700">
          <div className="text-sm text-gray-400 mb-2">Completed Processes</div>
          <div className="space-y-1">
            {backfillStatus.completedProcesses.map((process, idx) => (
              <div key={idx} className="text-xs text-green-400">✅ {process}</div>
            ))}
          </div>
        </div>
      )}

      {backfillStatus?.failedProcesses && backfillStatus.failedProcesses.length > 0 && (
        <div className="p-4 bg-[#0B1530] rounded border border-red-700">
          <div className="text-sm text-red-400 mb-2">Failed Processes</div>
          <div className="space-y-1">
            {backfillStatus.failedProcesses.map((process, idx) => (
              <div key={idx} className="text-xs text-red-400">❌ {process}</div>
            ))}
          </div>
        </div>
      )}

      {!backfillStatus?.running && backfillStatus?.completedProcesses && backfillStatus.completedProcesses.length > 0 && (
        <div className="p-4 bg-green-900/20 rounded border border-green-700">
          <div className="text-sm text-green-400">
            ✅ Backfill completed! Check enrichment stats above for results.
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminEnrichment() {
  const [stats, setStats] = useState<EnrichmentStats | null>(null);
  const [indexerStats, setIndexerStats] = useState<IndexerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [autoRefresh, setAutoRefresh] = useState(true);

  async function loadStats() {
    try {
      setError(undefined);
      const [enrichmentRes, indexerRes] = await Promise.all([
        fetch('/api/admin/enrichment-stats'),
        fetch('/api/admin/indexer-stats'),
      ]);

      if (enrichmentRes.ok) {
        const data: EnrichmentStats = await enrichmentRes.json();
        setStats(data);
      } else {
        throw new Error(`Enrichment stats HTTP ${enrichmentRes.status}`);
      }

      if (indexerRes.ok) {
        const data: IndexerStats = await indexerRes.json();
        setIndexerStats(data);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
    const interval = setInterval(() => {
      if (autoRefresh) {
        loadStats();
      }
    }, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [autoRefresh]);

  if (loading && !stats) {
    return (
      <main className="min-h-screen text-white" style={{ background: '#0B1530' }}>
        <Head><title>LiquiLab — Admin / Enrichment</title></Head>
        <div className="max-w-7xl mx-auto p-6">
          <div className="text-center py-12">Loading...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-white" style={{ background: '#0B1530', fontFamily: 'ui-sans-serif, system-ui, -apple-system, Inter, Segoe UI, Roboto' }}>
      <Head><title>LiquiLab — Admin / Enrichment</title></Head>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Admin — Data Enrichment</h1>
            <div className="mt-2 flex gap-2 text-sm">
              <a href="/admin/db" className="text-blue-400 hover:text-blue-300">Database</a>
              <span className="text-gray-600">|</span>
              <a href="/admin/ankr" className="text-blue-400 hover:text-blue-300">ANKR</a>
              <span className="text-gray-600">|</span>
              <a href="/admin/payments" className="text-blue-400 hover:text-blue-300">Payments</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Auto-refresh (30s)</span>
            </label>
            <button
              onClick={loadStats}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-700 rounded text-red-200">
            Error: {error}
          </div>
        )}

        {/* Indexer Status Section */}
        {indexerStats && (
          <div className="mb-8 p-6 bg-[#1a1f3a] rounded-lg border border-gray-700">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              Indexer Status
              <span
                className={`px-2 py-1 text-xs rounded ${
                  indexerStats.status === 'active'
                    ? 'bg-green-600 text-white'
                    : indexerStats.status === 'stale'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-red-600 text-white'
                }`}
              >
                {indexerStats.status.toUpperCase()}
              </span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="p-4 bg-[#0B1530] rounded border border-gray-700">
                <div className="text-sm text-gray-400 mb-1">Last Sync</div>
                <div className="text-lg font-semibold">
                  {indexerStats.lastSync.timestamp || 'Never'}
                </div>
                {indexerStats.lastSync.blockNumber && (
                  <div className="text-xs text-gray-500 mt-1">
                    Block #{indexerStats.lastSync.blockNumber.toLocaleString()}
                  </div>
                )}
              </div>

              <div className="p-4 bg-[#0B1530] rounded border border-gray-700">
                <div className="text-sm text-gray-400 mb-1">Events (24h)</div>
                <div className="text-lg font-semibold">
                  {formatNumber(indexerStats.recentActivity.eventsLast24h)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatNumber(indexerStats.recentActivity.eventsLastHour)} in last hour
                </div>
              </div>

              <div className="p-4 bg-[#0B1530] rounded border border-gray-700">
                <div className="text-sm text-gray-400 mb-1">Total Events</div>
                <div className="text-lg font-semibold">
                  {formatNumber(indexerStats.lastSync.eventsCount)}
                </div>
                {indexerStats.recentActivity.latestEvent && (
                  <div className="text-xs text-gray-500 mt-1">
                    Latest: {indexerStats.recentActivity.latestEvent}
                  </div>
                )}
              </div>
            </div>

            {/* Checkpoints */}
            {indexerStats.checkpoints.length > 0 && (
              <div className="mt-4">
                <div className="text-sm text-gray-400 mb-2">Recent Checkpoints:</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {indexerStats.checkpoints.slice(0, 6).map((cp, idx) => (
                    <div key={idx} className="p-3 bg-[#0B1530] rounded border border-gray-700 text-xs">
                      <div className="font-semibold">{cp.source}:{cp.key}</div>
                      <div className="text-gray-400">Block {cp.lastBlock.toLocaleString()}</div>
                      <div className="text-gray-500">{cp.updatedAt}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {stats && (
          <>
            {/* Pool Attribution Section */}
            <div className="mb-8 p-6 bg-[#1a1f3a] rounded-lg border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Pool Attribution</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="p-4 bg-[#0B1530] rounded border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Total Positions</div>
                  <div className="text-2xl font-bold tabular-nums">{formatNumber(stats.poolAttribution.totalPositions)}</div>
                </div>
                <div className="p-4 bg-[#0B1530] rounded border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Unknown Pool</div>
                  <div className="text-2xl font-bold text-yellow-400 tabular-nums">{formatNumber(stats.poolAttribution.totalUnknown)}</div>
                </div>
                <div className="p-4 bg-[#0B1530] rounded border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Known Pool</div>
                  <div className="text-2xl font-bold text-green-400 tabular-nums">
                    {formatNumber(stats.poolAttribution.totalPositions - stats.poolAttribution.totalUnknown)}
                  </div>
                </div>
                <div className="p-4 bg-[#0B1530] rounded border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Resolved (24h)</div>
                  <div className="text-2xl font-bold text-blue-400 tabular-nums">{formatNumber(stats.poolAttribution.recentResolved)}</div>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Completion Progress</span>
                  <span className="tabular-nums">
                    {formatPercentage(100 - stats.poolAttribution.percentageUnknown)} complete
                  </span>
                </div>
                <ProgressBar
                  value={stats.poolAttribution.totalPositions - stats.poolAttribution.totalUnknown}
                  max={stats.poolAttribution.totalPositions}
                  color="bg-green-500"
                />
              </div>
            </div>

            {/* Fees USD Section */}
            <div className="mb-8 p-6 bg-[#1a1f3a] rounded-lg border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Fees USD Calculation</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="p-4 bg-[#0B1530] rounded border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Total COLLECT Events</div>
                  <div className="text-2xl font-bold tabular-nums">{formatNumber(stats.feesUsd.totalCollectEvents)}</div>
                </div>
                <div className="p-4 bg-[#0B1530] rounded border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Without USD Value</div>
                  <div className="text-2xl font-bold text-yellow-400 tabular-nums">{formatNumber(stats.feesUsd.withoutUsdValue)}</div>
                </div>
                <div className="p-4 bg-[#0B1530] rounded border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">With USD Value</div>
                  <div className="text-2xl font-bold text-green-400 tabular-nums">{formatNumber(stats.feesUsd.withUsdValue)}</div>
                </div>
                <div className="p-4 bg-[#0B1530] rounded border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Calculated (24h)</div>
                  <div className="text-2xl font-bold text-blue-400 tabular-nums">{formatNumber(stats.feesUsd.recentCalculated)}</div>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Completion Progress</span>
                  <span className="tabular-nums">
                    {formatPercentage(stats.feesUsd.percentageComplete)} complete
                  </span>
                </div>
                <ProgressBar
                  value={stats.feesUsd.withUsdValue}
                  max={stats.feesUsd.totalCollectEvents}
                  color="bg-blue-500"
                />
              </div>
            </div>

            {/* Range Status Section */}
            <div className="mb-8 p-6 bg-[#1a1f3a] rounded-lg border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Range Status</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                <div className="p-4 bg-[#0B1530] rounded border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Total Positions</div>
                  <div className="text-2xl font-bold tabular-nums">{formatNumber(stats.rangeStatus.totalPositions)}</div>
                </div>
                <div className="p-4 bg-[#0B1530] rounded border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">With Range Status</div>
                  <div className="text-2xl font-bold text-green-400 tabular-nums">{formatNumber(stats.rangeStatus.withRangeStatus)}</div>
                </div>
                <div className="p-4 bg-[#0B1530] rounded border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">IN_RANGE</div>
                  <div className="text-2xl font-bold text-green-400 tabular-nums">{formatNumber(stats.rangeStatus.inRange)}</div>
                </div>
                <div className="p-4 bg-[#0B1530] rounded border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">OUT_OF_RANGE</div>
                  <div className="text-2xl font-bold text-yellow-400 tabular-nums">{formatNumber(stats.rangeStatus.outOfRange)}</div>
                </div>
                <div className="p-4 bg-[#0B1530] rounded border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Calculated (24h)</div>
                  <div className="text-2xl font-bold text-blue-400 tabular-nums">{formatNumber(stats.rangeStatus.recentCalculated)}</div>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Completion Progress</span>
                  <span className="tabular-nums">
                    {formatPercentage(stats.rangeStatus.percentageComplete)} complete
                  </span>
                </div>
                <ProgressBar
                  value={stats.rangeStatus.withRangeStatus}
                  max={stats.rangeStatus.totalPositions}
                  color="bg-purple-500"
                />
              </div>
            </div>

            {/* Historical Backfill Section */}
            <div className="mb-8 p-6 bg-[#1a1f3a] rounded-lg border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Historical Backfill</h2>
              <BackfillControls />
            </div>

            {/* Quick Actions */}
            <div className="p-6 bg-[#1a1f3a] rounded-lg border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-[#0B1530] rounded border border-gray-700">
                  <div className="text-sm text-gray-400 mb-2">Run Pool Attribution</div>
                  <code className="text-xs text-gray-500 block mb-2">
                    npm run enrich:data --skip-fees --limit=1000
                  </code>
                  <div className="text-xs text-gray-500">
                    Resolves {formatNumber(Math.min(1000, stats.poolAttribution.totalUnknown))} unknown pools
                  </div>
                </div>
                <div className="p-4 bg-[#0B1530] rounded border border-gray-700">
                  <div className="text-sm text-gray-400 mb-2">Run Fees USD Calculation</div>
                  <code className="text-xs text-gray-500 block mb-2">
                    npm run enrich:data --skip-pool --limit=10000
                  </code>
                  <div className="text-xs text-gray-500">
                    Calculates USD for {formatNumber(Math.min(10000, stats.feesUsd.withoutUsdValue))} events
                  </div>
                </div>
                <div className="p-4 bg-[#0B1530] rounded border border-gray-700">
                  <div className="text-sm text-gray-400 mb-2">Run Range Status</div>
                  <code className="text-xs text-gray-500 block mb-2">
                    npm run enrich:range --limit=1000
                  </code>
                  <div className="text-xs text-gray-500">
                    Calculates range status for {formatNumber(Math.min(1000, stats.rangeStatus.totalPositions - stats.rangeStatus.withRangeStatus))} positions
                  </div>
                </div>
                <div className="p-4 bg-[#0B1530] rounded border border-gray-700">
                  <div className="text-sm text-gray-400 mb-2">Run All</div>
                  <code className="text-xs text-gray-500 block mb-2">
                    npm run enrich:data --limit=1000
                  </code>
                  <div className="text-xs text-gray-500">
                    Runs pool attribution + fees USD
                  </div>
                </div>
              </div>
            </div>

            {/* Last Updated */}
            <div className="mt-4 text-sm text-gray-500 text-center">
              Last updated: {new Date(stats.lastUpdated).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

