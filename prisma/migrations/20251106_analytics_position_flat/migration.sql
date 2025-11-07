CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_position_flat AS
SELECT
  NULL::text AS token_id,
  NULL::text AS nfpm_address,
  NULL::text AS pool_address,
  NULL::text AS owner_address,
  NULL::integer AS first_block,
  NULL::integer AS last_block,
  NULL::integer AS mint_events,
  NULL::integer AS burn_events,
  NULL::integer AS collect_events,
  NULL::integer AS transfer_events
WHERE FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS analytics_position_flat_token_idx ON analytics_position_flat(token_id);
CREATE INDEX IF NOT EXISTS analytics_position_flat_owner_idx ON analytics_position_flat(owner_address);
CREATE INDEX IF NOT EXISTS analytics_position_flat_pool_idx  ON analytics_position_flat(pool_address);
CREATE INDEX IF NOT EXISTS analytics_position_flat_nfpm_idx  ON analytics_position_flat(nfpm_address);
