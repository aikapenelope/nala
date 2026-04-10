/**
 * Seed script for local development.
 *
 * Creates a sample business with an owner and employee.
 * Run with: npx tsx src/seed.ts
 */

import { createDb } from "./client";
import { businesses, users } from "./schema";

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

  // Create owner (would have a Clerk ID in production)
  const [owner] = await db
    .insert(users)
    .values({
      businessId: business.id,
      clerkId: "clerk_dev_owner_001",
      name: "Pedro Rodríguez",
      role: "owner",
      pinHash: "$2b$10$placeholder_owner_pin_hash", // PIN: 0000
      phone: "+58412-555-0001",
      whatsappEnabled: true,
    })
    .returning();

  console.log(`Created owner: ${owner.name}`);

  // Create employee
  const [employee] = await db
    .insert(users)
    .values({
      businessId: business.id,
      name: "María García",
      role: "employee",
      pinHash: "$2b$10$placeholder_employee_pin_hash", // PIN: 1234
    })
    .returning();

  console.log(`Created employee: ${employee.name}`);

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
