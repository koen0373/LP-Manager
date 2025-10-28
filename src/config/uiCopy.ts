/**
 * UI Copy Configuration
 * Centralized microcopy for LiquiLab pricing, gating, and empty states
 */

export const PRICING_COPY = {
  // Section headers
  sectionTitle: 'Predictable pricing with flexible capacity',
  sectionSubtitle: 'First pool is always free. Bundles add paid capacity — each bundle includes a free bonus slot.',
  
  // Pricing details
  pricePerPool: (price: string) => `$${price} per pool / month`,
  bundleInfo: (size: number) => `Billed in bundles of ${size}`,
  
  // Annual billing
  annualToggle: 'Annual (2 months free)',
  annualDescription: 'Billed once per year · starts immediately · 30-day billing periods',
  annualNote: 'Trial pool excluded from billing',
  
  // Tier cards
  tierCapacityLabel: (paid: number, bonus: number) => `${paid} paid + ${bonus} bonus`,
  firstPoolFree: 'First pool is free',
  capacityIncludes: (freeBonus: number) => `Capacity includes +${freeBonus} free`,
  
  // Gating states
  seatsAvailable: (remaining: number) => `Seats available — ${Math.max(0, remaining)} remaining`,
  seatsCapped: 'Seat cap reached — join the priority list to reserve your spot',
  
  // CTAs
  ctaStartFree: 'Start with your free pool',
  ctaJoinPriority: 'Join the priority list',
  ctaFastTrack: 'Fast-track ($50)',
  ctaSeePlans: 'See plans',
  ctaSelectPlan: 'Select plan',
  ctaJoinWaitlist: 'Join waitlist',
  
  // Tooltips & helpers
  tooltipFreeCapacity: 'Free capacity is a bonus, not a discount — unlocked automatically as you scale',
  tooltipBilling: '30-day billing periods start when you activate your first paid pool',
  
  // Usage summary
  usageSummaryTitle: 'Usage summary',
  activePoolsDetected: (count: number) => `Active pools detected: ${count}`,
  recommendedCapacity: (capacity: number, paid: number) =>
    paid > 0 ? `${capacity} pools (${paid} paid + bonus)` : 'Starter free plan',
  
  // Ready to start
  readyTitle: 'Ready to get started?',
  readySubtitle: 'Free plan includes 1 pool. Upgrade when you exceed your free capacity.',
  enterpriseNote: 'Need more than 30 paid pools? Contact the LiquiLab team for an enterprise quote.',
};

export const WALLET_COPY = {
  // Modal
  modalTitle: 'Connect your wallet',
  modalSubtitle: 'Choose your preferred wallet to connect to the Flare network.',
  modalClose: 'Close',
  
  // Wallets
  metamaskLabel: 'MetaMask',
  metamaskDesc: 'Browser extension on Chrome, Brave, Edge, and Firefox',
  
  rabbyLabel: 'Rabby Wallet',
  rabbyDesc: 'Flare-ready DeFi wallet with automatic network switching',
  
  bifrostLabel: 'Bifrost Wallet',
  bifrostDesc: 'Scan the QR code inside Bifrost to sign requests (mobile)',
  bifrostNote: 'Connect via WalletConnect or mobile (coming soon)',
  
  xamanLabel: 'Xaman',
  xamanDesc: 'Desktop integration is on the roadmap. Use the mobile app today',
  xamanNote: 'Coming soon',
  
  // States
  connecting: 'Connecting…',
  connected: (address: string) => `Connected: ${address}`,
  disconnect: 'Disconnect',
  
  // Errors
  errorConnector: 'Connector not available in this browser',
  errorConnect: 'Unable to connect wallet. Please try again.',
  errorNetwork: 'Please switch to the Flare network inside your wallet',
};

export const POOLS_COPY = {
  // Plan header
  planTitle: 'Your LiquiLab plan',
  planLabel: (paid: number, bonus: number) => 
    paid > 0 ? `${paid} paid · ${bonus} bonus` : 'Free plan',
  planCapacity: (capacity: number, active: number) => 
    `Capacity ${capacity} pools · active ${active}`,
  
  // Trial selection
  trialBadge: 'First pool is free',
  trialSelected: 'Your free pool',
  trialHelper: 'Select any position to attach your free pool slot. Bonus capacity unlocks automatically for every ten paid pools.',
  clearTrial: 'Clear trial selection',
  
  // Section headers
  activePools: 'Active pools',
  inactivePools: 'Inactive pools',
  
  // Pool cards
  useFreePool: 'Select as your free pool',
  selectedFreePool: 'Your free pool (selected)',
  assignFreeSlot: 'Assign free slot',
  
  // Empty states
  loading: 'Loading pools from Enosys, BlazeSwap, and SparkDEX…',
  noPools: 'No pools detected yet',
  noPoolsHelp: 'Once you provide liquidity on Enosys, BlazeSwap, or SparkDEX, we will list it here.',
  
  // Error state
  errorTitle: 'Unable to load pools',
  errorMessage: 'Unable to load pools for your wallet. Please check your connection or try again.',
};

export const EMPTY_STATES = {
  // No wallet connected
  noWalletTitle: 'Connect your wallet to discover your pools',
  noWalletSubtitle: 'LiquiLab tracks positions across Enosys, BlazeSwap, and SparkDEX.',
  noWalletCta: 'Connect wallet',
  
  // No pools found
  noPoolsTitle: 'No pools yet',
  noPoolsSubtitle: 'Once you provide liquidity, we will list it here.',
  
  // API error
  apiErrorTitle: 'Unable to load data',
  apiErrorMessage: 'Please check your connection or try again in a moment.',
};

