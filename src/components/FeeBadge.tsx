export function FeeBadge({ bps }: { bps: number }) {
  const pct = (bps / 100).toFixed(2);
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-lg bg-enosys-subcard border border-enosys-border text-[12px] font-mono text-enosys-subtext">
      {pct}%
    </span>
  );
}
