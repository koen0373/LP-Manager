import React from 'react';

interface LiquiLabLogoProps {
  variant?: 'full' | 'mark-only' | 'wordmark-only';
  size?: 'sm' | 'md' | 'lg';
  theme?: 'dark' | 'light';
  className?: string;
}

/**
 * LiquiLab Logo Component
 *
 * Renders the droplet mark and Quicksand wordmark inline so the logo never
 * depends on external image assets loading.
 */
export function LiquiLabLogo({
  variant = 'full',
  size = 'md',
  theme = 'dark',
  className = '',
}: LiquiLabLogoProps) {
  const sizeConfig = {
    sm: {
      mark: 24,
      wordmark: 'text-xl',
      gap: 'gap-2',
      height: 'h-8',
    },
    md: {
      mark: 32,
      wordmark: 'text-2xl',
      gap: 'gap-3',
      height: 'h-12',
    },
    lg: {
      mark: 48,
      wordmark: 'text-4xl',
      gap: 'gap-4',
      height: 'h-16',
    },
  } as const;

  const config = sizeConfig[size];

  const wordmarkColor = theme === 'dark' ? 'text-[#E6E9EF]' : 'text-[#0A0F1C]';

  const Droplet = ({ ariaHidden = true }: { ariaHidden?: boolean }) => (
    <svg
      width={config.mark}
      height={(config.mark * 12) / 10}
      viewBox="0 0 40 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={ariaHidden ? 'presentation' : 'img'}
      aria-label={ariaHidden ? undefined : 'LiquiLab droplet mark'}
      aria-hidden={ariaHidden}
      className="flex-shrink-0"
    >
      <path d="M20 0C20 0 0 18 0 30C0 40.4934 8.95431 48 20 48C31.0457 48 40 40.4934 40 30C40 18 20 0 20 0Z" fill="#6EA8FF" />
      <ellipse cx="15" cy="20" rx="6" ry="8" fill="#78B5FF" opacity="0.4" />
    </svg>
  );

  if (variant === 'mark-only') {
    return (
      <div className={`flex items-center justify-center ${config.height} ${className}`}>
        <Droplet ariaHidden={false} />
      </div>
    );
  }

  if (variant === 'wordmark-only') {
    return (
      <div className={`flex items-center ${config.height} ${className}`}>
        <span
          className={`font-brand ${config.wordmark} font-semibold ${wordmarkColor}`}
          style={{
            letterSpacing: '-0.015em',
            fontVariantNumeric: 'normal',
          }}
        >
          LiquiLab
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center ${config.gap} ${config.height} ${className}`}>
      <Droplet />
      <span
        className={`font-brand ${config.wordmark} font-semibold ${wordmarkColor}`}
        style={{
          letterSpacing: '-0.015em',
          fontVariantNumeric: 'normal',
        }}
      >
        LiquiLab
      </span>
    </div>
  );
}

interface LogoLockupProps {
  theme?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Logo with tagline lockup
 * For hero sections and prominent placements
 */
export function LiquiLabLogoLockup({
  theme = 'dark',
  size = 'md',
  className = '',
}: LogoLockupProps) {
  const taglineColor = theme === 'dark' ? 'text-[#9FA8B6]' : 'text-[#2D3642]';

  const sizeConfig = {
    sm: {
      logo: 'sm' as const,
      tagline: 'text-xs',
      gap: 'gap-2',
    },
    md: {
      logo: 'md' as const,
      tagline: 'text-sm',
      gap: 'gap-3',
    },
    lg: {
      logo: 'lg' as const,
      tagline: 'text-base',
      gap: 'gap-4',
    },
  } as const;

  const config = sizeConfig[size];

  return (
    <div className={`flex flex-col items-start ${config.gap} ${className}`}>
      <LiquiLabLogo variant="full" size={config.logo} theme={theme} />
      <p
        className={`font-ui ${config.tagline} font-medium ${taglineColor}`}
        style={{
          lineHeight: '1.4',
          maxWidth: '280px',
        }}
      >
        The easy way to manage your liquidity pools.
      </p>
    </div>
  );
}

export default LiquiLabLogo;
