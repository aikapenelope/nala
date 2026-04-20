/**
 * Stock transaction helpers.
 *
 * Encapsulates the common pattern of atomically decrementing/incrementing
 * stock and logging the movement with qty_after_transaction.
 *
 * Inspired by ERPNext's Stock Ledger Entry pattern where every stock
 * change is recorded with the resulting balance.
 */

import { eq, and, sql } from "drizzle-orm";
import { products, productVariants, stockMovements } from "@nova/db";
import type { Database } from "@nova/db";

/** A single item's stock change within a transaction. */
export interface StockChangeItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
  isService?: boolean;
}

/** Context for logging the stock movement. */
export interface StockMovementContext {
  businessId: string;
  userId: string;
  type: "sale" | "void" | "adjustment" | "purchase" | "credit_note";
  referenceType: string;
  referenceId: string;
  costUnit?: string;
}

/**
 * Decrement stock for a list of items within a transaction.
 * Uses atomic WHERE stock >= qty guard to prevent overselling.
 * Returns a map of productId -> post-decrement stock level.
 *
 * Throws Error("Insufficient stock for ...") if any item fails.
 */
export async function decrementStock(
  tx: Database,
  items: StockChangeItem[],
): Promise<Map<string, number>> {
  const stockAfterMap = new Map<string, number>();

  for (const item of items) {
    if (item.isService) continue;

    if (item.variantId) {
      const variantResult = await tx
        .update(productVariants)
        .set({
          stock: sql`${productVariants.stock} - ${item.quantity}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(productVariants.id, item.variantId),
            sql`${productVariants.stock} >= ${item.quantity}`,
          ),
        )
        .returning({ id: productVariants.id });

      if (variantResult.length === 0) {
        throw new Error(`Insufficient stock for variant ${item.variantId}`);
      }
    }

    const productResult = await tx
      .update(products)
      .set({
        stock: sql`${products.stock} - ${item.quantity}`,
        lastSoldAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(products.id, item.productId),
          sql`${products.stock} >= ${item.quantity}`,
        ),
      )
      .returning({ id: products.id, stock: products.stock });

    if (productResult.length === 0) {
      throw new Error(`Insufficient stock for product ${item.productId}`);
    }

    stockAfterMap.set(item.productId, productResult[0].stock);
  }

  return stockAfterMap;
}

/**
 * Increment stock for a list of items within a transaction (used for voids/returns).
 * Returns a map of productId -> post-increment stock level.
 */
export async function incrementStock(
  tx: Database,
  items: StockChangeItem[],
): Promise<Map<string, number>> {
  const stockAfterMap = new Map<string, number>();

  for (const item of items) {
    if (item.isService) continue;

    if (item.variantId) {
      await tx
        .update(productVariants)
        .set({
          stock: sql`${productVariants.stock} + ${item.quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, item.variantId));
    }

    const [restored] = await tx
      .update(products)
      .set({
        stock: sql`${products.stock} + ${item.quantity}`,
        updatedAt: new Date(),
      })
      .where(eq(products.id, item.productId))
      .returning({ stock: products.stock });

    stockAfterMap.set(item.productId, restored?.stock ?? 0);
  }

  return stockAfterMap;
}

/**
 * Log stock movements for a list of items with qty_after_transaction.
 */
export async function logStockMovements(
  tx: Database,
  items: StockChangeItem[],
  stockAfterMap: Map<string, number>,
  ctx: StockMovementContext,
): Promise<void> {
  for (const item of items) {
    if (item.isService) continue;

    const qtyChange = ctx.type === "void" ? item.quantity : -item.quantity;

    await tx.insert(stockMovements).values({
      businessId: ctx.businessId,
      productId: item.productId,
      variantId: item.variantId ?? null,
      type: ctx.type,
      quantity: qtyChange,
      costUnit: ctx.costUnit ?? "0",
      referenceType: ctx.referenceType,
      referenceId: ctx.referenceId,
      userId: ctx.userId,
      qtyAfterTransaction: stockAfterMap.get(item.productId) ?? null,
    });
  }
}
