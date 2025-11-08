/**
 * Railway cron helper to refresh ANKR billing cache once per day.
 * Invoke via: `node scripts/scheduler/ankr-refresh.ts`
 */

const DEFAULT_BASE = 'https://liquilab-production.up.railway.app';

async function main() {
  const baseUrl = (process.env.APP_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
  const endpoint = `${baseUrl}/api/admin/ankr?refresh=1`;
  const ts = new Date().toISOString();

  try {
    const res = await fetch(endpoint, { headers: { 'User-Agent': 'LiquiLab-Ankr-Refresh/1.0' } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`status ${res.status} ${res.statusText} - ${body}`);
    }
    console.log(`[${ts}] ANKR refresh succeeded via ${endpoint}`);
    process.exit(0);
  } catch (err) {
    console.error(`[${ts}] ANKR refresh failed:`, err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
