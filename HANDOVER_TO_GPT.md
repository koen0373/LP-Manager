# 🚨 LiquiLab Dev Server Issue — Handover to GPT

**Datum**: 27 oktober 2025  
**Status**: Dev server volledig kapot — alle endpoints geven 500 Internal Server Error  
**Context**: Na test run bleek de dev server niet functioneel. Build faalt met meerdere TypeScript errors.

---

## 🔴 PROBLEEM

### Symptomen
1. **Homepage**: 500 Internal Server Error (geen HTML)
2. **API endpoints**: Alle routes geven 500 error (0.1-0.4s response tijd)
3. **Build**: Faalt met TypeScript compilation errors
4. **Test resultaten** (gedocumenteerd in `DEBUG.md`):
   - Homepage: ❌ FAIL (500 error)
   - Pool API (1e call): ❌ FAIL (0.435s)
   - Pool API (2e call): ❌ FAIL (0.113s)
   - Positions API: ❌ FAIL (0.113s)

### Root Cause (volgens analyse)
```
Type error: Cannot find module '../../app/api/login/route.js' 
or its corresponding type declarations.
```

**Analyse**:
- Pages Router (`pages/`) en App Router (`src/app/`) werden door elkaar gebruikt
- TypeScript kon App Router imports niet resolven vanuit Pages Router context
- Duplicate directories (`src/components 2/`, `src/hooks 2/`, `src/lib 2/`, etc.) veroorzaakten type conflicts
- Missing/incomplete module exports (`@/lib/wagmi`, `@/lib/getWalletPositions`)

---

## ✅ UITGEVOERDE FIXES (door Cursor AI)

### 1. App Router → Pages Router migratie
**Actie**: Verplaatst API routes van App Router naar Pages Router  
**Files**:
- ✅ Aangemaakt: `pages/api/login.ts` (Next.js Pages API format)
- ✅ Aangemaakt: `pages/api/notify.ts` (Next.js Pages API format)
- ❌ Verwijderd: `src/app/` (volledige directory)

**Reden**: Next.js 15 ondersteunt beide routers, maar ze conflicteerden in deze setup.

---

### 2. Duplicate directories verwijderd
**Actie**: Verwijderd alle "backup" directories met spatie + nummer  
**Verwijderd**:
```
src/app 2/
src/abi 2/
src/components 2/
src/constants 2/
src/hooks 2/
src/lib 2/
src/types 2/
```

**Impact**: TypeScript type conflicts opgelost (bijv. `PositionStatus` type mismatch).

---

### 3. TypeScript fixes
**Acties**:
1. **testPhase1.ts**: Toegevoegd `Array.isArray()` check voor `creation.result`
2. **StatusPill.tsx**: Type signature uitgebreid: `'Active' | 'Inactive' | 'Closed'`
3. **WalletConnect.tsx**: Verwijderd duplicate `Window.ethereum` declaratie
4. **globals.d.ts**: Aangemaakt globale type voor `Window.ethereum`

---

### 4. Missing modules aangemaakt
**Acties**:
1. **src/lib/wagmi.ts**: Aangemaakt met basic wagmi config:
   ```typescript
   import { http, createConfig } from 'wagmi';
   import { flare } from 'wagmi/chains';
   
   export const config = createConfig({
     chains: [flare],
     transports: { [flare.id]: http() },
   });
   ```

2. **tsconfig.json**: Updated exclude patterns voor duplicate dirs

---

## ⚠️ RESTERENDE ISSUES

### Build stopte tijdens compilatie
**Status**: Build process werd gestopt voordat completion  
**Laatste error (mogelijk)**: Onbekend — build was nog bezig

### Ongeteste fixes
- Pages API routes (`/api/login`, `/api/notify`) niet getest in browser
- Wagmi config mogelijk incomplete (geen connectors geconfigureerd)
- Database connection (`DATABASE_URL`) nog steeds incorrect (localhost Prisma dev niet actief)
- RPC endpoints nog steeds incorrect (zie DEBUG.md)

---

## 📋 PROJECTCONTEXT

### Stack
- **Framework**: Next.js 15.5.6 (Pages Router)
- **Database**: PostgreSQL via Prisma
- **Web3**: Wagmi 2.18.1 + Viem 2.38.3
- **Deployment**: Railway (production)

### Directory structuur
```
/Users/koen/Desktop/Liquilab/
├── pages/           # Pages Router (primary)
│   ├── api/         # API routes
│   ├── index.tsx    # Homepage
│   └── ...
├── src/
│   ├── components/  # React components
│   ├── lib/         # Utilities & blockchain clients
│   ├── services/    # Business logic
│   └── types/       # TypeScript types
├── prisma/
│   └── schema.prisma
└── tsconfig.json
```

