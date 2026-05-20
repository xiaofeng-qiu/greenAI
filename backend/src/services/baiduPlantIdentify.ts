import { request } from "undici";

export type PlantIdentifyCandidate = {
  name: string;
  score: number;
  /** 百度百科链接（若百度返回） */
  baikeUrl?: string;
  /** 百科摘要片段 */
  baikeDescription?: string;
  /** 科属（接口 category 或百科摘要中的「XX科」） */
  taxonFamily?: string;
  /** 自建品种表或 LLM 推断的养护难度 */
  careDifficulty?: string;
  /** 自建品种表或 LLM 推断的养护要点摘要 */
  careSummary?: string;
  /** 从百科描述抽取的偏好 pH 下限（0..14） */
  phPreferredMin?: number;
  /** 从百科描述抽取的偏好 pH 上限（0..14） */
  phPreferredMax?: number;
};

/** 从百科文案中抽取「天南星科」这类科名（启发式，取句末最短的「…科」片段）。 */
export function extractTaxonFamilyFromText(
  text: string | undefined
): string | undefined {
  if (!text || typeof text !== "string") return undefined;
  const idx = text.lastIndexOf("科");
  if (idx <= 0) return undefined;
  for (let len = 12; len >= 3; len--) {
    const start = idx - len + 1;
    if (start < 0) continue;
    const s = text.slice(start, idx + 1);
    if (!/^[\u4e00-\u9fa5]+科$/.test(s)) continue;
    if (/^(常见|一种|某些|见)/.test(s)) continue;
    return s.slice(0, 32);
  }
  return undefined;
}

/**
 * 从百科描述里启发式抽取土壤 pH 偏好区间，返回 `{min,max}`（均在 0..14）。
 *
 * 优先级：
 *   1. 显式数值区间，例如「pH 5.5-6.5」「pH值 5.5~7.0」「pH 6 至 7」（支持 `-` / `~` / `～` / `–` / `—` / `至` / `到`）
 *   2. 显式单值阈值「pH ≤ 5.5」「pH 大于 7」 → 用 ±0.5 构造一个窄区间
 *   3. 定性词回退：「强酸性」/「酸性」/「微酸性」/「中性」/「微碱性」/「碱性」/「强碱性」 → 园艺常用粗粒区间
 *
 * 任一来源失败均返回 `undefined`，由调用方决定是否再走 LLM/默认值。
 */
export function extractPhPreferenceFromText(
  text: string | undefined
): { min: number; max: number } | undefined {
  if (!text || typeof text !== "string") return undefined;
  const lower = text.toLowerCase().replace(/ph\s*值/g, "ph");
  const NUM = "(\\d+(?:\\.\\d+)?)";
  const SEP = "\\s*(?:-|~|～|–|—|至|到)\\s*";
  // 1) 区间：pH 5.5-6.5
  const rangeRe = new RegExp(`ph[\\s:：约]*${NUM}${SEP}${NUM}`, "i");
  const m = lower.match(rangeRe);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const min = Math.min(a, b);
      const max = Math.max(a, b);
      if (min >= 0 && max <= 14 && max - min <= 6) {
        return { min, max };
      }
    }
  }
  // 2) 单点阈值：pH ≤ 5.5 / pH 大于 7 / pH 约 6.0
  const single = lower.match(
    new RegExp(
      `ph[\\s:：]*(?:(<=|>=|≤|≥|<|>|约|大于|小于)\\s*)?${NUM}`,
      "i"
    )
  );
  if (single) {
    const op = single[1];
    const v = Number(single[2]);
    if (Number.isFinite(v) && v >= 3 && v <= 11) {
      if (op === "<" || op === "<=" || op === "≤" || op === "小于") {
        return { min: Math.max(0, v - 1.5), max: v };
      }
      if (op === ">" || op === ">=" || op === "≥" || op === "大于") {
        return { min: v, max: Math.min(14, v + 1.5) };
      }
      // 「约 6.0」或无修饰：±0.5
      return { min: Math.max(0, v - 0.5), max: Math.min(14, v + 0.5) };
    }
  }
  // 3) 定性回退
  if (/强酸性/.test(text)) return { min: 4.0, max: 5.0 };
  if (/微酸性|偏酸性/.test(text)) return { min: 5.5, max: 6.5 };
  if (/酸性土|喜酸|耐酸/.test(text)) return { min: 4.5, max: 5.5 };
  if (/微碱性|偏碱性/.test(text)) return { min: 7.0, max: 7.8 };
  if (/强碱性/.test(text)) return { min: 8.0, max: 9.0 };
  if (/碱性土|喜碱|耐碱/.test(text)) return { min: 7.5, max: 8.5 };
  if (/中性土|喜中性/.test(text)) return { min: 6.5, max: 7.5 };
  return undefined;
}

