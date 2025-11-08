import fs from 'fs'; import path from 'path';
const file = path.join(process.cwd(),'data','raw','erc721_transfer.ndjson');
let lines=0, mtime=0; try{ const st=fs.statSync(file); mtime=st.mtimeMs; lines = fs.readFileSync(file,'utf8').split('\n').filter(Boolean).length; }catch{}
const fresh = (Date.now()-mtime) < 26*60*60*1000;
const ok = fresh && lines>0;
const out = path.join(process.cwd(),'data','ops','erc721.health.json');
fs.writeFileSync(out, JSON.stringify({ ok, lines, lastUpdateIso: mtime? new Date(mtime).toISOString(): null }, null, 2));
if (!ok) { console.error('# FAIL: ERC721 data missing or stale'); process.exit(1); }
console.log('# OK: ERC721 healthy', { lines });
