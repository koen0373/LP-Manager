import { useState } from 'react';
import Link from 'next/link';
import Header from '../src/components/Header';

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: "What is Liquidity Removed?",
    answer: "When you decrease or remove liquidity from your position, this is shown as 'Liquidity Removed'. This action automatically collects any pending fees and returns them along with your liquidity. The collected fees are included in the USD Delta shown for the transaction, but are not displayed as a separate 'Fees Claimed' event."
  },
  {
    question: "What is Fees Claimed?",
    answer: "Fees Claimed refers to standalone fee collection events where you explicitly claim accumulated fees and incentives (like RFLR rewards) WITHOUT removing liquidity. This is different from the automatic fee collection that happens when you decrease liquidity."
  },
  {
    question: "Why do I see 'Liquidity Removed' but no separate 'Fees Claimed'?",
    answer: "When you remove liquidity from a Uniswap V3 position, the protocol automatically collects any pending fees as part of the same transaction. This is an efficiency feature - you don't need to claim fees separately before removing liquidity. The fees are included in the 'USD Delta' value shown for the Liquidity Removed event."
  },
  {
    question: "What is Impermanent Loss (IL)?",
    answer: "Impermanent Loss occurs when the price ratio of your deposited tokens changes compared to when you deposited them. If you had simply held the tokens instead of providing liquidity, you might have more value. The loss is 'impermanent' because it only becomes permanent when you withdraw your liquidity. IL is calculated by comparing your current position value to what you would have if you had just held the tokens."
  },
  {
    question: "How is APY calculated?",
    answer: "APY (Annual Percentage Yield) is calculated based on the fees earned divided by your Total Value Locked (TVL), annualized. Formula: APY = (Total Fees Earned / TVL) × (365 / Days Active) × 100. This shows you the projected yearly return if fee generation continues at the current rate."
  },
  {
    question: "What does 'USD Value/Delta' mean?",
    answer: "USD Value represents the current dollar value of your position or a transaction. USD Delta shows the change in dollar value for a specific action (positive for gains, negative for losses). For example, when removing liquidity, the USD Delta includes both the liquidity value and any automatically collected fees."
  },
  {
    question: "What are RFLR Rewards?",
    answer: "RFLR (Reward FLR) are incentive rewards distributed by the Flare Network to liquidity providers. These rewards are separate from trading fees and are designed to incentivize liquidity provision. RFLR rewards accrue over time and can be claimed via the Flare Portal at the end of each month."
  },
  {
    question: "What's the difference between Active and Inactive pools?",
    answer: "Active pools have their current price within the set price range, meaning they actively provide liquidity for trades and earn swap fees. Inactive (Out of Range) pools have their current price outside the set range, so they don't earn swap fees but may still earn RFLR incentive rewards. You can see which pools are active on the homepage under the 'Active' tab."
  },
  {
    question: "What does 'In Range' vs 'Out of Range' mean?",
    answer: "In Range means the current market price falls within your position's price range, so your liquidity is being used for swaps and earning fees. Out of Range means the price has moved outside your range - your position is entirely in one token and not earning swap fees. You'll see a green blinking indicator for In Range and a red indicator for Out of Range."
  },
  {
    question: "How do I claim my fees?",
    answer: "You have two options: 1) Click the 'Claim' button on a specific pool's detail page to claim fees from that position only, or 2) Remove liquidity, which automatically claims all pending fees in the same transaction. Note that very small fee amounts (less than $1) may not be worth claiming due to gas costs."
  },
  {
    question: "Why don't Inactive pools show any Fees?",
    answer: "Inactive (Out of Range) pools don't earn trading fees because their liquidity isn't being used for swaps. The 'Fees' column will show $0.00 for inactive pools. However, these pools may still earn RFLR incentive rewards, which are shown in the 'Incentives' column."
  },
  {
    question: "What happens to fees when I decrease liquidity?",
    answer: "When you decrease (remove) liquidity, Uniswap V3 automatically collects all pending fees and returns them along with your liquidity tokens in a single transaction. This is more gas-efficient than claiming fees separately first. The total value (liquidity + fees) is shown in the 'USD Delta' for the 'Liquidity Removed' event."
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
            If you can't find the answer you're looking for, feel free to reach out:
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