type TokenCache = { token: string; expiresAtMs: number };
let tokenCache: TokenCache | null = null;

/** Test helper: clear in-memory token cache. */
export function resetBaiduPlantIdentifyCache(): void {
  tokenCache = null;
}

export async function getBaiduAccessToken(
  apiKey: string,
  secretKey: string
): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAtMs > now + 120_000) {
    return tokenCache.token;
  }
  const url = new URL("https://aip.baidubce.com/oauth/2.0/token");
  url.searchParams.set("grant_type", "client_credentials");
  url.searchParams.set("client_id", apiKey);
  url.searchParams.set("client_secret", secretKey);
  const res = await request(url, { method: "GET" });
  const body = (await res.body.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (res.statusCode !== 200 || !body.access_token) {
    throw new Error(
      `baidu_token_${res.statusCode}_${body.error ?? "unknown"}`
    );
  }
  const ttlSec = body.expires_in ?? 25 * 24 * 3600;
  tokenCache = {
    token: body.access_token,
    expiresAtMs: now + ttlSec * 1000,
  };
  return body.access_token;
}

/** Call Baidu 植物识别. `imageBase64` must be raw base64 (no data: URL prefix). */
export async function identifyPlantWithBaidu(input: {
  apiKey: string;
  secretKey: string;
  imageBase64: string;
}): Promise<PlantIdentifyCandidate[]> {
  const token = await getBaiduAccessToken(input.apiKey, input.secretKey);
  const url = new URL("https://aip.baidubce.com/rest/2.0/image-classify/v1/plant");
  url.searchParams.set("access_token", token);
  const form = new URLSearchParams();
  form.set("image", input.imageBase64);
  form.set("baike_num", "3");
  const res = await request(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: form.toString(),
  });
  const raw = (await res.body.json()) as {
    error_code?: number;
    error_msg?: string;
    result?: Array<{
      name?: string;
      score?: number;
      category?: string;
      baike_info?: { baike_url?: string; description?: string };
    }>;
  };
  if (raw.error_code != null && raw.error_code !== 0) {
    throw new Error(`baidu_plant_${raw.error_code}_${raw.error_msg ?? ""}`);
  }
  const list = Array.isArray(raw.result) ? raw.result : [];
  return list
    .filter((r) => typeof r.name === "string" && typeof r.score === "number")
    .map((r) => {
      const bk = r.baike_info;
      const fromDesc = extractTaxonFamilyFromText(bk?.description);
      const fromCat =
        typeof r.category === "string" && r.category.trim().length > 0
          ? r.category.trim().slice(0, 64)
          : undefined;
      const taxon = fromCat ?? fromDesc;
      const out: PlantIdentifyCandidate = {
        name: String(r.name),
        score: Number(r.score),
      };
      if (taxon) out.taxonFamily = taxon;
      if (bk && typeof bk.baike_url === "string" && bk.baike_url.length > 0) {
        out.baikeUrl = bk.baike_url;
      }
      if (bk && typeof bk.description === "string" && bk.description.length > 0) {
        out.baikeDescription = bk.description.slice(0, 800);
        const ph = extractPhPreferenceFromText(bk.description);
        if (ph) {
          out.phPreferredMin = ph.min;
          out.phPreferredMax = ph.max;
        }
      }
      return out;
    })
    .filter((r) => r.name.length > 0 && r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}
