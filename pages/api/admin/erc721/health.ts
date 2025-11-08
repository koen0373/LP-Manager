import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs'; import path from 'path';
export default function handler(req:NextApiRequest,res:NextApiResponse){
  const file = path.join(process.cwd(),'data','raw','erc721_transfer.ndjson');
  let lines=0, mtime=0;
  try { const st=fs.statSync(file); mtime=st.mtimeMs; lines = fs.readFileSync(file,'utf8').split('\n').filter(Boolean).length; } catch {}
  const ageMs = Date.now()-mtime;
  const fresh = ageMs < 26*60*60*1000; // <26h
  const ok = fresh && lines>0;
  const body = { ok, lines, ageMs, lastUpdateIso: mtime? new Date(mtime).toISOString(): null };
  res.status(ok?200:500).json(body);
}
