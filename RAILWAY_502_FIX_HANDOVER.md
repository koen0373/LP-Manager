# Railway 502 Error - Root Cause & Solution

## 🔴 PROBLEM

LiquiLab application deployed to Railway resulted in persistent **502 Bad Gateway** errors. The container would start, generate Prisma Client, and immediately stop without starting the Next.js server.

### Symptoms
```
Starting Container
✔ Generated Prisma Client (v6.19.0)
Stopping Container
```

- No startup logs from application
- No Next.js server output
- Container lifecycle < 5 seconds
- API endpoint returned 502 error

---

## 🔍 ROOT CAUSE

**Railway uses Nixpacks** (automatic build system) instead of the provided Dockerfile when it detects a `package.json` file. This caused several issues:

### Issue 1: Dockerfile Ignored
- Project contained a working `Dockerfile` with proper startup flow
- Custom `start.sh` script with migrations, logging, and graceful error handling
- Railway **completely ignored** both files
- Nixpacks took precedence due to `package.json` presence

### Issue 2: Shell Script Incompatibility
- `package.json` had: `"start": "./start.sh"`
- Nixpacks auto-detect runs: `npm start`
- Nixpacks environment **cannot execute shell scripts** properly
- `./start.sh` failed silently, causing immediate container crash

### Issue 3: Missing Migrations
- Dockerfile's `start.sh` ran `prisma migrate deploy` before starting Next.js
- With Nixpacks, migrations never executed
- Next.js tried to start without database schema
- Application crashed immediately

### Issue 4: Failed Mitigation Attempts

**Attempt 1: `railway.toml` configuration**
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"
```
❌ **Result:** Railway still used Nixpacks (config ignored)

**Attempt 2: Custom Start Command in Railway UI**
- Set to `npm start` (tried to force package.json script)
- Set to `./start.sh` (tried to force shell script)
❌ **Result:** Both failed - Nixpacks overrides UI settings

**Attempt 3: Enhanced logging in `start.sh`**
- Added comprehensive diagnostics
- Environment variable checks
- Detailed error messages
❌ **Result:** Never executed - script never ran

---

## ✅ SOLUTION

**Modified `package.json` to be Nixpacks-compatible:**

### Before
```json
{
  "scripts": {
    "start": "./start.sh"
  }
}
```

### After
```json
{
  "scripts": {
    "start": "npx prisma migrate deploy && npx next start -p ${PORT:-3000}"
  }
}
```

### Why This Works
1. ✅ **Pure npm commands** - Nixpacks can execute `npx` commands
2. ✅ **Inline migrations** - `prisma migrate deploy` runs before Next.js
3. ✅ **No shell scripts** - Avoids Nixpacks shell incompatibility
4. ✅ **PORT variable** - Uses Railway's dynamic port assignment
5. ✅ **Simple chain** - `&&` operator works in Nixpacks environment

---

## 📋 DEPLOYMENT FLOW (AFTER FIX)

```
Railway Nixpacks Auto-Detect:
├─ 1. Detect package.json ✅
├─ 2. Run: npm install ✅
├─ 3. Run: npm run build ✅
│     └─ prisma generate (via postinstall hook) ✅
├─ 4. Run: npx prisma generate ✅ (Railway auto-adds this)
└─ 5. Run: npm start ✅
      ├─ npx prisma migrate deploy ✅
      │  └─ Applies database migrations
      └─ npx next start -p 3000 ✅
         └─ Next.js server starts successfully
```

---

## 🎯 KEY LEARNINGS

### 1. Railway Nixpacks Priority
- **Nixpacks takes precedence** over Dockerfile when `package.json` exists
- `railway.toml` configuration is often **ignored**
- Must design for Nixpacks compatibility, not against it

### 2. Shell Script Limitations
- Nixpacks **cannot reliably execute** shell scripts
- Always use npm scripts with inline commands
- Use `npx` for CLI tools (prisma, next, etc.)

### 3. Migration Timing Critical
- Migrations **must run before** Next.js server starts
- Use `&&` operator in npm scripts: `migrate && start`
- Nixpacks respects this execution order

### 4. Dockerfile Strategy
- Keep Dockerfile for **local development** and **worker services**
- For web app on Railway: **design package.json scripts for Nixpacks**
- Alternative: Use Railway's Docker Source (requires different plan)

---

## 🔧 ALTERNATIVE SOLUTIONS (NOT USED)

### Option A: Force Dockerfile Usage
- Upgrade Railway plan to support "Docker Source"
- Configure project to ignore Nixpacks entirely
- **Downside:** Higher cost, unnecessary for this use case

### Option B: Separate Build Process
- Use Railway's "Build" service for Dockerfile
- Deploy container image to "Web" service
- **Downside:** Complex setup, slower deployments

### Option C: Procfile
- Create `Procfile` with: `web: ./start.sh`
- **Downside:** Nixpacks still has issues with shell scripts

---

## 📊 VERIFICATION

### Expected Deploy Logs (After Fix)
```
Starting Container
Prisma schema loaded from prisma/schema.prisma
✔ Generated Prisma Client (v6.19.0)

