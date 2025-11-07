import { useCallback, useEffect, useMemo, useState } from 'react';

type IntelRecency = 'day' | 'week';

type IntelItem = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  snippet?: string;
  relevance?: number;
};

type IntelImpact = {
  bullets: string[];
  riskLevel: 'low' | 'med' | 'high';
};

type IntelSuccess = {
  ok: true;
  pair: string;
  tokens: string[];
  recency: IntelRecency;
  items: IntelItem[];
  impact: IntelImpact;
  fallback?: boolean;
  empty?: boolean;
};

type IntelError = {
  ok: false;
  error: string;
  pair?: string;
  tokens?: string[];
  recency?: IntelRecency;
};

type PoolIntelCardProps = {
  pair?: string;
  tokens?: string[];
  chain?: string;
  recency?: IntelRecency;
};

type FetchStatus = 'idle' | 'loading' | 'loaded' | 'error';

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Request geweigerd; we hebben automatisch een fallback geprobeerd.',
  429: 'Teveel verzoeken; probeer zo weer.',
  500: 'Unexpected error.',
  501: 'API-sleutel ontbreekt.',
  502: 'Upstream tijdelijk onbereikbaar.',
};

const RISK_LABELS: Record<'low' | 'med' | 'high', string> = {
  low: 'Low risk',
  med: 'Medium risk',
  high: 'High risk',
};

