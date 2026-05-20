/**
 * Centralized structured logger for the Nova API.
 *
 * Emits one JSON object per line to stdout (info/debug/warn) or stderr
 * (error/fatal). This format is identical to what the structured-logger
 * middleware produces for HTTP requests, so Loki/Grafana can index all
 * logs uniformly by: level, ts, module, msg, and any extra fields.
 *
 * Usage:
 *   import { logger } from "./logger";
 *   logger.info("startup", "Database connected");
 *   logger.error("redis", "Connection failed", { error: err.message });
 *   logger.warn("storage", "Bucket not found", { bucket: "nova-media" });
 *
 * Configuration:
 *   LOG_LEVEL env var controls minimum level (default: "info").
 *   In development, set LOG_LEVEL=debug for verbose output.
 *
 * Design decisions:
 * - Zero dependencies: uses only process.stdout/stderr.write
 * - Matches structured-logger.ts output format for Loki consistency.
 * - Module field enables filtering in Grafana (e.g., module="storage").
 * - Extra fields are spread into the JSON object (flat, not nested).
 * - Errors go to stderr so Docker/Coolify can separate them if needed.
 */

type Level = "debug" | "info" | "warn" | "error" | "fatal";

const LEVEL_ORDER: Record<Level, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const MIN_LEVEL: Level = (process.env.LOG_LEVEL as Level) ?? "info";

function shouldLog(level: Level): boolean {
  return (LEVEL_ORDER[level] ?? 1) >= (LEVEL_ORDER[MIN_LEVEL] ?? 1);
}

function emit(
  level: Level,
  module: string,
  msg: string,
  extra?: Record<string, unknown>,
): void {
  if (!shouldLog(level)) return;

  const entry: Record<string, unknown> = {
    level,
    ts: new Date().toISOString(),
    module,
    msg,
  };

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      entry[key] = value;
    }
  }

  const line = JSON.stringify(entry) + "\n";
  const stream =
    level === "error" || level === "fatal" ? process.stderr : process.stdout;
  stream.write(line);
}

export const logger = {
  debug: (module: string, msg: string, extra?: Record<string, unknown>) =>
    emit("debug", module, msg, extra),
  info: (module: string, msg: string, extra?: Record<string, unknown>) =>
    emit("info", module, msg, extra),
  warn: (module: string, msg: string, extra?: Record<string, unknown>) =>
    emit("warn", module, msg, extra),
  error: (module: string, msg: string, extra?: Record<string, unknown>) =>
    emit("error", module, msg, extra),
  fatal: (module: string, msg: string, extra?: Record<string, unknown>) =>
    emit("fatal", module, msg, extra),
};
