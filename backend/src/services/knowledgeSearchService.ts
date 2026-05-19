import type { Prisma, PrismaClient } from "@prisma/client";
import {
  KnowledgeArticleLayer,
  KnowledgeArticleStatus,
} from "@prisma/client";
import { listSymptomCatalog } from "../domain/diagnoseEngine.js";
import { normalizeSpeciesNameKey } from "../lib/speciesNameKey.js";

export type KnowledgeSearchSpeciesHit = {
  id: string;
  nameKey: string;
  title: string;
  snippet: string;
  score: number;
  matchField: "nameKey" | "displayName" | "alias";
};

export type KnowledgeSearchArticleHit = {
  id: string;
  slug: string;
  title: string;
  snippet: string;
  layer: KnowledgeArticleLayer;
  score: number;
};

export type KnowledgeSearchSymptomHit = {
  id: string;
  label: string;
  group: string;
  score: number;
};

export type KnowledgeSearchResult = {
  query: string;
  interpretation: {
    tokens: string[];
    layersTouched: ("species" | "pest_disease" | "environment")[];
  };
  buckets: {
    species: KnowledgeSearchSpeciesHit[];
    articles: KnowledgeSearchArticleHit[];
    symptoms: KnowledgeSearchSymptomHit[];
  };
  suggestedActions: string[];
};

const SPLIT_RE = /[\s,，.。!！?？/、]+/;

/** 供测试与搜索复用：拆出有效 token（含单字中文）。 */
export function tokenizeKnowledgeQuery(raw: string): string[] {
  const q = raw.trim();
  if (!q) return [];
  const fromSplit = q
    .split(SPLIT_RE)
    .map((t) => t.trim())
    .filter(Boolean);
  const set = new Set<string>([q, ...fromSplit]);
  return [...set];
}

function snippetAround(haystack: string, needle: string, maxLen: number): string {
  const h = haystack.trim();
  if (!h) return "";
  const lower = h.toLowerCase();
  const n = needle.toLowerCase();
  const idx = lower.indexOf(n);
  if (idx < 0) return h.slice(0, maxLen);
  const pad = 24;
  const start = Math.max(0, idx - pad);
  const end = Math.min(h.length, idx + needle.length + pad);
  let s = h.slice(start, end);
  if (start > 0) s = "…" + s;
  if (end < h.length) s = s + "…";
  return s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
}

function scoreTextFields(
  title: string,
  summary: string,
  body: string,
  slug: string,
  q: string,
  tokens: string[]
): { score: number; matched: boolean } {
  const norm = (s: string) => s.trim().toLowerCase();
  const t = norm(title);
  const s = norm(summary);
  const b = norm(body);
  const slugN = norm(slug);
  const qn = norm(q);
  let score = 0;
  let matched = false;

  if (qn && slugN === norm(qn)) {
    score += 22;
    matched = true;
  }
  if (qn && t.includes(qn)) {
    score += 14;
    matched = true;
  }
  if (qn && s.includes(qn)) {
    score += 6;
    matched = true;
  }
  if (qn && b.includes(qn)) {
    score += 3;
    matched = true;
  }

  for (const tok of tokens) {
    if (!tok || tok === q) continue;
    const tn = norm(tok);
    if (tn.length < 1) continue;
    if (t.includes(tn)) {
      score += 4;
      matched = true;
    } else if (s.includes(tn)) {
      score += 2;
      matched = true;
    } else if (b.includes(tn)) {
      score += 1;
      matched = true;
    }
  }

  return { score, matched };
}

function layerToSearchLayer(
  layer: KnowledgeArticleLayer
): "species" | "pest_disease" | "environment" {
  switch (layer) {
    case KnowledgeArticleLayer.pest_disease:
      return "pest_disease";
    case KnowledgeArticleLayer.environment:
      return "environment";
    default:
      return "species";
  }
}