export function PoolIntelCard({
  pair,
  tokens,
  chain = 'flare',
  recency = 'week',
}: PoolIntelCardProps) {
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [error, setError] = useState<string | undefined>();
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [data, setData] = useState<IntelSuccess | undefined>();
  const [localRecency, setLocalRecency] = useState<IntelRecency>(recency);
  const [allowAny, setAllowAny] = useState(false);

  useEffect(() => {
    setLocalRecency(recency);
  }, [recency]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (tokens?.length) {
      params.set('tokens', tokens.join(','));
    } else if (pair) {
      params.set('pair', pair);
    }
    params.set('chain', chain);
    params.set('recency', localRecency);
    return params.toString();
  }, [pair, tokens, chain, localRecency]);

  useEffect(() => {
    setAllowAny(false);
  }, [pair, tokens?.join(',')]);

  const fetchIntel = useCallback(async () => {
    if (!pair && !tokens?.length) return;
    setStatus('loading');
    setError(undefined);

    try {
      const url = `/api/intel/news?${query}${allowAny ? '&allow=any' : ''}`;
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => undefined)) as IntelError | undefined;
        const message =
          STATUS_MESSAGES[response.status] ||
          body?.error ||
          `Request failed (${response.status})`;
        setStatusCode(response.status);
        setError(message);
        setStatus('error');
        return;
      }

      const body = (await response.json()) as IntelSuccess | IntelError;
      if (!body.ok) {
        setStatusCode(response.status);
        setError(body.error || 'Unexpected error.');
        setStatus('error');
        return;
      }

      setData(body);
      setStatusCode(null);
      setStatus('loaded');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to load intel');
      setStatusCode(null);
    }
  }, [pair, tokens, query, allowAny]);

  useEffect(() => {
    if (!pair && !tokens?.length) return;
    fetchIntel();
  }, [fetchIntel, pair, tokens]);

  if (!pair && !tokens?.length) {
    return null;
  }

  const items = data?.items ?? [];
  const impact = data?.impact;

  const subjectLabel = useMemo(() => {
    if (data?.tokens?.length) return data.tokens.join(' / ');
    if (pair) return pair;
    if (tokens?.length) return tokens.join(' / ');
    return 'this pool';
  }, [data?.tokens, pair, tokens]);

  const resolveHostname = useCallback((item: IntelItem) => {
    if (item.source) return item.source;
    try {
      return new URL(item.url).hostname.replace(/^www\./, '');
    } catch {
      return 'source';
    }
  }, []);

  const activeRecency = status === 'loaded' && data ? data.recency : localRecency;
  const isEmpty = status === 'loaded' && (data?.empty || (data && data.items.length === 0));

  return (
    <section className="card space-y-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="font-ui text-xs uppercase tracking-[0.25em] text-white/60">Signals</p>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-brand text-xl font-semibold text-white">
                Pool Intel — Web Signals
              </h2>
              {impact?.riskLevel && (
                <span
                  className={`inline-flex items-center gap-1 rounded-[8px] px-2.5 py-1 text-xs font-medium text-white ${
                    impact.riskLevel === 'high'
                      ? 'bg-red-500/20 text-red-300'
                      : impact.riskLevel === 'med'
                        ? 'bg-amber-500/20 text-amber-200'
                        : 'bg-emerald-500/20 text-emerald-200'
                  }`}
                >
                  <span className="font-num">{RISK_LABELS[impact.riskLevel]}</span>
                </span>
              )}
            </div>
          </div>

          <div className="inline-flex items-center rounded-[8px] bg-white/10 p-1 text-xs text-white/70 backdrop-blur">
            {(['day', 'week'] as IntelRecency[]).map((option) => {
              const active = localRecency === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    if (!active) {
                      setLocalRecency(option);
                    }
                  }}
                  className={`rounded-[6px] px-3 py-1 font-ui font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1530] ${
                    active ? 'rounded-[6px] bg-[#3B82F6] text-white' : 'text-white/70 hover:text-white'
                  }`}
                  aria-pressed={active}
                >
                  {option === 'day' ? 'Day' : 'Week'}
                </button>
              );
            })}
          </div>
        </div>
        <p className="font-ui text-sm text-white/65">
          {activeRecency === 'day' ? 'Daily scan' : 'Weekly crawl'} of public sources for {subjectLabel}. Links open in a new tab.
        </p>
        {status === 'loaded' && data?.fallback && (
          <p className="font-ui text-xs text-white/45">
            Showing extended sources after whitelist returned no recent signals.
          </p>
        )}
      </header>

      {status === 'loading' && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-xl bg-white/10 p-4"
            >
              <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-white/10" />
              <div className="mt-3 h-3 w-full animate-pulse rounded bg-white/5" />
            </div>
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-xl bg-white/10 p-5 text-white/70">
          <p className="font-ui text-sm">Could not load pool intel right now.</p>
          {error && (
            <p className="mt-2 font-ui text-xs text-white/50">
              {statusCode ? `[${statusCode}] ${error}` : error}
            </p>
          )}
          <button
            type="button"
            onClick={fetchIntel}
            className="mt-3 inline-flex items-center justify-center rounded-[10px] bg-[#3B82F6] px-4 py-2 font-ui text-sm font-medium text-white transition hover:bg-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1530]"
          >
            Retry
          </button>
        </div>
      )}

      {isEmpty && (
        <div className="space-y-4 rounded-xl bg-white/10 p-5 text-white/70">
          <p className="font-ui text-sm">
            Geen recente signalen voor dit paar. Probeer ‘Day/Week’ of ‘Broaden sources’.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (!allowAny) {
                  setAllowAny(true);
                }
              }}
              disabled={allowAny}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              Broaden sources
            </button>
          </div>
        </div>
      )}

      {status === 'loaded' && !isEmpty && items.length > 0 && (
        <div className="space-y-4">
          <ul className="space-y-4">
            {items.map((item) => (
              <li key={`${item.url}-${item.publishedAt}`}>
                <article className="rounded-xl bg-white/10 p-4 transition hover:bg-white/15">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-brand text-lg font-semibold text-white hover:underline"
                  >
                    {item.title}
                  </a>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-white/60">
                    <span className="font-ui text-xs uppercase tracking-[0.2em] text-white/50">
                      {resolveHostname(item)}
                    </span>
                    <span>•</span>
                    <span className="font-num">{new Date(item.publishedAt).toLocaleDateString('en-US')}</span>
                    {typeof item.relevance === 'number' && (
                      <>
                        <span>•</span>
                        <span className="font-num text-white/65">Relevance {Math.round(item.relevance)}%</span>
                      </>
                    )}
                  </div>
                  {item.snippet && (
                    <p className="mt-3 font-ui text-sm text-white/80">{item.snippet}</p>
                  )}
                </article>
              </li>
            ))}
          </ul>

          {impact?.bullets?.length ? (
            <div className="space-y-2 rounded-xl bg-white/8 p-4">
              <p className="font-ui text-sm font-semibold text-white">Impact</p>
              <ul className="space-y-1">
                {impact.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2 text-sm text-white/80">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#3B82F6]" />
                    <span className="font-ui">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

export default PoolIntelCard;
