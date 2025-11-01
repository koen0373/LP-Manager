# Unknowns & Resolution Paths

1) SparkDEX V3 **factory address** (exact):
   - *Gap*: Not explicitly published in docs.
   - *Resolve*: Call `factory()` on Position Manager (SPARKDEX‑V3‑POS `0xEE5F...527da`) via JSON‑RPC (Tenderly Flare node) and/or inspect app network calls. Cite result in Sources on capture. 

2) Enosys V3 **factory address** + canonical pool enumeration API:
   - *Gap*: Factory address not on public docs page.
   - *Resolve #1*: Use Flare Explorer REST v2 for PositionNFT instances (contract `0xD977...6657`) to extract pool addresses (primary). 
   - *Resolve #2*: Read `factory()` on PositionManager via RPC, then enumerate `PoolCreated` logs on explorer.

3) BlazeSwap **definitive factory set** on mainnet:
   - *Gap*: Multiple factory‑labeled addresses appear on Flarescan (legacy/aliases).
   - *Resolve*: Verify active factory by latest `PairCreated` events and cross‑check with current app pairs. Keep only active one in config. 

4) **Official subgraphs** for SparkDEX V3 and Enosys V3:
   - *Gap*: No public endpoints found during sweep.
   - *Resolve*: 
     - Ask teams (Discord/Twitter) for Goldsky/TheGraph endpoints.
     - If none public, deploy internal subgraphs on Goldsky using ABIs (allowed by ToS) — document name/version. 

5) **Incentives catalogs** (programmatic feeds):
   - *Gap*: Programmatic reward schedules often only in announcements/UI.
   - *Resolve*: Scrape official posts (SparkDEX Medium; Flare DeFi Emissions program) and farm UIs with change detection; maintain manual override table. 

6) **stXRP contract address** at TGE:
   - *Gap*: Not on Firelight site yet.
   - *Resolve*: Watch Firelight/Flare announcements; once live, pin ERC‑20 address and index pools via explorer. 

7) **MoreMarkets** public metrics/API:
   - *Gap*: No public API yet.
   - *Resolve*: Monitor MoreMarkets blog & Flare posts; infer on‑chain positions routed through FXRP vaults; tag any addresses announced. 