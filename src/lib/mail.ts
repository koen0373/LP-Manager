type NodemailerTransporter = {
  sendMail: (options: {
    from: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }) => Promise<{ messageId: string }>;
};

type NodemailerModule = {
  createTransport: (options: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
  }) => NodemailerTransporter;
};

const FROM = process.env.MAIL_FROM ?? '';
const HOST = process.env.SMTP_HOST ?? '';
const PORT = Number(process.env.SMTP_PORT ?? 0);
const USER = process.env.SMTP_USER ?? '';
const PASS = process.env.SMTP_PASS ?? '';
const DRY =
  String(process.env.MAIL_DRY_RUN ?? '')
    .trim()
    .toLowerCase() === 'true';

let cachedModule: NodemailerModule | null = null;
let moduleLoadError: Error | null = null;

function nodemailerAvailable() {
  if (cachedModule || moduleLoadError) {
    return cachedModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    cachedModule = require('nodemailer') as NodemailerModule;
  } catch (error) {
    moduleLoadError = error instanceof Error ? error : new Error(String(error));
    console.warn('[mail] nodemailer module not available:', moduleLoadError.message);
    cachedModule = null;
  }

  return cachedModule;
}

export function isMailConfigured(): boolean {
  return Boolean(FROM && HOST && PORT && USER && PASS);
}

type SendMailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function sendMail(opts: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}): Promise<SendMailResult> {
  if (!isMailConfigured()) {
    return { ok: false, error: 'mail_not_configured' };
  }

  if (!opts.to) {
    return { ok: false, error: 'missing_to' };
  }

  if (DRY) {
    console.log('[mail:dry-run]', {
      from: FROM,
      to: opts.to,
      subject: opts.subject,
    });
    return { ok: true, id: 'dry-run' };
  }

  const nodemailer = nodemailerAvailable();
  if (!nodemailer) {
    return { ok: false, error: 'nodemailer_not_available' };
  }

  const secure = PORT === 465;
  const transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure,
    auth: { user: USER, pass: PASS },
  });

  const info = await transporter.sendMail({
    from: FROM,
    to: opts.to,
    subject: opts.subject,
    text: opts.text ?? '',
    html:
      opts.html ??
      (opts.text ? `<pre>${escapeHtml(opts.text)}</pre>` : '<div></div>'),
  });

  return { ok: true, id: info.messageId };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return ch;
    }
  });
}
