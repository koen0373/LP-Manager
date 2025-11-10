# Indexer 502 Fix Plan - Backend Expert Analysis

## 🔴 Kritieke Problemen

### 1. **Prisma Queries Zonder Timeouts**
**Probleem:** Alle Prisma queries kunnen oneindig hangen, wat Railway timeouts veroorzaakt.

**Oplossing:**
```typescript
// Wrapper functie voor Prisma queries met timeout
async function withPrismaTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 10000
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Prisma query timeout after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

// Gebruik in dbWriter.ts:
const result = await withPrismaTimeout(
  this.prisma.$transaction(...),
  15000 // 15s timeout voor batches
);
```

### 2. **Prisma Client Connection Pool Management**
**Probleem:** Elke IndexerCore maakt nieuwe PrismaClient → connection pool exhaustion.

**Oplossing:**
```typescript
// Singleton PrismaClient met connection pool limits
let prismaClient: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      // Connection pool limits
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }
  return prismaClient;
}

// In indexerCore.ts:
constructor() {
  this.prisma = getPrismaClient(); // Gedeelde client
}
```

### 3. **Circuit Breaker Pattern**
**Probleem:** Bij database failures blijft het retryen zonder backoff.

**Oplossing:**
```typescript
class DatabaseCircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > 60000) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker OPEN - database unavailable');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= 5) {
      this.state = 'OPEN';
    }
  }
}
```

### 4. **Batch Size Limits & Memory Management**
**Probleem:** Grote batches kunnen memory pressure veroorzaken.

**Oplossing:**
```typescript
// In indexerCore.ts:
const MAX_BATCH_SIZE = 10000; // Hard limit
const MAX_MEMORY_MB = 500; // Max memory usage

// Check memory before processing
function checkMemory(): void {
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  if (used > MAX_MEMORY_MB) {
    throw new Error(`Memory limit exceeded: ${used.toFixed(2)}MB`);
  }
}

// Process in smaller chunks
async function processLogsInChunks(logs: Log[], chunkSize = 5000) {
  for (let i = 0; i < logs.length; i += chunkSize) {
    checkMemory();
    const chunk = logs.slice(i, i + chunkSize);
    await processChunk(chunk);
  }
}
```

### 5. **Graceful Degradation**
**Probleem:** Als één onderdeel faalt, faalt alles.

**Oplossing:**
```typescript
// In indexerCore.ts:
async index(options: IndexOptions): Promise<IndexResult> {
  const result: IndexResult = {
    blocksScanned: 0,
    logsFound: 0,
    eventsDecoded: 0,
    eventsWritten: 0,
    duplicates: 0,
    errors: 0,
    elapsedMs: 0,
    checkpointSaved: false,
  };
  
  try {
    // Scan (kan falen, maar we gaan door)
    const logs = await this.scanWithFallback(options);
    result.logsFound = logs.length;
    
    // Decode (kan falen, maar we gaan door)
    const events = await this.decodeWithFallback(logs);
    result.eventsDecoded = events.length;
    
    // Write (kan falen, maar checkpoint wordt opgeslagen)
    const writeStats = await this.writeWithFallback(events);
    result.eventsWritten = writeStats.written;
    result.errors = writeStats.errors;
    
    // Checkpoint altijd opslaan (zelfs bij errors)
    await this.saveCheckpointSafe(toBlock);
    result.checkpointSaved = true;
    
  } catch (error) {
    // Log maar crash niet
    console.error('[INDEXER] Partial failure:', error);
  }
  
  return result;
}
```

### 6. **Database Connection Health Checks**
**Probleem:** Geen monitoring van database connectiviteit.

**Oplossing:**
```typescript
// Pre-flight health check
async function ensureDatabaseHealthy(): Promise<boolean> {
  try {
    const pool = getDbPool();
    const result = await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('DB health check timeout')), 2000)
      ),
    ]);
    return true;
  } catch {
    return false;
  }
}

// In indexer-follower.ts:
while (true) {
  const dbHealthy = await ensureDatabaseHealthy();
  if (!dbHealthy) {
    console.error('[INDEXER] Database unhealthy, waiting...');
    await sleep(10000);
    continue;
  }
  
  // Proceed with indexing
}
```

## 📋 Implementatie Prioriteit

### **P0 (Kritiek - Direct implementeren):**
1. ✅ Prisma query timeouts (15s voor batches, 5s voor single queries)
2. ✅ Singleton PrismaClient met connection pool limits
3. ✅ Circuit breaker voor database operations

### **P1 (Hoog - Deze week):**
4. ✅ Batch size limits & memory checks
5. ✅ Graceful degradation (partial failures)
6. ✅ Database health checks voor elke sync

### **P2 (Medium - Volgende sprint):**
7. ✅ Metrics & monitoring (Prometheus/StatsD)
8. ✅ Retry strategy met exponential backoff
9. ✅ Connection pool monitoring

## 🎯 Verwachte Resultaten

Na implementatie:
- ✅ Geen 502 errors meer door database timeouts
- ✅ Indexer blijft draaien bij database issues (circuit breaker)
- ✅ Betere error recovery (graceful degradation)
- ✅ Lagere memory usage (batch limits)
- ✅ Betere observability (health checks)

## 📊 Monitoring Metrics

Track deze metrics:
- `indexer_db_query_duration_ms` (histogram)
- `indexer_db_query_timeouts_total` (counter)
- `indexer_circuit_breaker_state` (gauge)
- `indexer_memory_usage_mb` (gauge)
- `indexer_batch_size` (histogram)

