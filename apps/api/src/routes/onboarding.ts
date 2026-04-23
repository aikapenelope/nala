/**
 * Onboarding routes.
 *
 * POST /onboarding - Create a new business + Clerk Organization after sign-up.
 *
 * Flow:
 * 1. Verify Clerk JWT to get the user's clerkId
 * 2. Create a Clerk Organization with the business name
 * 3. Add the user as org:admin of the Organization
 * 4. Create the business record in DB (with clerkOrgId)
 * 5. Create the owner user record in DB
 * 6. Pre-configure categories and accounting chart
 *
 * After onboarding, the user's JWT will include orgId and orgRole,
 * which the authMiddleware uses for all subsequent requests.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { verifyToken, createClerkClient } from "@clerk/backend";
import { eq } from "drizzle-orm";
import { businessTypeSchema } from "@nova/shared";
import {
  businesses,
  users,
  categories,
  accountingAccounts,
  findUserByClerkId,
  findBusinessById,
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
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    "Slug must be lowercase alphanumeric with hyphens",
  )
  .refine((s) => !RESERVED_SLUGS.has(s), "This name is reserved");

/** Schema for onboarding request. */
const onboardingSchema = z.object({
  businessType: businessTypeSchema,
  businessName: z.string().min(1).max(100),
  businessSlug: slugSchema,
  ownerName: z.string().min(1).max(100),
});

/**
 * Pre-configured categories per business type.
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
 * POST /onboarding - Create business + Clerk Organization + owner.
 *
 * Requires a valid Clerk session (the user just signed up).
 * Creates:
 * 1. Clerk Organization (the user becomes org:admin)
 * 2. Business record in DB (linked to Clerk Org via clerkOrgId)
 * 3. Owner user record in DB
 * 4. Pre-configured categories and accounting chart
 */
onboarding.post("/", zValidator("json", onboardingSchema), async (c) => {
  const { businessType, businessName, businessSlug, ownerName } =
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

  // Check if user already has a business
  const existingUser = await findUserByClerkId(db, clerkUserId);
  if (existingUser) {
    // User already has a business. Check if it needs Clerk Org migration.
    const existingBusiness = await findBusinessById(db, existingUser.businessId);

    if (existingBusiness && !existingBusiness.clerkOrgId && clerkSecretKey) {
      // --- Migration: link existing business to a new Clerk Organization ---
      // This handles businesses created before the Organizations migration.
      try {
        const clerk = createClerkClient({ secretKey: clerkSecretKey });

        // Try with slug first, fall back without if Clerk rejects it
        let org;
        try {
          org = await clerk.organizations.createOrganization({
            name: existingBusiness.name,
            slug: existingBusiness.slug ?? undefined,
            createdBy: clerkUserId,
          });
        } catch {
          org = await clerk.organizations.createOrganization({
            name: existingBusiness.name,
            createdBy: clerkUserId,
          });
        }

        await db
          .update(businesses)
          .set({ clerkOrgId: org.id, updatedAt: new Date() })
          .where(eq(businesses.id, existingBusiness.id));

        console.info(
          `[onboarding] Migrated business "${existingBusiness.name}" to Clerk Org ${org.id}`,
        );

        return c.json({
          business: {
            id: existingBusiness.id,
            name: existingBusiness.name,
            type: existingBusiness.type,
            clerkOrgId: org.id,
          },
          user: {
            id: existingUser.id,
            name: existingUser.name,
            role: existingUser.role,
            businessId: existingBusiness.id,
          },
          migrated: true,
        });
      } catch (err) {
        const clerkErr = err as {
          errors?: Array<{ message: string; code: string; longMessage?: string }>;
        };
        const detail = clerkErr.errors
          ? clerkErr.errors.map((e) => e.longMessage ?? e.message).join(". ")
          : String(err);
        console.error("[onboarding] Migration to Clerk Org failed:", detail);
        return c.json(
          { error: `Error al migrar el negocio: ${detail}` },
          500,
        );
      }
    }

    // Business already has a Clerk Org -- return it so the frontend
    // can call setActive() to activate it in the session.
    return c.json(
      {
        error: "User already has a business",
        businessId: existingUser.businessId,
        clerkOrgId: existingBusiness?.clerkOrgId ?? null,
      },
      409,
    );
  }

  // --- Create Clerk Organization ---
  // The owner becomes org:admin automatically (createdBy).
  // In dev mode without Clerk, skip org creation.
  let clerkOrgId: string | null = null;

  if (clerkSecretKey) {
    try {
      const clerk = createClerkClient({ secretKey: clerkSecretKey });

      // Try with slug first, fall back to without slug if it fails
      // (Clerk may reject slugs that conflict with existing orgs)
      try {
        const org = await clerk.organizations.createOrganization({
          name: businessName,
          slug: businessSlug,
          createdBy: clerkUserId,
        });
        clerkOrgId = org.id;
      } catch {
        // Retry without slug
        const org = await clerk.organizations.createOrganization({
          name: businessName,
          createdBy: clerkUserId,
        });
        clerkOrgId = org.id;
      }

      console.info(
        `[onboarding] Created Clerk Organization "${businessName}" (${clerkOrgId}) for user ${clerkUserId}`,
      );
    } catch (err) {
      const clerkErr = err as {
        errors?: Array<{ message: string; code: string; longMessage?: string }>;
      };
      const detail = clerkErr.errors
        ? clerkErr.errors.map((e) => e.longMessage ?? e.message).join(". ")
        : String(err);
      console.error("[onboarding] Failed to create Clerk Organization:", detail);
      return c.json(
        { error: `Error al crear la organizacion: ${detail}` },
        500,
      );
    }
  }

  // --- Create DB records in a single transaction ---
  let result;
  try {
    result = await db.transaction(async (tx) => {
      // 1. Create business with Clerk Org link
      const [business] = await tx
        .insert(businesses)
        .values({
          name: businessName,
          type: businessType,
          slug: businessSlug,
          clerkOrgId,
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
        clerkOrgId: result.business.clerkOrgId,
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
