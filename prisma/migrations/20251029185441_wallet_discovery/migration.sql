-- CreateTable
CREATE TABLE "discovered_wallet" (
    "address" TEXT NOT NULL,
    "addressLower" TEXT NOT NULL,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "discovered_wallet_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "discovered_wallet_source" (
    "id" BIGSERIAL NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "txHash" TEXT,
    "block" BIGINT,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discovered_wallet_source_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "discovered_wallet_addressLower_key" ON "discovered_wallet"("addressLower");

-- CreateIndex
CREATE INDEX "discovered_wallet_source_provider_ts_idx" ON "discovered_wallet_source"("provider", "ts");

-- CreateIndex
CREATE INDEX "discovered_wallet_source_walletAddress_provider_idx" ON "discovered_wallet_source"("walletAddress", "provider");

-- AddForeignKey
ALTER TABLE "discovered_wallet_source" ADD CONSTRAINT "discovered_wallet_source_walletAddress_fkey" FOREIGN KEY ("walletAddress") REFERENCES "discovered_wallet"("address") ON DELETE CASCADE ON UPDATE CASCADE;
