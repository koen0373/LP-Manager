const ttlCache = new Map<string, { expires: number; value: unknown }>();
let pgPool: import('pg').Pool | null = null;

function hasDatabase(): boolean {
  return process.env.DB_DISABLE !== 'true' && Boolean(process.env.DATABASE_URL);
}

async function withTTL<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const cached = ttlCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.value as T;
  }

  const value = await fn();
  ttlCache.set(key, {
    value,
    expires: Date.now() + ttlMs,
  });

  return value;
}

function getPool(pgModule: typeof import('pg')): import('pg').Pool {
  if (!pgPool) {
    pgPool = new pgModule.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
    });
  }
  return pgPool;
}

export async function queryOrDegrade<T>(
  sql: string,
  params: any[] = [],
  ttlMs = 60_000,
): Promise<{ ok: boolean; degrade?: boolean; rows?: T[] }> {
  if (!hasDatabase()) {
    return { ok: false, degrade: true };
  }

  let pgModule: typeof import('pg');
  try {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    pgModule = require('pg');
  } catch {
    return { ok: false, degrade: true };
  }

  const cacheKey = `${sql}::${JSON.stringify(params)}`;

  try {
    const rows = await withTTL<T[]>(cacheKey, ttlMs, async () => {
      const pool = getPool(pgModule);
      const result = await pool.query<T>(sql, params);
      return result.rows;
    });

    return { ok: true, rows };
  } catch {
    return { ok: false, degrade: true };
  }
}

