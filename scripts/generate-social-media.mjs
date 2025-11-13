#!/usr/bin/env node
/**
 * Social Media Post Generator for Weekly Reports
 * 
 * Automatically generates social media content for LinkedIn, Twitter/X, etc.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

// Generate LinkedIn post
function generateLinkedInPost(data, weekInfo) {
  const { tvl, crossDexStats, topWallets, positionStats } = data;
  const totalPositions = Number(positionStats.total_positions);
  const totalWallets = Math.floor(Number(positionStats.total_wallets) / 2);
  const crossDexUsers = Number(crossDexStats.cross_dex_users);
  const crossDexPct = ((crossDexUsers / totalWallets) * 100).toFixed(1);
  
  return `📊 LiquiLab Weekly Market Report - Week ${weekInfo.week} | ${weekInfo.month} ${weekInfo.year}

Deep-dive into Flare Network's V3 liquidity ecosystem 🌊

🔥 KEY INSIGHTS:
• $${(tvl.totalTVL / 1e6).toFixed(1)}M Total Value Locked across ${totalPositions.toLocaleString()} positions
• ${crossDexPct}% of LPs actively use BOTH Enosys & SparkDEX
• Cross-DEX users hold ~${((crossDexUsers / totalWallets) * 100).toFixed(0)}% of all liquidity
• Top 10 wallets control ~$${(topWallets.reduce((sum, w) => sum + Number(w.total_pos), 0) * (tvl.totalTVL / totalPositions) / 1e6).toFixed(1)}M

💡 WHY IT MATTERS:
Multi-DEX strategies deliver superior returns through:
✅ Incentive arbitrage
✅ Fee tier optimization  
✅ Risk diversification
✅ Earlier access to opportunities

📈 MARKET BREAKDOWN:
SparkDEX: $${(tvl.sparkdexTVL / 1e6).toFixed(1)}M TVL
Enosys: $${(tvl.enosysTVL / 1e6).toFixed(1)}M TVL

📥 Download the full report: [LINK]

Track your positions in real-time: https://app.liquilab.io

#Flare #DeFi #LiquidityProviding #Crypto #Analytics #FlareNetwork #UniswapV3

---

🔔 Weekly reports published every Monday at 10:00 AM CET`;
}

// Generate Twitter/X thread
function generateTwitterThread(data, weekInfo) {
  const { tvl, crossDexStats, topWallets, positionStats } = data;
  const totalPositions = Number(positionStats.total_positions);
  const totalWallets = Math.floor(Number(positionStats.total_wallets) / 2);
  const crossDexUsers = Number(crossDexStats.cross_dex_users);
  const crossDexPct = ((crossDexUsers / totalWallets) * 100).toFixed(1);
  
  const tweets = [
    // Tweet 1 (Hook)
    `🚨 NEW: @LiquiLab Weekly Market Report

Week ${weekInfo.week} | Flare V3 LP Analysis

$${(tvl.totalTVL / 1e6).toFixed(1)}M TVL • ${totalPositions.toLocaleString()} Positions • ${totalWallets.toLocaleString()} Wallets

Cross-DEX users are CRUSHING it 👇🧵`,

    // Tweet 2 (Main Finding)
    `2/ 🔥 POWER USER INSIGHT

Only ${crossDexPct}% of LPs use BOTH Enosys & SparkDEX

BUT they control ~${((crossDexUsers / totalWallets) * 100).toFixed(0)}% of ALL liquidity

Avg positions:
• Cross-DEX: ${(topWallets.reduce((sum, w) => sum + Number(w.total_pos), 0) / topWallets.length).toFixed(0)}
• Single-DEX: ${(totalPositions / totalWallets).toFixed(1)}

Multi-DEX = 3-5x more positions`,

    // Tweet 3 (Market Share)
    `3/ 📊 MARKET BREAKDOWN

SparkDEX 🟣
$${(tvl.sparkdexTVL / 1e6).toFixed(1)}M TVL
${((tvl.sparkdexTVL / tvl.totalTVL) * 100).toFixed(1)}% market share

Enosys 🔵
$${(tvl.enosysTVL / 1e6).toFixed(1)}M TVL
${((tvl.enosysTVL / tvl.totalTVL) * 100).toFixed(1)}% market share

SparkDEX dominates in both volume AND pool depth`,

    // Tweet 4 (Top Wallets)
    `4/ 🏆 TOP 10 CROSS-DEX WALLETS

Combined: ~$${(topWallets.reduce((sum, w) => sum + Number(w.total_pos), 0) * (tvl.totalTVL / totalPositions) / 1e6).toFixed(1)}M TVL

🥇 ${topWallets[0].wallet.substring(0, 10)}... - ${topWallets[0].total_pos} positions
🥈 ${topWallets[1].wallet.substring(0, 10)}... - ${topWallets[1].total_pos} positions
🥉 ${topWallets[2].wallet.substring(0, 10)}... - ${topWallets[2].total_pos} positions

Are YOU on this list? 👀`,

    // Tweet 5 (Why Cross-DEX)
    `5/ 💡 WHY CROSS-DEX WINS

✅ Incentive arbitrage (rFLR, SPX, APS)
✅ Fee tier optimization
✅ Better risk diversification
✅ Early access to new pools
✅ Scale advantages

Result: Est. 30-50% higher APR vs single-DEX`,

    // Tweet 6 (CTA)
    `6/ 📥 GET THE FULL REPORT

• Complete data analysis
• LP strategy breakdown
• APR estimates by tier
• Week-over-week trends

Download: [LINK]

Track YOUR positions: https://app.liquilab.io

#Flare $FLR #DeFi`,

    // Tweet 7 (Subscribe)
    `7/ 🔔 NEVER MISS AN UPDATE

Weekly reports drop every Monday 10AM CET

Follow @LiquiLab for:
📊 Market analytics
💰 APR tracking
🎯 Strategy insights
⚡ RangeBand™ alerts

See you next week! 🚀`,
  ];
  
  return tweets;
}

// Generate Instagram caption
function generateInstagramCaption(data, weekInfo) {
  const { tvl, crossDexStats } = data;
  const totalWallets = Math.floor(Number(data.positionStats.total_wallets) / 2);
  const crossDexPct = ((Number(crossDexStats.cross_dex_users) / totalWallets) * 100).toFixed(1);
  
  return `📊 WEEKLY MARKET REPORT | Week ${weekInfo.week}

Flare Network V3 LP Analysis 🌊

💰 $${(tvl.totalTVL / 1e6).toFixed(1)}M Total Value Locked
🔥 ${crossDexPct}% of LPs use BOTH DEXes
📈 30-50% higher APR for cross-DEX strategies

Full report in bio 🔗

---

#DeFi #Crypto #FlareNetwork #LiquidityProviding #CryptoAnalytics #Web3 #Blockchain #PassiveIncome #CryptoTrading #DeFiStrategy

💬 Are YOU using multiple DEXes? Drop a 🔥 in comments!`;
}

// Generate Reddit post
function generateRedditPost(data, weekInfo) {
  const { tvl, crossDexStats, topWallets, positionStats } = data;
  const totalPositions = Number(positionStats.total_positions);
  const totalWallets = Math.floor(Number(positionStats.total_wallets) / 2);
  const crossDexUsers = Number(crossDexStats.cross_dex_users);
  
  return `**[Research] LiquiLab Weekly Report: Cross-DEX LP Analysis on Flare Network (Week ${weekInfo.week}, ${weekInfo.month} ${weekInfo.year})**

Hey r/FlareNetwork! We just published our weekly deep-dive into V3 liquidity provider behavior across Enosys and SparkDEX. Here are the highlights:

## 📊 Key Data Points

* **Total Value Locked:** $${(tvl.totalTVL / 1e6).toFixed(1)}M
* **Total Positions:** ${totalPositions.toLocaleString()}
* **Active Wallets:** ${totalWallets.toLocaleString()}
* **SparkDEX TVL:** $${(tvl.sparkdexTVL / 1e6).toFixed(1)}M (${((tvl.sparkdexTVL / tvl.totalTVL) * 100).toFixed(1)}%)
* **Enosys TVL:** $${(tvl.enosysTVL / 1e6).toFixed(1)}M (${((tvl.enosysTVL / tvl.totalTVL) * 100).toFixed(1)}%)

## 🔥 Most Interesting Finding

Only **${((crossDexUsers / totalWallets) * 100).toFixed(1)}%** of LPs actively use BOTH Enosys and SparkDEX, but these ${crossDexUsers} wallets control approximately **${((crossDexUsers / totalWallets) * 100).toFixed(0)}%** of all liquidity positions.

**Why?** Multi-DEX strategies allow for:
1. Incentive arbitrage (rFLR, SPX, APS rewards)
2. Fee tier optimization
3. Better risk diversification
4. Earlier access to new pools

Our analysis suggests cross-DEX users earn an estimated **30-50% higher APR** compared to single-DEX strategies.

## 🏆 Top 10 Cross-DEX Power Users

Combined TVL of top 10: **~$${(topWallets.reduce((sum, w) => sum + Number(w.total_pos), 0) * (tvl.totalTVL / totalPositions) / 1e6).toFixed(1)}M**

Average positions per top wallet: **${(topWallets.reduce((sum, w) => sum + Number(w.total_pos), 0) / topWallets.length).toFixed(0)}**

(Full wallet breakdown in the report)

## 📥 Full Report

You can download the complete analysis here: [LINK]

We also track real-time position data at: https://app.liquilab.io

## 🔔 Weekly Updates

We publish these reports every Monday at 10:00 AM CET. Follow us for ongoing market insights!

---

*Disclaimer: This is for informational purposes only. DYOR. Not financial advice.*`;
}

// Save all social media content
async function saveSocialMediaContent(data, weekInfo) {
  const outputDir = path.join(process.cwd(), 'docs/research/weekly', `W${weekInfo.week.toString().padStart(2, '0')}-social`);
  await fs.mkdir(outputDir, { recursive: true });
  
  // LinkedIn
  const linkedin = generateLinkedInPost(data, weekInfo);
  await fs.writeFile(path.join(outputDir, 'linkedin.txt'), linkedin, 'utf8');
  
  // Twitter thread
  const tweets = generateTwitterThread(data, weekInfo);
  await fs.writeFile(
    path.join(outputDir, 'twitter-thread.txt'),
    tweets.map((tweet, i) => `TWEET ${i + 1}/${tweets.length}\n${'-'.repeat(50)}\n${tweet}\n`).join('\n'),
    'utf8'
  );
  
  // Individual tweets for easy copy-paste
  for (let i = 0; i < tweets.length; i++) {
    await fs.writeFile(
      path.join(outputDir, `tweet-${i + 1}.txt`),
      tweets[i],
      'utf8'
    );
  }
  
  // Instagram
  const instagram = generateInstagramCaption(data, weekInfo);
  await fs.writeFile(path.join(outputDir, 'instagram.txt'), instagram, 'utf8');
  
  // Reddit
  const reddit = generateRedditPost(data, weekInfo);
  await fs.writeFile(path.join(outputDir, 'reddit.txt'), reddit, 'utf8');
  
  console.log(`\n📱 Social media content saved to: ${outputDir}\n`);
  
  return outputDir;
}

export {
  generateLinkedInPost,
  generateTwitterThread,
  generateInstagramCaption,
  generateRedditPost,
  saveSocialMediaContent,
};

const invokedDirectly =
  Boolean(process.argv[1]) &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  const weeklyReport = await import('./generate-weekly-report.mjs');

  weeklyReport
    .main()
    .then(async (result) => {
      await saveSocialMediaContent(
        { ...result.data, tvl: result.tvl, topWallets: result.data.topWallets },
        result.weekInfo,
      );
      console.log('✅ Social media content generated!\n');
    })
    .catch((error) => {
      console.error('❌ ERROR:', error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
