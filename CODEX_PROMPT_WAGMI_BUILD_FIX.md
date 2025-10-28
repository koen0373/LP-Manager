# PROMPT VOOR CODEX — Wagmi v2 Build Error Fix

## CONTEXT
LiquiLab Next.js app (Pages Router) draait op Railway. De build faalt met Wagmi v2 configuratie errors na een poging om UI polish door te voeren.

## PROBLEEM
**Build error:**
```
Type error: Object literal may only specify known properties, and 'shimDisconnect' does not exist in type 'MetaMaskParameters'.
./src/lib/wagmi.ts:11:16
```

**Root cause:**
- Wagmi v2.18.1 gebruikt `@wagmi/connectors@6.1.0`
- MetaMask connector API is veranderd en accepteert geen `shimDisconnect` parameter meer
- Alleen MetaMask connector beschikbaar in `@wagmi/connectors` (geen `rabbyWallet` export)
- Build process hangt of wordt interrupted tijdens `npm run build`

## HUIDIGE STAAT
**Bestanden gewijzigd door Claude:**

1. **`src/lib/wagmi.ts`** (meerdere pogingen):
```typescript
import { http, createConfig } from 'wagmi';
import { metaMask } from '@wagmi/connectors';
import { flare } from 'wagmi/chains';

export const config = createConfig({
  chains: [flare],
  transports: {
    [flare.id]: http(),
  },
  connectors: [
    metaMask(), // shimDisconnect verwijderd, maar build hangt nog steeds
  ],
  ssr: true,
});
```

2. **`src/components/WalletConnect.tsx`**:
- Verwijderd: `isConnecting`, `pendingConnector` (niet meer in Wagmi v2 API)
- Aangepast: `isPending` gebruikt voor loading state

3. **Type fixes**:
- `pages/api/billing/preview.ts`: `any` → `unknown` met proper casting
- `pages/demo.tsx`: `any` → `Record<string, unknown>` met type guards
- `src/pages/api/health.ts`: `any` → typed result object
- `src/config/uiCopy.ts`: Apostrof fixes voor ESLint

4. **`pages/dashboard.tsx`**:
- `address={address ?? ''}` voor undefined safety

## GEPROBEERDE OPLOSSINGEN (GEFAALD)

### Poging 1: RabbyWallet toevoegen
```typescript
import { metaMask, rabbyWallet } from '@wagmi/connectors';
```
**Resultaat:** `Module has no exported member 'rabbyWallet'` — bestaat niet in v6.1.0

### Poging 2: Chains parameter toevoegen aan MetaMask
```typescript
metaMask({ chains: [flare], shimDisconnect: true })
```
**Resultaat:** `'chains' does not exist in type 'MetaMaskParameters'`

### Poging 3: Alleen shimDisconnect
```typescript
metaMask({ shimDisconnect: true })
```
**Resultaat:** `'shimDisconnect' does not exist in type 'MetaMaskParameters'`

### Poging 4: Geen parameters (huidige staat)
```typescript
metaMask()
```
**Resultaat:** Build hangt of wordt interrupted — geen duidelijke error meer, maar completeert niet

## RESTERENDE ESLINT WARNINGS
```
./src/components/billing/PricingCalculator.tsx
188:5  Warning: Unused eslint-disable directive

./src/components/marketing/PricingPanel.tsx
28:32  Warning: 'highlight' is defined but never used
105:19  Warning: 'href' is assigned a value but never used

./src/features/pools/PoolsOverview.tsx
24:10  Warning: 'computePlanCapacity' is defined but never used
```

## GEVRAAGDE ACTIE DOOR CODEX

**Primair doel:** Build succesvol laten slagen (`npm run build` completeert zonder errors).

**Stappen:**
1. **Verifieer Wagmi v2 MetaMask connector API**
   - Check `node_modules/@wagmi/connectors/dist/types/metaMask.d.ts` voor correcte parameters
   - Pas `src/lib/wagmi.ts` aan naar werkende v2 syntax

2. **Alternatief: Downgrade naar Wagmi v1**
   - Als v2 API te instabiel is, downgrade naar laatste stabiele v1.x
   - Update `package.json`: `"wagmi": "^1.4.13"` (of laatste v1)
   - `npm install` en rebuild

3. **Clean build dependencies**
   - `rm -rf .next node_modules package-lock.json`
   - `npm install`
   - `npm run build`

4. **Fix resterende ESLint warnings**
   - Verwijder unused variables/parameters
   - Verwijder onnodige eslint-disable directives

5. **Update PROJECT_STATE.md**
   - Log exacte Wagmi configuratie die werkt
   - Documenteer connector setup onder "Known Issues" als er limitaties zijn
   - Changelog entry met datum 27 oktober 2025

## VERWACHTE OUTPUT

1. **Working `src/lib/wagmi.ts`** met correcte Wagmi v2 of v1 syntax
2. **Succesvolle build**: `npm run build` completeert zonder type errors
3. **ESLint warnings opgelost** (geen errors, warnings acceptabel)
4. **Bijgewerkte PROJECT_STATE.md** met:
   - Changelog entry
   - Wagmi versie + configuratie beslissing
   - Bestandswijzigingen lijst

## PACKAGE VERSIES
```json
"wagmi": "^2.18.1",
"@wagmi/connectors": "^6.0.1",
"@wagmi/core": "^2.22.1",
"viem": "^2.38.3",
"next": "15.5.6"
```

## RAILWAY DEPLOYMENT NOTES
- Build command: `npm run build` (moet slagen)
- Start command: `./start.sh` (draait op `$PORT`)
- Environment: Node.js, geen Vercel-specifieke features

## TOEGESTANE SCOPE
- **Mag wijzigen**: `src/lib/wagmi.ts`, `package.json`, ESLint warning files, `PROJECT_STATE.md`
- **Mag NIET wijzigen**: Database schema, API routes (tenzij voor type fixes), branding/copy
- **Mag dependencies updaten/downgraden** als dat build fix oplevert

---

**Verwachting:** Codex lost dit op door ofwel correcte Wagmi v2 syntax te vinden, ofwel naar stabiele v1 te downgraden, en documenteert de beslissing helder in PROJECT_STATE.md.

