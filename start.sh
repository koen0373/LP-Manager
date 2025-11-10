#!/bin/sh

echo "🔍 Checking environment..."
echo "   PORT: ${PORT:-3000}"
echo "   NODE_ENV: ${NODE_ENV:-development}"
echo "   DATABASE_URL: ${DATABASE_URL:0:30}..." # Show first 30 chars only

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL is not set!"
  echo "   Skipping migrations and starting app anyway..."
else
  echo "🔄 Running Prisma migrations..."
  if npx prisma migrate deploy; then
    echo "✅ Migrations complete!"
  else
    echo "⚠️  Migrations failed, but continuing to start app..."
  fi
fi

echo "🚀 Starting Next.js server on port ${PORT:-3000}..."

# Don't use 'set -e' to allow graceful error handling
exec npx next start -p "${PORT:-3000}"

