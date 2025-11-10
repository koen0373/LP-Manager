import { PrismaClient } from '@prisma/client';
import { formatCET, getToday18CETUnix, getToday19CETUnix } from '../src/utils/cetTime';

const prisma = new PrismaClient();

async function checkIndexerActivity() {
  try {
    // Get 18:00-19:00 CET today
    const today18Unix = getToday18CETUnix();
    const today19Unix = getToday19CETUnix();
    const twoHoursAgoUnix = Math.floor((Date.now() - 2 * 60 * 60 * 1000) / 1000);
    
    console.log(`\n🔍 Checking indexer activity around 18:00 CET (${formatCET(today18Unix)})...\n`);
    console.log(`   Unix timestamp range: ${today18Unix} - ${today19Unix}\n`);

    // Check recent PositionEvents (18:00-19:00 CET today)
    const recentEvents = await prisma.$queryRaw<Array<{ count: bigint; latest: number }>>`
      SELECT 
        COUNT(*)::bigint as count,
        MAX("timestamp")::bigint as latest
      FROM "PositionEvent"
      WHERE "timestamp" >= ${today18Unix}
        AND "timestamp" < ${today19Unix}
    `;

    const eventCount = Number(recentEvents[0]?.count || 0);
    const latestTimestamp = recentEvents[0]?.latest ? Number(recentEvents[0].latest) : null;

    console.log(`📊 Events between 18:00-19:00 CET:`);
    console.log(`   Count: ${eventCount}`);
    if (latestTimestamp) {
      console.log(`   Latest: ${formatCET(latestTimestamp)} (Unix: ${latestTimestamp})`);
    } else {
      console.log(`   Latest: N/A`);
    }

    // Check most recent events overall (last 2 hours)
    const mostRecent = await prisma.$queryRaw<Array<{ count: bigint; latest: number; earliest: number }>>`
      SELECT 
        COUNT(*)::bigint as count,
        MAX("timestamp")::bigint as latest,
        MIN("timestamp")::bigint as earliest
      FROM "PositionEvent"
      WHERE "timestamp" >= ${twoHoursAgoUnix}
    `;

    const recentCount = Number(mostRecent[0]?.count || 0);
    const latestOverall = mostRecent[0]?.latest ? Number(mostRecent[0].latest) : null;
    const earliestOverall = mostRecent[0]?.earliest ? Number(mostRecent[0].earliest) : null;

    console.log(`\n📊 Events in last 2 hours:`);
    console.log(`   Count: ${recentCount}`);
    if (latestOverall) {
      console.log(`   Latest: ${formatCET(latestOverall)} (Unix: ${latestOverall})`);
      console.log(`   Earliest: ${formatCET(earliestOverall)} (Unix: ${earliestOverall})`);
    }

    // Check SyncCheckpoint table
    let checkpoints: any[] = [];
    try {
      checkpoints = await prisma.$queryRaw<Array<{ source: string; key: string; lastBlock: number; updatedAt: Date }>>`
        SELECT 
          "source",
          "key",
          "lastBlock",
          "updatedAt"
        FROM "SyncCheckpoint"
        ORDER BY "updatedAt" DESC
        LIMIT 5
      `;
      
      console.log(`\n📌 Recent checkpoints:`);
      for (const cp of checkpoints) {
        const updatedAt = new Date(cp.updatedAt);
        const cetTime = formatCET(Math.floor(updatedAt.getTime() / 1000));
        console.log(`   ${cp.source}:${cp.key} @ block ${cp.lastBlock} (${cetTime})`);
      }
    } catch (e) {
      console.log(`\n⚠️  SyncCheckpoint tabel niet gevonden of error: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Determine if indexer ran at 18:00
    console.log(`\n`);
    if (eventCount > 0) {
      console.log(`✅ Indexer heeft WEL data opgehaald tussen 18:00-19:00 CET`);
      console.log(`   ${eventCount} events gevonden`);
    } else if (recentCount > 0) {
      console.log(`⚠️  Geen events tussen 18:00-19:00 CET, maar wel ${recentCount} events in laatste 2 uur`);
      if (latestOverall) {
        const latestDate = formatCET(latestOverall);
        console.log(`   Laatste event: ${latestDate}`);
        const hoursDiff = (Date.now() - latestOverall * 1000) / (1000 * 60 * 60);
        console.log(`   ${hoursDiff.toFixed(1)} uur geleden`);
      }
      console.log(`   Indexer draait mogelijk op ander tijdstip`);
    } else {
      console.log(`❌ Geen recente events gevonden`);
      console.log(`   Indexer heeft mogelijk niet gedraaid of is gestopt`);
    }

  } catch (error) {
    console.error('❌ Error checking indexer activity:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkIndexerActivity();

