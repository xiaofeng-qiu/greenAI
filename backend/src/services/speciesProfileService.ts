import { Prisma, type PrismaClient } from "@prisma/client";
import { SpeciesProfileSource } from "@prisma/client";
import type { DiagnoseLlmSettings } from "../config.js";
import { normalizeSpeciesNameKey } from "../lib/speciesNameKey.js";
import { inferSpeciesProfileWithLlm } from "./speciesProfileLlm.js";

/**
 * 先查自建品种表；未命中且配置了 LLM 时推断并写入，供后续识别复用。
 */
export async function findOrCreateSpeciesProfile(
  prisma: PrismaClient,
  input: {
    displayName: string;
    taxonFamilyHint?: string | null;
    baikeDescription?: string | null;
    /** 百科抽取得到的偏好 pH 下限（0..14） */
    phPreferredMinHint?: number | null;
    /** 百科抽取得到的偏好 pH 上限（0..14） */
    phPreferredMaxHint?: number | null;
  },
  llm: DiagnoseLlmSettings | null
): Promise<{
  profile: import("@prisma/client").SpeciesProfile | null;
  source: "cache" | "created" | "llm_disabled" | "llm_failed";
}> {
  const trimmed = input.displayName.trim();
  if (!trimmed) {
    return { profile: null, source: "llm_disabled" };
  }
  const nameKey = normalizeSpeciesNameKey(trimmed);

  const hit = await prisma.speciesProfile.findUnique({
    where: { nameKey },
  });
  if (hit) {
    return { profile: hit, source: "cache" };
  }

  if (!llm) {
    return { profile: null, source: "llm_disabled" };
  }

  let inferred;
  try {
    inferred = await inferSpeciesProfileWithLlm({
      baseUrl: llm.baseUrl,
      apiKey: llm.apiKey,
      model: llm.model,
      displayName: trimmed,
      taxonFamilyHint: input.taxonFamilyHint,
      baikeDescription: input.baikeDescription,
    });
  } catch {
    return { profile: null, source: "llm_failed" };
  }

  const taxonFamily =
    inferred.taxonFamily?.trim() ||
    (input.taxonFamilyHint?.trim() ?? null) ||
    null;

  // pH 优先用百科抽取 hint（硬事实），其次 LLM 推断；都没有则 null。
  const clampPh = (v: number | null | undefined): number | null => {
    if (v == null || !Number.isFinite(v)) return null;
    if (v < 0 || v > 14) return null;
    return v;
  };
  let phMin =
    clampPh(input.phPreferredMinHint) ?? clampPh(inferred.phPreferredMin);
  let phMax =
    clampPh(input.phPreferredMaxHint) ?? clampPh(inferred.phPreferredMax);
  if (phMin != null && phMax != null && phMin > phMax) {
    [phMin, phMax] = [phMax, phMin];
  }

  try {
    const created = await prisma.speciesProfile.create({
      data: {
        nameKey,
        displayName: trimmed.slice(0, 200),
        taxonFamily: taxonFamily ? taxonFamily.slice(0, 120) : null,
        careDifficulty: inferred.careDifficulty,
        careSummary: inferred.careSummary.slice(0, 2000),
        phPreferredMin: phMin,
        phPreferredMax: phMax,
        source: SpeciesProfileSource.llm,
      },
    });
    return { profile: created, source: "created" };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      const again = await prisma.speciesProfile.findUnique({
        where: { nameKey },
      });
      return { profile: again, source: "cache" };
    }
    throw e;
  }
}
