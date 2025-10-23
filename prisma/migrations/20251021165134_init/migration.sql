-- CreateTable
CREATE TABLE "PoolEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pool" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "eventName" TEXT NOT NULL,
    "sender" TEXT,
    "owner" TEXT,
    "recipient" TEXT,
    "tickLower" INTEGER,
    "tickUpper" INTEGER,
    "amount" TEXT,
    "amount0" TEXT,
    "amount1" TEXT,
    "sqrtPriceX96" TEXT,
    "liquidity" TEXT,
    "tick" INTEGER
);

-- CreateIndex
CREATE INDEX "PoolEvent_pool_blockNumber_idx" ON "PoolEvent"("pool", "blockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PoolEvent_txHash_logIndex_key" ON "PoolEvent"("txHash", "logIndex");
