import React from 'react';

interface StatusPillProps {
  inRange: boolean;
}

export function StatusPill({ inRange }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        inRange
          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
          : 'bg-red-500/20 text-red-400 border border-red-500/30'
      }`}
    >
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
          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
      }`}
    >
      {status}
    </span>
  );
}