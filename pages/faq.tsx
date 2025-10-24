import { useState } from 'react';
import Link from 'next/link';
import Header from '../src/components/Header';

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: "What is Liqui LP Manager?",
    answer: "Liqui is a liquidity pool intelligence platform specifically built for Uniswap V3 positions on the Flare Network. It provides real-time tracking of your LP positions, automatic calculations of fees and rewards (including RFLR incentives), and comprehensive analytics to help you make informed decisions about your liquidity provision strategy."
  },
  {
    question: "How do I connect my wallet?",
    answer: "Click the 'Connect Wallet' button in the top right corner of the page. We support MetaMask and WalletConnect. Make sure you're connected to the Flare Network. Once connected, the app will automatically discover all your Uniswap V3 LP positions."
  },
  {
    question: "What does 'Liquidity Removed' mean?",
    answer: "When you decrease or remove liquidity from your position, this is shown as 'Liquidity Removed'. This action automatically collects any pending fees and returns them along with your liquidity. The collected fees are included in the USD Delta shown for the transaction, but are not displayed as a separate 'Fees Claimed' event."
  },
  {
    question: "What does 'Fees Claimed' mean?",
    answer: "Fees Claimed refers to standalone fee collection events where you explicitly claim accumulated fees and incentives (like RFLR rewards) WITHOUT removing liquidity. This is different from the automatic fee collection that happens when you decrease liquidity."
  },
  {
    question: "What are RFLR Incentives?",
    answer: "RFLR (Reward FLR) are incentive rewards distributed by the Flare Network to liquidity providers. These rewards are separate from trading fees and are designed to incentivize liquidity provision. RFLR rewards accrue over time and are shown in the 'Incentives' column. They can be claimed via the Flare Portal at the end of each month."
  },
  {
    question: "When should I claim my fees?",
    answer: "The optimal time to claim fees depends on gas costs vs accumulated fees. Liqui shows a green 'Claim' button when your unclaimed fees exceed $5 USD (recommended threshold) and a yellow button for $1-$5 (marginal). Below $1, the button is disabled (grey) as gas costs likely exceed the value. For maximum efficiency, claim when fees are >$5 or when you're removing liquidity anyway (which auto-collects fees). Remember: fees are already earning yield in the pool, so there's no urgency unless you need the funds."
  },
  {
    question: "What&apos;s the difference between Active and Inactive pools?",
    answer: "Active pools have their current price within the set price range, meaning they actively provide liquidity for trades and earn swap fees. Inactive (Out of Range) pools have their current price outside the set range, so they don&apos;t earn swap fees but may still earn RFLR incentive rewards."
  },
  {
    question: "What does In Range vs Out of Range mean?",
    answer: "In Range means the current market price falls within your position&apos;s price range, so your liquidity is being used for swaps and earning fees. Out of Range means the price has moved outside your range - your position is entirely in one token and not earning swap fees. You&apos;ll see a green blinking indicator for In Range and a red indicator for Out of Range."
  },
  {
    question: "Why don&apos;t Inactive pools show any Fees?",
    answer: "Inactive (Out of Range) pools don&apos;t earn trading fees because their liquidity isn&apos;t being used for swaps. The Fees column will show $0.00 for inactive pools. However, these pools may still earn RFLR incentive rewards, which are shown in the Incentives column."
  },
  {
    question: "How is the USD value calculated?",
    answer: "USD values are calculated using real-time token prices from CoinGecko and on-chain sources. For your LP positions, we calculate the total value of both tokens in your position at current market prices. The USD Delta shows the change in dollar value for specific actions like adding or removing liquidity."
  },
  {
    question: "What happens when I remove liquidity?",
    answer: "When you decrease (remove) liquidity, Uniswap V3 automatically collects all pending fees and returns them along with your liquidity tokens in a single transaction. This is more gas-efficient than claiming fees separately first. The total value (liquidity + fees) is shown in the USD Delta for the Liquidity Removed event."
  },
  {
    question: "How do I view my pool&apos;s performance?",
    answer: "Click on any pool from your homepage to view detailed performance metrics including total liquidity, accumulated fees, RFLR rewards, pool earnings history, and recent activity. You can also view your overall portfolio performance by clicking 'Portfolio Performance' in the header."
  },
  {
    question: "Is my data secure?",
    answer: "Liqui is a read-only interface - we never ask for your private keys or have access to your funds. All data is fetched directly from the blockchain and your connected wallet. We do not store any sensitive information. Your positions remain completely under your control in your own wallet."
  }
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="min-h-screen">
      <Header currentPage="faq" showTabs={false} />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/" 
            className="text-liqui-subtext hover:text-liqui-aqua transition-colors mb-4 inline-flex items-center gap-2"
          >
            ← Back to My Pools
          </Link>
          <h1 className="text-3xl font-bold text-white mt-4">Frequently Asked Questions</h1>
          <p className="text-liqui-subtext mt-2">
            Everything you need to know about managing your Uniswap V3 liquidity positions
          </p>
        </div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {faqData.map((item, index) => (
            <div 
              key={index}
              className="bg-liqui-card border border-liqui-border rounded-lg overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-liqui-hover transition-colors"
              >
                <span className="text-lg font-semibold text-white pr-4">
                  {item.question}
                </span>
                <svg
                  className={`w-5 h-5 text-liqui-subtext transition-transform ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              
              {openIndex === index && (
                <div className="px-6 pb-4 text-liqui-subtext">
                  {item.answer}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 p-6 bg-liqui-card border border-liqui-border rounded-lg">
          <h2 className="text-xl font-bold text-white mb-3">Still have questions?</h2>
          <p className="text-liqui-subtext mb-4">
            If you can&apos;t find the answer you&apos;re looking for, feel free to reach out:
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="https://discord.gg/flarenetwork"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-liqui-aqua/10 text-liqui-aqua border border-liqui-aqua/20 rounded-lg hover:bg-liqui-aqua/20 transition-colors text-center"
            >
              Join Flare Discord
            </a>
            <a
              href="https://twitter.com/FlareNetworks"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-liqui-aqua/10 text-liqui-aqua border border-liqui-aqua/20 rounded-lg hover:bg-liqui-aqua/20 transition-colors text-center"
            >
              Follow on Twitter
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

