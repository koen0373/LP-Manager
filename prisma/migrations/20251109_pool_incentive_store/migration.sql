CREATE TABLE IF NOT EXISTS "pool_incentive" (
  "pool_address" text PRIMARY KEY,
  "provider" text NOT NULL,
  "usd_per_day" numeric(38,18) NOT NULL DEFAULT 0,
  "tokens" jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pool_incentive_pool_address_idx
  ON "pool_incentive" ("pool_address");
