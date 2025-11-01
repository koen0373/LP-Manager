/// <reference types="next" />
/// <reference types="next/image-types/global" />

// Asset modules
declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}

// JSON modules (ABIs, config files)
declare module '*.json' {
  const value: any;
  export default value;
}

// Environment variables
declare namespace NodeJS {
  interface ProcessEnv {
    // WalletConnect
    NEXT_PUBLIC_WC_PROJECT_ID?: string;
    NEXT_PUBLIC_SITE_URL?: string;
    
    // Stripe
    STRIPE_SECRET_KEY?: string;
    STRIPE_PUBLISHABLE_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
    NEXT_PUBLIC_BILLING_SUCCESS_URL?: string;
    NEXT_PUBLIC_BILLING_CANCEL_URL?: string;
    
    // Demo mode
    DEMO_MODE?: string;
    
    // Position Manager addresses
    ENOSYS_PM?: string;
    SPARKDEX_PM?: string;
    BLAZESWAP_PM?: string;
    BLAZESWAP_FACTORY?: string;
    FLARE_RPC_URL?: string;
    
    // Standard Next.js
    NODE_ENV: 'development' | 'production' | 'test';
    PORT?: string;
  }
}
