import fs from 'fs';
const env = Object.fromEntries((fs.existsSync('.env.local')?fs.readFileSync('.env.local','utf8'):'').split('\n').map(l=>l.split('=',2)).filter(a=>a[0]));
const rpc = (env.FLARE_RPC_URLS||'https://flare-api.flare.network/ext/C/rpc').split(',')[0].trim();
const nfpm = [env.ENOSYS_NFPM, env.SPARKDEX_NFPM].filter(Boolean).map(s=>s.toLowerCase());
const TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'; // ERC721 Transfer

const j = (m,p)=>({jsonrpc:'2.0',id:1,method:m,params:p});
const post = async (b)=> (await fetch(rpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)})).json();

const hex = n=>'0x'+n.toString(16);
const head = parseInt((await post(j('eth_blockNumber',[]))).result,16);
const safe = head-16;

for (const a of nfpm){
  // scan in blokken van 200k; start diep
  for (let from=25000000; from<=safe; from+=200000){
    const to=Math.min(from+199999,safe);
    const logs=(await post(j('eth_getLogs',[{fromBlock:hex(from),toBlock:hex(to),address:a,topics:[TOPIC]}]))).result||[];
    if (logs.length>0){ console.log(JSON.stringify({nfpm:a,from,to,count:logs.length},null,2)); process.exit(0); }
  }
}
console.log(JSON.stringify({nfpm:'none',from:25000000,to:safe,count:0},null,2));
