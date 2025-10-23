import React from 'react';

interface WaterSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export function WaterSpinner({ size = 'md', text }: WaterSpinnerProps) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className={`${sizes[size]} relative`}>
        {/* Outer ripple */}
        <div className="absolute inset-0 rounded-full border-2 border-blue-400/30 animate-ping" />
        
        {/* Middle ripple */}
        <div 
          className="absolute inset-0 rounded-full border-2 border-blue-400/50 animate-ping" 
          style={{ animationDelay: '0.2s' }}
        />
        
        {/* Inner water drop */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-1/2 h-1/2 bg-gradient-to-b from-blue-400 to-cyan-500 rounded-full animate-bounce" />
        </div>
      </div>
      
      {text && (
        <p className="text-sm text-gray-400 animate-pulse">{text}</p>
      )}
    </div>
  );
}

