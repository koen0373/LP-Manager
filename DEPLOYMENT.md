# 🚀 Deployment Guide

## Railway Docker Deployment

This project uses Docker for Railway deployments. Due to Docker's aggressive caching, sometimes changes don't get picked up immediately.

### 🐳 When Changes Aren't Deployed

If you push changes but don't see them on the live site after Railway deployment completes:

**Solution: Bump the Docker Cache Bust**

1. Open `Dockerfile`
2. Find line 6: `ARG CACHE_BUST=v0.1.X`
3. Increment the version number:
   ```dockerfile
   # From:
   ARG CACHE_BUST=v0.1.3
   
   # To:
   ARG CACHE_BUST=v0.1.4
   ```
4. Commit and push:
   ```bash
   git add Dockerfile
   git commit -m "chore: Bump CACHE_BUST to force Docker rebuild"
   git push origin main
   ```

This forces Docker to rebuild all layers after the `CACHE_BUST` line, ensuring your changes are included.

### 📝 Version History

- `v0.1.0` - Initial deployment
- `v0.1.1` - First cache bust
- `v0.1.2` - Docker fix implementation
- `v0.1.3` - FAQ + UI updates (current)

### ⚙️ Why This Happens

Docker caches build layers for efficiency. When you push changes:
- Docker checks if files changed
- If it thinks nothing changed (based on hashes/timestamps), it uses cached layers
- This can cause your CSS/JS changes to be ignored

The `CACHE_BUST` ARG forces Docker to invalidate the cache and rebuild fresh.

### 🔄 Alternative: Railway Dashboard

You can also trigger a fresh rebuild from Railway:
1. Go to your Railway project
2. Click on the deployment
3. Click the **⋮** (three dots) menu
4. Select **"Redeploy from scratch"** (not just "Redeploy")

This clears all caches but is slower than bumping `CACHE_BUST`.

### 🎯 Best Practice

**Before each deployment batch:**
1. Make all your code changes
2. Test locally (`npm run dev`)
3. Bump `CACHE_BUST` once
4. Commit everything together
5. Push once

This minimizes the number of rebuilds needed.

### 🆘 If It Still Doesn't Work

If bumping `CACHE_BUST` doesn't help:
1. Check Railway build logs for actual errors
2. Verify the correct commit SHA is being deployed
3. Try "Redeploy from scratch" in Railway dashboard
4. Check if there are multiple deployments queued (Railway might be building an old commit)

---

**Current Version**: v0.1.3  
**Last Updated**: October 25, 2025

