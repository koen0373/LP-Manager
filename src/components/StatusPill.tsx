import React from 'react';

interface StatusPillProps {
  inRange: boolean;
}

export function StatusPill({ inRange }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center text-xs font-medium ${
        inRange
          ? 'text-green-400'
          : 'text-red-400'
      }`}
    >
      {inRange && (
        <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
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
          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
      }`}
    >
      {status}
    </span>
  );
}