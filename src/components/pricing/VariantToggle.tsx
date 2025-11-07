'use client';

import clsx from 'clsx';

type Variant = 'A' | 'B';

type VariantToggleProps = {
  value: Variant;
  onChange: (variant: Variant) => void;
  className?: string;
};

const OPTIONS: Array<{ value: Variant; label: string; description: string }> = [
  { value: 'A', label: 'Option A', description: 'Trial-first Minimal' },
  { value: 'B', label: 'Option B', description: 'Two-column Calm' },
];

export default function VariantToggle({
  value,
  onChange,
  className,
}: VariantToggleProps) {
  return (
    <div
      role="group"
      aria-label="Toggle pricing layout variant"
      className={clsx('segmented', className)}
    >
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={clsx(
              'inline-flex items-center justify-center px-4 py-2 text-sm font-semibold font-ui transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1530]',
              selected ? 'btn-primary px-4 py-2' : 'segmented-btn--off',
            )}
            aria-pressed={selected}
          >
            <span>{option.label}</span>
            <span className="ml-2 text-xs font-normal text-white/60">
              {option.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
