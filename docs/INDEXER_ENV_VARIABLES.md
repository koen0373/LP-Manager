# Indexer Environment Variables - Aanbevelingen

## Huidige Defaults

```bash
INDEXER_BLOCK_WINDOW=25    # Veilig onder Flare's 30-block limit
INDEXER_CONCURRENCY=6      # Parallelle RPC requests
INDEXER_RPS=6              # Requests per seconde
```

## Aanbevolen Waarden voor Productie (502 Prevention)

### **Conservatief (Aanbevolen voor Stabiele Indexer):**

```bash
INDEXER_BLOCK_WINDOW=25    # Blijf op 25 (veilig onder Flare limit)
INDEXER_CONCURRENCY=4      # Verlaag naar 4 (minder database pressure)
INDEXER_RPS=4              # Verlaag naar 4 (minder rate limit issues)
```

**Waarom:**
- ✅ Minder database connections = minder 502 errors
- ✅ Minder RPC pressure = stabieler
- ✅ Langzamer maar betrouwbaarder

### **Balanced (Goede Performance + Stabiel):**

```bash
INDEXER_BLOCK_WINDOW=25    # Blijf op 25
INDEXER_CONCURRENCY=6      # Huidige waarde (OK)
INDEXER_RPS=5              # Iets lager (5 i.p.v. 6)
```

### **Aggressief (Alleen als alles stabiel is):**

```bash
INDEXER_BLOCK_WINDOW=25    # NOOIT hoger dan 25!
INDEXER_CONCURRENCY=8      # Max voor Railway
INDEXER_RPS=6              # Huidige waarde
```

## Kritieke Regels

1. **INDEXER_BLOCK_WINDOW:**
   - ✅ **NOOIT hoger dan 25** (Flare hard limit = 30)
   - ✅ 25 is veilig met marge
   - ❌ Hoger = gegarandeerde crashes

2. **INDEXER_CONCURRENCY:**
   - ✅ Start laag (4) en verhoog langzaam
   - ✅ Monitor database connections
   - ❌ Te hoog = connection pool exhaustion → 502

3. **INDEXER_RPS:**
   - ✅ 4-6 is veilig voor Flare RPC
   - ✅ Monitor rate limit errors
   - ❌ Te hoog = rate limiting → timeouts → 502

## Monitoring

Check deze metrics na wijzigingen:
- Database connection count (moet < 10 blijven)
- RPC error rate (moet < 1% zijn)
- 502 error frequency (moet 0 zijn)

## Mijn Aanbeveling voor Nu

Gezien de 502 errors, gebruik deze **conservatieve waarden**:

```bash
INDEXER_BLOCK_WINDOW=25
INDEXER_CONCURRENCY=4
INDEXER_RPS=4
```

**Na 24 uur zonder errors, verhoog langzaam:**
- Concurrency: 4 → 5 → 6
- RPS: 4 → 5 → 6

**Stop met verhogen als:**
- Database connections > 8
- RPC errors > 0.5%
- 502 errors verschijnen

