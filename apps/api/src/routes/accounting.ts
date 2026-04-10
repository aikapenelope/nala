/**
 * Accounting and OCR API routes.
 *
 * GET  /accounting/accounts     - Chart of accounts
 * GET  /accounting/entries      - Journal entries for a period
 *
 * POST /ocr/invoice             - Process invoice image with OCR
 * POST /ocr/confirm             - Confirm OCR results (creates expense + updates stock)
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, gte, lte, desc, sql, ilike } from "drizzle-orm";
import {
  accountingAccounts,
  accountingEntries,
  expenses,
  expenseItems,
  products,
  productAliases,
} from "@nova/db";
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
  const db = c.get("db");
  const businessId = c.get("businessId");

  const accounts = await db
    .select()
    .from(accountingAccounts)
    .where(
      and(
        eq(accountingAccounts.businessId, businessId),
        eq(accountingAccounts.isActive, true),
      ),
    )
    .orderBy(accountingAccounts.code);

  return c.json({ accounts });
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
    const { from, to } = c.req.valid("query");
    const db = c.get("db");
    const businessId = c.get("businessId");

    const conditions = [eq(accountingEntries.businessId, businessId)];

    if (from) {
      const fromDate = new Date(`${from}T00:00:00.000Z`);
      if (isNaN(fromDate.getTime())) {
        return c.json({ error: "Invalid 'from' date. Use YYYY-MM-DD." }, 400);
      }
      conditions.push(gte(accountingEntries.date, fromDate));
    }

    if (to) {
      const toDate = new Date(`${to}T23:59:59.999Z`);
      if (isNaN(toDate.getTime())) {
        return c.json({ error: "Invalid 'to' date. Use YYYY-MM-DD." }, 400);
      }
      conditions.push(lte(accountingEntries.date, toDate));
    }

    const entries = await db
      .select()
      .from(accountingEntries)
      .where(and(...conditions))
      .orderBy(desc(accountingEntries.date));

    return c.json({ entries });
  },
);

// ============================================================
// OCR
// ============================================================

const ocrRequestSchema = z.object({
  imageBase64: z.string().min(1),
});

/**
 * POST /ocr/invoice - Process invoice image.
 *
 * 1. Load product names from DB for matching hints
 * 2. Extract data with GPT-4o-mini vision
 * 3. Validate math
 * 4. Match items against inventory (aliases -> name fuzzy)
 * 5. Return structured result for user confirmation
 */
