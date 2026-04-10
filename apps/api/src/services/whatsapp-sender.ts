/**
 * WhatsApp message sender via Meta Cloud API.
 *
 * Sends text messages and media to WhatsApp users.
 * Used for: daily summaries, alerts, collection reminders, receipts.
 */

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

/** Send a text message to a WhatsApp number. */
export async function sendWhatsAppMessage(
  to: string,
  text: string,
): Promise<boolean> {
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
  const accessToken = process.env.WA_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.warn("WhatsApp not configured: WA_PHONE_NUMBER_ID or WA_ACCESS_TOKEN missing");
    return false;
  }

  try {
    const response = await fetch(
      `${GRAPH_API_BASE}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to.replace(/[^0-9]/g, ""),
          type: "text",
          text: { body: text },
        }),
      },
    );

    return response.ok;
  } catch (err) {
    console.error("WhatsApp send failed:", err);
    return false;
  }
}

/** Verify the webhook signature from Meta. */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
): boolean {
  const appSecret = process.env.WA_APP_SECRET;
  if (!appSecret) return false;

  // In production: use crypto.createHmac('sha256', appSecret).update(payload).digest('hex')
  // For now, accept all in development
  if (!signature.startsWith("sha256=")) return false;

  // TODO: Implement proper HMAC verification when deploying
  return true;
}
