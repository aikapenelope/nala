/**
 * WhatsApp webhook and outbound message routes.
 *
 * GET  /webhooks/whatsapp  - Webhook verification (Meta setup)
 * POST /webhooks/whatsapp  - Receive incoming messages
 *
 * Architecture (from doc 19):
 * 1. Meta sends webhook POST with message
 * 2. Identify user by phone number
 * 3. LLM interprets message -> structured action
 * 4. Execute action (query or mutation with confirmation)
 * 5. Send response back via Meta Cloud API
 */

import { Hono } from "hono";
import { sendWhatsAppMessage } from "../services/whatsapp-sender";
import { interpretWhatsAppMessage } from "../services/whatsapp-interpreter";
import { WA_RATE_LIMIT_PER_HOUR } from "@nova/shared";

const whatsapp = new Hono();

/** In-memory rate limiter (use Redis in production). */
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + 3600000 });
    return true;
  }

  if (entry.count >= WA_RATE_LIMIT_PER_HOUR) return false;
  entry.count++;
  return true;
}

/**
 * GET /webhooks/whatsapp - Webhook verification.
 * Meta calls this once during webhook setup.
 */
whatsapp.get("/", (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  if (mode === "subscribe" && token === process.env.WA_VERIFY_TOKEN) {
    return c.text(challenge ?? "", 200);
  }
  return c.text("Forbidden", 403);
});

/**
 * POST /webhooks/whatsapp - Receive incoming messages.
 *
 * Flow:
 * 1. Extract phone + text from Meta's nested payload
 * 2. Look up user by phone (must have whatsapp_enabled)
 * 3. Rate limit check
 * 4. LLM interprets message -> action
 * 5. Check permissions (employee = read-only)
 * 6. Execute or request confirmation
 * 7. Send response
 */
whatsapp.post("/", async (c) => {
  const body = await c.req.json();

  // Extract message from Meta's nested structure
  const entry = body.entry?.[0];
  const change = entry?.changes?.[0];
  const message = change?.value?.messages?.[0];

  if (!message || message.type !== "text") {
    return c.json({ status: "ignored" });
  }

  const phone = message.from as string;
  const text = message.text.body as string;

  // TODO: Look up user by phone in DB
  // const user = await findUserByPhone(phone);
  // if (!user || !user.whatsappEnabled) { ... }

  // For now, respond with a placeholder
  if (!process.env.WA_ACCESS_TOKEN) {
    return c.json({ status: "whatsapp_not_configured" });
  }

  // Rate limit
  if (!checkRateLimit(phone)) {
    await sendWhatsAppMessage(
      phone,
      "Has enviado muchos mensajes. Espera un momento o usa la app.",
    );
    return c.json({ status: "rate_limited" });
  }

  // Interpret message with LLM
  try {
    const action = await interpretWhatsAppMessage(text, "owner");

    if (action.type === "unknown") {
      await sendWhatsAppMessage(
        phone,
        action.response ??
          "No entendí tu mensaje. Intenta algo como: cuánto vendí hoy",
      );
      return c.json({ status: "unknown_action" });
    }

    // TODO: Execute action against DB and send result
    await sendWhatsAppMessage(phone, action.response ?? "Procesando...");

    return c.json({ status: "ok" });
  } catch {
    await sendWhatsAppMessage(
      phone,
      "No puedo procesar tu mensaje ahora. Usa la app en nova.app",
    );
    return c.json({ status: "error" });
  }
});

export { whatsapp };
