import React from 'react';
import Link from 'next/link';
import { LiquiLabLogo } from './LiquiLabLogo';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-[#0A0F1C]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="inline-block transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[#6EA8FF] focus:ring-offset-2 focus:ring-offset-[#0A0F1C]">
              <LiquiLabLogo variant="full" size="sm" theme="dark" />
            </Link>
          </div>

          {/* Right: Navigation Links */}
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-3" aria-label="Footer navigation">
            {/* Internal Links */}
            <Link
              href="/pricing"
              className="font-ui text-sm font-medium text-[#9FA8B6] transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-[#6EA8FF] focus:ring-offset-2 focus:ring-offset-[#0A0F1C]"
            >
              Pricing
                </Link>
            
            <Link
              href="/rangeband"
              className="font-ui text-sm font-medium text-[#9FA8B6] transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-[#6EA8FF] focus:ring-offset-2 focus:ring-offset-[#0A0F1C]"
            >
              RangeBand™
                </Link>
            
            <Link
              href="/partners"
              className="font-ui text-sm font-medium text-[#9FA8B6] transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-[#6EA8FF] focus:ring-offset-2 focus:ring-offset-[#0A0F1C]"
            >
              Partners
                </Link>
            
            <Link
              href="/contact"
              className="font-ui text-sm font-medium text-[#9FA8B6] transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-[#6EA8FF] focus:ring-offset-2 focus:ring-offset-[#0A0F1C]"
            >
              Contact
            </Link>

            {/* Divider */}
            <span className="hidden text-[#9FA8B6]/30 sm:inline">|</span>

            {/* External Social Links */}
                <a 
              href="https://t.me/liquilab"
                  target="_blank" 
                  rel="noopener noreferrer"
              aria-label="LiquiLab on Telegram"
              className="font-ui text-sm font-medium text-[#9FA8B6] transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-[#6EA8FF] focus:ring-offset-2 focus:ring-offset-[#0A0F1C]"
            >
              Telegram
            </a>
            
                <a 
              href="https://x.com/liquilab"
                  target="_blank" 
                  rel="noopener noreferrer"
              aria-label="LiquiLab on X (Twitter)"
              className="font-ui text-sm font-medium text-[#9FA8B6] transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-[#6EA8FF] focus:ring-offset-2 focus:ring-offset-[#0A0F1C]"
                >
              X
                </a>
          </nav>
        </div>

        {/* Copyright */}
        <div className="mt-6 border-t border-white/5 pt-6">
          <p className="font-ui text-xs text-[#9FA8B6]/60">
            © {currentYear} LiquiLab. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
