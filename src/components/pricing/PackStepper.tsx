'use client';

type PackStepperProps = {
  value: number;
  onChange: (next: number) => void;
};

function normalize(value: number) {
  if (!Number.isFinite(value)) return 5;
  const clamped = Math.max(5, Math.round(value));
  return Math.max(5, Math.ceil(clamped / 5) * 5);
}

export default function PackStepper({ value, onChange }: PackStepperProps) {
  const normalized = normalize(value);

  const handleAdjust = (delta: number) => {
    const next = normalize(normalized + delta);
    onChange(next);
  };

  return (
    <div className="inline-flex items-center gap-3 rounded-2xl bg-white/10 p-2 text-white shadow-[0_0_25px_rgba(11,21,48,0.6)] backdrop-blur">
      <button
        type="button"
        onClick={() => handleAdjust(-5)}
        className="inline-flex h-10 w-10 items-center justify-center radius-ctrl bg-white/10 font-ui text-lg font-semibold text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1530]"
        aria-label="Decrease"
      >
        −
      </button>
      <span className="min-w-[3.5rem] text-center font-num text-base font-semibold text-white/90">
        {normalized}
      </span>
      <button
        type="button"
        onClick={() => handleAdjust(5)}
        className="inline-flex h-10 w-10 items-center justify-center radius-ctrl bg-[#3B82F6] font-ui text-lg font-semibold text-[#0A0F1C] transition hover:bg-[#60A5FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1530]"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}
