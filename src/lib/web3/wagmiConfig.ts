import { createConfig, http, cookieStorage } from 'wagmi';
import { flare } from 'wagmi/chains';
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
            icons: [`${siteUrl}/media/brand/liquilab_logo.png`],
          },
        }),
      ]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [flare],
  transports: { [flare.id]: http() },
  connectors,
  ssr: true,
  storage: cookieStorage,
  autoConnect: true,
});
