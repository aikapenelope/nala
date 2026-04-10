/**
 * OCR pipeline service using GPT-4o-mini vision via OpenRouter.
 *
 * Flow (from doc 12):
 * 1. Receive image from PWA camera (full resolution)
 * 2. Send to GPT-4o-mini vision with structured output
 * 3. Extract: supplier, date, invoice number, line items
 * 4. Validate math (qty * price = line_total)
 * 5. Match items against inventory (aliases → SKU → fuzzy)
 * 6. Return structured data for user confirmation
 *
 * Cost: ~$0.005-0.01 per invoice.
 */

import { z } from "zod";

/** Schema for OCR extraction result. */
export const ocrInvoiceSchema = z.object({
  supplier: z.string(),
  invoiceNumber: z.string().optional(),
  date: z.string(),
  items: z.array(
    z.object({
      description: z.string(),
      sku: z.string().optional(),
      quantity: z.number(),
      unitPrice: z.number(),
      lineTotal: z.number(),
    }),
  ),
  subtotal: z.number().optional(),
  tax: z.number().optional(),
  total: z.number(),
});

export type OcrInvoice = z.infer<typeof ocrInvoiceSchema>;

/** Match result for a single invoice item. */
export interface ItemMatch {
  type: "alias" | "sku" | "fuzzy" | "new";
  productId: string | null;
  productName: string | null;
  confidence: number;
}

/** OCR result with matches for user confirmation. */
export interface OcrResult {
  invoice: OcrInvoice;
  matches: Array<{
    item: OcrInvoice["items"][number];
    match: ItemMatch;
    mathWarning: boolean;
  }>;
  totalWarning: boolean;
}

/**
 * Extract invoice data from an image using GPT-4o-mini vision.
 * Returns structured JSON via OpenRouter's structured output.
 */
export async function extractInvoiceFromImage(
  imageBase64: string,
  productListHint: string,
): Promise<OcrInvoice> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY required for OCR. Configure it in .env",
    );
  }

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
          {
            role: "system",
            content:
              "Extrae datos de facturas venezolanas. Devuelve JSON con proveedor, fecha, items y total. " +
              "Cada item tiene: description, quantity, unitPrice, lineTotal.",
          },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: imageBase64 } },
              {
                type: "text",
                text: `Productos del negocio para matching:\n${productListHint}`,
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`OpenRouter OCR error: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error("Empty OCR response");

  const parsed = ocrInvoiceSchema.safeParse(JSON.parse(content));
  if (!parsed.success) {
    throw new Error(`OCR schema validation failed: ${parsed.error.message}`);
  }

  return parsed.data;
}

/**
 * Validate math consistency of extracted invoice data.
 * Checks: qty * unitPrice = lineTotal for each item, sum = total.
 */
export function validateInvoiceMath(invoice: OcrInvoice): {
  itemWarnings: boolean[];
  totalWarning: boolean;
} {
  const itemWarnings = invoice.items.map((item) => {
    const expected = item.quantity * item.unitPrice;
    return Math.abs(expected - item.lineTotal) > 0.01;
  });

  const sumOfLines = invoice.items.reduce((s, i) => s + i.lineTotal, 0);
  const totalWarning = Math.abs(sumOfLines - invoice.total) > 0.5;

  return { itemWarnings, totalWarning };
}
