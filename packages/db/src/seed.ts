/**
 * Seed script for local development.
 *
 * Creates a sample business with a single owner user.
 *
 * Run with: npx tsx src/seed.ts
 */

import { createDb } from "./client";
import {
  businesses,
  users,
  categories,
  accountingAccounts,
  storeSettings,
} from "./schema";

async function seed() {
  const db = createDb();

  console.log("Seeding database...");

  // Create a sample business (slug required for public catalog)
  const [business] = await db
    .insert(businesses)
    .values({
      name: "Bodega Don Pedro",
      type: "bodega",
      phone: "+58412-555-0001",
      address: "Av. Principal, Los Teques, Miranda",
      slug: "bodega-don-pedro",
      whatsappNumber: "+584125550001",
    })
    .returning();

  console.log(`Created business: ${business.name} (${business.id})`);

  // Create owner
  const [owner] = await db
    .insert(users)
    .values({
      businessId: business.id,
      clerkId: "clerk_dev_owner_001",
      name: "Pedro Rodriguez",
      role: "owner",
      phone: "+58412-555-0001",
      whatsappEnabled: true,
    })
    .returning();

  console.log(`Created owner: ${owner.name}`);

  // Create default categories for bodega
  const categoryNames = [
    "Abarrotes",
    "Lacteos",
    "Bebidas",
    "Limpieza",
    "Cuidado personal",
    "Snacks",
    "Otros",
  ];

  await db.insert(categories).values(
    categoryNames.map((name, idx) => ({
      businessId: business.id,
      name,
      sortOrder: idx,
    })),
  );

  console.log(`Created ${categoryNames.length} categories`);

  // Create default accounting chart
  const accounts = [
    { code: "1101", name: "Caja (Efectivo)", type: "asset" },
    { code: "1102", name: "Bancos", type: "asset" },
    { code: "1103", name: "Cuentas por cobrar", type: "asset" },
    { code: "1104", name: "Inventario", type: "asset" },
    { code: "2101", name: "Cuentas por pagar", type: "liability" },
    { code: "4101", name: "Ventas", type: "revenue" },
    { code: "5101", name: "Costo de ventas", type: "expense" },
    { code: "5201", name: "Gastos operativos", type: "expense" },
  ];

  await db.insert(accountingAccounts).values(
    accounts.map((acc) => ({
      businessId: business.id,
      code: acc.code,
      name: acc.name,
      type: acc.type,
    })),
  );

  console.log(`Created ${accounts.length} accounting accounts`);

  // Create store settings with example payment methods
  await db.insert(storeSettings).values({
    businessId: business.id,
    storeEnabled: true,
    paymentMethods: [
      {
        method: "pago_movil",
        label: "Pago Movil",
        details: {
          bank: "Banesco",
          phone: "0412-555-0001",
          ci: "V-12345678",
        },
      },
      {
        method: "binance",
        label: "Binance Pay",
        details: { payId: "pedro_bodega" },
      },
    ],
    deliveryEnabled: true,
    deliveryFee: "2.00",
    deliveryZones: "Los Teques y alrededores",
    welcomeMessage: "Bienvenido a Bodega Don Pedro. Haz tu pedido online!",
    minOrderAmount: "5.00",
  });

  console.log("Created store settings");

  console.log("\nSeed complete.");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
