import Link from 'next/link';

export function WaitlistHero() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-liqui-border bg-gradient-to-br from-liqui-card to-liqui-card/60 p-8 md:p-12">
      <div className="max-w-3xl space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-liqui-card-hover/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-liqui-subtext">
          Early Access · 100 seats
        </div>
        <h1 className="font-brand text-3xl font-bold text-white md:text-5xl">
          Join the first 100 LiquiLab operators.
        </h1>
        <p className="text-base text-liqui-subtext md:text-lg">
          LiquiLab is the command room for LPs on Flare. Join the waitlist or purchase a Fast-Track to secure your place with a one-time crypto payment.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/waitlist"
            className="font-brand inline-flex items-center justify-center gap-2 rounded-lg bg-liqui-aqua px-5 py-3 text-sm font-semibold text-liqui-navy transition hover:bg-liqui-aqua/80"
          >
            Join Waitlist
          </Link>
          <Link
            href="/fastforward/pay"
            className="font-brand inline-flex items-center justify-center gap-2 rounded-lg border border-liqui-aqua px-5 py-3 text-sm font-semibold text-liqui-aqua transition hover:bg-liqui-aqua/10"
          >
            Fast-Track ($50 in crypto)
          </Link>
        </div>
        <div className="space-y-1 text-xs text-liqui-subtext">
          <p className="font-semibold uppercase tracking-wide text-[10px] text-liqui-aqua">Disclaimer — Early Access</p>
          <p>LiquiLab is in early development. Features and pricing may change. Outages or data issues may occur. No refunds can be issued for early access or usage-based payments.</p>
        </div>
        <ul className="flex flex-col gap-2 text-sm text-liqui-subtext md:flex-row md:items-center md:gap-6">
          <li>⚡ Multi-DEX insights (Enosys, BlazeSwap, SparkDEX)</li>
          <li>🧪 Pool Detail beta and analytics on day one</li>
          <li>💡 Share feedback and shape the roadmap</li>
        </ul>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 translate-x-1/3 rounded-full bg-liqui-aqua/20 blur-3xl md:block" />
    </section>
  );
}
