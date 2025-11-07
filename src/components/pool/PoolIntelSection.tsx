import { useEffect, useMemo, useRef } from 'react';

import PoolIntelCard from '@/components/PoolIntelCard';

type TokenLike = { symbol?: string | null };

type PoolLike = {
  token0?: TokenLike | null;
  token1?: TokenLike | null;
};

type PoolIntelSectionProps = {
  pool?: PoolLike | null;
  pair?: string;
  chain?: string;
  recency?: 'day' | 'week';
};

export default function PoolIntelSection({
  pool,
  pair,
  chain = 'flare',
  recency = 'week',
}: PoolIntelSectionProps) {
  const hasWarnedRef = useRef(false);

  const derivedTokens = useMemo(() => {
    if (!pool) return [] as string[];
    return [
      pool.token0?.symbol?.trim(),
      pool.token1?.symbol?.trim(),
    ]
      .filter(Boolean)
      .slice(0, 2) as string[];
  }, [pool?.token0?.symbol, pool?.token1?.symbol]);

  const effectivePair =
    derivedTokens.length === 2 ? `${derivedTokens[0]}-${derivedTokens[1]}` : pair;

  useEffect(() => {
    if (!effectivePair && derivedTokens.length < 2 && !hasWarnedRef.current) {
      console.warn('PoolIntelSection: missing token symbols; intel card hidden', {
        pair,
        derivedTokens,
      });
      hasWarnedRef.current = true;
    }
  }, [derivedTokens, effectivePair, pair]);

  if (derivedTokens.length < 2 && !effectivePair) {
    return null;
  }

  return (
    <section id="intel" className="mt-10 space-y-6">
      <PoolIntelCard
        tokens={derivedTokens.length === 2 ? derivedTokens : undefined}
        pair={derivedTokens.length === 2 ? undefined : effectivePair}
        chain={chain}
        recency={recency}
      />
    </section>
  );
}
