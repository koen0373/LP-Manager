/* eslint-disable no-console */
import fs from "fs";
import path from "path";
import { ERC721_TRANSFER_TOPIC } from "./abi";
import { ensureDir, readJson, writeJsonAtomic, appendNdjson, isoNow, RAW_TRANSFERS, POSITIONS, CURSORS, CACHE } from "./io";

const env = Object.fromEntries((fs.existsSync(".env.local") ? fs.readFileSync(".env.local","utf8") : "").split("\n").map(l=>l.split("=",2)).filter(a=>a[0]));
const rpcList = (env.FLARE_RPC_URLS || "https://flare-api.flare.network/ext/C/rpc").split(",").map(s=>s.trim()).filter(Boolean);

const NFPMs = [env.ENOSYS_NFPM, env.SPARKDEX_NFPM].filter(a => a && a !== "0x0000000000000000000000000000000000000000").map(a=>a.toLowerCase());
if (NFPMs.length === 0) {
  console.error("[erc721] Geen NFPM-adressen in .env.local (ENOSYS_NFPM/SPARKDEX_NFPM) — stop.");
  process.exit(0);
}

const MAX_AGE_MS = 24*60*60*1000;
const WINDOW = 2000;
const CONFIRM = 16;

async function rpcCall(url: string, body: any) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`rpc ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || "rpc error");
  return j.result;
}

async function getHead(url: string): Promise<number> {
  const hex = await rpcCall(url, { jsonrpc:"2.0", id:1, method:"eth_blockNumber", params:[] });
  return parseInt(hex,16);
}

function toHex(n:number){ return "0x"+n.toString(16); }

async function main() {
  ensureDir(path.dirname(RAW_TRANSFERS));
  ensureDir(path.dirname(POSITIONS));
  ensureDir(path.dirname(CURSORS));
  ensureDir(path.dirname(CACHE));

  // 24h cache guard
  const last = readJson<{ts?:string}>(CACHE, {});
  if (last.ts && (Date.now() - Date.parse(last.ts)) < MAX_AGE_MS) {
    console.log("[erc721] Skip: laatste run <", MAX_AGE_MS, "ms");
    return;
  }

  // Cursors per NFPM
  const cursors = readJson<Record<string, number>>(CURSORS, {});
  const positions = readJson<Record<string, any>>(POSITIONS, {}); // tokenId -> snapshot

  // Kies eerste werkende RPC
  let rpc = rpcList[0];
  let head = 0;
  for (const url of rpcList) {
    try { head = await getHead(url); rpc = url; break; } catch { /* try next */ }
  }
  if (!head) throw new Error("Geen werkende FLARE RPC gevonden");

  const safeHead = head - CONFIRM;
  let totalLogs = 0;

  for (const nfpm of NFPMs) {
    const fromDefault = Math.max(0, safeHead - 10000);
    let from = cursors[nfpm] ?? fromDefault;
    let to = safeHead;

    while (from <= to) {
      const end = Math.min(from + WINDOW - 1, to);
      const params = [{
        fromBlock: toHex(from),
        toBlock: toHex(end),
        address: nfpm,
        topics: [ ERC721_TRANSFER_TOPIC ]
      }];
      let logs:any[] = [];
      // simpele retry/rotatie
      for (let i=0;i<rpcList.length;i++){
        try { logs = await rpcCall(rpc, { jsonrpc:"2.0", id:1, method:"eth_getLogs", params }); break; }
        catch { rpc = rpcList[(rpcList.indexOf(rpc)+1)%rpcList.length]; }
      }

      for (const log of logs) {
        // raw wegschrijven
        appendNdjson(RAW_TRANSFERS, {
          ts: isoNow(),
          nfpm,
          blockNumber: parseInt(log.blockNumber,16),
          txHash: log.transactionHash,
          logIndex: parseInt(log.logIndex,16),
          address: log.address.toLowerCase(),
          topics: log.topics,
          data: log.data
        });
        // decode Transfer(from,to,tokenId) uit topics
        const fromAddr = "0x"+log.topics[1].slice(26).toLowerCase();
        const toAddr   = "0x"+log.topics[2].slice(26).toLowerCase();
        const tokenId  = BigInt(log.topics[3]).toString();
        positions[tokenId] = {
          tokenId,
          owner: toAddr,
          lastFrom: fromAddr,
          nfpm,
          lastEventBlock: parseInt(log.blockNumber,16),
          lastEventTx: log.transactionHash,
          updatedAt: isoNow()
        };
        totalLogs++;
      }

      cursors[nfpm] = end + 1;
      // tussentijds flushen
      if ((end - fromDefault) % (WINDOW*5) === 0) {
        writeJsonAtomic(CURSORS, cursors);
        writeJsonAtomic(POSITIONS, positions);
      }
      console.log(`[erc721] ${nfpm} ${from}-${end} => ${logs.length} logs (total ${totalLogs})`);
      from = end + 1;
    }
  }

  writeJsonAtomic(CURSORS, cursors);
  writeJsonAtomic(POSITIONS, positions);
  writeJsonAtomic(CACHE, { ts: isoNow(), totalLogs });

  console.log(`[erc721] klaar: ${totalLogs} transfers verwerkt. Cache 24u actief.`);
}

main().catch(e=>{ console.error("[erc721] fatal:", e); process.exit(1); });
