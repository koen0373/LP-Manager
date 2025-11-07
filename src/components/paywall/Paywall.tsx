'use client';

type PaywallProps = {
  label?: string;
  href?: string;
  inline?: boolean;
  className?: string;
};

export default function Paywall({
  label = 'Premium feature',
  href = '/pricing',
  inline = false,
  className = '',
}: PaywallProps) {
  if (inline) {
    return (
      <a
        href={href}
        className={`inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 font-ui text-xs font-semibold text-white/80 transition hover:border-white/30 hover:bg-white/15 ${className}`}
      >
        {label}
      </a>
    );
  }

  return (
    <div
      className={`pointer-events-none absolute inset-0 flex items-center justify-center ${className}`}
      aria-hidden="true"
    >
      <div className="pointer-events-auto rounded-xl border border-white/15 bg-[#0A0F1C]/85 px-4 py-3 text-center shadow-[0_8px_24px_rgba(10,15,28,0.35)]">
        <p className="font-ui text-sm text-white/80">{label}</p>
        <a
          href={href}
          className="mt-2 inline-flex items-center justify-center rounded-lg bg-[#3B82F6] px-3 py-1.5 font-ui text-xs font-semibold text-[#0A0F1C] transition hover:bg-[#60A5FA]"
        >
          View pricing
        </a>
      </div>
    </div>
  );
}




