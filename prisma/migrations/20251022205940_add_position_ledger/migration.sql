-- CreateTable
CREATE TABLE "PositionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenId" TEXT NOT NULL,
    "pool" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "sender" TEXT,
    "owner" TEXT,
    "recipient" TEXT,
    "tickLower" INTEGER,
    "tickUpper" INTEGER,
    "tick" INTEGER,
    "liquidityDelta" TEXT,
    "amount0" TEXT,
    "amount1" TEXT,
    "sqrtPriceX96" TEXT,
    "price1Per0" REAL,
    "usdValue" REAL,
    "metadata" JSONB
);

-- CreateTable
CREATE TABLE "PositionTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenId" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "metadata" JSONB
);

-- CreateTable
CREATE TABLE "CapitalFlow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wallet" TEXT NOT NULL,
    "tokenId" TEXT,
    "pool" TEXT,
    "flowType" TEXT NOT NULL,
    "amountUsd" REAL NOT NULL,
    "amount0" TEXT,
    "amount1" TEXT,
    "timestamp" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "relatedTx" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "PositionEvent_tokenId_blockNumber_idx" ON "PositionEvent"("tokenId", "blockNumber");

-- CreateIndex
CREATE INDEX "PositionEvent_pool_blockNumber_idx" ON "PositionEvent"("pool", "blockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PositionEvent_txHash_logIndex_key" ON "PositionEvent"("txHash", "logIndex");

-- CreateIndex
CREATE INDEX "PositionTransfer_tokenId_blockNumber_idx" ON "PositionTransfer"("tokenId", "blockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PositionTransfer_txHash_logIndex_key" ON "PositionTransfer"("txHash", "logIndex");

-- CreateIndex
CREATE INDEX "CapitalFlow_wallet_timestamp_idx" ON "CapitalFlow"("wallet", "timestamp");

-- CreateIndex
CREATE INDEX "CapitalFlow_tokenId_timestamp_idx" ON "CapitalFlow"("tokenId", "timestamp");

-- CreateIndex
CREATE INDEX "CapitalFlow_pool_timestamp_idx" ON "CapitalFlow"("pool", "timestamp");
