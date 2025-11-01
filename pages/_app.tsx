import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';

import '@/styles/globals.css';
import Footer from '@/components/Footer';

// Defer providers to the client to avoid SSR touching wallet-specific globals.
const Providers = dynamic(() => import('@/providers').then((mod) => mod.default), { ssr: false });

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Providers>
      <Component {...pageProps} />
      <Footer />
    </Providers>
  );
}
