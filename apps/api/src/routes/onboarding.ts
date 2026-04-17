/**
 * Onboarding routes.
 *
 * POST /onboarding - Create a new business + owner user after Clerk registration.
 *
 * This is called once per Clerk user, right after they sign up.
 * It creates the business record, the owner user linked to their Clerk ID,
 * and pre-configures categories and accounting chart based on business type.
 *
 * The entire operation runs in a single database transaction. If any step
 * fails, everything is rolled back -- no orphaned records.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { verifyToken } from "@clerk/backend";
import { eq } from "drizzle-orm";
import { businessTypeSchema, PIN_LENGTH } from "@nova/shared";
import {
  businesses,
  users,
  categories,
  accountingAccounts,
  findUserByClerkId,
} from "@nova/db";
import { getDb } from "../db";
import { handleDbError } from "../utils/db-errors";

const onboarding = new Hono();

/** Slug validation: lowercase alphanumeric + hyphens, 3-40 chars. */
const RESERVED_SLUGS = new Set([
  "www",
  "api",
  "admin",
  "mail",
  "ftp",
  "staging",
  "dev",
  "app",
  "dashboard",
  "catalog",
  "catalogo",
  "health",
  "onboarding",
]);

const slugSchema = z
  .string()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Slug must be lowercase alphanumeric with hyphens")
  .refine((s) => !RESERVED_SLUGS.has(s), "This name is reserved");

/** Schema for onboarding request. */
const onboardingSchema = z.object({
  businessType: businessTypeSchema,
  businessName: z.string().min(1).max(100),
  businessSlug: slugSchema,
  ownerName: z.string().min(1).max(100),
  ownerPin: z.string().length(PIN_LENGTH),
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
 * GET /onboarding/check-slug/:slug - Check if a slug is available.
 *
 * Public endpoint (no auth required). Returns { available: boolean }.
 * Used by the onboarding form for real-time slug validation.
 */
onboarding.get("/check-slug/:slug", async (c) => {
  const slug = c.req.param("slug");
  const db = getDb();

  const [existing] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.slug, slug))
    .limit(1);

  return c.json({ available: !existing });
});

/**
 * POST /onboarding - Create business + owner.
 *
 * Requires a valid Clerk session (the user just signed up).
 * Creates in a single transaction:
 * 1. Business record with type and name
 * 2. Owner user linked to the Clerk ID
 * 3. Pre-configured categories for the business type
 * 4. Pre-configured accounting chart
 */
onboarding.post("/", zValidator("json", onboardingSchema), async (c) => {
  const { businessType, businessName, businessSlug, ownerName, ownerPin } =
    c.req.valid("json");
  const db = getDb();

  // Authenticate: extract Clerk user ID from JWT
  const authHeader = c.req.header("Authorization");
  let clerkUserId: string | null = null;

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;

  if (authHeader?.startsWith("Bearer ") && clerkSecretKey) {
    try {
      const token = authHeader.slice(7);
      const payload = await verifyToken(token, {
        secretKey: clerkSecretKey,
      });
      clerkUserId = payload.sub ?? null;
    } catch {
      return c.json({ error: "Invalid authentication token" }, 401);
    }
  } else if (!clerkSecretKey && process.env.NODE_ENV === "development") {
    // Dev-only fallback, requires explicit NODE_ENV=development
    clerkUserId = "dev-clerk-001";
  } else if (!clerkSecretKey) {
    return c.json(
      { error: "Server misconfiguration: authentication not available" },
      500,
    );
  } else {
    return c.json(
      { error: "Authorization header with Bearer token required" },
      401,
    );
  }

  if (!clerkUserId) {
    return c.json({ error: "Could not identify user from token" }, 401);
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

  // All-or-nothing: create business, owner, categories, accounts in one transaction
  let result;
  try {
    result = await db.transaction(async (tx) => {
    // 1. Create business
    const [business] = await tx
      .insert(businesses)
      .values({
        name: businessName,
        type: businessType,
        slug: businessSlug,
      })
      .returning();

    // 2. Create owner user linked to Clerk ID
    const [owner] = await tx
      .insert(users)
      .values({
        businessId: business.id,
        clerkId: clerkUserId,
        name: ownerName,
        role: "owner",
        pinHash,
      })
      .returning();

    // 3. Pre-configure categories for the business type
    const categoryNames =
      CATEGORIES_BY_TYPE[businessType] ?? CATEGORIES_BY_TYPE["otro"];
    await tx.insert(categories).values(
      categoryNames.map((name, idx) => ({
        businessId: business.id,
        name,
        sortOrder: idx,
      })),
    );

    // 4. Pre-configure accounting chart
    await tx.insert(accountingAccounts).values(
      DEFAULT_ACCOUNTS.map((acc) => ({
        businessId: business.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
      })),
    );

    return { business, owner };
    });
  } catch (err) {
    const dbErr = handleDbError(err);
    if (dbErr) return c.json({ error: dbErr.message }, dbErr.status);
    throw err;
  }

  return c.json(
    {
      business: {
        id: result.business.id,
        name: result.business.name,
        type: result.business.type,
      },
      user: {
        id: result.owner.id,
        name: result.owner.name,
        role: result.owner.role,
        businessId: result.business.id,
      },
    },
    201,
  );
});

export { onboarding };
