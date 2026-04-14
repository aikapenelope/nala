/**
 * Email service using Resend.
 *
 * Sends transactional emails for:
 * - Report delivery to the business accountant
 *
 * Requires RESEND_API_KEY environment variable.
 * The "from" address uses Resend's default domain unless RESEND_FROM is set.
 */

import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (_resend) return _resend;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  _resend = new Resend(apiKey);
  return _resend;
}

/** Default sender address. Override with RESEND_FROM env var. */
function getFromAddress(): string {
  return process.env.RESEND_FROM ?? "Nova <onboarding@resend.dev>";
}

export interface SendReportEmailOptions {
  /** Recipient email address. */
  to: string;
  /** Email subject line. */
  subject: string;
  /** Business name for the email body. */
  businessName: string;
  /** Report type label (e.g. "Resumen Diario"). */
  reportType: string;
  /** Period label (e.g. "Hoy", "Esta semana"). */
  period: string;
  /** PDF attachment as ArrayBuffer. */
  pdfBuffer: ArrayBuffer;
  /** Filename for the attachment. */
  pdfFilename: string;
}

/**
 * Send a report PDF via email.
 * Returns the Resend message ID on success, or throws on failure.
 */
export async function sendReportEmail(
  options: SendReportEmailOptions,
): Promise<string> {
  const resend = getResend();
  if (!resend) {
    throw new Error(
      "Email no configurado. Agrega RESEND_API_KEY en las variables de entorno.",
    );
  }

  const { data, error } = await resend.emails.send({
    from: getFromAddress(),
    to: [options.to],
    subject: options.subject,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">${options.businessName}</h2>
        <p>Adjunto encontraras el reporte <strong>${options.reportType}</strong> del periodo: <strong>${options.period}</strong>.</p>
        <p style="color: #666; font-size: 14px;">Este reporte fue generado automaticamente por Nova.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">
          Nova - Backoffice Operativo<br/>
          Este email fue enviado a solicitud del dueno del negocio.
        </p>
      </div>
    `,
    attachments: [
      {
        filename: options.pdfFilename,
        content: Buffer.from(options.pdfBuffer),
      },
    ],
  });

  if (error) {
    throw new Error(`Error enviando email: ${error.message}`);
  }

  return data?.id ?? "sent";
}
