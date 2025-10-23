# 🚀 Railway Worker Setup - UPDATED

## ✅ NIEUWE CONFIGURATIE

De worker is nu gecompileerd naar JavaScript voor betere compatibiliteit!

---

## 📋 Railway Worker Service Settings

### **Build Command:**
```
npm run build:worker
```

### **Start Command:**
```
npm run backfill:ids
```

**Dit runt:** `node ./dist/scripts/backfillLedger.js 22003 22326 20445 21866`

---

## 🔧 Wat Is Er Veranderd?

### **VOOR (Probleem):**
- `npx tsx` kon TypeScript modules niet vinden
- `MODULE_NOT_FOUND` errors voor `src/lib/backfill/*`
- Runtime TypeScript execution faalde op Railway

### **NA (Oplossing):**
- TypeScript wordt gecompileerd naar JavaScript tijdens build
- Compiled files in `dist/` directory
- Node draait pre-compiled JavaScript (geen runtime TS)
- Alle imports worden correct geresolved

---

## 📊 Verwachte Logs

### **Build Phase:**
```
[BUILD] Running: npm run build:worker
[BUILD] > prisma generate && tsc --project tsconfig.worker.json
[BUILD] ✔ Generated Prisma Client
[BUILD] ✅ Build completed
```

### **Start Phase:**
```
[START] Running: npm run backfill:ids
[START] > node ./dist/scripts/backfillLedger.js 22003 22326 20445 21866

╔═══════════════════════════════════════════════════════════╗
║           LP MANAGER - BACKFILL WORKER                    ║
╚═══════════════════════════════════════════════════════════╝

📋 Configuration:
  Token IDs: 22003, 22326, 20445, 21866
  Mode: SINCE LAST CHECKPOINT
  Concurrency: 6

[BACKFILL] Starting batch backfill for 4 positions
[BACKFILL:22003] Starting backfill (mode: since)
[BACKFILL:22003] Resuming from block 0
[SYNC] Syncing position ledger for tokenId: 22003...
[PMFALLBACK] Fetching position by ID: 22003

... (sync progress) ...

[BACKFILL:22003] ✅ Complete in 8234ms: 45 inserted, 2 updated, 3 skipped
[BACKFILL:22326] ✅ Complete in 7891ms: 38 inserted, 1 updated, 2 skipped
[BACKFILL:20445] ✅ Complete in 6543ms: 29 inserted, 0 updated, 1 skipped
[BACKFILL:21866] ✅ Complete in 5234ms: 15 inserted, 1 updated, 0 skipped

============================================================
📊 BACKFILL SUMMARY
============================================================
Total positions: 4
✅ Successful: 4
❌ Failed: 0
📝 Total inserted: 127
🔄 Total updated: 4
⏭️  Total skipped: 6
⏱️  Total elapsed: 15.23s
============================================================

✅ Backfill completed successfully!

[EXIT] Process exited with code 0
```

---

## ✅ Success Criteria

- ✅ Build completes without errors
- ✅ Start phase shows backfill banner
- ✅ All 4 positions sync successfully
- ✅ Exit code = 0
- ✅ Status = "Exited" (grijs - dit is GOED!)

---

## 🐛 Troubleshooting

### **Build fails:**
```
🔍 Check: tsconfig.worker.json exists
🔍 Check: TypeScript is installed (devDependencies)
🔍 Run locally: npm run build:worker
```

### **"Cannot find module" at runtime:**
```
🔍 Check: dist/ folder exists in Railway
🔍 Check: Build command ran successfully
🔍 Verify: package.json has correct start command
```

### **Database connection errors:**
```
🔍 Check: DATABASE_URL env var is set
🔍 Check: Postgres service is linked
🔍 Verify: Prisma generate ran during build
```

---

## 🎯 Update Worker Service NOW

1. **Railway Dashboard** → **Worker Service** → **Settings**
2. **Deploy** section:
   - Build Command: `npm run build:worker`
   - Start Command: `npm run backfill:ids`
3. **Save changes**
4. **Redeploy** (new deployment will trigger automatically)

---

## ✨ Benefits

- ✅ **Faster startup** (no runtime TypeScript compilation)
- ✅ **More reliable** (all deps resolved at build time)
- ✅ **Smaller runtime** (just node, no tsx loader)
- ✅ **Better compatibility** (works on any Node runtime)
- ✅ **Easier debugging** (source maps available)

---

**PUSH IS DONE - UPDATE RAILWAY WORKER SETTINGS NOW!** 🚀