### Belangrijke configuratie
- **PROJECT_STATE.md**: Brand guidelines, AI collaboration protocol, design system
- **DEBUG.md**: Test logs, known issues, RPC/DB connection problems
- **.env.local**: Environment variables (NIET in repo)

---

## 🎯 VRAAG AAN GPT

### Gewenst: Stappenplan voor definitieve fix

**Context**:
- LiquiLab gebruikt **twee AI agents**: **Codex** (structural/technical) en **Claude Sonnet** (UI/creative)
- Volgens `PROJECT_STATE.md` moet Codex structural fixes doen, Claude alleen UI/copy
- Build errors zijn **P0 blocker** — niks werkt tot dit is opgelost

### Deliverable:
Een **gedetailleerd stappenplan** met:

1. **Diagnose**: Welke checks moet ik eerst draaien om de exacte status te bepalen?
   - Welke commando's?
   - Welke files checken?
   - Hoe verifieer ik of de eerdere fixes correct zijn?

2. **Fix strategie**: Wat is de veiligste aanpak?
   - Moet ik de App Router volledig verwijderen of juist correct integreren?
   - Moeten de duplicate directories terug? (backup?)
   - Zijn er missing dependencies die geïnstalleerd moeten worden?

3. **Taak verdeling**: Wie doet wat?
   - **Codex**: Structural fixes (build errors, TypeScript, module resolution)
   - **Claude Sonnet**: UI consistency checks (NA build is gefixt)
   - **Menselijke review**: Welke stappen vereisen handmatige controle?

4. **Verificatie**: Hoe test ik dat het werkt?
   - Build succesvol?
   - Dev server start zonder errors?
   - Homepage laadt (200 OK)?
   - API endpoints functioneel?

5. **Rollback plan**: Als het misgaat?
   - Welke files moet ik backuppen voor ik begin?
   - Hoe herstel ik naar werkende staat? (laatste commit was `2cd2cd0`)

---

## 📎 RELEVANTE FILES

### Voor diagnose
- `package.json` — Dependencies
- `tsconfig.json` — TypeScript config (recent gewijzigd)
- `next.config.ts` — Next.js config
- `pages/api/login.ts` — Nieuw aangemaakt
- `pages/api/notify.ts` — Nieuw aangemaakt
- `src/lib/wagmi.ts` — Nieuw aangemaakt
- `src/types/globals.d.ts` — Nieuw aangemaakt

### Voor context
- `PROJECT_STATE.md` — AI collaboration rules, brand guidelines
- `DEBUG.md` — Test logs + known issues (RPC, DB)
- `.env` / `.env.local` — Environment vars (lokaal probleem: RPC + DB URLs)

---

## ⏱️ URGENTIE

**Priority**: P0 — Critical blocker  
**Impact**: Dev environment volledig kapot, geen testing mogelijk  
**Gewenste timeline**: Fix binnen 30-60 minuten (als het goed gaat)

---

## 💬 EXTRA CONTEXT

### Waarom dit gebeurde
- Eerdere Claude Sonnet iteraties hebben waarschijnlijk backup directories aangemaakt (`components 2/`, etc.)
- App Router routes (`src/app/api/`) werden toegevoegd voor placeholder functionaliteit
- Pages Router (`pages/`) en App Router (`src/app/`) werden niet correct gescheiden
- Build cache (`.next/`) had oude references die conflicts veroorzaakten

### Wat WEL werkt (production)
- Railway deployment op `https://liquilab.io` werkt waarschijnlijk nog
- Production heeft correcte env vars (DATABASE_URL, RPC_URL)
- Laatste werkende commit: `2cd2cd0` (mogelijk eerder)

---

## 🙏 HULPVRAAG

**GPT, kun je een stappenplan maken dat**:
1. **Veilig** is (geen data loss, rollback mogelijk)
2. **Duidelijk** verdeeld tussen Codex (tech) en Claude (UI)
3. **Compleet** is (van diagnose tot verificatie)
4. **Realistisch** is (geen "rebuild from scratch")

Geef bij elke stap aan:
- **Tool**: Terminal command / File edit / Code review
- **Owner**: Codex / Claude / Menselijk
- **Verificatie**: Hoe check ik dat de stap geslaagd is?
- **Fallback**: Wat als deze stap faalt?

Bedankt! 🙏

