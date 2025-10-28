type AnalyticsEvent =
  | 'hero_cta_click'
  | 'wallet_connected'
  | 'pools_detected'
  | 'follow_now_click'
  | 'checkout_viewed'
  | 'payment_success'
  | 'payment_error';

export function track(name: AnalyticsEvent, payload?: Record<string, unknown>) {
  try {
    // In production this can forward to a real analytics sink.
    // For now we keep it simple so callers can already wire the events.
    // eslint-disable-next-line no-console
    console.info(
      `[analytics] ${name}`,
      payload && Object.keys(payload).length > 0 ? payload : undefined,
    );
  } catch (error) {
    // Swallow errors so analytics never blocks UX flows.
    // eslint-disable-next-line no-console
    console.warn('[analytics:error]', error);
  }
}

