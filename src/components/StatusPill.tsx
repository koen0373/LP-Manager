import React from 'react';

interface StatusPillProps {
  inRange: boolean;
}

export function StatusPill({ inRange }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center text-xs font-medium ${
        inRange
          ? 'text-liqui-succ'
          : 'text-liqui-err'
      }`}
    >
      {inRange && (
        <div className="w-2 h-2 bg-liqui-succ rounded-full mr-2 slow-pulse"></div>
      )}
      {!inRange && (
        <div className="w-2 h-2 bg-liqui-err rounded-full mr-2"></div>
      )}
      {inRange ? 'In Range' : 'Out of Range'}
    </span>
  );
}

interface PositionStatusPillProps {
  status: 'Active' | 'Inactive';
}

export function PositionStatusPill({ status }: PositionStatusPillProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        status === 'Active'
          ? 'bg-liqui-aqua/20 text-liqui-aqua border border-liqui-aqua/30'
          : 'bg-liqui-mist/20 text-liqui-mist border border-liqui-mist/30'
      }`}
    >
      {status}
    </span>
  );
}