[npm start executing]
Environment variables:
  PRISMA_CLI_QUERY_ENGINE_TYPE=binary
  DATABASE_URL=postgresql://...

Prisma Migrate applied 3 migrations:
  ✓ 20241101_initial
  ✓ 20241105_pool_table  
  ✓ 20241108_position_nfpm

▲ Next.js 15.1.5
- Local:    http://localhost:3000
- Network:  http://0.0.0.0:3000

✓ Ready in 3.2s
```

### API Health Check
```bash
curl https://app.liquilab.io/api/health
# Expected: {"status":"ok","timestamp":"...","database":"connected"}
```

---

## 🚀 DEPLOYMENT CHECKLIST

For future Railway deployments with Next.js + Prisma:

- [ ] `package.json` has `"start"` script with migrations
- [ ] Start script format: `"npx prisma migrate deploy && npx next start -p ${PORT:-3000}"`
- [ ] `postinstall` hook includes `prisma generate`
- [ ] `DATABASE_URL` environment variable set in Railway
- [ ] No reliance on shell scripts for startup
- [ ] Test deployment shows Next.js server output in logs
- [ ] Health endpoint returns 200 OK

---

## 📝 FILES MODIFIED

### 1. `package.json` (CRITICAL FIX)
```json
{
  "scripts": {
    "start": "npx prisma migrate deploy && npx next start -p ${PORT:-3000}",
    "postinstall": "prisma generate"
  }
}
```

### 2. `railway.toml` (ATTEMPTED, NOT EFFECTIVE)
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "./start.sh"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```
⚠️ This file did NOT force Dockerfile usage as intended.

### 3. `start.sh` (KEPT FOR LOCAL/DOCKER)
Enhanced with diagnostics, still used by Dockerfile for local development and worker containers.

### 4. `Dockerfile` (KEPT FOR WORKERS)
Used by `Dockerfile.worker` for Indexer Follower service (cron job).
Not used for main web application on Railway.

---

## 🔄 MIGRATION PATH FOR OTHERS

If experiencing similar Railway 502 errors:

### Step 1: Identify Builder
Check Railway dashboard → Settings → Build Method
- If "Nixpacks" → Follow this solution
- If "Dockerfile" → Different issue (check logs)

### Step 2: Update package.json
```json
"start": "npx prisma migrate deploy && npx next start -p ${PORT:-3000}"
```

### Step 3: Remove Custom Start Command
Railway Settings → Deploy → Custom Start Command → **Leave EMPTY**

### Step 4: Verify Environment Variables
- `DATABASE_URL` must be set
- Use Railway variable references: `${{Postgres.DATABASE_URL}}`

### Step 5: Deploy and Monitor
- Watch Deploy Logs for migration output
- Confirm Next.js "Ready" message
- Test health endpoint

---

## 🎓 LESSONS FOR GPT/CLAUDE

### When Railway shows "Stopping Container" immediately:

1. **First check:** Is Railway using Nixpacks or Dockerfile?
   - Look for "Using Detected Dockerfile" in Build Logs
   - If absent → Nixpacks is being used

2. **Nixpacks incompatibilities:**
   - Shell scripts (`.sh` files) often fail
   - Custom startup commands may be ignored
   - `railway.toml` config may not apply

3. **Quick diagnostic:**
   - If Deploy Logs show ONLY Prisma Client generation → Startup command failed
   - If no Next.js "Ready" message → Server never started
   - If < 10 seconds uptime → Immediate crash

4. **Solution pattern:**
   - Inline everything in `package.json` scripts
   - Use `npx` for CLI tools
   - Chain commands with `&&`
   - Avoid shell scripts for startup

5. **Don't over-engineer:**
   - Simple npm script > complex Dockerfile CMD
   - Nixpacks compatibility > forcing Dockerfile
   - Railway's auto-detect usually works if you work with it

---

## 📞 REFERENCE

- **Issue:** Railway 502 Bad Gateway (immediate container stop)
- **Environment:** Railway (Nixpacks), Next.js 15, Prisma 6.19, PostgreSQL
- **Resolution Time:** ~3 hours (multiple attempted solutions)
- **Final Commit:** `906c483` - "HOTFIX: npm start with migrations"
- **Status:** ✅ Resolved - Application successfully deployed

---

**Generated:** 2025-11-10  
**Author:** LiquiLab Development Team  
**Purpose:** Handover documentation for ChatGPT/Claude for similar Railway deployment issues

