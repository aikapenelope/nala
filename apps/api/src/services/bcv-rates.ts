/**
 * BCV (Banco Central de Venezuela) rate fetcher.
 *
 * Fetches the official BCV exchange rate from ve.dolarapi.com,
 * a reliable public API that aggregates Venezuelan exchange rates.
 *
 * The rate is informational -- the business's manual rate is what
 * gets used in actual sales. This just shows the official reference.
 *
 * Source: ve.dolarapi.com (stable, updated daily)
 * Fallback: returns null if the API is unreachable (non-blocking).
 */

/** ve.dolarapi.com response shape for a single currency. */
interface DolarApiEntry {
  moneda: string;
  fuente: string;
  nombre: string;
  promedio: number;
  fechaActualizacion: string;
}

/** Parsed BCV rates. */
export interface BcvRates {
  usd: number;
  eur: number;
  usdParalelo: number;
  date: string;
  source: "bcv";
}

/**
 * Fetch current BCV exchange rates (official + parallel).
 *
 * Returns null if the API is unreachable or returns an error.
 * The caller should fall back gracefully -- this is never blocking.
 */
export async function fetchBcvRates(): Promise<BcvRates | null> {
  try {
    // Fetch USD and EUR in parallel
    const [usdRes, eurRes] = await Promise.all([
      fetch("https://ve.dolarapi.com/v1/dolares", {
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "application/json" },
      }),
      fetch("https://ve.dolarapi.com/v1/euros", {
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "application/json" },
      }),
    ]);

    if (!usdRes.ok) return null;

    const usdData = (await usdRes.json()) as DolarApiEntry[];
    const eurData = eurRes.ok
      ? ((await eurRes.json()) as DolarApiEntry[])
      : [];

    const usdOficial = usdData.find((d) => d.fuente === "oficial");
    const usdParalelo = usdData.find((d) => d.fuente === "paralelo");
    const eurOficial = eurData.find((d) => d.fuente === "oficial");

    if (!usdOficial || !usdOficial.promedio || usdOficial.promedio <= 0) {
      return null;
    }

    return {
      usd: usdOficial.promedio,
      eur: eurOficial?.promedio ?? 0,
      usdParalelo: usdParalelo?.promedio ?? 0,
      date: usdOficial.fechaActualizacion,
      source: "bcv",
    };
  } catch {
    // Network error, timeout, or parse error -- non-blocking
    return null;
  }
}
