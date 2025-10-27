import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const supportFromEmail = process.env.SUPPORT_FROM_EMAIL ?? 'support@liquilab.io';

export interface FasttrackInvoiceAttachment {
  invoiceNumber: string;
  invoiceCsv: string;
  issuedAt: Date;
  totalUsd: number;
}

export interface FasttrackEmailInput {
  to?: string | null;
  wallet?: string | null;
  invoice?: FasttrackInvoiceAttachment;
}

const formatUsd = (value: number) => `$${value.toFixed(2)}`;

export async function sendFasttrackApprovalEmail({ to, wallet, invoice }: FasttrackEmailInput): Promise<boolean> {
  if (!to || !resendApiKey) {
    console.warn('[EMAIL] Skipping fast-track approval email (missing recipient or API key)');
    return false;
  }

  const resend = new Resend(resendApiKey);
  const walletInfo = wallet ? `<p>Wallet: <strong>${wallet}</strong></p>` : '';
  const invoiceSummary = invoice
    ? `<p>Your invoice <strong>${invoice.invoiceNumber}</strong> (${formatUsd(invoice.totalUsd)}) is attached as a CSV file.</p>
       <p>You can import this invoice directly into GetGekko via <em>Verkoop &gt; Facturen &gt; Importeren (CSV)</em>.</p>`
    : '';

  const subject = invoice
    ? `LiquiLab Fast-Track Approved · Invoice ${invoice.invoiceNumber}`
    : 'LiquiLab Fast-Track Approved';

  const attachments = invoice
    ? [
        {
          filename: `${invoice.invoiceNumber}.csv`,
          content: Buffer.from(invoice.invoiceCsv, 'utf-8').toString('base64'),
          contentType: 'text/csv',
        },
      ]
    : undefined;

  try {
    await resend.emails.send({
      from: supportFromEmail,
      to,
      subject,
      attachments,
      html: `
        <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0A0F1C;">
          <h2>Early Access Approved</h2>
          <p>Thanks for supporting LiquiLab. Your account is now activated with access to 2 pools.</p>
          <p>You can connect your wallet and start exploring your positions immediately.</p>
          ${walletInfo}
          ${invoiceSummary}
          <hr />
          <p><strong>Disclaimer</strong></p>
          <p>LiquiLab is still in early development. Outages or data issues may occur.</p>
          <p>No refunds are available for early access payments.</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error('[EMAIL] Failed to send fast-track approval email', error);
    return false;
  }
}
