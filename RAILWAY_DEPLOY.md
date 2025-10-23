# Railway Deployment Guide

## Quick Start

### 1. Create Railway Project
```bash
# Go to https://railway.app
# Click "New Project"
# Select "Deploy from GitHub repo"
# Connect this repository
```

### 2. Add PostgreSQL Database
```bash
# In your Railway project:
# Click "+ New"
# Select "Database" -> "PostgreSQL"
# Railway will automatically set DATABASE_URL
```

### 3. Configure Environment Variables
```bash
# In Railway project settings, add:
NEXT_PUBLIC_RPC_URL=https://flare.rpc.qa.enosys.global/ext/bc/C/rpc
NEXT_PUBLIC_FALLBACK_RPC_URL=https://flare.rpc.qa.enosys.global/ext/bc/C/rpc

# Optional:
RUN_BACKFILL=false
```

### 4. Deploy
```bash
# Railway will auto-deploy on push to main
# Or click "Deploy" in Railway dashboard
```

## Build Process

Railway will automatically:
1. Run `npm install`
2. Run `npm run build` which includes:
   - `prisma generate` - Generate Prisma client
   - `prisma db push --accept-data-loss` - Create tables
   - `next build` - Build Next.js app
3. Run `npm run start` - Start production server

## Database Migrations

The `prisma db push` command will:
- Create all tables from `prisma/schema.prisma`
- **⚠️ Warning**: `--accept-data-loss` means it will drop/recreate tables if schema changes

For production, consider using `prisma migrate deploy` instead:
```json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

## Backfill Data

After first deployment:
```bash
# SSH into Railway container or use Railway CLI
railway run npm run backfill 22003 22326 20445 21866
```

Or set `RUN_BACKFILL=true` environment variable and redeploy.

## Monitoring

- **Logs**: Railway Dashboard > Deployments > View Logs
- **Database**: Railway Dashboard > PostgreSQL > Connect
- **Health**: Check `/api/health` endpoint

## Troubleshooting

### Database connection failed
- Verify `DATABASE_URL` is set by Railway
- Check PostgreSQL service is running

### Build fails
- Check build logs in Railway
- Verify all dependencies are in `package.json`
- Ensure `prisma generate` runs before build

### Tables not created
- Run `railway run prisma db push` manually
- Or `railway run prisma migrate deploy`

## Production Checklist

- [ ] PostgreSQL database added to Railway
- [ ] Environment variables configured
- [ ] First deployment successful
- [ ] Database tables created
- [ ] Backfill completed
- [ ] Homepage loads with wallet connect
- [ ] Pool detail pages work
- [ ] Activity data visible

## Useful Commands

```bash
# Deploy manually
git push origin main

# View logs
railway logs

# Run migrations
railway run prisma migrate deploy

# Run backfill
railway run npm run backfill 22003

# Connect to database
railway run psql $DATABASE_URL
```

## Notes

- Railway provides a free tier with 500 hours/month
- PostgreSQL database includes 1GB storage
- Auto-deploys on every push to `main`
- Build time: ~2-3 minutes
- Cold start: ~5-10 seconds

