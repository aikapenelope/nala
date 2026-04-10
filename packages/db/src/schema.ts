/**
 * Drizzle ORM schema for Nova.
 *
 * Phase 2: adds categories, products, product_variants, units_of_measure.
 * RLS policies are applied via init.sql (not Drizzle).
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ============================================================
// Phase 1 tables
// ============================================================

/**
 * Businesses table - each row is a tenant.
 * All other tables reference this via business_id for RLS isolation.
 */
export const businesses = pgTable("businesses", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("otro"),
  phone: text("phone"),
  address: text("address"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Users table - owners (Clerk auth) and employees (PIN auth).
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    clerkId: text("clerk_id"),
    name: text("name").notNull(),
    role: text("role").notNull().default("employee"),
    pinHash: text("pin_hash").notNull(),
    phone: text("phone"),
    whatsappEnabled: boolean("whatsapp_enabled").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    pinFailedAttempts: integer("pin_failed_attempts").notNull().default(0),
    pinLockedUntil: timestamp("pin_locked_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_users_clerk_id").on(table.clerkId),
    uniqueIndex("idx_users_phone").on(table.phone),
  ],
);

/** Activity log - tracks all user actions for accountability. */
export const activityLog = pgTable("activity_log", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  detail: text("detail"),
  channel: text("channel").notNull().default("web"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================
// Phase 2 tables: Inventory
// ============================================================

/**
 * Product categories - pre-configured per business type during onboarding.
 * Examples: "Abarrotes", "Herramientas", "Ropa de mujer".
 */
export const categories = pgTable("categories", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Units of measure with conversion factor.
 * Example: product sells in "unidades" but is purchased in "cajas" (1 caja = 12 unidades).
 */
export const unitsOfMeasure = pgTable("units_of_measure", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id),
  /** Name shown to the user: "unidad", "caja", "kg", "litro". */
  name: text("name").notNull(),
  /** Short abbreviation: "u", "cj", "kg", "L". */
  abbreviation: text("abbreviation").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Products (parent). Each product can have 0+ variants.
 * A product without variants is a simple product (stock/price live here).
 * A product with variants delegates stock/price to product_variants.
 */
export const products = pgTable(
  "products",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    categoryId: uuid("category_id").references(() => categories.id),
    name: text("name").notNull(),
    description: text("description"),

    /** SKU for simple products (no variants). Variants have their own SKU. */
    sku: text("sku"),

    /** Barcode (EAN/UPC) for scanner lookup. */
    barcode: text("barcode"),

    /** Cost price in USD. For products with variants, this is the default. */
    cost: numeric("cost", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),

    /** Sale price in USD. For products with variants, this is the default. */
    price: numeric("price", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),

    /** Current stock. For products with variants, this is the sum of variant stocks. */
    stock: integer("stock").notNull().default(0),

    /** Minimum stock level before "yellow" semaphore. */
    stockMin: integer("stock_min").notNull().default(5),

    /** Critical stock level for "red" semaphore. */
    stockCritical: integer("stock_critical").notNull().default(2),

    /** Whether this product has variants (talla, color, etc.). */
    hasVariants: boolean("has_variants").notNull().default(false),

    /** Sale unit of measure (what the customer buys). */
    saleUnitId: uuid("sale_unit_id").references(() => unitsOfMeasure.id),

    /** Purchase unit of measure (what you buy from supplier). */
    purchaseUnitId: uuid("purchase_unit_id").references(
      () => unitsOfMeasure.id,
    ),

    /** Conversion factor: 1 purchase unit = X sale units. E.g. 1 caja = 12 unidades. */
    unitConversionFactor: numeric("unit_conversion_factor", {
      precision: 10,
      scale: 4,
    }).default("1"),

    /** Expiration date for perishable products. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** URL of product image in MinIO. */
    imageUrl: text("image_url"),

    /** Last date this product was sold. Used for dead stock detection. */
    lastSoldAt: timestamp("last_sold_at", { withTimezone: true }),

    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_products_business").on(table.businessId),
    index("idx_products_category").on(table.categoryId),
    index("idx_products_barcode").on(table.barcode),
    index("idx_products_name_trgm").using(
      "gin",
      sql`${table.name} gin_trgm_ops`,
    ),
  ],
);

/**
 * Product variants - child rows for products with variants.
 * Each variant has its own SKU, stock, cost, and price.
 * Attributes are stored as JSON: { "talla": "M", "color": "Azul" }.
 */
export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),

    /** Variant-specific SKU. E.g. "CAM-AZL-M". */
    sku: text("sku"),

    /** Variant attributes as JSON. E.g. { "talla": "M", "color": "Azul" }. */
    attributes: jsonb("attributes").notNull().default({}),

    cost: numeric("cost", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    price: numeric("price", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    stock: integer("stock").notNull().default(0),
    barcode: text("barcode"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_variants_product").on(table.productId),
    index("idx_variants_business").on(table.businessId),
  ],
);

/**
 * Price history - tracks every cost/price change for a product.
 * Used for "alert when cost rises and margin drops" feature.
 */
export const priceHistory = pgTable("price_history", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  variantId: uuid("variant_id").references(() => productVariants.id),
  previousCost: numeric("previous_cost", { precision: 12, scale: 2 }),
  newCost: numeric("new_cost", { precision: 12, scale: 2 }),
  previousPrice: numeric("previous_price", { precision: 12, scale: 2 }),
  newPrice: numeric("new_price", { precision: 12, scale: 2 }),
  changedBy: uuid("changed_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
