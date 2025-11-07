import fs from "fs";
import path from "path";

const CACHE_FILE = path.join(process.cwd(), "data", "cache", "flare-cache.json");
const MAX_AGE = 24 * 60 * 60 * 1000;

export async function flareRpc(method: string, params: any[] = []): Promise<any> {
  const cache = fs.existsSync(CACHE_FILE)
    ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"))
    : {};
  const key = `${method}:${JSON.stringify(params)}`;
  const entry = cache[key];
  const fresh = entry && Date.now() - new Date(entry.ts).getTime() < MAX_AGE;
  if (fresh) return entry.result;

  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  let res;
  for (let i = 0; i < 3; i++) {
    try {
      res = await fetch("https://flare-api.flare.network/ext/C/rpc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      if (res.ok) break;
    } catch { await new Promise(r => setTimeout(r, 300 * (i + 1))); }
  }
  if (!res?.ok) throw new Error(`FLARE RPC error: ${res?.statusText}`);
  const json = await res.json();
  cache[key] = { ts: new Date().toISOString(), result: json };
  const tmp = CACHE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, CACHE_FILE);
  return json;
}
