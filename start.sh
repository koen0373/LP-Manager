#!/bin/sh

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 LiquiLab Startup Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "🔍 Environment Check:"
echo "   PWD: $(pwd)"
echo "   USER: $(whoami)"
echo "   PORT: ${PORT:-3000}"
echo "   NODE_ENV: ${NODE_ENV:-development}"

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo "   DATABASE_URL: ❌ NOT SET"
  echo ""
  echo "⚠️  WARNING: DATABASE_URL is missing!"
  echo "   Skipping migrations..."
  echo ""
else
  echo "   DATABASE_URL: ✅ SET (${DATABASE_URL:0:40}...)"
  echo ""
  echo "🔄 Running Prisma migrations..."
  if npx prisma migrate deploy 2>&1; then
    echo "✅ Migrations complete!"
  else
    echo "⚠️  Migrations failed (exit code: $?)"
    echo "   Continuing anyway..."
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Starting Next.js Server"
echo "   Port: ${PORT:-3000}"
echo "   Mode: production"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start Next.js (use exec to replace shell process)
# -H 0.0.0.0 is required for Railway to bind to all interfaces
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"

