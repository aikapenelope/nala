/**
 * Application configuration with strict validation.
 *
 * All required environment variables are validated at import time.
 * If any required variable is missing in production, the process exits
 * immediately with a clear error message.
 *
 * In development (NODE_ENV=development), missing variables are allowed
 * but logged as warnings. The API will still fail at the point of use
 * (e.g., auth middleware will reject requests without CLERK_SECRET_KEY).
 */

const NODE_ENV = process.env.NODE_ENV ?? "production";
const isDev = NODE_ENV === "development";

/** Required environment variables and their descriptions. */
const REQUIRED_VARS = {
  DATABASE_URL: "PostgreSQL connection string",
  CLERK_SECRET_KEY: "Clerk authentication secret key",
} as const;

/** Optional but recommended environment variables. */
const OPTIONAL_VARS = {
  REDIS_URL: "Redis connection string (exchange rate cache)",
  PORT: "API server port (default: 3001)",
} as const;

/**
 * Validate that all required environment variables are set.
 * In production, exits the process if any are missing.
 * In development, logs warnings but continues.
 */
function validateEnv(): void {
  const missing: string[] = [];

  for (const [key, description] of Object.entries(REQUIRED_VARS)) {
    if (!process.env[key]) {
      missing.push(`  ${key} - ${description}`);
    }
  }

  if (missing.length > 0) {
    const message = [
      "",
      "Missing required environment variables:",
      ...missing,
      "",
    ].join("\n");

    if (isDev) {
      console.warn(`[config] WARNING: ${message}`);
      console.warn(
        "[config] Running in development mode. Some features will not work.\n",
      );
    } else {
      console.error(`[config] FATAL: ${message}`);
      console.error(
        "[config] Set NODE_ENV=development to run without these variables.\n",
      );
      process.exit(1);
    }
  }

  // Log optional vars status
  for (const [key, description] of Object.entries(OPTIONAL_VARS)) {
    if (!process.env[key]) {
      console.warn(`[config] Optional: ${key} not set (${description})`);
    }
  }
}

// Run validation on import
validateEnv();

/**
 * Typed configuration object.
 * Access environment variables through this object for type safety.
 */
export const config = {
  nodeEnv: NODE_ENV,
  isDev,
  port: Number(process.env.PORT) || 3001,
  databaseUrl: process.env.DATABASE_URL ?? "",
  clerkSecretKey: process.env.CLERK_SECRET_KEY ?? "",
  redisUrl: process.env.REDIS_URL ?? "",
} as const;
