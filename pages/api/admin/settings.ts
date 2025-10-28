import type { NextApiRequest, NextApiResponse } from 'next';

import { db } from '@/lib/data/db';

const ALLOWED_KEYS = new Set(['WAITLIST_ENABLED', 'FASTFORWARD_ENABLED']);

function normalizeValue(input: unknown): '0' | '1' | null {
  if (input === '1' || input === 1 || input === true) {
    return '1';
  }
  if (input === '0' || input === 0 || input === false) {
    return '0';
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed === '1') return '1';
    if (trimmed === '0') return '0';
  }
  return null;
}

async function loadSettings() {
  const rows = await db.appSetting.findMany({ where: { key: { in: Array.from(ALLOWED_KEYS) } } });
  const settings: Record<string, string> = {};
  rows.forEach((row) => {
    settings[row.key] = row.value;
  });

  if (settings.FASTFORWARD_ENABLED == null) {
    settings.FASTFORWARD_ENABLED = process.env.LL_FASTFORWARD_ENABLED ?? '1';
  }
  if (settings.WAITLIST_ENABLED == null) {
    settings.WAITLIST_ENABLED = process.env.LL_WAITLIST_ENABLED ?? '0';
  }

  return settings;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const settings = await loadSettings();
      return res.status(200).json({ ok: true, settings });
    } catch (error) {
      console.error('[ADMIN_SETTINGS] Failed to load settings', error);
      return res.status(500).json({ ok: false, error: 'Failed to load settings' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};
      const key = typeof body.key === 'string' ? body.key.trim() : '';
      const rawValue = body.value;

      if (!ALLOWED_KEYS.has(key)) {
        return res.status(400).json({ ok: false, error: 'Invalid key' });
      }

      const value = normalizeValue(rawValue);
      if (value == null) {
        return res.status(400).json({ ok: false, error: 'Value must be "0" or "1"' });
      }

      await db.appSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });

      const settings = await loadSettings();
      return res.status(200).json({ ok: true, settings });
    } catch (error) {
      console.error('[ADMIN_SETTINGS] Failed to update settings', error);
      return res.status(500).json({ ok: false, error: 'Failed to update settings' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
