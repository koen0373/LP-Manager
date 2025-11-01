import React from 'react';

type InfoNoteProps = {
  title: string;
  children: React.ReactNode;
  variant?: 'default' | 'muted';
};

/**
 * InfoNote — A subtle, accessible note component for guidance text
 * 
 * Usage:
 * <InfoNote title="Choose your free pool">
 *   Select the pool you want to follow for free...
 * </InfoNote>
 */
export function InfoNote({ title, children, variant = 'default' }: InfoNoteProps) {
  return (
    <div
      role="note"
      aria-label={`${title}: ${typeof children === 'string' ? children : 'Note'}`}
      className={`rounded-lg border-l-2 px-4 py-3 ${
        variant === 'muted'
          ? 'border-[#9CA3AF]/30 bg-[#9CA3AF]/5'
          : 'border-[#3B82F6]/30 bg-[#3B82F6]/5'
      }`}
    >
      <h3 className={`mb-1 font-ui text-xs font-semibold uppercase tracking-wide ${
        variant === 'muted' ? 'text-[#9CA3AF]' : 'text-[#3B82F6]'
      }`}>
        {title}
      </h3>
      <p className="font-ui text-sm leading-relaxed text-[#9CA3AF]">
        {children}
      </p>
    </div>
  );
}


