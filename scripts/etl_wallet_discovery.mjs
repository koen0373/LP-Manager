import { db } from '../src/server/db/index.js'
async function main() {
  console.log('Wallet discovery placeholder – wire to provider scanners.')
  // await db.analytics_wallet.upsert({ where: { address }, create: { address }, update: {} })
}
main().catch(e => { console.error(e); process.exit(1) })
