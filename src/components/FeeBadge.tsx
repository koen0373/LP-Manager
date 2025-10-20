import React from 'react';

interface FeeBadgeProps {
  feeBps: number;
}

export function FeeBadge({ feeBps }: FeeBadgeProps) {
  const feePercentage = (feeBps / 10000) * 100;
  
  return (
    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-enosys-subcard text-enosys-subtext border border-enosys-border">
      {feePercentage}%
    </span>
  );
}