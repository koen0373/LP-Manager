import React from 'react';
import type { Address } from 'viem';

import { canonicalSymbol } from './symbolMap';

export type TokenIconProps = {
  symbol?: string;
  address?: Address | string | null;
  size?: number;
  className?: string;
  alt?: string;
};

function buildLocalIconCandidates(symbol?: string | null, address?: string | null): string[] {
  const candidates: string[] = [];
  const canonical = canonicalSymbol(symbol);
  
  if (canonical) {
    // Try WEBP first (most common format), then PNG, then SVG
    candidates.push(`/media/tokens/${canonical}.webp`);
    candidates.push(`/media/tokens/${canonical}.png`);
    candidates.push(`/media/tokens/${canonical}.svg`);
  }
  
  if (address) {
    const normalizedAddress = address.toLowerCase().startsWith('0x') 
      ? address.toLowerCase() 
      : `0x${address.toLowerCase()}`;
    // Try both webp and png for by-address
    candidates.push(`/media/tokens/by-address/${normalizedAddress}.webp`);
    candidates.push(`/media/tokens/by-address/${normalizedAddress}.png`);
  }
  
  candidates.push('/media/icons/token-default.svg');
  
  return candidates;
}

export function TokenIcon({
  symbol,
  address,
  size = 20,
  className = '',
  alt: altLabel,
}: TokenIconProps): JSX.Element {
  const candidates = React.useMemo(
    () => buildLocalIconCandidates(symbol, address),
    [symbol, address],
  );

  const [index, setIndex] = React.useState(0);
  const currentSrc = candidates[index];
  const label = altLabel || (canonicalSymbol(symbol) || symbol || 'token').toUpperCase();

  React.useEffect(() => {
    setIndex(0);
  }, [symbol, address]);

  const handleError = React.useCallback(() => {
    setIndex((previous) => {
      if (previous + 1 >= candidates.length) {
        return previous;
      }
      return previous + 1;
    });
  }, [candidates.length]);

  return (
    <img
      src={currentSrc}
      alt={label}
      width={size}
      height={size}
      className={`rounded-full border border-[rgba(30,144,255,0.25)] bg-[#0B1530] object-contain ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        maxWidth: size,
        maxHeight: size,
        flexShrink: 0,
        display: 'block',
      }}
      onError={handleError}
    />
  );
}

export default TokenIcon;
