'use client';

import Head from 'next/head';

import Header from '@/components/Header';
import NetworkMetrics from '@/components/demo/NetworkMetrics';

export default function DemoPage() {
  return (
    <>
      <Head>
        <title>Network metrics · LiquiLab</title>
        <meta
          name="description"
          content="Track Flare network TVL and pool counts across Enosys and SparkDEX in one calm overview."
        />
      </Head>
      <div className="relative min-h-screen overflow-hidden text-white">
        <div className="page-bg" aria-hidden="true" />
        <Header showTabs={false} currentPage="home" />

        <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-20 sm:px-8 md:gap-12 md:py-24">
          <NetworkMetrics />
        </main>
      </div>
    </>
  );
}
