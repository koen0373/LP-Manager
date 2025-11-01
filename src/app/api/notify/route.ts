import { NextResponse } from 'next/server';

import { prisma } from '@/server/db';

export const runtime = 'nodejs';

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

export async function POST(req: Request) {
  try {
    const payload = await req.json().catch(() => ({} as Record<string, unknown>));
    const emailRaw = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';

    if (!emailRaw) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(emailRaw)) {
      return NextResponse.json({ success: false, error: 'Enter a valid email address' }, { status: 400 });
    }

    await prisma.placeholderSignup.upsert({
      where: { email: emailRaw },
      update: {},
      create: { email: emailRaw },
    });

    await sendSlackNotification(emailRaw);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('[PLACEHOLDER_SIGNUP] Failed', error);
    return NextResponse.json({ success: false, error: 'Unable to register interest' }, { status: 500 });
  }
}