export async function searchKnowledge(
  prisma: PrismaClient,
  rawQuery: string,
  options?: { limit?: number; layer?: KnowledgeArticleLayer }
): Promise<KnowledgeSearchResult> {
  const query = rawQuery.trim();
  const limit = Math.min(40, Math.max(1, options?.limit ?? 20));
  const tokens = tokenizeKnowledgeQuery(query);
  const nameKeyExact =
    query.length > 0 ? normalizeSpeciesNameKey(query) : "";

  const layersTouched = new Set<
    "species" | "pest_disease" | "environment"
  >();

  const speciesOut: KnowledgeSearchSpeciesHit[] = [];
  const articlesOut: KnowledgeSearchArticleHit[] = [];
  const symptomsOut: KnowledgeSearchSymptomHit[] = [];

  if (query.length > 0) {
    const speciesRows = await prisma.speciesProfile.findMany({
      where: {
        OR: [
          { nameKey: nameKeyExact },
          { displayName: { contains: query } },
          { aliases: { some: { alias: { contains: query } } } },
        ],
      },
      include: { aliases: true },
      take: limit,
    });

    for (const sp of speciesRows) {
      let score = 0;
      let matchField: KnowledgeSearchSpeciesHit["matchField"] = "displayName";
      if (sp.nameKey === nameKeyExact && query.length > 0) {
        score = 50;
        matchField = "nameKey";
      } else if (
        sp.displayName.includes(query) ||
        normalizeSpeciesNameKey(sp.displayName) === nameKeyExact
      ) {
        score = 28;
        matchField = "displayName";
      } else {
        score = 18;
        matchField = "alias";
      }
      const snippet =
        sp.careSummary?.trim().slice(0, 160) ||
        sp.displayName ||
        sp.nameKey;
      speciesOut.push({
        id: sp.id,
        nameKey: sp.nameKey,
        title: sp.displayName,
        snippet,
        score,
        matchField,
      });
      layersTouched.add("species");
    }
    speciesOut.sort((a, b) => b.score - a.score);

    const layerWhere: Prisma.KnowledgeArticleWhereInput = options?.layer
      ? { layer: options.layer }
      : {};

    const textOrSpeciesKey: Prisma.KnowledgeArticleWhereInput[] = [
      { title: { contains: query } },
      { summary: { contains: query } },
      { body: { contains: query } },
      { slug: { contains: query } },
      ...tokens
        .filter((t) => t.length >= 2)
        .slice(0, 8)
        .flatMap((t) => [
          { title: { contains: t } },
          { summary: { contains: t } },
        ]),
    ];
    if (nameKeyExact) {
      textOrSpeciesKey.push({ speciesNameKeys: { has: nameKeyExact } });
    }

    const dbArticles = await prisma.knowledgeArticle.findMany({
      where: {
        status: KnowledgeArticleStatus.published,
        deletedAt: null,
        ...layerWhere,
        OR: textOrSpeciesKey,
      },
      take: limit * 2,
      orderBy: { updatedAt: "desc" },
    });

    const seenSlug = new Set<string>();
    const scored: KnowledgeSearchArticleHit[] = [];
    for (const a of dbArticles) {
      if (seenSlug.has(a.slug)) continue;
      const { score: baseScore, matched: baseMatched } = scoreTextFields(
        a.title,
        a.summary,
        a.body,
        a.slug,
        query,
        tokens
      );
      let score = baseScore;
      let matched = baseMatched;
      if (nameKeyExact && a.speciesNameKeys.includes(nameKeyExact)) {
        score += 26;
        matched = true;
      }
      if (!matched) continue;
      seenSlug.add(a.slug);
      const searchLayer = layerToSearchLayer(a.layer);
      layersTouched.add(searchLayer);
      const hay = `${a.title}\n${a.summary}\n${a.body}`;
      scored.push({
        id: a.id,
        slug: a.slug,
        title: a.title,
        snippet: snippetAround(hay, query || tokens[0] || "", 140),
        layer: a.layer,
        score,
      });
    }
    scored.sort((x, y) => y.score - x.score);
    articlesOut.push(...scored.slice(0, limit));

    const catalog = listSymptomCatalog();
    for (const item of catalog) {
      const label = item.label;
      let sc = 0;
      if (query && label.includes(query)) sc += 20;
      for (const tok of tokens) {
        if (tok.length >= 2 && label.includes(tok)) sc += 6;
      }
      if (sc > 0) {
        symptomsOut.push({
          id: item.id,
          label: item.label,
          group: item.group,
          score: sc,
        });
        layersTouched.add("pest_disease");
      }
    }
    symptomsOut.sort((a, b) => b.score - a.score);
    if (symptomsOut.length > limit) symptomsOut.length = limit;
  }

  const suggestedActions: string[] = [];
  if (symptomsOut.length > 0) {
    suggestedActions.push("open_diagnose_with_symptoms");
  }
  if (speciesOut.length > 0 || articlesOut.length > 0) {
    suggestedActions.push("open_species_or_article");
  }

  return {
    query,
    interpretation: {
      tokens,
      layersTouched: [...layersTouched],
    },
    buckets: {
      species: speciesOut.slice(0, limit),
      articles: articlesOut,
      symptoms: symptomsOut,
    },
    suggestedActions,
  };
}
