import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-liqui-border bg-liqui-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-8 max-w-[1400px]">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo & Description */}
          <div className="md:col-span-1">
            <Image
              src="/icons/liqui_logo.webp"
              alt="Liqui Logo"
              width={140}
              height={47}
              className="object-contain h-auto mb-4"
              unoptimized={true}
            />
            <p className="text-liqui-subtext text-sm">
              The Liquidity Pool Intelligence Platform for Flare Network
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="text-white font-bold mb-4">Product</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-liqui-subtext hover:text-liqui-aqua transition-colors text-sm">
                  My Pools
                </Link>
              </li>
              <li>
                <Link href="/summary" className="text-liqui-subtext hover:text-liqui-aqua transition-colors text-sm">
                  Portfolio Performance
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-liqui-subtext hover:text-liqui-aqua transition-colors text-sm">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-white font-bold mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <a 
                  href="https://docs.flare.network" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-liqui-subtext hover:text-liqui-aqua transition-colors text-sm"
                >
                  Flare Docs
                </a>
              </li>
              <li>
                <a 
                  href="https://docs.uniswap.org/contracts/v3/overview" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-liqui-subtext hover:text-liqui-aqua transition-colors text-sm"
                >
                  Uniswap V3 Docs
                </a>
              </li>
              <li>
                <a 
                  href="https://flarescan.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-liqui-subtext hover:text-liqui-aqua transition-colors text-sm"
                >
                  FlareScan
                </a>
              </li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h3 className="text-white font-bold mb-4">Community</h3>
            <ul className="space-y-2">
              <li>
                <a 
                  href="https://twitter.com/FlareNetworks" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-liqui-subtext hover:text-liqui-aqua transition-colors text-sm"
                >
                  Twitter
                </a>
              </li>
              <li>
                <a 
                  href="https://discord.gg/flarenetwork" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-liqui-subtext hover:text-liqui-aqua transition-colors text-sm"
                >
                  Discord
                </a>
              </li>
              <li>
                <a 
                  href="https://t.me/FlareNetwork" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-liqui-subtext hover:text-liqui-aqua transition-colors text-sm"
                >
                  Telegram
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-6 border-t border-liqui-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-liqui-subtext text-sm">
            © 2025 Liqui. Built for the Flare Network community.
          </p>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-liqui-subtext">
              Powered by Uniswap V3
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

