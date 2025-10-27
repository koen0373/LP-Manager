import type { NextApiRequest, NextApiResponse } from 'next';

import { db } from '@/lib/data/db';

async function sendSlackNotification(email: string) {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return;

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `New LiquiLab product update signup: ${email}`,
      }),
    });
  } catch (error) {
    console.warn('[PLACEHOLDER_SIGNUP] Failed to notify Slack', error);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const emailRaw = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!emailRaw) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(emailRaw)) {
      return res.status(400).json({ success: false, error: 'Enter a valid email address' });
    }

    await db.placeholderSignup.upsert({
      where: { email: emailRaw },
      update: {},
      create: { email: emailRaw },
    });

    await sendSlackNotification(emailRaw);

    return res.status(201).json({ success: true });
  } catch (error) {
    console.error('[PLACEHOLDER_SIGNUP] Failed', error);
    return res.status(500).json({ success: false, error: 'Unable to register interest' });
  }
}

