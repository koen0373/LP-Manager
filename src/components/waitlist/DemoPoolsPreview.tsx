'use client';

import React from 'react';
import PositionsTable, { PositionData } from '@/components/PositionsTable';

const providerLabelMap: Record<string, string> = {
  Enosys: 'ENOSYS V3',
  SparkDEX: 'SPARKDEX V3',
  BlazeSwap: 'BLAZESWAP V3',
};

interface DemoPoolRow {
  tokenId: string;
  pair: string;
  feeTier: string;
  range: string;
  liquidityUsd: string;
  liquidityShare: string;
  feesUsd: string;
  incentivesUsd: string;
  incentivesToken: string;
  currentPrice: string;
  status: PositionData['status'];
  token0Icon: string;
  token1Icon: string;
  provider: string;
}

const demoPools: DemoPoolRow[] = [
  {
    tokenId: '#21567',
    pair: 'HLN / USD₮0',
    feeTier: '0.05%',
    range: '0.02143 – 0.02510',
    liquidityUsd: '$2,437.18',
    liquidityShare: '(0.12%)',
    feesUsd: '$6.26',
    incentivesUsd: '$34.12',
    incentivesToken: '1,856.40 rFLR',
    currentPrice: '0.02308',
    status: 'IN_RANGE',
    token0Icon: '/icons/hln.webp',
    token1Icon: '/icons/usd0.webp',
    provider: 'Enosys',
  },
  {
    tokenId: '#22088',
    pair: 'SFLR / USD₮0',
    feeTier: '0.30%',
    range: '0.286 – 0.342',
    liquidityUsd: '$3,118.54',
    liquidityShare: '(0.27%)',
    feesUsd: '$4.92',
    incentivesUsd: '$41.77',
    incentivesToken: '1,244.66 rFLR',
    currentPrice: '0.318',
    status: 'NEAR_BAND',
    token0Icon: '/icons/sflr.webp',
    token1Icon: '/icons/usd0.webp',
    provider: 'Enosys',
  },
  {
    tokenId: '#22531',
    pair: 'WFLR / USD₮0',
    feeTier: '0.30%',
    range: '0.01640 – 0.01895',
    liquidityUsd: '$11,407.55',
    liquidityShare: '(0.86%)',
    feesUsd: '$14.02',
    incentivesUsd: '$68.44',
    incentivesToken: '3,771.12 rFLR',
    currentPrice: '0.01752',
    status: 'IN_RANGE',
    token0Icon: '/icons/flr.webp',
    token1Icon: '/icons/usd0.webp',
    provider: 'Enosys',
  },
  {
    tokenId: '#SPX01',
    pair: 'FXRP / USD₮0',
    feeTier: '0.30%',
    range: '—',
    liquidityUsd: '$3,904.88',
    liquidityShare: '(0.22%)',
    feesUsd: '$5.36',
    incentivesUsd: '$27.90',
    incentivesToken: '1,112.34 FXRP yield',
    currentPrice: '2.311',
    status: 'IN_RANGE',
    token0Icon: '/icons/fxrp.webp',
    token1Icon: '/icons/usd0.webp',
    provider: 'SparkDEX',
  },
  {
    tokenId: '#SPX02',
    pair: 'WFLR / FXRP',
    feeTier: '0.30%',
    range: '—',
    liquidityUsd: '$5,612.45',
    liquidityShare: '(0.34%)',
    feesUsd: '$7.88',
    incentivesUsd: '$33.42',
    incentivesToken: '1,508.21 LP rewards',
    currentPrice: '45.112',
    status: 'NEAR_BAND',
    token0Icon: '/icons/flr.webp',
    token1Icon: '/icons/fxrp.webp',
    provider: 'SparkDEX',
  },
  {
    tokenId: '#SPX03',
    pair: 'SGB / USDX',
    feeTier: '0.30%',
    range: '—',
    liquidityUsd: '$8,225.63',
    liquidityShare: '(0.27%)',
    feesUsd: '$6.94',
    incentivesUsd: '$42.01',
    incentivesToken: '2,086.77 staking yield',
    currentPrice: '0.371',
    status: 'IN_RANGE',
    token0Icon: '/icons/sgb.network.webp',
    token1Icon: '/icons/usdx.webp',
    provider: 'SparkDEX',
  },
  {
    tokenId: '#SPX04',
    pair: 'SFLR / FXRP',
    feeTier: '1.00%',
    range: '—',
    liquidityUsd: '$12,814.77',
    liquidityShare: '(0.41%)',
    feesUsd: '$9.88',
    incentivesUsd: '$55.12',
    incentivesToken: '2,615.44 LP incentives',
    currentPrice: '0.344',
    status: 'OUT_OF_RANGE',
    token0Icon: '/icons/sflr.webp',
    token1Icon: '/icons/fxrp.webp',
    provider: 'SparkDEX',
  },
  {
    tokenId: '#22154',
    pair: 'WFLR / HLN',
    feeTier: '1.00%',
    range: '35.126 – 41.554',
    liquidityUsd: '$8,715.63',
    liquidityShare: '(0.21%)',
    feesUsd: '$5.12',
    incentivesUsd: '$48.09',
    incentivesToken: '2,103.08 rFLR',
    currentPrice: '39.408',
    status: 'NEAR_BAND',
    token0Icon: '/icons/flr.webp',
    token1Icon: '/icons/hln.webp',
    provider: 'BlazeSwap',
  },
  {
    tokenId: '#23211',
    pair: 'SGB / SFLR',
    feeTier: '0.05%',
    range: '0.342 – 0.402',
    liquidityUsd: '$21,554.87',
    liquidityShare: '(0.41%)',
    feesUsd: '$14.88',
    incentivesUsd: '$83.90',
    incentivesToken: '2,612.55 LP incentives',
    currentPrice: '0.371',
    status: 'NEAR_BAND',
    token0Icon: '/icons/sgb.network.webp',
    token1Icon: '/icons/sflr.webp',
    provider: 'BlazeSwap',
  },
];

function toPositionData(row: DemoPoolRow): PositionData {
  const [token0Symbol, token1Symbol] = row.pair.split('/').map((token) => token.trim());
  const liquidityValue = Number(row.liquidityUsd.replace(/[^0-9.-]/g, ''));
  const feesValue = Number(row.feesUsd.replace(/[^0-9.-]/g, ''));
  const incentivesValue = Number(row.incentivesUsd.replace(/[^0-9.-]/g, ''));
  const share = Number(row.liquidityShare.replace(/[^0-9.-]/g, ''));
  const rangeParts = row.range.includes('–')
    ? row.range.split('–').map((value) => Number(value.trim()))
    : [undefined, undefined];

  return {
    tokenId: row.tokenId.replace('#', ''),
    dexName: providerLabelMap[row.provider] ?? row.provider.toUpperCase(),
    poolId: row.tokenId,
    token0Symbol,
    token1Symbol,
    token0Icon: row.token0Icon,
    token1Icon: row.token1Icon,
    feeTier: row.feeTier,
    rangeMin: rangeParts[0],
    rangeMax: rangeParts[1],
    liquidityUsd: liquidityValue,
    liquidityShare: share > 0 ? share : undefined,
    feesUsd: feesValue,
    incentivesUsd: incentivesValue,
    incentivesToken: row.incentivesToken,
    currentPrice: Number(row.currentPrice),
    status: row.status,
  };
}

export function DemoPoolsPreview() {
  const demoData = React.useMemo(() => demoPools.map(toPositionData), []);

  return <PositionsTable positions={demoData} />;
}
