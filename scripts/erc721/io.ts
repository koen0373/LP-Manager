import fs from "fs";
import path from "path";

export function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

export function writeJsonAtomic(file: string, data: any) {
  const tmp = file + ".tmp." + Math.random().toString(36).slice(2);
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

export function appendNdjson(file: string, obj: any) {
  fs.appendFileSync(file, JSON.stringify(obj) + "\n", "utf8");
}

export function isoNow() { return new Date().toISOString(); }

export const ROOT = process.cwd();
export const RAW_TRANSFERS = path.join(ROOT, "data", "raw", "erc721_transfer.ndjson");
export const POSITIONS = path.join(ROOT, "data", "enriched", "positions.json");
export const CURSORS = path.join(ROOT, "data", "cursors.erc721.json");
export const CACHE = path.join(ROOT, "data", "cache", "erc721-refresh.json");
