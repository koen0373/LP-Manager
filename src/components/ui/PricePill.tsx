import React from 'react';
import clsx from 'clsx';

type PricePillProps = {
  className?: string;
};

export function PricePill({ className }: PricePillProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-sm font-medium text-white/90 backdrop-blur',
        'tnum',
        className,
      )}
    >
      $1.99 per pool / month · First pool is free
    </span>
  );
}

