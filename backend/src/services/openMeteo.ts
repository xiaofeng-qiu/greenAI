import { request } from "undici";

export type CurrentWeather = {
  temperatureC: number;
  relativeHumidity: number;
};

/** One calendar day in the user's timezone (Open-Meteo `daily` bucket). */
export type DailyForecastEntry = {
  date: string;
  tempMaxC: number;
  tempMinC: number;
  /** 0–100 when API returns it */
  precipitationProbabilityMax: number | null;
  /** Millimetres for the day */
  precipitationSumMm: number | null;
  /** WMO weather code when present */
  weatherCode: number | null;
};

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function fetchOpenMeteoCurrent(input: {
  latitude: number;
  longitude: number;
}): Promise<CurrentWeather> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(input.latitude));
  url.searchParams.set("longitude", String(input.longitude));
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m");

  const res = await request(url, { method: "GET" });
  if (res.statusCode !== 200) {
    throw new Error(`open_meteo_http_${res.statusCode}`);
  }
  const body = (await res.body.json()) as {
    current?: {
      temperature_2m?: number;
      relative_humidity_2m?: number;
    };
  };
  const t = body.current?.temperature_2m;
  const h = body.current?.relative_humidity_2m;
  if (typeof t !== "number" || typeof h !== "number") {
    throw new Error("open_meteo_invalid_payload");
  }
  return { temperatureC: t, relativeHumidity: h };
}

/**
 * Daily aggregates for the next N days (default 3), aligned to `timezone`
 * (e.g. user's IANA zone from settings).
 */
export async function fetchOpenMeteoDailyForecast(input: {
  latitude: number;
  longitude: number;
  timezone: string;
  forecastDays?: number;
}): Promise<DailyForecastEntry[]> {
  const n = Math.min(Math.max(input.forecastDays ?? 3, 1), 7);
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(input.latitude));
  url.searchParams.set("longitude", String(input.longitude));
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weathercode"
  );
  url.searchParams.set("timezone", input.timezone || "auto");
  url.searchParams.set("forecast_days", String(n));

  const res = await request(url, { method: "GET" });
  if (res.statusCode !== 200) {
    throw new Error(`open_meteo_http_${res.statusCode}`);
  }
  const body = (await res.body.json()) as {
    daily?: {
      time?: string[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_probability_max?: Array<number | null>;
      precipitation_sum?: Array<number | null>;
      weathercode?: Array<number | null>;
    };
  };
  const d = body.daily;
  const times = d?.time;
  if (!Array.isArray(times) || times.length === 0) {
    throw new Error("open_meteo_invalid_forecast");
  }
  const tMax = d?.temperature_2m_max ?? [];
  const tMin = d?.temperature_2m_min ?? [];
  const pProb = d?.precipitation_probability_max ?? [];
  const pSum = d?.precipitation_sum ?? [];
  const codes = d?.weathercode ?? [];

  const out: DailyForecastEntry[] = [];
  for (let i = 0; i < times.length; i++) {
    const date = times[i];
    if (typeof date !== "string") continue;
    const hi = tMax[i];
    const lo = tMin[i];
    if (typeof hi !== "number" || typeof lo !== "number") continue;
    out.push({
      date,
      tempMaxC: hi,
      tempMinC: lo,
      precipitationProbabilityMax: numOrNull(pProb[i]),
      precipitationSumMm: numOrNull(pSum[i]),
      weatherCode: numOrNull(codes[i]),
    });
  }
  if (out.length === 0) throw new Error("open_meteo_invalid_forecast");
  return out;
}
