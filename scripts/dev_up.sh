#!/usr/bin/env bash
set -euo pipefail

LISTEN_HOST="${HOST:-0.0.0.0}"
ACCESS_HOST="${ACCESS_HOST:-127.0.0.1}"
PORT="${PORT:-3000}"
BASE="http://$ACCESS_HOST:$PORT"
LOG="${LOG:-/tmp/liquilab_dev_3000.log}"

# 0) Zorg dat Postgres (Homebrew) actief is
brew services start postgresql@16 >/dev/null 2>&1 || true
/opt/homebrew/opt/postgresql@16/bin/pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1 || {
  echo "… wachten op Postgres"
  until /opt/homebrew/opt/postgresql@16/bin/pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; do sleep 1; done
}
echo "✅ Postgres ready"

# 1) DATABASE_URL in .env (Prisma leest .env)
DBURL='postgresql://postgres:postgres@127.0.0.1:5432/liquilab?schema=public'
touch .env
if grep -q '^DATABASE_URL=' .env; then
  sed -i '' "s#^DATABASE_URL=.*#DATABASE_URL=\"$DBURL\"#" .env
else
  printf 'DATABASE_URL="%s"\n' "$DBURL" >> .env
fi

# Eventueel LL_DISABLE_DB uitzetten in .env.local
if [ -f .env.local ] && grep -q '^LL_DISABLE_DB=' .env.local; then
  sed -i '' 's#^LL_DISABLE_DB=.*#LL_DISABLE_DB="0"#' .env.local
fi

# 2) Prisma
npx prisma generate
npx prisma migrate deploy || npx prisma db push

# 3) Dev-server op :3000 (poort eerst vrijmaken)
if lsof -t -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  kill -15 $(lsof -t -iTCP:$PORT -sTCP:LISTEN) || true; sleep 1
  kill -9  $(lsof -t -iTCP:$PORT -sTCP:LISTEN) || true
fi

nohup npx --yes next dev --turbopack --hostname "$LISTEN_HOST" --port "$PORT" >"$LOG" 2>&1 &
for i in {1..120}; do curl -sf "$BASE/" >/dev/null && break || sleep 1; done
echo "✅ Dev up: $BASE (log: $LOG)"
