import Image from 'next/image';
import React from 'react';
import type { Address } from 'viem';

import { buildTokenIconUrls, isRemoteIcon } from './dexscreener';
import { canonicalSymbol } from './symbolMap';

export type TokenIconProps = {
  symbol?: string;
  address?: Address | string | null;
  chain?: string;
  size?: number;
  className?: string;
  alt?: string;
  priority?: boolean;
};

export function TokenIcon({
  symbol,
  address,
  chain = 'flare',
  size = 20,
  className = '',
  alt: altLabel,
  priority = false,
}: TokenIconProps): JSX.Element {
  const sources = React.useMemo(
    () =>
      buildTokenIconUrls({
        symbol,
        address: address ? String(address) : undefined,
        chain,
      }),
    [symbol, address, chain],
  );

  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    setIndex(0);
  }, [sources]);

  const currentSrc = sources[index];
  const label = altLabel || (canonicalSymbol(symbol) || symbol || 'token').toUpperCase();
  const remote = isRemoteIcon(currentSrc);

  const handleError = React.useCallback(() => {
    setIndex((previous) => {
      if (previous + 1 >= sources.length) {
        return previous;
      }
      return previous + 1;
    });
  }, [sources.length]);

  return (
    <Image
      src={currentSrc}
      alt={label}
      width={size}
      height={size}
      unoptimized={remote}
      priority={priority}
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
