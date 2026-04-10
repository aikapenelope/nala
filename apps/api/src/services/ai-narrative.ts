/**
 * AI narrative service using OpenRouter (GPT-4o-mini).
 *
 * Generates human-readable summaries for reports and dashboard.
 * Examples:
 *   "Esta semana vendiste $3,270, 8% más que la anterior.
 *    Tu mejor día fue sábado. Tu producto estrella: Pan Campesino."
 *
 * Uses OpenRouter as primary (GPT-4o-mini) with Groq as fallback.
 * Cost: ~$0.001 per narrative.
 */

/** Input data for generating a narrative. */
export interface NarrativeInput {
  type:
    | "daily_summary"
    | "weekly_summary"
    | "product_profitability"
    | "inventory_movement"
    | "receivable_aging"
    | "sales_by_seller"
    | "financial_summary";
  data: Record<string, unknown>;
  locale?: string;
}

/** Generate an AI narrative for a report. */
export async function generateNarrative(
  input: NarrativeInput,
): Promise<string> {
  const prompt = buildPrompt(input);

  // Try OpenRouter first, then Groq fallback
  if (process.env.OPENROUTER_API_KEY) {
    try {
      return await callOpenRouter(prompt);
    } catch {
      // Fall through to Groq
    }
  }

  if (process.env.GROQ_API_KEY) {
    try {
      return await callGroq(prompt);
    } catch {
      // Fall through to static fallback
    }
  }

  // Static fallback when no AI provider is configured
  return buildStaticNarrative(input);
}

/** Build the prompt for the AI model. */
function buildPrompt(input: NarrativeInput): string {
  const systemPrompt =
    "Eres el asistente de Nova, un sistema de backoffice para comerciantes en Venezuela. " +
    "Genera un párrafo corto (2-3 oraciones) resumiendo los datos. " +
    "Usa lenguaje simple y directo. Incluye comparativas y sugerencias accionables. " +
    "Todos los montos en USD. Responde en español.";

  const dataStr = JSON.stringify(input.data, null, 2);

  return JSON.stringify({
    system: systemPrompt,
    user: `Tipo de reporte: ${input.type}\nDatos:\n${dataStr}\n\nGenera el resumen narrativo.`,
  });
}

/** Call OpenRouter API (GPT-4o-mini). */
async function callOpenRouter(prompt: string): Promise<string> {
  const parsed = JSON.parse(prompt);
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: parsed.system },
        { role: "user", content: parsed.user },
      ],
      max_tokens: 200,
      temperature: 0.7,
    }),
  });

  if (!response.ok) throw new Error(`OpenRouter error: ${response.status}`);

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? buildStaticNarrative({ type: "daily_summary", data: {} });
}

/** Call Groq API (Llama 3 fallback). */
async function callGroq(prompt: string): Promise<string> {
  const parsed = JSON.parse(prompt);
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: parsed.system },
        { role: "user", content: parsed.user },
      ],
      max_tokens: 200,
      temperature: 0.7,
    }),
  });

  if (!response.ok) throw new Error(`Groq error: ${response.status}`);

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? buildStaticNarrative({ type: "daily_summary", data: {} });
}

/** Static fallback narrative when no AI is available. */
function buildStaticNarrative(input: NarrativeInput): string {
  switch (input.type) {
    case "daily_summary":
      return "Resumen del día generado. Configura OPENROUTER_API_KEY para narrativas con IA.";
    case "weekly_summary":
      return "Resumen semanal generado. Configura OPENROUTER_API_KEY para análisis con IA.";
    case "financial_summary":
      return "Resumen financiero generado. Configura OPENROUTER_API_KEY para insights con IA.";
    default:
      return "Reporte generado. Configura OPENROUTER_API_KEY para narrativas con IA.";
  }
}
