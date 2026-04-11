import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // In production, DATABASE_URL points to direct Postgres (port 5432).
    // drizzle-kit push needs direct connection for DDL operations.
    url:
      process.env.DATABASE_URL ??
      "postgresql://nova:nova@localhost:5432/nova",
  },
});
