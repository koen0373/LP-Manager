/**
 * Prisma Query Utilities
 * 
 * Provides timeout wrappers and circuit breaker for Prisma queries
 * to prevent 502 errors from hanging database connections.
 */

import { PrismaClient } from '@prisma/client';

/**
 * Execute a Prisma query with timeout
 * Prevents hanging queries that cause Railway 502 errors
 */
export async function withPrismaTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 10000,
  operationName?: string
): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          `Prisma query timeout after ${timeoutMs}ms${operationName ? ` (${operationName})` : ''}`
        )
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      console.error(`[PRISMA] Query timeout: ${operationName || 'unknown'} after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Circuit Breaker for Database Operations
 * 
 * Prevents cascading failures by opening circuit after consecutive failures.
 * States:
 * - CLOSED: Normal operation
 * - OPEN: Circuit open, reject requests immediately
 * - HALF_OPEN: Testing if service recovered
 */
export class DatabaseCircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMaxAttempts: number;
  private halfOpenAttempts = 0;

  constructor(
    failureThreshold: number = 5,
    resetTimeoutMs: number = 60000,
    halfOpenMaxAttempts: number = 3
  ) {
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.halfOpenMaxAttempts = halfOpenMaxAttempts;
  }

  /**
   * Execute a database operation through circuit breaker
   */
  async execute<T>(fn: () => Promise<T>, operationName?: string): Promise<T> {
    // Check circuit state
    if (this.state === 'OPEN') {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure > this.resetTimeoutMs) {
        // Try half-open
        this.state = 'HALF_OPEN';
        this.halfOpenAttempts = 0;
        console.log('[CIRCUIT] Moving to HALF_OPEN state');
      } else {
        throw new Error(
          `Circuit breaker OPEN - database unavailable (retry in ${Math.ceil(
            (this.resetTimeoutMs - timeSinceFailure) / 1000
          )}s)`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(operationName);
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.halfOpenAttempts = 0;
    if (this.state === 'HALF_OPEN') {
      // Success in half-open means service recovered
      this.state = 'CLOSED';
      console.log('[CIRCUIT] Service recovered, moving to CLOSED state');
    }
  }

  private onFailure(operationName?: string): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.halfOpenMaxAttempts) {
        // Still failing, back to OPEN
        this.state = 'OPEN';
        console.error(
          `[CIRCUIT] Service still failing after ${this.halfOpenAttempts} attempts, moving to OPEN state`
        );
      }
    } else if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      console.error(
        `[CIRCUIT] Too many failures (${this.failures}), opening circuit${operationName ? ` (${operationName})` : ''}`
      );
    }
  }

  /**
   * Get current circuit state
   */
  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.state;
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.failures;
  }

  /**
   * Manually reset circuit breaker (for testing/recovery)
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.halfOpenAttempts = 0;
    this.lastFailureTime = 0;
    console.log('[CIRCUIT] Circuit breaker manually reset');
  }
}

/**
 * Singleton PrismaClient with connection pool management
 * 
 * Prevents connection pool exhaustion by reusing a single client instance
 */
let prismaClient: PrismaClient | null = null;
let prismaClientPromise: Promise<PrismaClient> | null = null;

export function getPrismaClient(): PrismaClient {
  if (prismaClient) {
    return prismaClient;
  }

  // Prevent multiple simultaneous initializations
  if (!prismaClientPromise) {
    prismaClientPromise = (async () => {
      const client = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
        // Connection pool configuration
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
      });

      // Test connection on startup
      try {
        await client.$connect();
        console.log('[PRISMA] Client initialized and connected');
      } catch (error) {
        console.error('[PRISMA] Failed to connect:', error);
        throw error;
      }

      prismaClient = client;
      return client;
    })();
  }

  // If we're here, initialization is in progress
  // This shouldn't happen in practice, but handle gracefully
  throw new Error('PrismaClient initialization in progress');
}

/**
 * Get PrismaClient asynchronously (waits for initialization)
 */
export async function getPrismaClientAsync(): Promise<PrismaClient> {
  if (prismaClient) {
    return prismaClient;
  }

  if (!prismaClientPromise) {
    prismaClientPromise = (async () => {
      const client = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
      });

      try {
        await client.$connect();
        console.log('[PRISMA] Client initialized and connected');
      } catch (error) {
        console.error('[PRISMA] Failed to connect:', error);
        throw error;
      }

      prismaClient = client;
      return client;
    })();
  }

  return prismaClientPromise;
}

/**
 * Gracefully disconnect PrismaClient
 */
export async function disconnectPrismaClient(): Promise<void> {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = null;
    prismaClientPromise = null;
    console.log('[PRISMA] Client disconnected');
  }
}

/**
 * Check memory usage and throw if limit exceeded
 */
export function checkMemoryLimit(maxMemoryMB: number = 500): void {
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  if (used > maxMemoryMB) {
    const error = new Error(`Memory limit exceeded: ${used.toFixed(2)}MB (limit: ${maxMemoryMB}MB)`);
    console.error('[MEMORY]', error.message);
    throw error;
  }
}

/**
 * Get current memory usage in MB
 */
export function getMemoryUsageMB(): number {
  return process.memoryUsage().heapUsed / 1024 / 1024;
}

