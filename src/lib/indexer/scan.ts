export type ScanResult<T> = { events: T[]; nextFrom: number | null };

export function normalizeScanResult<T>(
  r: Partial<ScanResult<T>> | undefined,
  from: number,
): ScanResult<T> {
  const events = Array.isArray(r?.events) ? (r!.events as T[]) : [];
  const nextFrom = Number.isInteger((r as any)?.nextFrom)
    ? Number((r as any).nextFrom)
    : from;
  return { events, nextFrom };
}
