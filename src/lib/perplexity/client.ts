import { FLARE_HOSTS } from '@/lib/intel/domainWhitelist';

type RiskLevel = 'low' | 'med' | 'high';

export type SearchResult = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  snippet?: string;
  relevance?: number;
};

export type ImpactSummary = {
  bullets: string[];
  riskLevel: RiskLevel;
};

type SearchOptions = {
  synonymGroups: string[][];
  hints?: string[];
  recency?: 'day' | 'week';
  max?: number;
  allowlist?: string[];
};

type SearchNewsResult = {
  items: SearchResult[];
  fallback: boolean;
  cacheHit: boolean;
};

type ImpactOptions = {
  items: SearchResult[];
  context: string;
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type PerplexityResponse = {
  body: any;
  rawContent?: string;
  status: number;
};

export class PerplexityError extends Error {
  code: number;

  constructor(message: string, code: number) {
    super(message);
    this.code = code;
  }
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const searchCache = new Map<string, CacheEntry<SearchNewsResult>>();
const impactCache = new Map<string, CacheEntry<ImpactSummary>>();

const CHAT_ENDPOINT = 'https://api.perplexity.ai/v1/chat/completions';
const SEARCH_ENDPOINT = 'https://api.perplexity.ai/v1/search';

function ensureApiKey(): string {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) {
    throw new PerplexityError('PERPLEXITY_API_KEY missing', 501);
  }
  return key;
}

function normaliseGroup(group: string[]): string[] {
  return Array.from(
    new Set(
      group
        .map((value) => value?.trim())
        .filter(Boolean)
        .map((value) => value as string),
    ),
  );
}

function buildSearchCacheKey(options: SearchOptions) {
  const { synonymGroups = [], hints = [], recency = 'week', max = 5, allowlist = [] } = options;
  const groupKey = synonymGroups
    .map((group) => normaliseGroup(group).map((v) => v.toLowerCase()).sort())
    .sort((a, b) => a.join('|').localeCompare(b.join('|')));
  const hintsKey = hints.map((hint) => hint.toLowerCase()).sort();
  return JSON.stringify({
    groups: groupKey,
    hints: hintsKey,
    recency,
    max,
    allowlist: [...allowlist].map((host) => host.toLowerCase()).sort(),
  });
}

function buildImpactCacheKey(options: ImpactOptions) {
  return JSON.stringify({
    context: options.context,
    urls: options.items.map((item) => item.url).sort(),
  });
}

async function callPerplexity(endpoint: string, init: RequestInit): Promise<PerplexityResponse> {
  const apiKey = ensureApiKey();

  let response: Response;
  try {
    response = await fetch(endpoint, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    throw new PerplexityError(
      error instanceof Error ? error.message : 'Network error reaching Perplexity',
      502,
    );
  }

  if (response.status === 404) {
    return { body: null, rawContent: undefined, status: 404 };
  }

  if (response.status >= 500) {
    throw new PerplexityError('Upstream error', 502);
  }

  if (response.status === 429) {
    throw new PerplexityError('Rate limited', 429);
  }

  if (response.status === 400) {
    throw new PerplexityError('Invalid request', 400);
  }

  if (response.status >= 400) {
    throw new PerplexityError(`Perplexity request failed (${response.status})`, 500);
  }

  let body: any = null;
  let rawContent: string | undefined;
  try {
    body = await response.json();
    rawContent = body?.choices?.[0]?.message?.content;
  } catch {
    body = null;
    rawContent = undefined;
  }

  return { body, rawContent, status: response.status };
}

function parseJsonPayload(content: string | undefined) {
  if (!content) return undefined;
  const trimmed = content.trim();
  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i);
  const payload = fencedMatch ? fencedMatch[1] : trimmed;
  try {
    return JSON.parse(payload);
  } catch {
    return undefined;
  }
}

function normaliseSearchResults(raw: any): SearchResult[] {
  if (!Array.isArray(raw?.items)) return [];
  return raw.items
    .filter(Boolean)
    .map((item: any) => ({
      title: String(item?.title ?? 'Untitled'),
      url: String(item?.url ?? '#'),
      source:
        item?.source ??
        item?.domain ??
        (() => {
          try {
            return new URL(String(item?.url ?? '')).hostname.replace(/^www\./, '');
          } catch {
            return 'source';
          }
        })(),
      publishedAt: item?.publishedAt ? String(item.publishedAt) : new Date().toISOString(),
      snippet: item?.snippet ? String(item.snippet) : undefined,
      relevance:
        typeof item?.relevance === 'number'
          ? Math.min(100, Math.max(0, Math.round(item.relevance)))
          : undefined,
    }));
}

function normaliseImpact(raw: any): ImpactSummary {
  const bullets = Array.isArray(raw?.bullets)
    ? raw.bullets.map((bullet: any) => String(bullet)).filter(Boolean)
    : [];
  const risk = String(raw?.riskLevel ?? 'low').toLowerCase();
  let riskLevel: RiskLevel = 'low';
  if (risk === 'high') riskLevel = 'high';
  else if (risk === 'med' || risk === 'medium') riskLevel = 'med';
  return { bullets, riskLevel };
}

function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function quoteTerm(term: string): string {
  return /\s/.test(term) ? `"${term}"` : term;
}

function buildQueryString(synonymGroups: string[][], hints: string[]): string {
  const segments: string[] = [];

  synonymGroups.forEach((group) => {
    const unique = normaliseGroup(group);
    if (unique.length > 0) {
      segments.push(`(${unique.map(quoteTerm).join(' OR ')})`);
    }
  });

  const uniqueHints = Array.from(new Set(hints.filter(Boolean)));
  if (uniqueHints.length > 0) {
    segments.push(`(${uniqueHints.map(quoteTerm).join(' OR ')})`);
  }

  if (segments.length === 0) {
    return '"Flare"';
  }

  return segments.join(' AND ');
}

function dedupeResults(items: SearchResult[], max: number): SearchResult[] {
  const seen = new Set<string>();
  const deduped: SearchResult[] = [];
  for (const item of items) {
    const host = hostnameFromUrl(item.url) ?? item.source;
    const key = `${host}|${item.title}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
    if (deduped.length >= max) break;
  }
  return deduped;
}

async function chatSearch(
  query: string,
  recency: string,
  max: number,
): Promise<{ items: SearchResult[]; status: number }> {
  const { body, rawContent, status } = await callPerplexity(CHAT_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({
      model: 'sonar',
      return_search_results: true,
      search_recency: recency,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: `Find recent web items about: ${query}. Return JSON with items:[{title,url,source,publishedAt,snippet}] limited to ${max}.`,
        },
      ],
    }),
  });

  if (status === 404) {
    return { items: [], status };
  }

  const parsed = parseJsonPayload(rawContent);
  let items = normaliseSearchResults(parsed).slice(0, max * 2);

  if (!items.length && Array.isArray(body?.search_results)) {
    items = body.search_results
      .map((result: any) => ({
        title: String(result?.title ?? 'Untitled'),
        url: String(result?.url ?? '#'),
        source:
          result?.source?.domain ??
          result?.source?.name ??
          hostnameFromUrl(String(result?.url ?? '')) ??
          'source',
        publishedAt: result?.published_at ? String(result.published_at) : new Date().toISOString(),
        snippet: result?.snippet ? String(result.snippet) : undefined,
        relevance:
          typeof result?.score === 'number'
            ? Math.min(100, Math.max(0, Math.round(result.score * 100)))
            : undefined,
      }))
      .filter(Boolean)
      .slice(0, max * 2);
  }

  return { items, status };
}

async function searchFallback(
  query: string,
  recency: string,
  max: number,
): Promise<{ items: SearchResult[]; status: number }> {
  const { body, status } = await callPerplexity(SEARCH_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({
      q: query,
      top_k: Math.max(8, max),
      search_recency: recency,
    }),
  });

  if (status === 404 || !Array.isArray(body?.results)) {
    return { items: [], status };
  }

  const items = body.results
    .map((result: any) => ({
      title: String(result?.title ?? 'Untitled'),
      url: String(result?.url ?? '#'),
      source:
        result?.source?.domain ??
        result?.source?.name ??
        hostnameFromUrl(String(result?.url ?? '')) ??
        'source',
      publishedAt: result?.published_at ? String(result.published_at) : new Date().toISOString(),
      snippet: result?.snippet ? String(result.snippet) : undefined,
      relevance:
        typeof result?.score === 'number'
          ? Math.min(100, Math.max(0, Math.round(result.score * 100)))
          : undefined,
    }))
    .filter(Boolean)
    .slice(0, max * 2);

  return { items, status };
}

export async function searchNews(options: SearchOptions): Promise<SearchNewsResult> {
  const {
    synonymGroups,
    hints = [],
    recency = 'week',
    max = 5,
    allowlist = FLARE_HOSTS.slice(),
  } = options;

  const cacheKey = buildSearchCacheKey({ synonymGroups, hints, recency, max, allowlist });
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.value, cacheHit: true };
  }

  const query = buildQueryString(synonymGroups, hints);

  let fallbackUsed = false;
  let items: SearchResult[] = [];

  const chatResult = await chatSearch(query, recency, max);
  if (chatResult.status === 404) {
    items = [];
  } else if (chatResult.items.length) {
    items = chatResult.items;
  } else {
    try {
      const fallbackResult = await searchFallback(query, recency, max);
      fallbackUsed = true;
      items = fallbackResult.items;
    } catch (error) {
      if (error instanceof PerplexityError && error.code === 404) {
        items = [];
      } else {
        throw error;
      }
    }
  }

  const allowHosts = allowlist.map((domain) => domain.toLowerCase());
  let filteredItems = items;
  if (allowHosts.length > 0) {
    filteredItems = items.filter((item) => {
      const host =
        hostnameFromUrl(item.url)?.toLowerCase() ?? item.source.toLowerCase().trim();
      return allowHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
    });
  }

  let fallback = fallbackUsed;
  if (allowHosts.length > 0 && filteredItems.length === 0 && items.length > 0) {
    filteredItems = items;
    fallback = true;
  }

  const finalItems = dedupeResults(filteredItems, max);

  const result: SearchNewsResult = {
    items: finalItems,
    fallback,
    cacheHit: false,
  };

  searchCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value: result,
  });

  return result;
}

export async function summarizeImpact(options: ImpactOptions): Promise<ImpactSummary> {
  if (options.items.length === 0) {
    return {
      bullets: ['No recent notable signals.'],
      riskLevel: 'low',
    };
  }

  const cacheKey = buildImpactCacheKey(options);
  const cached = impactCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const { items, context } = options;

  const list = items.map((item, index) => `${index + 1}. ${item.title} (${item.source})`).join('\n');

  const { rawContent } = await callPerplexity(CHAT_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({
      model: 'sonar',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: [
            'Summarise the following liquidity pool intel items into concise impact bullets.',
            'Return JSON with shape {"bullets":[""],"riskLevel":"low|med|high"}.',
            'Risk level should reflect urgency for liquidity providers (low, med, or high).',
            `Context: ${context}.`,
            'Items:\n' + list,
          ].join(' '),
        },
      ],
    }),
  });

  const payload = parseJsonPayload(rawContent) ?? {};
  const impact = normaliseImpact(payload);

  if (!impact.bullets.length) {
    impact.bullets = ['No recent notable signals.'];
  }

  impactCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value: impact,
  });

  return impact;
}
