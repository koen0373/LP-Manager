import React from 'react';

interface FeeBadgeProps {
  feeBps: number;
}

export function FeeBadge({ feeBps }: FeeBadgeProps) {
  const feePercentage = (feeBps / 10000) * 100;
  
  // Format percentage with appropriate decimal places
  const formatFeePercentage = (percentage: number): string => {
    if (percentage === 0) return '0%';
    if (percentage < 0.01) return '<0.01%';
    if (percentage < 1) return `${percentage.toFixed(2)}%`;
    if (percentage < 100) return `${percentage.toFixed(1)}%`;
    return `${percentage.toFixed(0)}%`;
  };
  
  return (
    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-enosys-subcard text-enosys-subtext border border-enosys-border">
      {formatFeePercentage(feePercentage)}
    </span>
  );
}