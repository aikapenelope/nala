/**
 * Accounting and OCR API routes.
 *
 * GET  /accounting/accounts     - Chart of accounts
 * GET  /accounting/entries      - Journal entries for a period
 * POST /accounting/export       - Generate Excel export for accountant
 *
 * POST /ocr/invoice             - Process invoice image with OCR
 * POST /ocr/confirm             - Confirm OCR results (creates expense + updates stock)
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  extractInvoiceFromImage,
  validateInvoiceMath,
} from "../services/ocr-pipeline";
import type { AppEnv } from "../types";

const accounting = new Hono<AppEnv>();

// ============================================================
// Accounting
// ============================================================

/** GET /accounting/accounts - Chart of accounts for the business. */
accounting.get("/accounting/accounts", async (c) => {
  // TODO: Query accounting_accounts from DB
  return c.json({ accounts: [] });
});

const periodQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

/** GET /accounting/entries - Journal entries for a period. */
accounting.get(
  "/accounting/entries",
  zValidator("query", periodQuery),
  async (c) => {
    // TODO: Query accounting_entries with period filter
    return c.json({ entries: [] });
  },
);

/** POST /accounting/export - Generate Excel export package. */
accounting.post("/accounting/export", async (c) => {
  // TODO: Generate Excel with libro diario format
  // Columns: fecha, cuenta, debe, haber, descripcion, referencia
  // Also generate: sales summary, expense summary, P&L
  return c.json({
    message: "Export generation requires database connection",
  }, 503);
});

// ============================================================
// OCR
// ============================================================

const ocrRequestSchema = z.object({
  imageBase64: z.string().min(1),
});

/**
 * POST /ocr/invoice - Process invoice image.
 *
 * 1. Extract data with GPT-4o-mini vision
 * 2. Validate math
 * 3. Match items against inventory
 * 4. Return structured result for user confirmation
 */
accounting.post(
  "/ocr/invoice",
  zValidator("json", ocrRequestSchema),
  async (c) => {
    const { imageBase64 } = c.req.valid("json");

    try {
      // TODO: Load product list from DB for matching hints
      const productListHint = "No products loaded yet (DB not connected)";

      const invoice = await extractInvoiceFromImage(
        imageBase64,
        productListHint,
      );

      const { itemWarnings, totalWarning } = validateInvoiceMath(invoice);

      // TODO: Match items against inventory (aliases → SKU → fuzzy)
      const matches = invoice.items.map((item, i) => ({
        item,
        match: {
          type: "new" as const,
          productId: null,
          productName: null,
          confidence: 0,
        },
        mathWarning: itemWarnings[i] ?? false,
      }));

      return c.json({
        invoice,
        matches,
        totalWarning,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "OCR processing failed";
      return c.json({ error: message }, 500);
    }
  },
);

const ocrConfirmSchema = z.object({
  invoice: z.object({
    supplier: z.string(),
    invoiceNumber: z.string().optional(),
    date: z.string(),
    total: z.number(),
  }),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
      lineTotal: z.number(),
      productId: z.string().uuid().optional(),
      isNewProduct: z.boolean().default(false),
      newProductName: z.string().optional(),
      newProductPrice: z.number().optional(),
      newProductCategory: z.string().optional(),
    }),
  ),
});

/**
 * POST /ocr/confirm - Confirm OCR results.
 *
 * Atomic transaction:
 * 1. Create expense record
 * 2. Create expense items
 * 3. Update stock for matched products
 * 4. Create new products for unmatched items
 * 5. Save aliases for future matching
 * 6. Generate accounting entries
 */
accounting.post(
  "/ocr/confirm",
  zValidator("json", ocrConfirmSchema),
  async (c) => {
    // TODO: Atomic transaction when DB is connected
    return c.json({
      message: "OCR confirmation requires database connection",
    }, 503);
  },
);

export { accounting };
