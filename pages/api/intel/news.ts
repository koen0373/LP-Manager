import type { NextApiRequest, NextApiResponse } from 'next';

import { canonicalizeSymbol, buildIntelTerms, intelSynonyms } from '@/lib/intel/canonicalize';
import {
  ImpactSummary,
  PerplexityError,
  SearchResult,
  searchNews,
  summarizeImpact,
} from '@/lib/perplexity/client';
import { getPositionById } from '@/services/pmFallback';
import { FLARE_HOSTS } from '@/lib/intel/domainWhitelist';

type IntelResponse =
  | {
      ok: true;
      pair: string;
      tokens: string[];
      recency: 'day' | 'week';
      items: SearchResult[];
      impact: ImpactSummary;
      fallback?: boolean;
      empty?: boolean;
    }
  | {
      ok: false;
      error: string;
      pair?: string;
      tokens?: string[];
      recency?: 'day' | 'week';
    };

const VALID_RECENCY = new Set(['day', 'week']);

function splitTokens(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
}

function splitPair(value?: string): string[] {
  if (!value) return [];
  return value
    .split('-')
    .map((token) => token.trim())
    .filter(Boolean);
}

async function resolveTokensFromId(id: string): Promise<string[]> {
  try {
    const position = await getPositionById(id);
    if (!position) {
      return [];
    }
    return [position.token0?.symbol, position.token1?.symbol].filter(Boolean) as string[];
  } catch (error) {
    console.error('intel.news: failed to resolve pool id', { id, error });
    return [];
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<IntelResponse>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const {
    pair: pairParam,
    tokens: tokensParam,
    chain: chainParam,
    recency: recencyParam,
    id,
    allow: allowParam,
  } = req.query;

  const startedAt = Date.now();

  const chainRaw = typeof chainParam === 'string' && chainParam ? chainParam : 'flare';
  const chain = chainRaw[0]?.toUpperCase() + chainRaw.slice(1).toLowerCase();

  const rawTokens: string[] = [];

  if (typeof tokensParam === 'string') {
    rawTokens.push(...splitTokens(tokensParam));
  } else if (Array.isArray(tokensParam)) {
    tokensParam.forEach((value) => rawTokens.push(...splitTokens(value)));
  }

  if (typeof pairParam === 'string') {
    rawTokens.push(...splitPair(pairParam));
  }

  if (typeof id === 'string' && id.trim()) {
    const idTokens = await resolveTokensFromId(id.trim());
    if (idTokens.length === 2) {
      rawTokens.splice(0, rawTokens.length, ...idTokens);
    } else if (!rawTokens.length) {
      return res
        .status(400)
        .json({ ok: false, error: 'Unable to resolve pool tokens from id. Provide pair or tokens.' });
    }
  }

  const trimmedTokens = rawTokens
    .map((token) => (token ? token.trim() : token))
    .filter(Boolean) as string[];

  const canonicalTokens = trimmedTokens.map(canonicalizeSymbol).filter(Boolean);

  if (trimmedTokens.length < 2 && canonicalTokens.length < 2) {
    return res.status(400).json({ ok: false, error: 'Cannot derive tokens for this pool.' });
  }

  const pairLabel =
    trimmedTokens.length >= 2
      ? `${trimmedTokens[0]}-${trimmedTokens[1]}`
      : `${canonicalTokens[0]}-${canonicalTokens[1]}`;

  const recency =
    typeof recencyParam === 'string' && VALID_RECENCY.has(recencyParam)
      ? (recencyParam as 'day' | 'week')
      : 'week';

  const allowValue = typeof allowParam === 'string' ? allowParam.trim().toLowerCase() : null;
  const allowlist = allowValue === 'any' ? [] : FLARE_HOSTS.slice();

  try {
    const synonymGroups = (trimmedTokens.length ? trimmedTokens : canonicalTokens)
      .slice(0, 2)
      .map((token) => {
        const group = new Set<string>();
        group.add(token);
        intelSynonyms(token).forEach((syn) => group.add(syn));
        return Array.from(group);
      });

    const hints = buildIntelTerms(trimmedTokens.length ? trimmedTokens : canonicalTokens, chain);
    hints.push(pairLabel);

    const { items, fallback, cacheHit } = await searchNews({
      synonymGroups,
      hints,
      recency,
      max: 5,
      allowlist,
    });

    const impact = await summarizeImpact({
      items,
      context: `Flare ${pairLabel} liquidity pool`,
    });

    const payload: IntelResponse = {
      ok: true,
      pair: pairLabel,
      tokens: trimmedTokens.length ? trimmedTokens.slice(0, 2) : canonicalTokens.slice(0, 2),
      recency,
      items: items.map((item) => ({ ...item })),
      impact,
      fallback: fallback || undefined,
      ...(items.length === 0 ? { empty: true } : {}),
    };

    console.info(
      JSON.stringify({
        event: 'intel.news',
        pair: pairLabel,
        recency,
        tokenCount: trimmedTokens.length ? trimmedTokens.length : canonicalTokens.length,
        allowCount: allowlist.length,
        itemCount: items.length,
        fallback,
        upstreamMs: Date.now() - startedAt,
        cache: cacheHit,
      }),
    );

    return res.status(200).json(payload);
  } catch (error) {
    if (error instanceof PerplexityError) {
      const status = error.code ?? 500;
      return res.status(status).json({
        ok: false,
        error: status === 501 ? 'PERPLEXITY_API_KEY missing' : error.message,
        pair: pairLabel,
        tokens: trimmedTokens.length ? trimmedTokens.slice(0, 2) : canonicalTokens.slice(0, 2),
        recency,
      });
    }

    console.error('intel.news: unexpected failure', { error });
    return res.status(500).json({
      ok: false,
      error: 'Unexpected error',
      pair: pairLabel,
      tokens: trimmedTokens.length ? trimmedTokens.slice(0, 2) : canonicalTokens.slice(0, 2),
      recency,
    });
  }
}
