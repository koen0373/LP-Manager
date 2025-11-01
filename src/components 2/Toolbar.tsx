'use client';
import React from 'react';

type Props = {
  activeTab: 'active' | 'inactive';
  onTab: (tab: 'active' | 'inactive') => void;
};

export default function Toolbar({ activeTab, onTab }: Props) {
  return (
    <div className="w-full max-w-[1200px] mx-auto mt-6">
      <div className="flex gap-2">
        <button
          onClick={() => onTab('active')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'active'
              ? 'bg-enosys-accent text-black'
              : 'bg-enosys-subcard text-enosys-subtext hover:text-enosys-text'
          }`}
        >
          Active Positions
        </button>
        <button
          onClick={() => onTab('inactive')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'inactive'
              ? 'bg-enosys-accent text-black'
              : 'bg-enosys-subcard text-enosys-subtext hover:text-enosys-text'
          }`}
        >
          Inactive Positions
        </button>
      </div>
    </div>
  );
}
