import React from 'react';
import clsx from 'clsx';

type StepKey = 'home' | 'connect' | 'checkout';

const STEPS: Array<{ key: StepKey; label: string }> = [
  { key: 'home', label: 'Home' },
  { key: 'connect', label: 'Connect' },
  { key: 'checkout', label: 'Checkout' },
];

type ProgressStepsProps = {
  current: StepKey;
  className?: string;
};

export function ProgressSteps({ current, className }: ProgressStepsProps) {
  return (
    <nav
      aria-label="Acquisition funnel progress"
      className={clsx(
        'hidden w-full items-center justify-center gap-6 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium backdrop-blur-md sm:flex',
        className,
      )}
    >
      {STEPS.map((step, index) => {
        const isCurrent = step.key === current;
        const isCompleted = STEPS.findIndex((s) => s.key === current) > index;

        return (
          <React.Fragment key={step.key}>
            <span
              className={clsx(
                'flex items-center gap-2 uppercase tracking-[0.16em]',
                isCurrent
                  ? 'text-[#6EA8FF]'
                  : isCompleted
                    ? 'text-white/70'
                    : 'text-white/40',
              )}
            >
              <span
                className={clsx(
                  'flex h-6 w-6 items-center justify-center rounded-full border text-xs',
                  isCurrent
                    ? 'border-[#6EA8FF] text-[#6EA8FF]'
                    : isCompleted
                      ? 'border-white/40 text-white/70'
                      : 'border-white/20 text-white/40',
                )}
              >
                {index + 1}
              </span>
              {step.label}
            </span>
            {index < STEPS.length - 1 ? (
              <span className="h-px w-10 bg-white/10" aria-hidden="true" />
            ) : null}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

