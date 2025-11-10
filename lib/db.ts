/**
 * Database connection pool with short timeouts for 502 hardening
 * 
 * Uses pg Pool with aggressive timeouts to prevent hanging connections.
 * SSL is auto-detected from DATABASE_URL (Railway Postgres includes ?sslmode=require).
 */

import { Pool } from 'pg';

let pool: Pool | null = null;

/**
 * Reset the database pool (useful for testing or config changes)
 */
export function resetDbPool(): void {
  if (pool) {
    pool.end().catch(() => {
      // Ignore errors during reset
    });
    pool = null;
  }
}

export function getDbPool(): Pool {
  if (pool) {
    return pool;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Detect Railway connections (proxy or internal)
  const isRailwayProxy = databaseUrl.includes('rlwy.net') || databaseUrl.includes('railway.app');
  const isRailwayInternal = databaseUrl.includes('railway.internal');
  const isRailway = isRailwayProxy || isRailwayInternal;
  
  // Clean URL: remove sslmode parameter if present
  // pg's sslmode=require conflicts with our ssl config object
  let cleanUrl = databaseUrl;
  let needsSSL = false;
  
  if (databaseUrl.includes('sslmode=')) {
    // Strip sslmode parameter - we'll set SSL explicitly
    cleanUrl = databaseUrl.replace(/[?&]sslmode=[^&]*/g, '');
    // Clean up trailing ? or &
    cleanUrl = cleanUrl.replace(/[?&]$/, '');
    needsSSL = true;
  }
  
  // Determine SSL configuration
  let sslConfig: boolean | { rejectUnauthorized: boolean } | undefined = undefined;
  
  if (isRailwayProxy) {
    // Railway proxy (rlwy.net) uses self-signed certs - always need SSL
    sslConfig = { rejectUnauthorized: false };
  } else if (isRailwayInternal) {
    // Railway internal network doesn't need SSL
    sslConfig = undefined;
  } else if (needsSSL || process.env.DATABASE_SSL === 'true') {
    // Other SSL connections
    sslConfig = { rejectUnauthorized: false };
  }

  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[db] Pool config:', {
      isRailwayProxy,
      isRailwayInternal,
      hasSSLConfig: !!sslConfig,
      urlHasSslMode: databaseUrl.includes('sslmode'),
      cleanedURL: cleanUrl.substring(0, 50) + '...',
    });
  }

  const poolConfig: any = {
    connectionString: cleanUrl,
    connectionTimeoutMillis: 5000, // 5s timeout for Railway proxy connections
    idleTimeoutMillis: 10000, // 10s idle timeout
    max: 5, // Maximum 5 connections in pool
  };

  // Set SSL config if needed
  if (sslConfig !== undefined) {
    poolConfig.ssl = sslConfig;
  }

  pool = new Pool(poolConfig);

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('[db] Unexpected pool error:', err);
  });

  return pool;
}

/**
 * Execute a simple health check query with timeout
 * Uses a proper timeout wrapper that doesn't leave hanging queries
 */
export async function dbHealthCheck(timeoutMs: number = 1000): Promise<boolean> {
  let queryResolved = false;
  
  try {
    const pool = getDbPool();
    
    // Create query promise
    const queryPromise = pool.query('SELECT 1').then((result) => {
      queryResolved = true;
      return result;
    });
    
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        if (!queryResolved) {
          reject(new Error('Health check timeout'));
        }
      }, timeoutMs);
    });

    const result = await Promise.race([queryPromise, timeoutPromise]);
    
    if (!result || !result.rows || result.rows.length === 0) {
      return false;
    }
    
    return result.rows[0]['?column?'] === 1;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Health check timeout') {
        console.warn('[db] Health check timeout after', timeoutMs, 'ms');
        return false;
      }
      // Log the actual error for debugging
      console.warn('[db] Health check failed:', error.message);
      // Don't log full stack in production to avoid noise
      if (process.env.NODE_ENV === 'development') {
        console.warn('[db] Stack:', error.stack);
      }
    } else {
      console.warn('[db] Health check failed with unknown error:', error);
    }
    return false;
  }
}

/**
 * Gracefully close the pool
 */
export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

