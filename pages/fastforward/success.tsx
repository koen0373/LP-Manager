import Head from 'next/head';

import Header from '@/components/Header';

export default function FastForwardSuccessPage() {
  return (
    <>
      <Head>
        <title>LiquiLab · Fast-Track Pending Approval</title>
      </Head>
      <main className="min-h-screen bg-liqui-navy text-white">
        <Header showTabs={false} />
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-20 text-center">
          <h1 className="font-brand text-3xl font-bold md:text-4xl">Payment received</h1>
          <p className="text-liqui-subtext md:text-lg">
            Thanks for supporting the rollout. An admin will review your transaction and activate your early-access account. You&rsquo;ll receive an email as soon as your two free pools are unlocked.
          </p>
          <p className="text-sm text-liqui-subtext">
            Questions or need to share proof of payment? Email us at{' '}
            <a className="text-liqui-aqua" href="mailto:support@liquilab.io">
              support@liquilab.io
            </a>
            .
          </p>
        </div>
      </main>
    </>
  );
}
