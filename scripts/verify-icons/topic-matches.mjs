#!/usr/bin/env node
/**
 * Topic Smoke Test
 * 
 * Tests eth_getLogs with PoolCreated topic filter and reports count.
 */

const POOL_CREATED_TOPIC = '0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    rpc: null,
    factory: null,
    from: null,
    to: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--rpc' && args[i + 1]) opts.rpc = args[++i];
    else if (arg === '--factory' && args[i + 1]) opts.factory = args[++i];
    else if (arg === '--from' && args[i + 1]) opts.from = parseInt(args[++i], 10);
    else if (arg === '--to' && args[i + 1]) opts.to = parseInt(args[++i], 10);
  }

  if (!opts.rpc || !opts.factory || opts.from === null || opts.to === null) {
    console.error('❌ Usage: --rpc <url> --factory <addr> --from <bn> --to <bn>');
    process.exit(1);
  }

  return opts;
}

async function rpcCall(url, method, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(`RPC error: ${data.error.message || JSON.stringify(data.error)}`);
  }
  return data.result;
}

async function main() {
  const opts = parseArgs();

  try {
    const logs = await rpcCall(opts.rpc, 'eth_getLogs', [{
      fromBlock: `0x${opts.from.toString(16)}`,
      toBlock: `0x${opts.to.toString(16)}`,
      address: opts.factory,
      topics: [POOL_CREATED_TOPIC],
    }]);

    const result = {
      count: Array.isArray(logs) ? logs.length : 0,
      from: opts.from,
      to: opts.to,
    };

    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(`❌ Error: ${e.message}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});


