/**
 * PostgreSQL error handler for API routes.
 *
 * Translates Postgres error codes into user-friendly Spanish messages.
 * Used in catch blocks around DB transactions to avoid generic 500s.
 *
 * Common Postgres error codes:
 * - 23505: unique_violation (duplicate key)
 * - 23503: foreign_key_violation (referenced row doesn't exist)
 * - 23514: check_violation (value out of range)
 * - 23502: not_null_violation (required field missing)
 * - 40001: serialization_failure (concurrent transaction conflict)
 */

/** Postgres error shape from postgres.js / drizzle. */
interface PostgresError {
  code?: string;
  detail?: string;
  constraint?: string;
  column?: string;
  table?: string;
  message?: string;
}

/** Check if an error is a Postgres error with a code. */
function isPostgresError(err: unknown): err is PostgresError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as PostgresError).code === "string"
  );
}

/**
 * Translate a Postgres error into a user-friendly message and HTTP status.
 *
 * Returns null if the error is not a recognized Postgres error,
 * meaning the caller should fall through to a generic 500.
 */
export function handleDbError(err: unknown): {
  message: string;
  status: 400 | 409 | 500;
} | null {
  if (!isPostgresError(err)) return null;

  switch (err.code) {
    case "23505": {
      // unique_violation - extract useful info from detail
      const field = extractField(err.detail, err.constraint);
      return {
        message: field
          ? `Ya existe un registro con ese ${field}. Usa un valor diferente.`
          : "Este registro ya existe. Verifica los datos e intenta de nuevo.",
        status: 409,
      };
    }

    case "23503": {
      // foreign_key_violation - referenced record doesn't exist
      const ref = extractFkReference(err.detail, err.constraint);
      return {
        message: ref
          ? `${ref} no existe o fue eliminado.`
          : "Uno de los registros referenciados no existe.",
        status: 400,
      };
    }

    case "23514":
      // check_violation - value out of allowed range
      return {
        message: "Uno de los valores esta fuera del rango permitido.",
        status: 400,
      };

    case "23502": {
      // not_null_violation - required field missing
      const col = err.column ?? "desconocido";
      return {
        message: `El campo '${col}' es obligatorio.`,
        status: 400,
      };
    }

    case "40001":
      // serialization_failure - concurrent transaction conflict
      return {
        message:
          "Conflicto con otra operacion en curso. Intenta de nuevo en unos segundos.",
        status: 409,
      };

    default:
      return null;
  }
}

/** Extract a human-readable field name from Postgres detail/constraint. */
function extractField(
  detail?: string,
  constraint?: string,
): string | null {
  // detail looks like: Key (sku)=(ABC123) already exists.
  if (detail) {
    const match = detail.match(/Key \(([^)]+)\)/);
    if (match?.[1]) {
      return fieldLabel(match[1]);
    }
  }

  // Fall back to constraint name: idx_products_barcode -> barcode
  if (constraint) {
    const parts = constraint.split("_");
    const last = parts[parts.length - 1];
    if (last) return fieldLabel(last);
  }

  return null;
}

/** Extract a human-readable FK reference from Postgres detail. */
function extractFkReference(
  detail?: string,
  constraint?: string,
): string | null {
  // detail: Key (product_id)=(uuid) is not present in table "products".
  if (detail) {
    const tableMatch = detail.match(/table "([^"]+)"/);
    if (tableMatch?.[1]) {
      return tableLabel(tableMatch[1]);
    }
  }

  // constraint: sale_items_product_id_products_id_fk -> products
  if (constraint) {
    const parts = constraint.split("_");
    // Look for known table names in the constraint
    for (const table of [
      "products",
      "customers",
      "categories",
      "users",
      "sales",
      "businesses",
    ]) {
      if (parts.includes(table)) return tableLabel(table);
    }
  }

  return null;
}

/** Map DB column names to Spanish labels. */
function fieldLabel(column: string): string {
  const labels: Record<string, string> = {
    sku: "SKU",
    barcode: "codigo de barras",
    slug: "URL del negocio",
    email: "email",
    phone: "telefono",
    name: "nombre",
    clerk_id: "cuenta de Clerk",
  };
  return labels[column] ?? column;
}

/** Map DB table names to Spanish labels. */
function tableLabel(table: string): string {
  const labels: Record<string, string> = {
    products: "El producto",
    customers: "El cliente",
    categories: "La categoria",
    users: "El usuario",
    sales: "La venta",
    businesses: "El negocio",
  };
  return labels[table] ?? `El registro en ${table}`;
}
