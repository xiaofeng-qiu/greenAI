import type { PrismaClient } from "@prisma/client";
import { KnowledgeArticleStatus } from "@prisma/client";

export type KnowledgeArticleSummary = {
  slug: string;
  title: string;
  summary: string;
};

const publishedWhere = {
  status: KnowledgeArticleStatus.published,
  deletedAt: null,
} as const;

/** 去重、截断为小程序/诊断页列表用摘要。 */
export function dedupeArticleSummaries(
  rows: KnowledgeArticleSummary[],
  limit: number
): KnowledgeArticleSummary[] {
  const seen = new Set<string>();
  const out: KnowledgeArticleSummary[] = [];
  for (const r of rows) {
    if (!r.slug || seen.has(r.slug)) continue;
    seen.add(r.slug);
    out.push({
      slug: r.slug,
      title: r.title,
      summary: (r.summary || "").slice(0, 220),
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function listArticleSummariesBySymptomIds(
  prisma: PrismaClient,
  symptomIds: readonly string[],
  limit: number
): Promise<KnowledgeArticleSummary[]> {
  const ids = [...new Set(symptomIds.filter(Boolean))];
  if (!ids.length || limit <= 0) return [];
  const rows = await prisma.knowledgeArticle.findMany({
    where: {
      ...publishedWhere,
      symptomIds: { hasSome: ids },
    },
    select: { slug: true, title: true, summary: true },
    orderBy: [{ updatedAt: "desc" }],
    take: Math.min(60, limit * 4),
  });
  return dedupeArticleSummaries(rows, limit);
}

export async function listArticleSummariesBySpeciesNameKeys(
  prisma: PrismaClient,
  nameKeys: readonly string[],
  limit: number
): Promise<KnowledgeArticleSummary[]> {
  const keys = [...new Set(nameKeys.map((k) => k.trim()).filter(Boolean))];
  if (!keys.length || limit <= 0) return [];
  const rows = await prisma.knowledgeArticle.findMany({
    where: {
      ...publishedWhere,
      speciesNameKeys: { hasSome: keys },
    },
    select: { slug: true, title: true, summary: true },
    orderBy: [{ updatedAt: "desc" }],
    take: Math.min(40, limit * 3),
  });
  return dedupeArticleSummaries(rows, limit);
}

export async function listArticleSummariesForSymptomCatalog(
  prisma: PrismaClient
): Promise<Map<string, KnowledgeArticleSummary[]>> {
  const rows = await prisma.knowledgeArticle.findMany({
    where: { ...publishedWhere },
    select: { slug: true, title: true, summary: true, symptomIds: true },
  });
  const tagged = rows.filter((r) => r.symptomIds.length > 0);
  const map = new Map<string, KnowledgeArticleSummary[]>();
  const perSymptomLimit = 4;
  for (const r of tagged) {
    const sum: KnowledgeArticleSummary = {
      slug: r.slug,
      title: r.title,
      summary: r.summary,
    };
    for (const sid of r.symptomIds) {
      if (!sid) continue;
      const cur = map.get(sid) ?? [];
      if (cur.length >= perSymptomLimit) continue;
      if (cur.some((x) => x.slug === sum.slug)) continue;
      cur.push(sum);
      map.set(sid, cur);
    }
  }
  return map;
}
