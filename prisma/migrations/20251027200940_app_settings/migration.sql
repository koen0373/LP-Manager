-- CreateTable
CREATE TABLE "analytics_provider" (
    "id" BIGSERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_market" (
    "id" BIGSERIAL NOT NULL,
    "providerId" BIGINT NOT NULL,
    "providerSlug" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "feeTierBps" INTEGER NOT NULL,
    "token0Symbol" TEXT NOT NULL,
    "token1Symbol" TEXT NOT NULL,
    "poolAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_market_snapshot" (
    "id" BIGSERIAL NOT NULL,
    "marketIdFk" BIGINT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "price" DECIMAL(38,18) NOT NULL,
    "tvlUsd" DECIMAL(38,18) NOT NULL,
    "volume24hUsd" DECIMAL(38,18),
    "incentiveUsd" DECIMAL(38,18),
    "apyPct" DECIMAL(38,18),

    CONSTRAINT "analytics_market_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_wallet" (
    "id" BIGSERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_position" (
    "id" BIGSERIAL NOT NULL,
    "walletId" BIGINT NOT NULL,
    "marketIdFk" BIGINT NOT NULL,
    "onchainId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "lowerPrice" DECIMAL(38,18) NOT NULL,
    "upperPrice" DECIMAL(38,18) NOT NULL,
    "feeTierBps" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_position_snapshot" (
    "id" BIGSERIAL NOT NULL,
    "positionIdFk" BIGINT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount0" DECIMAL(38,18) NOT NULL,
    "amount1" DECIMAL(38,18) NOT NULL,
    "tvlUsd" DECIMAL(38,18) NOT NULL,
    "feesToken0" DECIMAL(38,18) NOT NULL,
    "feesToken1" DECIMAL(38,18) NOT NULL,
    "feesUsd" DECIMAL(38,18) NOT NULL,
    "incentivesUsd" DECIMAL(38,18),
    "inRange" BOOLEAN NOT NULL,

    CONSTRAINT "analytics_position_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_wallet_metrics_daily" (
    "id" BIGSERIAL NOT NULL,
    "walletId" BIGINT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "poolsCount" INTEGER NOT NULL,
    "activePoolsCount" INTEGER NOT NULL,
    "tvlUsd" DECIMAL(38,18) NOT NULL,
    "realizedFeesUsd" DECIMAL(38,18) NOT NULL,
    "avgApyPct" DECIMAL(38,18),
    "avgRangeWidthRatio" DECIMAL(38,18),

    CONSTRAINT "analytics_wallet_metrics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_market_metrics_daily" (
    "id" BIGSERIAL NOT NULL,
    "marketIdFk" BIGINT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "tvlUsd" DECIMAL(38,18) NOT NULL,
    "activePositions" INTEGER NOT NULL,
    "avgApyPct" DECIMAL(38,18),

    CONSTRAINT "analytics_market_metrics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_discovery_log" (
    "id" BIGSERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "txHash" TEXT,
    "block" BIGINT,
    "wallet" TEXT NOT NULL,
    "marketId" TEXT,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_discovery_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "analytics_provider_slug_key" ON "analytics_provider"("slug");

-- CreateIndex
CREATE INDEX "analytics_market_providerId_idx" ON "analytics_market"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_market_providerSlug_marketId_key" ON "analytics_market"("providerSlug", "marketId");

-- CreateIndex
CREATE INDEX "analytics_market_snapshot_marketIdFk_ts_idx" ON "analytics_market_snapshot"("marketIdFk", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_wallet_address_key" ON "analytics_wallet"("address");

-- CreateIndex
CREATE INDEX "analytics_position_walletId_idx" ON "analytics_position"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_position_marketIdFk_onchainId_key" ON "analytics_position"("marketIdFk", "onchainId");

-- CreateIndex
CREATE INDEX "analytics_position_snapshot_positionIdFk_ts_idx" ON "analytics_position_snapshot"("positionIdFk", "ts");

-- CreateIndex
CREATE INDEX "analytics_wallet_metrics_daily_day_idx" ON "analytics_wallet_metrics_daily"("day");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_wallet_metrics_daily_walletId_day_key" ON "analytics_wallet_metrics_daily"("walletId", "day");

-- CreateIndex
CREATE INDEX "analytics_market_metrics_daily_day_idx" ON "analytics_market_metrics_daily"("day");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_market_metrics_daily_marketIdFk_day_key" ON "analytics_market_metrics_daily"("marketIdFk", "day");

-- CreateIndex
CREATE INDEX "analytics_discovery_log_provider_ts_idx" ON "analytics_discovery_log"("provider", "ts");

-- AddForeignKey
ALTER TABLE "analytics_market" ADD CONSTRAINT "analytics_market_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "analytics_provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_market_snapshot" ADD CONSTRAINT "analytics_market_snapshot_marketIdFk_fkey" FOREIGN KEY ("marketIdFk") REFERENCES "analytics_market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_position" ADD CONSTRAINT "analytics_position_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "analytics_wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_position" ADD CONSTRAINT "analytics_position_marketIdFk_fkey" FOREIGN KEY ("marketIdFk") REFERENCES "analytics_market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_position_snapshot" ADD CONSTRAINT "analytics_position_snapshot_positionIdFk_fkey" FOREIGN KEY ("positionIdFk") REFERENCES "analytics_position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_wallet_metrics_daily" ADD CONSTRAINT "analytics_wallet_metrics_daily_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "analytics_wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_market_metrics_daily" ADD CONSTRAINT "analytics_market_metrics_daily_marketIdFk_fkey" FOREIGN KEY ("marketIdFk") REFERENCES "analytics_market"("id") ON DELETE CASCADE ON UPDATE CASCADE;
