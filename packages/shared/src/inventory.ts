/**
 * Zod schemas for inventory/product operations.
 * Used by both the API (validation) and the frontend (form validation).
 */

import { z } from "zod";

/** Schema for creating a new product. */
export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  categoryId: z.string().uuid().optional(),
  sku: z.string().max(50).optional(),
  barcode: z.string().max(50).optional(),
  cost: z.number().min(0).default(0),
  price: z.number().min(0),
  stock: z.number().int().min(0).default(0),
  stockMin: z.number().int().min(0).default(5),
  stockCritical: z.number().int().min(0).default(2),
  hasVariants: z.boolean().default(false),
  /** Service products have no stock tracking. */
  isService: z.boolean().default(false),
  /** Wholesale price in USD (optional). */
  wholesalePrice: z.number().min(0).optional(),
  /** Minimum qty to trigger wholesale price. */
  wholesaleMinQty: z.number().int().min(1).default(1),
  /** Brand name (free text). */
  brand: z.string().max(100).optional(),
  /** Physical location in the store. */
  location: z.string().max(100).optional(),
  imageUrl: z.string().url().optional(),
  expiresAt: z.string().datetime().optional(),
});

/** Schema for updating an existing product. */
export const updateProductSchema = createProductSchema.partial();

/** Schema for batch-creating multiple products (Excel import). */
export const batchCreateProductsSchema = z.object({
  products: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        sku: z.string().max(50).optional(),
        barcode: z.string().max(50).optional(),
        cost: z.number().min(0).default(0),
        price: z.number().min(0),
        stock: z.number().int().min(0).default(0),
      }),
    )
    .min(1)
    .max(500),
});

/** Schema for creating a product variant. */
export const createVariantSchema = z.object({
  productId: z.string().uuid(),
  sku: z.string().max(50).optional(),
  attributes: z.record(z.string()).default({}),
  cost: z.number().min(0).default(0),
  price: z.number().min(0),
  stock: z.number().int().min(0).default(0),
  barcode: z.string().max(50).optional(),
});

/** Schema for creating a category. */
export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  sortOrder: z.number().int().min(0).default(0),
});

/** Valid expense categories. */
export const EXPENSE_CATEGORIES = ["variable", "fixed", "cogs"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Stock semaphore status calculation. */
export type StockSemaphore = "green" | "yellow" | "red" | "gray";

/**
 * Calculate stock semaphore color based on current stock and thresholds.
 * Services always return "green" (no stock tracking).
 */
export function calculateStockSemaphore(
  stock: number,
  stockMin: number,
  stockCritical: number,
  lastSoldAt: string | null,
  isService: boolean = false,
): StockSemaphore {
  // Services don't track stock
  if (isService) return "green";

  // Gray: no movement in 60+ days
  if (lastSoldAt) {
    const daysSinceLastSale = Math.floor(
      (Date.now() - new Date(lastSoldAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSinceLastSale >= 60) return "gray";
  }

  if (stock <= stockCritical) return "red";
  if (stock <= stockMin) return "yellow";
  return "green";
}
