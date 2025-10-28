import React from "react";
import Image from "next/image";
import type { Address } from "viem";

import { fetchTokenIcon } from "@/services/tokenIconService";

type TokenIconProps = {
  symbol?: string;
  address?: string;
  size?: number;
  className?: string;
  alt?: string;
  priority?: boolean;
};

// Robuuste icon mapping - alleen lokale WEBP bestanden
const ICON_MAP: Record<string, string> = {
  WFLR: '/icons/flr.webp',
  FLR: '/icons/flr.webp',
  SFLR: '/icons/sflr.webp',
  FXRP: '/icons/fxrp.webp',
  USDTO: '/icons/usd0.webp',
  USDT0: '/icons/usd0.webp',
  USDT: '/icons/usd0.webp',
  EETH: '/icons/eeth.webp',
  EQNT: '/icons/eqnt.webp',
  EUSDT: '/icons/eusdt.webp',
  HLN: '/icons/hln.webp',
  APS: '/icons/aps.webp',
  USDC: '/icons/usdcsg.webp',
  USDX: '/icons/usdx.webp',
  SGB: '/icons/sgb.network.webp',
  YFLR: '/icons/flr.webp',
  CAND: '/icons/flr.webp',
  BAZE: '/icons/flr.webp',
};

const getTokenIcon = (symbol?: string): string | null => {
  const sym = (symbol || "").trim();
  
  // Special handling for USD₮0 (Unicode T symbol)
  if (sym.includes('₮') || sym.includes('USD₮')) {
    return '/icons/usd0.webp';
  }
  
  // Normalize Unicode characters (NFKD) and remove all non-alphanumeric
  const normalized = sym.normalize('NFKD').replace(/[^A-Z0-9]/g, '').toUpperCase();

  return ICON_MAP[normalized] ?? ICON_MAP[sym] ?? null;
};

export const TokenIcon: React.FC<TokenIconProps> = ({
  symbol,
  address,
  size = 28,
  className,
  alt: altLabel,
  priority,
}) => {
  const localIcon = React.useMemo(() => getTokenIcon(symbol), [symbol]);
  const [iconSrc, setIconSrc] = React.useState<string | null>(localIcon);

  React.useEffect(() => {
    setIconSrc(localIcon);
  }, [localIcon]);

  React.useEffect(() => {
    let cancelled = false;

    if (!iconSrc && address && address.startsWith('0x')) {
      fetchTokenIcon(address as Address)
        .then((remoteIcon) => {
          if (!cancelled && remoteIcon) {
            setIconSrc(remoteIcon);
          }
        })
        .catch((error) => {
          console.warn(`[TokenIcon] Failed to fetch icon for ${address}:`, error);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [iconSrc, address]);

  const label = altLabel || symbol || (address ? `${address.slice(0, 6)}…` : 'token');

  if (!iconSrc) {
    const initials = (symbol || '?').slice(0, 2).toUpperCase();
    return (
      <div
        className={`flex items-center justify-center rounded-full border border-[rgba(255,255,255,0.1)] bg-gradient-to-br from-[#1BE8D2] to-[#3B82F6] text-xs font-bold text-white ${className ?? ''}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          maxWidth: size,
          maxHeight: size,
          flexShrink: 0,
        }}
        aria-label={label}
      >
        {initials}
      </div>
    );
  }

  return (
    <Image
      src={iconSrc}
      alt={label}
      width={size}
      height={size}
      className={`rounded-full border border-[rgba(255,255,255,0.1)] object-contain ${className ?? ''}`}
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
      priority={priority}
    />
  );
};
