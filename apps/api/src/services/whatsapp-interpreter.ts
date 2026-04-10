/**
 * WhatsApp message interpreter using LLM.
 *
 * Takes a user's text message and returns a structured action.
 * Uses GPT-4o-mini via OpenRouter to understand intent.
 *
 * Actions:
 * - Read-only: query_sales, query_inventory, query_debt, query_price, query_cash
 * - Mutations (require confirmation): send_collection, update_price, register_expense
 */

/** Structured action from the LLM interpreter. */
export interface WhatsAppAction {
  type: string;
  params?: Record<string, unknown>;
  requiresConfirmation: boolean;
  response?: string;
}

/**
 * Interpret a WhatsApp message and return a structured action.
 *
 * Uses OpenRouter (GPT-4o-mini) to understand the user's intent.
 * Falls back to keyword matching when no AI provider is configured.
 */
export async function interpretWhatsAppMessage(
  text: string,
  userRole: "owner" | "employee",
): Promise<WhatsAppAction> {
  // Try AI interpretation first
  if (process.env.OPENROUTER_API_KEY) {
    try {
      return await interpretWithLlm(text, userRole);
    } catch {
      // Fall through to keyword matching
    }
  }

  // Keyword-based fallback
  return interpretWithKeywords(text, userRole);
}

/** AI-powered interpretation via OpenRouter. */
async function interpretWithLlm(
  text: string,
  userRole: string,
): Promise<WhatsAppAction> {
  const systemPrompt =
    `Eres el asistente de WhatsApp de Nova, un backoffice para comerciantes.\n` +
    `Interpreta el mensaje y devuelve JSON con: type, params, requiresConfirmation, response.\n` +
    `Acciones lectura: query_sales, query_inventory, query_debt, query_price, query_cash.\n` +
    `Acciones escritura (solo dueño): send_collection, update_price, register_expense.\n` +
    `Si no entiendes: { "type": "unknown", "response": "sugerencia" }.\n` +
    `Rol del usuario: ${userRole}`;

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        response_format: { type: "json_object" },
        max_tokens: 200,
      }),
    },
  );

  if (!response.ok) throw new Error(`LLM error: ${response.status}`);

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error("Empty LLM response");

  return JSON.parse(content) as WhatsAppAction;
}

/** Simple keyword-based fallback when no AI is available. */
function interpretWithKeywords(
  text: string,
  _userRole: string,
): WhatsAppAction {
  const lower = text.toLowerCase().trim();

  if (lower.includes("vendí") || lower.includes("ventas")) {
    return {
      type: "query_sales",
      params: { period: "today" },
      requiresConfirmation: false,
      response: "Consultando ventas de hoy...",
    };
  }

  if (lower.includes("inventario") || lower.includes("stock")) {
    return {
      type: "query_inventory",
      params: { filter: "low" },
      requiresConfirmation: false,
      response: "Consultando inventario bajo...",
    };
  }

  if (lower.includes("debe") || lower.includes("deuda")) {
    return {
      type: "query_debt",
      requiresConfirmation: false,
      response: "Consultando deudas...",
    };
  }

  if (lower.includes("precio")) {
    return {
      type: "query_price",
      requiresConfirmation: false,
      response: "Consultando precio...",
    };
  }

  if (lower.includes("caja") || lower.includes("efectivo")) {
    return {
      type: "query_cash",
      requiresConfirmation: false,
      response: "Consultando estado de caja...",
    };
  }

  if (lower.includes("cobra") || lower.includes("cobrar")) {
    return {
      type: "send_collection",
      requiresConfirmation: true,
      response: "¿A quién quieres cobrar?",
    };
  }

  return {
    type: "unknown",
    requiresConfirmation: false,
    response:
      "No entendí. Prueba: cuánto vendí hoy, inventario bajo, cuánto me debe Juan, precio del pan",
  };
}
