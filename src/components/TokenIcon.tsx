// components/TokenIcon.tsx
import React from "react";

type TokenIconProps = {
  symbol?: string;
  address?: string;
  size?: number;
  className?: string;
  alt?: string;
  priority?: boolean;
};

// Robuuste icon mapping - alleen lokale WEBP bestanden
const getTokenIcon = (symbol?: string): string => {
  const sym = (symbol || "").toUpperCase().trim();
  
  // Directe mapping naar bestaande WEBP bestanden
  switch (sym) {
    case 'WFLR':
      return '/icons/flr.webp'; // WFLR gebruikt FLR icoon
    case 'SFLR':
      return '/icons/sflr.webp';
    case 'FXRP':
      return '/icons/fxrp.webp';
    case 'USDTO':
    case 'USDT0':
    case 'USDT':
      return '/icons/usd0.webp'; // USDTO icoon
    case 'FLR':
      return '/icons/flr.webp';
    case 'EETH':
      return '/icons/eeth.webp';
    case 'EQNT':
      return '/icons/eqnt.webp';
    case 'EUSDT':
      return '/icons/eusdt.webp';
    case 'HLN':
      return '/icons/hln.webp';
    case 'APS':
      return '/icons/aps.webp';
    case 'USDC':
      return '/icons/usdcsg.webp';
    case 'USDX':
      return '/icons/usdx.webp';
    default:
      return '/icons/default-token.webp';
  }
};

export const TokenIcon: React.FC<TokenIconProps> = ({
  symbol,
  address,
  size = 28,
  className,
  alt,
  priority,
}) => {
  const iconSrc = getTokenIcon(symbol);
  const label = alt || symbol || (address ? address.slice(0, 6) + "…" : "token");

  // Browser-compatibele oplossing: gebruik een img tag met robuuste error handling
  return (
    <img
      src={iconSrc}
      alt={label}
      width={size}
      height={size}
      className={
        className ??
        "rounded-full bg-[#121212] p-[2px] ring-1 ring-black/20 object-contain"
      }
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        maxWidth: size,
        maxHeight: size,
        // Zorg ervoor dat de afbeelding correct wordt weergegeven
        display: 'block',
        // Voorkom dat de browser de afbeelding vervangt
        imageRendering: 'auto',
      }}
      // Geen onError handler - laat de browser het afhandelen
      // Dit voorkomt dat Chrome de afbeelding vervangt
      loading="eager"
      decoding="sync"
    />
  );
};

export default TokenIcon;