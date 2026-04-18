/**
 * Zod schemas for sales operations.
 * Used by both the API (validation) and the frontend (form validation).
 */

import { z } from "zod";
import { paymentMethodSchema } from "./schemas";

/** Valid IVA rates in Venezuela. */
export const VALID_TAX_RATES = [0, 8, 16] as const;
export type TaxRate = (typeof VALID_TAX_RATES)[number];

/** IGTF rate for foreign currency payments (3%). */
export const IGTF_RATE = 3;

/** Payment methods that are in foreign currency (trigger IGTF). */
export const FOREIGN_CURRENCY_METHODS = [
  "binance",
  "zinli",
  "zelle",
] as const;

/** Schema for a sale item (line in the ticket). */
export const saleItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  discountPercent: z.number().min(0).max(100).default(0),
  /** Tax rate for this item (copied from product). */
  taxRate: z.number().min(0).max(100).default(0),
});

/** Schema for a sale payment. */
export const salePaymentSchema = z.object({
  method: paymentMethodSchema,
  amountUsd: z.number().min(0),
  amountBs: z.number().min(0).optional(),
  exchangeRate: z.number().min(0).optional(),
  reference: z.string().max(100).optional(),
});

/** Schema for creating a new sale. */
export const createSaleSchema = z.object({
  customerId: z.string().uuid().optional(),
  items: z.array(saleItemSchema).min(1),
  payments: z.array(salePaymentSchema).min(1),
  discountPercent: z.number().min(0).max(100).default(0),
  /** Fixed discount amount in USD (applied after percentage discount). */
  discountAmount: z.number().min(0).default(0),
  notes: z.string().max(500).optional(),
});

/** Schema for voiding a sale (requires owner PIN). */
export const voidSaleSchema = z.object({
  reason: z.string().min(1).max(500),
});

/** Schema for creating a credit note (partial refund). */
export const createCreditNoteSchema = z.object({
  /** Original sale to credit against. */
  originalSaleId: z.string().uuid(),
  /** Items to return (subset of original sale items). */
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().optional(),
        quantity: z.number().int().min(1),
        unitPrice: z.number().min(0),
        taxRate: z.number().min(0).max(100).default(0),
      }),
    )
    .min(1),
  reason: z.string().min(1).max(500),
});

/** Schema for creating a quotation. */
export const createQuotationSchema = z.object({
  customerId: z.string().uuid().optional(),
  items: z.array(saleItemSchema).min(1),
});

/**
 * Calculate line total after discount (before tax).
 * lineTotal = quantity * unitPrice * (1 - discountPercent / 100)
 */
export function calculateLineTotal(
  quantity: number,
  unitPrice: number,
  discountPercent: number,
): number {
  return (
    Math.round(quantity * unitPrice * (1 - discountPercent / 100) * 100) / 100
  );
}

/**
 * Calculate tax amount for a line item.
 * taxAmount = lineTotal * (taxRate / 100)
 */
export function calculateLineTax(
  lineTotal: number,
  taxRate: number,
): number {
  return Math.round(lineTotal * (taxRate / 100) * 100) / 100;
}

/**
 * Calculate sale totals with IVA and discounts.
 *
 * Flow:
 * 1. Sum line totals (after per-item discounts) = subtotal
 * 2. Apply sale-level % discount
 * 3. Apply sale-level fixed amount discount
 * 4. Calculate tax on each item's line total
 * 5. Total = discounted subtotal + total tax
 */
export function calculateSaleTotal(
  items: Array<{
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    taxRate?: number;
  }>,
  saleDiscountPercent: number = 0,
  saleDiscountAmount: number = 0,
): {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
} {
  // 1. Sum line totals
  const subtotal = items.reduce(
    (sum, item) =>
      sum +
      calculateLineTotal(item.quantity, item.unitPrice, item.discountPercent),
    0,
  );

  // 2-3. Apply sale-level discounts
  const afterPercentDiscount = subtotal * (1 - saleDiscountPercent / 100);
  const afterAllDiscounts = Math.max(0, afterPercentDiscount - saleDiscountAmount);
  const discountTotal =
    Math.round((subtotal - afterAllDiscounts) * 100) / 100;

  // 4. Calculate tax per item (on line totals, proportionally discounted)
  const discountRatio = subtotal > 0 ? afterAllDiscounts / subtotal : 0;
  const taxTotal = items.reduce((sum, item) => {
    const lineTotal = calculateLineTotal(
      item.quantity,
      item.unitPrice,
      item.discountPercent,
    );
    const discountedLine = lineTotal * discountRatio;
    return sum + calculateLineTax(discountedLine, item.taxRate ?? 0);
  }, 0);

  // 5. Total
  const total =
    Math.round((afterAllDiscounts + taxTotal) * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountTotal,
    taxTotal: Math.round(taxTotal * 100) / 100,
    total,
  };
}

/**
 * Convert USD to Bs. using the given exchange rate.
 */
export function usdToBs(amountUsd: number, rate: number): number {
  return Math.round(amountUsd * rate * 100) / 100;
}

/**
 * Calculate IGTF (3%) on foreign currency payments.
 * Only applies to payments in divisas (binance, zinli, zelle).
 */
export function calculateIgtf(
  payments: Array<{ method: string; amountUsd: number }>,
): number {
  const foreignTotal = payments
    .filter((p) =>
      (FOREIGN_CURRENCY_METHODS as readonly string[]).includes(p.method),
    )
    .reduce((sum, p) => sum + p.amountUsd, 0);
  return Math.round(foreignTotal * (IGTF_RATE / 100) * 100) / 100;
}
