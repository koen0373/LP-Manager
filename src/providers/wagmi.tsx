'use client';

import React from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { injected, walletConnect } from 'wagmi/connectors';

const wcProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;
const siteUrl =
  (typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL) || 'http://localhost:3000';

const connectors = [
  injected({ shimDisconnect: true }),
  ...(wcProjectId
    ? [
        walletConnect({
          projectId: wcProjectId,
          showQrModal: true,
          metadata: {
            name: 'LiquiLab',
            description: 'Follow your liquidity with RangeBand™',
            url: siteUrl,
            icons: [`${siteUrl}/media/icon.png`],
          },
        }),
      ]
    : []),
];

const config = createConfig({
  chains: [mainnet],
  transports: { [mainnet.id]: http() },
  connectors,
  ssr: true,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

export function WagmiRoot({ children }: { children: React.ReactNode }) {
  // Avoid SSR pitfalls: don't spin providers on the server
  if (typeof window === 'undefined') return <>{children}</>;
  
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
