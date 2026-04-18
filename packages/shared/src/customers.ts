/**
 * Zod schemas for customers, accounts, and day close operations.
 */

import { z } from "zod";
import { CLIENT_AT_RISK_DAYS, CLIENT_INACTIVE_DAYS, AGING_THRESHOLDS } from "./constants";

export type CustomerSegment = "vip" | "frequent" | "at_risk" | "new" | "with_debt" | "inactive";
export type AgingColor = "green" | "yellow" | "red";

export const createCustomerSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  /** Maximum fiado allowed (0 = no limit). */
  creditLimitUsd: z.number().min(0).optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const recordPaymentSchema = z.object({
  amountUsd: z.number().min(0.01),
  method: z.string(),
  reference: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export const createAccountPayableSchema = z.object({
  supplierName: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  amountUsd: z.number().min(0.01),
  dueDate: z.string().datetime().optional(),
});

export const dayCloseSchema = z.object({
  cashCounted: z.number().min(0),
  notes: z.string().max(500).optional(),
});

/** Calculate which segments a customer belongs to. */
export function calculateCustomerSegments(customer: {
  totalSpentUsd: number;
  totalPurchases: number;
  lastPurchaseAt: string | null;
  balanceUsd: number;
  createdAt: string;
  allCustomerSpends: number[];
}): CustomerSegment[] {
  const segments: CustomerSegment[] = [];
  const now = Date.now();

  if (customer.allCustomerSpends.length > 0) {
    const sorted = [...customer.allCustomerSpends].sort((a, b) => b - a);
    const top10Index = Math.max(1, Math.floor(sorted.length * 0.1));
    const threshold = sorted[top10Index - 1] ?? 0;
    if (customer.totalSpentUsd >= threshold && customer.totalSpentUsd > 0) {
      segments.push("vip");
    }
  }

  if (customer.totalPurchases >= 4) segments.push("frequent");

  if (customer.lastPurchaseAt) {
    const daysSince = Math.floor(
      (now - new Date(customer.lastPurchaseAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSince >= CLIENT_AT_RISK_DAYS && daysSince < CLIENT_INACTIVE_DAYS) segments.push("at_risk");
    if (daysSince >= CLIENT_INACTIVE_DAYS) segments.push("inactive");
  }

  const daysSinceCreated = Math.floor(
    (now - new Date(customer.createdAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysSinceCreated <= 30) segments.push("new");
  if (customer.balanceUsd > 0) segments.push("with_debt");

  return segments;
}

/** Calculate aging color for an account receivable. */
export function calculateAgingColor(createdAt: string): AgingColor {
  const days = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days > AGING_THRESHOLDS.yellow) return "red";
  if (days > AGING_THRESHOLDS.green) return "yellow";
  return "green";
}

/** Generate WhatsApp collection URL. */
export function generateCollectionWhatsAppUrl(
  phone: string, customerName: string, amountUsd: number, businessName: string,
): string {
  const message = encodeURIComponent(
    `Hola ${customerName}, te escribimos de ${businessName}. ` +
    `Tienes un saldo pendiente de $${amountUsd.toFixed(2)}. ` +
    `¿Podrías indicarnos cuándo puedes realizar el pago? Gracias.`,
  );
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${cleanPhone}?text=${message}`;
}
