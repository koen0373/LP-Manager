export type SubscriptionPlanId = 'shallow' | 'flow' | 'depth' | 'tide';

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  poolLimitLabel: string;
  annualPrice: number | null;
  monthlyPrice: number | null;
  description: string;
  ctaHref?: string;
  ctaLabel?: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'shallow',
    name: 'Shallow',
    poolLimitLabel: 'Up to 5 pools',
    annualPrice: 99.95,
    monthlyPrice: 9.95,
    description: 'For LPs starting out with liquidity management.',
    ctaHref: '/waitlist',
  },
  {
    id: 'flow',
    name: 'Flow',
    poolLimitLabel: 'Up to 15 pools',
    annualPrice: 249.95,
    monthlyPrice: 24.95,
    description: 'For active LPs managing multiple pools.',
    ctaHref: '/waitlist',
  },
  {
    id: 'depth',
    name: 'Depth',
    poolLimitLabel: 'Up to 50 pools',
    annualPrice: 749.95,
    monthlyPrice: 74.95,
    description: 'For professionals and small teams.',
    ctaHref: '/waitlist',
  },
  {
    id: 'tide',
    name: 'Tide',
    poolLimitLabel: '50+ pools',
    annualPrice: null,
    monthlyPrice: null,
    description: 'For DAOs and organizations (enterprise access in development).',
    ctaHref: '/waitlist',
    ctaLabel: 'Join priority list',
  },
];
