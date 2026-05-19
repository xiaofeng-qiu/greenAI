import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  KnowledgeArticleLayer,
  KnowledgeArticleStatus,
  type KnowledgeArticle,
} from "@prisma/client";
import { DIAGNOSE_SYMPTOM_IDS } from "../domain/diagnoseEngine.js";
import { loadStaticKnowledgeArticles } from "../services/knowledgeCatalog.js";
import {
  listArticleSummariesBySymptomIds,
  listArticleSummariesBySpeciesNameKeys,
} from "../services/knowledgeArticleService.js";
import { searchKnowledge } from "../services/knowledgeSearchService.js";

const symptomIdSet = new Set<string>(DIAGNOSE_SYMPTOM_IDS);

function mapDbArticleToClient(a: KnowledgeArticle) {
  return {
    id: a.slug,
    title: a.title,
    summary: a.summary,
    body: a.body,
    coverTone: a.coverTone,
    ...(a.sections != null && Array.isArray(a.sections)
      ? { sections: a.sections }
      : {}),
  };
}

function mapDbArticleToDetailClient(a: KnowledgeArticle) {
  return {
    ...mapDbArticleToClient(a),
    layer: a.layer,
    symptomIds: a.symptomIds,
    speciesNameKeys: a.speciesNameKeys,
  };
}

const searchQuerySchema = z.object({
  q: z.string().max(200).optional().default(""),
  limit: z.coerce.number().int().min(1).max(40).optional().default(20),
  layer: z
    .enum(["species_guide", "pest_disease", "environment", "all"])
    .optional()
    .default("all"),
});

const knowledgeRoutes: FastifyPluginAsync = async (app) => {
  app.get("/knowledge/search", async (req, reply) => {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_query" });
    }
    const { q, limit, layer } = parsed.data;
    const layerFilter =
      layer === "all" ? undefined : (layer as KnowledgeArticleLayer);
    const result = await searchKnowledge(app.prisma, q, {
      limit,
      layer: layerFilter,
    });
    return result;
  });

  app.get("/knowledge/by-symptom/:symptomId", async (req, reply) => {
    const symptomId = decodeURIComponent(
      (req.params as { symptomId: string }).symptomId || ""
    ).trim();
    if (!symptomId || !symptomIdSet.has(symptomId)) {
      return reply.status(400).send({ error: "invalid_symptom" });
    }
    const articles = await listArticleSummariesBySymptomIds(
      app.prisma,
      [symptomId],
      16
    );
    return { symptomId, articles };
  });

  app.get("/knowledge/species/:nameKey", async (req, reply) => {
    const nameKey = decodeURIComponent(
      (req.params as { nameKey: string }).nameKey || ""
    ).trim();
    if (!nameKey) {
      return reply.status(400).send({ error: "invalid_name_key" });
    }
    const profile = await app.prisma.speciesProfile.findUnique({
      where: { nameKey },
      include: { aliases: true },
    });
    if (!profile) {
      return reply.status(404).send({ error: "not_found" });
    }
    const relatedArticles = await listArticleSummariesBySpeciesNameKeys(
      app.prisma,
      [nameKey],
      12
    );
    return { ...profile, relatedArticles };
  });

  app.get("/knowledge/articles/:slug", async (req, reply) => {
    const slug = decodeURIComponent(
      (req.params as { slug: string }).slug || ""
    ).trim();
    if (!slug) {
      return reply.status(400).send({ error: "invalid_slug" });
    }
    const row = await app.prisma.knowledgeArticle.findFirst({
      where: {
        slug,
        status: KnowledgeArticleStatus.published,
        deletedAt: null,
      },
    });
    if (row) {
      return mapDbArticleToDetailClient(row);
    }
    const staticList = loadStaticKnowledgeArticles();
    const hit = staticList.find((x) => x.id === slug);
    if (!hit) {
      return reply.status(404).send({ error: "not_found" });
    }
    return {
      id: hit.id,
      title: hit.title,
      summary: hit.summary ?? "",
      body: hit.body ?? "",
      coverTone: typeof hit.coverTone === "number" ? hit.coverTone : 0,
      ...(hit.sections != null ? { sections: hit.sections } : {}),
      layer: KnowledgeArticleLayer.species_guide,
      symptomIds: [] as string[],
      speciesNameKeys: [] as string[],
    };
  });

  app.get("/knowledge/articles", async (_req, reply) => {
    const count = await app.prisma.knowledgeArticle.count({
      where: {
        status: KnowledgeArticleStatus.published,
        deletedAt: null,
      },
    });
    if (count > 0) {
      const rows = await app.prisma.knowledgeArticle.findMany({
        where: {
          status: KnowledgeArticleStatus.published,
          deletedAt: null,
        },
        orderBy: { title: "asc" },
      });
      return rows.map(mapDbArticleToClient);
    }
    try {
      const articles = loadStaticKnowledgeArticles();
      if (!articles.length) {
        return reply.status(500).send({ error: "knowledge_invalid" });
      }
      return articles;
    } catch {
      return reply.status(500).send({ error: "knowledge_load_failed" });
    }
  });
};

export default knowledgeRoutes;
