  const files = fs.readdirSync(rawDir).filter(f => f.endsWith('.ndjson') && (f.includes('erc721') || f.startsWith('nfpm_')));
  let rawCount=0;
  for (const f of files) {
    const full = path.join(rawDir, f);
    const eventHint = f.replace(/\.nd?json$/,'');
    const recs = parseLines(full);
    for (const r of recs) {
      const tx = r.txHash || r.transactionHash || r.tx_hash || null;
      const idx = r.logIndex ?? r.log_index ?? null;
      const blk = num(r.blockNumber ?? r.block_number);
      const ts = toDate(r.ts ?? r.blockTime ?? r.timeStamp);
      const contract = r.address || r.contract || null;
      const ev = String(r.event || r.type || event_hint || '').toLowerCase() || (f.includes('transfer')?'erc721_transfer':f);
      if (!tx || idx==null) continue;
      await client.query(
        `insert into public.ingested_erc721_raw (contract,event,tx_hash,log_index,block_number,ts,raw)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (tx_hash,log_index) do nothing`,
        [low(contract), ev, String(tx), Number(idx), blk, ts, JSON.stringify(r)]
      );
      raw_count++;
    }
  }

  let posCount=0;
  if (fs.existsSync(posPath)) {
    const posObj = JSON.parse(fs.readFileSync(posPath, 'utf8'));
    for (const [tokenId, p] of Object.entries(posObj || {})) {
      await client.query(
        `insert into public.ingested_positions (token_id,owner,pool,tick_lower,tick_upper,liquidity,tokens_owed0,tokens_owed1,last_event_block,data)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         on conflict (token_id) do update set
           owner=excluded.owner, pool=excluded.pool, tick_lower=excluded.tick_lower, tick_upper=excluded.tick_upper,
           liquidity=excluded.liquidity, tokens_owed0=excluded.tokens_owed0, tokens_owed1=excluded.tokens_owed1, data=excluded.data`,
        [
          String(tokenId),
          low(p?.owner),
          (low(p?.token0) && low(p?.token1)) ? `${low(p?.token0)}-${low(p?.token1)}` : (p?.pool ?? null),
          p?.tickLower ?? null,
          p?.tickUpper ?? null,
          p?.liquidity ?? null,
          p?.tokensOwed0 ?? null,
          p?.tokensOwed1 ?? null,
          p?.lastEventBlock ?? null,
          JSON.stringify(p)
        ]
      );
      posCount++;
    }
  }

  const { rows: [r1] } = await client.getResult ? await client.getResult() : await client.query('select count(*)::int as n from public.ingested_erc721_raw');
  const { rows: [r2] } = await client.query('select count(*)::int as n from public.ingested_positions');
  console.log(JSON.stringify({inserted_raw: rawCount, inserted_positions: posCount, totals: {erc721_raw: r1.n, positions: r2.n}}));
  await client.end();
})().catch(e => { console.error(e); process.exit(1); });
