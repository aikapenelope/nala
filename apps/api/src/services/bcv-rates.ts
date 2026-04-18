/**
 * BCV (Banco Central de Venezuela) rate fetcher.
 *
 * Fetches the official BCV exchange rate from a public API.
 * The rate is used as the "tasa oficial" alongside the user's
 * manual rate (which may differ from BCV).
 *
 * Source: bcv-exchange-rates.vercel.app (open source scraper of bcv.org.ve)
 * Fallback: returns null if the API is unreachable (non-blocking).
 */

/** BCV API response shape. */
interface BcvApiResponse {
  error: boolean;
  data: {
    dolar: { value: string };
    euro: { value: string };
    effective_date: string;
  };
}

/** Parsed BCV rates. */
export interface BcvRates {
  usd: number;
  eur: number;
  date: string;
  source: "bcv";
}

/**
 * Fetch current BCV exchange rates.
 *
 * Returns null if the API is unreachable or returns an error.
 * The caller should fall back to the last known rate.
 */
export async function fetchBcvRates(): Promise<BcvRates | null> {
  try {
    const response = await fetch(
      "https://bcv-exchange-rates.vercel.app/get_bcv_exchange_rates",
      {
        signal: AbortSignal.timeout(10000),
        headers: { Accept: "application/json" },
      },
    );

    if (!response.ok) return null;

    const data = (await response.json()) as BcvApiResponse;
    if (data.error) return null;

    // BCV returns values with comma as decimal separator and spaces
    const parseRate = (val: string): number => {
      const cleaned = val.trim().replace(/\s/g, "").replace(",", ".");
      return Number(cleaned);
    };

    const usd = parseRate(data.data.dolar.value);
    const eur = parseRate(data.data.euro.value);

    if (isNaN(usd) || usd <= 0) return null;

    return {
      usd,
      eur: isNaN(eur) || eur <= 0 ? 0 : eur,
      date: data.data.effective_date,
      source: "bcv",
    };
  } catch {
    // Network error, timeout, or parse error -- non-blocking
    return null;
  }
}
