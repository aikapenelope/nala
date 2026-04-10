/**
 * Onboarding routes.
 *
 * POST /onboarding - Create a new business + owner user after Clerk registration.
 *
 * This is called once per Clerk user, right after they sign up.
 * It creates the business record, the owner user linked to their Clerk ID,
 * and pre-configures categories and accounting chart based on business type.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { verifyToken } from "@clerk/backend";
import { businessTypeSchema } from "@nova/shared";
import {
  businesses,
  users,
  categories,
  accountingAccounts,
  findUserByClerkId,
} from "@nova/db";
import { getDb } from "../db";

const onboarding = new Hono();

/** Schema for onboarding request. */
const onboardingSchema = z.object({
  businessType: businessTypeSchema,
  businessName: z.string().min(1).max(100),
  ownerPin: z.string().length(4).optional().default("0000"),
});

/**
 * Pre-configured categories per business type.
 * These give the user a head start so they don't have to create categories from scratch.
 */
const CATEGORIES_BY_TYPE: Record<string, string[]> = {
  ferreteria: [
    "Herramientas manuales",
    "Herramientas eléctricas",
    "Tornillería",
    "Pinturas",
    "Plomería",
    "Electricidad",
    "Cerrajería",
    "Otros",
  ],
  bodega: [
    "Abarrotes",
    "Lácteos",
    "Bebidas",
    "Limpieza",
    "Cuidado personal",
    "Snacks",
    "Otros",
  ],
  ropa: [
    "Ropa de mujer",
    "Ropa de hombre",
    "Ropa de niños",
    "Calzado",
    "Accesorios",
    "Ropa interior",
    "Otros",
  ],
  autopartes: [
    "Motor",
    "Frenos",
    "Suspensión",
    "Eléctrico",
    "Filtros",
    "Aceites y lubricantes",
    "Accesorios",
    "Otros",
  ],
  peluqueria: [
    "Cortes",
    "Coloración",
    "Tratamientos",
    "Productos capilares",
    "Uñas",
    "Maquillaje",
    "Otros",
  ],
  farmacia: [
    "Medicamentos",
    "Vitaminas",
    "Cuidado personal",
    "Bebés",
    "Primeros auxilios",
    "Otros",
  ],
  electronica: [
    "Celulares",
    "Accesorios",
    "Computación",
    "Audio",
    "Cables y conectores",
    "Otros",
  ],
  libreria: [
    "Cuadernos",
    "Útiles escolares",
    "Papelería",
    "Arte",
    "Oficina",
    "Otros",
  ],
  cosmeticos: [
    "Maquillaje",
    "Cuidado facial",
    "Cuidado corporal",
    "Fragancias",
    "Cabello",
    "Otros",
  ],
  distribuidora: [
    "Alimentos",
    "Bebidas",
    "Limpieza",
    "Cuidado personal",
    "Otros",
  ],
  otro: ["General", "Otros"],
};

/**
 * Basic chart of accounts for Venezuelan small businesses.
 * Simplified for non-accountants but compatible with libro diario format.
 */
const DEFAULT_ACCOUNTS: Array<{
  code: string;
  name: string;
  type: string;
}> = [
  { code: "1101", name: "Caja (Efectivo)", type: "asset" },
  { code: "1102", name: "Bancos", type: "asset" },
  { code: "1103", name: "Cuentas por cobrar", type: "asset" },
  { code: "1104", name: "Inventario", type: "asset" },
  { code: "2101", name: "Cuentas por pagar", type: "liability" },
  { code: "4101", name: "Ventas", type: "revenue" },
  { code: "5101", name: "Costo de ventas", type: "expense" },
  { code: "5201", name: "Gastos operativos", type: "expense" },
];

/**
 * POST /onboarding - Create business + owner.
 *
 * Requires a valid Clerk session (the user just signed up).
 * Creates:
 * 1. Business record with type and name
 * 2. Owner user linked to the Clerk ID
 * 3. Pre-configured categories for the business type
 * 4. Pre-configured accounting chart
 */
onboarding.post("/", zValidator("json", onboardingSchema), async (c) => {
  const { businessType, businessName, ownerPin } = c.req.valid("json");
  const db = getDb();

  // Get Clerk user ID from auth header
  const authHeader = c.req.header("Authorization");
  let clerkUserId: string | null = null;

  if (authHeader?.startsWith("Bearer ") && process.env.CLERK_SECRET_KEY) {
    try {
      const token = authHeader.slice(7);
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
      clerkUserId = payload.sub ?? null;
    } catch {
      return c.json({ error: "Invalid authentication token" }, 401);
    }
  } else if (!process.env.CLERK_SECRET_KEY) {
    // Dev mode fallback
    clerkUserId = "dev-clerk-001";
  } else {
    return c.json({ error: "Authorization required" }, 401);
  }

  if (!clerkUserId) {
    return c.json({ error: "Could not identify user" }, 401);
  }

  // Check if user already has a business (prevent duplicates)
  const existingUser = await findUserByClerkId(db, clerkUserId);
  if (existingUser) {
    return c.json(
      {
        error: "User already has a business",
        businessId: existingUser.businessId,
      },
      409,
    );
  }

  // Hash the owner's PIN
  const pinHash = await bcrypt.hash(ownerPin, 10);

  // Create business
  const [business] = await db
    .insert(businesses)
    .values({
      name: businessName,
      type: businessType,
    })
    .returning();

  // Create owner user linked to Clerk ID
  const [owner] = await db
    .insert(users)
    .values({
      businessId: business.id,
      clerkId: clerkUserId,
      name: businessName, // Will be updated from Clerk profile later
      role: "owner",
      pinHash,
    })
    .returning();

  // Pre-configure categories for the business type
  const categoryNames =
    CATEGORIES_BY_TYPE[businessType] ?? CATEGORIES_BY_TYPE["otro"];
  if (categoryNames.length > 0) {
    await db.insert(categories).values(
      categoryNames.map((name, idx) => ({
        businessId: business.id,
        name,
        sortOrder: idx,
      })),
    );
  }

  // Pre-configure accounting chart
  if (DEFAULT_ACCOUNTS.length > 0) {
    await db.insert(accountingAccounts).values(
      DEFAULT_ACCOUNTS.map((acc) => ({
        businessId: business.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
      })),
    );
  }

  return c.json({
    business: {
      id: business.id,
      name: business.name,
      type: business.type,
    },
    user: {
      id: owner.id,
      name: owner.name,
      role: owner.role,
      businessId: business.id,
    },
  });
});

export { onboarding };