accounting.post(
  "/ocr/invoice",
  zValidator("json", ocrRequestSchema),
  async (c) => {
    const { imageBase64 } = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");

    try {
      // Load product list from DB for matching hints
      const productList = await db
        .select({ id: products.id, name: products.name, sku: products.sku })
        .from(products)
        .where(
          and(eq(products.businessId, businessId), eq(products.isActive, true)),
        );

      const productListHint =
        productList.length > 0
          ? productList
              .map((p) => `${p.name}${p.sku ? ` (${p.sku})` : ""}`)
              .join("\n")
          : "No products registered yet";

      const invoice = await extractInvoiceFromImage(
        imageBase64,
        productListHint,
      );

      const { itemWarnings, totalWarning } = validateInvoiceMath(invoice);

      // Load aliases for this business for matching
      const aliases = await db
        .select()
        .from(productAliases)
        .where(eq(productAliases.businessId, businessId));

      const aliasMap = new Map(
        aliases.map((a) => [a.aliasText.toLowerCase(), a.productId]),
      );

      // Match items against inventory
      const matches = await Promise.all(
        invoice.items.map(async (item, i) => {
          // 1. Try alias match
          const aliasProductId = aliasMap.get(item.description.toLowerCase());
          if (aliasProductId) {
            const [matched] = await db
              .select({ id: products.id, name: products.name })
              .from(products)
              .where(eq(products.id, aliasProductId))
              .limit(1);

            if (matched) {
              return {
                item,
                match: {
                  type: "alias" as const,
                  productId: matched.id,
                  productName: matched.name,
                  confidence: 0.95,
                },
                mathWarning: itemWarnings[i] ?? false,
              };
            }
          }

          // 2. Try SKU match
          if (item.sku) {
            const [skuMatch] = await db
              .select({ id: products.id, name: products.name })
              .from(products)
              .where(
                and(
                  eq(products.businessId, businessId),
                  eq(products.sku, item.sku),
                  eq(products.isActive, true),
                ),
              )
              .limit(1);

            if (skuMatch) {
              return {
                item,
                match: {
                  type: "sku" as const,
                  productId: skuMatch.id,
                  productName: skuMatch.name,
                  confidence: 0.99,
                },
                mathWarning: itemWarnings[i] ?? false,
              };
            }
          }

          // 3. Try fuzzy name match (ILIKE with first significant words)
          const searchTerm = item.description.split(" ").slice(0, 3).join(" ");
          if (searchTerm.length >= 3) {
            const fuzzyMatches = await db
              .select({ id: products.id, name: products.name })
              .from(products)
              .where(
                and(
                  eq(products.businessId, businessId),
                  ilike(products.name, `%${searchTerm}%`),
                  eq(products.isActive, true),
                ),
              )
              .limit(1);

            if (fuzzyMatches[0]) {
              return {
                item,
                match: {
                  type: "fuzzy" as const,
                  productId: fuzzyMatches[0].id,
                  productName: fuzzyMatches[0].name,
                  confidence: 0.6,
                },
                mathWarning: itemWarnings[i] ?? false,
              };
            }
          }

          // 4. No match
          return {
            item,
            match: {
              type: "new" as const,
              productId: null,
              productName: null,
              confidence: 0,
            },
            mathWarning: itemWarnings[i] ?? false,
          };
        }),
      );

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
 * 6. Generate accounting entries (expense)
 */
accounting.post(
  "/ocr/confirm",
  zValidator("json", ocrConfirmSchema),
  async (c) => {
    const data = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");

    const result = await db.transaction(async (tx) => {
      // 1. Create expense record
      const [expense] = await tx
        .insert(expenses)
        .values({
          businessId,
          supplierName: data.invoice.supplier,
          invoiceNumber: data.invoice.invoiceNumber,
          date: new Date(data.invoice.date),
          total: String(data.invoice.total),
        })
        .returning();

      // 2. Create expense items + 3. Update stock + 4. Create new products
      for (const item of data.items) {
        let productId = item.productId ?? null;

        // Create new product if flagged
        if (item.isNewProduct && item.newProductName) {
          const [newProduct] = await tx
            .insert(products)
            .values({
              businessId,
              name: item.newProductName,
              cost: String(item.unitPrice),
              price: String(item.newProductPrice ?? item.unitPrice * 1.3),
              stock: item.quantity,
            })
            .returning();

          productId = newProduct.id;

          // 5. Save alias for future matching
          await tx.insert(productAliases).values({
            businessId,
            supplierId: data.invoice.supplier,
            aliasText: item.description,
            productId: newProduct.id,
          });
        } else if (productId) {
          // Update stock for existing matched product
          await tx
            .update(products)
            .set({
              stock: sql`${products.stock} + ${item.quantity}`,
              cost: String(item.unitPrice),
              updatedAt: new Date(),
            })
            .where(eq(products.id, productId));

          // Save alias if description differs from product name
          await tx
            .insert(productAliases)
            .values({
              businessId,
              supplierId: data.invoice.supplier,
              aliasText: item.description,
              productId,
            })
            .onConflictDoNothing();
        }

        await tx.insert(expenseItems).values({
          expenseId: expense.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: String(item.unitPrice),
          lineTotal: String(item.lineTotal),
          productId,
        });
      }

      // 6. Generate accounting entries (expense)
      const expenseAccount = await tx
        .select()
        .from(accountingAccounts)
        .where(
          and(
            eq(accountingAccounts.businessId, businessId),
            eq(accountingAccounts.code, "5101"), // Costo de ventas
          ),
        )
        .limit(1);

      const cashAccount = await tx
        .select()
        .from(accountingAccounts)
        .where(
          and(
            eq(accountingAccounts.businessId, businessId),
            eq(accountingAccounts.code, "1101"), // Caja
          ),
        )
        .limit(1);

      if (expenseAccount[0] && cashAccount[0]) {
        await tx.insert(accountingEntries).values({
          businessId,
          date: new Date(data.invoice.date),
          debitAccountId: expenseAccount[0].id,
          creditAccountId: cashAccount[0].id,
          amount: String(data.invoice.total),
          description: `Compra ${data.invoice.supplier}${data.invoice.invoiceNumber ? ` #${data.invoice.invoiceNumber}` : ""}`,
          referenceType: "expense",
          referenceId: expense.id,
        });
      }

      return expense;
    });

    return c.json({ expense: result }, 201);
  },
);

export { accounting };
