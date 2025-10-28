import type { AppProps } from 'next/app';

import AppProviders from '@/providers';
import '../src/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AppProviders>
      <Component {...pageProps} />
    </AppProviders>
  );
}
