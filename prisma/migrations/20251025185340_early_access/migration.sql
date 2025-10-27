-- CreateEnum
CREATE TYPE "PositionEventType" AS ENUM ('MINT', 'INCREASE', 'DECREASE', 'COLLECT', 'BURN', 'SWAP', 'OTHER');

-- CreateEnum
CREATE TYPE "CapitalFlowType" AS ENUM ('DEPOSIT', 'WITHDRAW', 'FEES_REALIZED', 'FEES_REINVESTED', 'TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "PoolStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('FAST_FORWARD');

-- CreateEnum
CREATE TYPE "UserState" AS ENUM ('WAITLIST', 'ACTIVATED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "state" "UserState" NOT NULL DEFAULT 'WAITLIST',
    "poolAllowance" INTEGER NOT NULL DEFAULT 0,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoolEvent" (
    "id" TEXT NOT NULL,
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
    "tick" INTEGER,

    CONSTRAINT "PoolEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "wallet" TEXT,
    "fastTrack" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionEvent" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "pool" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "eventType" "PositionEventType" NOT NULL,
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
    "price1Per0" DOUBLE PRECISION,
    "usdValue" DOUBLE PRECISION,
    "metadata" JSONB,

    CONSTRAINT "PositionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionTransfer" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "PositionTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalFlow" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "tokenId" TEXT,
    "pool" TEXT,
    "flowType" "CapitalFlowType" NOT NULL,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "amount0" TEXT,
    "amount1" TEXT,
    "timestamp" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "relatedTx" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapitalFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "billingStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billingExpiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPool" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "poolId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "PoolStatus" NOT NULL DEFAULT 'ACTIVE',
    "excludedFromBilling" BOOLEAN NOT NULL DEFAULT false,
    "lastActivity" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'crypto',
    "chainId" INTEGER NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "treasuryAddress" TEXT NOT NULL,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "amountToken" DOUBLE PRECISION NOT NULL,
    "txHash" TEXT,
    "intentId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "payerAddress" TEXT,
    "kind" "PaymentKind" NOT NULL DEFAULT 'FAST_FORWARD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "disclaimerAccepted" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncCheckpoint" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lastBlock" INTEGER NOT NULL,
    "lastTimestamp" INTEGER,
    "eventsCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackfillCursor" (
    "tokenId" INTEGER NOT NULL,
    "lastBlock" INTEGER NOT NULL DEFAULT 0,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackfillCursor_pkey" PRIMARY KEY ("tokenId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "PoolEvent_pool_blockNumber_idx" ON "PoolEvent"("pool", "blockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PoolEvent_txHash_logIndex_key" ON "PoolEvent"("txHash", "logIndex");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_email_key" ON "WaitlistEntry"("email");

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

-- CreateIndex
CREATE INDEX "Wallet_billingExpiresAt_idx" ON "Wallet"("billingExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_address_key" ON "Wallet"("userId", "address");

-- CreateIndex
CREATE INDEX "UserPool_walletId_status_idx" ON "UserPool"("walletId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserPool_walletId_poolId_key" ON "UserPool"("walletId", "poolId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_intentId_key" ON "Payment"("intentId");

-- CreateIndex
CREATE INDEX "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SyncCheckpoint_source_lastBlock_idx" ON "SyncCheckpoint"("source", "lastBlock");

-- CreateIndex
CREATE UNIQUE INDEX "SyncCheckpoint_source_key_key" ON "SyncCheckpoint"("source", "key");

-- CreateIndex
CREATE INDEX "BackfillCursor_lastBlock_idx" ON "BackfillCursor"("lastBlock");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPool" ADD CONSTRAINT "UserPool_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
