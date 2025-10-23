#!/bin/bash

# Railway Environment Variables Setup Script
# Run this after: railway init

echo "🚂 Setting up Railway environment variables..."
echo ""
echo "⚠️  IMPORTANT: Replace YOUR_VERCEL_POSTGRES_URL with your actual URL!"
echo ""
echo "Get your DATABASE_URL from:"
echo "https://vercel.com/koen0373/enosys-lp-manager-v2/settings/environment-variables"
echo ""
echo "Look for POSTGRES_URL (NOT POSTGRES_PRISMA_URL)"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Prompt for DATABASE_URL
echo ""
echo "Paste your Vercel POSTGRES_URL here:"
read -r DATABASE_URL

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL cannot be empty"
  exit 1
fi

echo ""
echo "Setting Railway variables..."

railway variables set \
  DATABASE_URL="$DATABASE_URL" \
  FLARE_RPC_URL="https://flare.flr.finance/ext/bc/C/rpc" \
  NPM_ADDRESS="0x17AA157AC8C54034381b840Cb8f6bf7Fc355f0de" \
  START_BLOCK="0" \
  NODE_ENV="production"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Environment variables set successfully!"
  echo ""
  echo "Next steps:"
  echo "1. Deploy: railway up"
  echo "2. Set start command in Railway dashboard:"
  echo "   railway open → Settings → Start Command: npm run indexer:follow"
  echo "3. View logs: railway logs"
else
  echo ""
  echo "❌ Failed to set variables. Make sure you ran 'railway init' first"
  exit 1
fi

