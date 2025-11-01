'use client';

import React from 'react';
import { WagmiRoot } from './providers/wagmi';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiRoot>
      {children}
    </WagmiRoot>
  );
}
