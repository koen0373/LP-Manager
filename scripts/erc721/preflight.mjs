import fs from 'fs';
const env = Object.fromEntries((fs.existsSync('.env.local')?fs.readFileSync('.env.local','utf8'):'').split('\n').map(l=>l.split('=',2)).filter(a=>a[0]));
const rpc = (env.FLARE_RPC_URLS||'https://flare-api.flare.network/ext/C/rpc').split(',')[0].trim();
const nfpm = [env.ENOSYS_NFPM, env.SPARKDEX_NFPM].filter(Boolean).map(s=>s.toLowerCase());
const TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const post = async (b)=> (await fetch(rpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)})).json();
const hex = n=>'0x'+n.toString(16);
const head = parseInt((await post({jsonrpc:'2.0',id:1,method:'eth_blockNumber',params:[]})).result,16);
const safe = head - 16;
const from = Math.max(25000000, safe - 20_000); // kleine band net vóór head
for (const a of nfpm) {
  const r = await post({jsonrpc:'2.0',id:1,method:'eth_getLogs',params:[{fromBlock:hex(from),toBlock:hex(safe),address:a,topics:[TOPIC]}]});
  const count = (r.result||[]).length;
  if (count>0) { console.log(JSON.stringify({ok:true, nfpm:a, from, to:safe, count},null,2)); process.exit(0); }
}
console.log(JSON.stringify({ok:false, reason:'no_logs_in_probe', from, to:safe})); process.exit(2);
