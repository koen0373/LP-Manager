import type { NextApiRequest, NextApiResponse } from 'next';

import { isMailConfigured, sendMail } from '@/lib/mail';

type MailBody = {
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const { to, subject, text, html } = (req.body ?? {}) as MailBody;

  if (!to) {
    return res.status(400).json({ ok: false, error: 'missing_to' });
  }

  if (!isMailConfigured()) {
    return res.status(501).json({ ok: false, error: 'mail_not_configured' });
  }

  try {
    const result = await sendMail({
      to,
      subject: subject || 'LiquiLab test email',
      text,
      html,
    });

    if (result.ok) {
      return res.status(200).json(result);
    }

    return res.status(502).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ ok: false, error: message });
  }
}
