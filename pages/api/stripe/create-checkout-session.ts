import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // TODO: Integrate real Stripe Checkout. Keep this stub to unblock UI.
  // Expect body JSON or form fields: { paidPools: number, billingCycle: 'month' }
  res.status(501).json({
    ok: false,
    error: 'Stripe not yet connected',
    next: 'Configure STRIPE_SECRET_KEY and implement session creation here.',
    doc: 'Add server-side createCheckoutSession with validation & return redirect URL.',
  });
}






