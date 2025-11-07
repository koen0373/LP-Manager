-- Ensure analytics_position table exists with required columns.
CREATE TABLE IF NOT EXISTS analytics_position (
    token_id      TEXT PRIMARY KEY,
    owner_address TEXT NULL,
    pool_address  TEXT NULL,
    nfpm_address  TEXT NULL,
    first_block   INTEGER NULL,
    last_block    INTEGER NULL,
    first_seen_at TIMESTAMP NULL,
    last_seen_at  TIMESTAMP NULL
);

-- Idempotent column additions (in case table existed with partial schema).
ALTER TABLE analytics_position
    ADD COLUMN IF NOT EXISTS owner_address TEXT NULL,
    ADD COLUMN IF NOT EXISTS pool_address  TEXT NULL,
    ADD COLUMN IF NOT EXISTS nfpm_address  TEXT NULL,
    ADD COLUMN IF NOT EXISTS first_block   INTEGER NULL,
    ADD COLUMN IF NOT EXISTS last_block    INTEGER NULL,
    ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS last_seen_at  TIMESTAMP NULL;

-- Indexes to support owner/pool/nfpm lookups.
CREATE INDEX IF NOT EXISTS analytics_position_owner_idx ON analytics_position(owner_address);
CREATE INDEX IF NOT EXISTS analytics_position_pool_idx  ON analytics_position(pool_address);
CREATE INDEX IF NOT EXISTS analytics_position_nfpm_idx  ON analytics_position(nfpm_address);
