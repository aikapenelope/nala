/**
 * Seed script for local development.
 *
 * Creates a sample business with an owner and employee.
 * Uses real bcrypt hashes so PIN auth works immediately.
 *
 * Run with: npx tsx src/seed.ts
 */

import { createDb } from "./client";
import { businesses, users, categories, accountingAccounts } from "./schema";

// bcryptjs is a dependency of @nova/api, not @nova/db.
// For the seed script, we use a pre-computed hash to avoid the dependency.
// These hashes were generated with bcrypt.hash(pin, 10).
const PIN_HASHES: Record<string, string> = {
  "0000": "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
  "1234": "$2a$10$YQ8HhvBRz5OaTIGYTYMT4.2rxSFBMP.kDJOiZE6OU/.VjEbMmx9V.",
};

async function seed() {
  const db = createDb();

  console.log("Seeding database...");

  // Create a sample business
  const [business] = await db
    .insert(businesses)
    .values({
      name: "Bodega Don Pedro",
      type: "bodega",
      phone: "+58412-555-0001",
      address: "Av. Principal, Los Teques, Miranda",
    })
    .returning();

  console.log(`Created business: ${business.name} (${business.id})`);

  // Create owner (PIN: 0000)
  const [owner] = await db
    .insert(users)
    .values({
      businessId: business.id,
      clerkId: "clerk_dev_owner_001",
      name: "Pedro Rodriguez",
      role: "owner",
      pinHash: PIN_HASHES["0000"],
      phone: "+58412-555-0001",
      whatsappEnabled: true,
    })
    .returning();

  console.log(`Created owner: ${owner.name} (PIN: 0000)`);

  // Create employee (PIN: 1234)
  const [employee] = await db
    .insert(users)
    .values({
      businessId: business.id,
      name: "Maria Garcia",
      role: "employee",
      pinHash: PIN_HASHES["1234"],
    })
    .returning();

  console.log(`Created employee: ${employee.name} (PIN: 1234)`);

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

  console.log("\nSeed complete. You can now log in with:");
  console.log("  Owner PIN: 0000");
  console.log("  Employee PIN: 1234");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
