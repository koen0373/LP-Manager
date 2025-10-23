#!/bin/sh
set -e

echo "🔄 Running Prisma migrations..."
npx prisma migrate deploy

echo "✅ Migrations complete!"
echo "🚀 Starting Next.js server on port ${PORT:-3000}..."

exec npx next start -p "${PORT:-3000}"

