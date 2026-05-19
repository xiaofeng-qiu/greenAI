import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { loadConfig, resolveDiagnoseLlmSettings } from "../config.js";
import {
  DIAGNOSE_DISCLAIMER,
  DIAGNOSE_LLM_EXTRA_DISCLAIMER,
  DIAGNOSE_SYMPTOM_IDS,
  diagnoseFromSymptoms,
  listSymptomCatalog,
  type DiagnoseSymptomId,
} from "../domain/diagnoseEngine.js";
import { authenticate } from "../lib/authGuard.js";
import { diagnosePlantWithVisionLlm } from "../services/diagnoseLlm.js";
import {
  listArticleSummariesBySymptomIds,
  listArticleSummariesForSymptomCatalog,
  type KnowledgeArticleSummary,
} from "../services/knowledgeArticleService.js";

const symptomIdSet = new Set<string>(DIAGNOSE_SYMPTOM_IDS);

const diagnoseBody = z.object({
  symptomIds: z
    .array(z.string())
    .min(1)
    .max(12)
    .refine(
      (ids) =>
        ids.length === new Set(ids).size &&
        ids.every((id) => symptomIdSet.has(id)),
      { message: "invalid_symptoms" }
    ),
  plantId: z.string().min(1).optional(),
});

const llmDiagnoseBody = z.object({
  imageBase64: z.string().min(80).max(8_000_000),
  userNote: z.string().max(2500).optional(),
  symptomIds: z.array(z.string()).max(12).optional(),
  plantId: z.string().min(1).optional(),
});

function symptomLabelsFromIds(
  ids: readonly DiagnoseSymptomId[],
  catalog: ReturnType<typeof listSymptomCatalog>
): string[] {
  const map = new Map(catalog.map((c) => [c.id, c.label] as const));
  return ids.map((id) => map.get(id) ?? id);
}

function validateOptionalSymptomIds(ids: string[] | undefined): boolean {
  if (!ids?.length) return true;
  if (ids.length !== new Set(ids).size) return false;
  return ids.every((id) => symptomIdSet.has(id));
}

const diagnoseRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  app.get("/diagnose/catalog", async () => {
    const cfg = loadConfig();
    const base = listSymptomCatalog();
    let bySymptom: Map<string, KnowledgeArticleSummary[]>;
    try {
      bySymptom = await listArticleSummariesForSymptomCatalog(app.prisma);
    } catch {
      bySymptom = new Map();
    }
    const symptoms = base.map((s) => ({
      ...s,
      relatedArticles: bySymptom.get(s.id) ?? [],
    }));
    return {
      symptoms,
      llmDiagnoseEnabled: resolveDiagnoseLlmSettings(cfg) !== null,
    };
  });

  app.post("/diagnose", async (req, reply) => {
    const parsed = diagnoseBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_body" });
    }

    let env: { indoor?: boolean | null; heating?: boolean | null } | null =
      null;
    if (parsed.data.plantId) {
      const plant = await app.prisma.plant.findFirst({
        where: { id: parsed.data.plantId, userId: req.userId! },
        select: { indoor: true, heating: true },
      });
      if (!plant) return reply.status(404).send({ error: "not_found" });
      env = { indoor: plant.indoor, heating: plant.heating };
    }

    const core = diagnoseFromSymptoms(
      parsed.data.symptomIds as DiagnoseSymptomId[],
      env
    );
    const relatedArticles = await listArticleSummariesBySymptomIds(
      app.prisma,
      parsed.data.symptomIds,
      10
    );
    return { ...core, relatedArticles };
  });

  app.post("/diagnose/llm", async (req, reply) => {
    const cfg = loadConfig();
    const llm = resolveDiagnoseLlmSettings(cfg);
    if (!llm) {
      return reply.status(503).send({ error: "diagnose_llm_disabled" });
    }

    const parsed = llmDiagnoseBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_body" });
    }
    if (!validateOptionalSymptomIds(parsed.data.symptomIds)) {
      return reply.status(400).send({ error: "invalid_symptoms" });
    }

    const catalog = listSymptomCatalog();
    const symptomIds = (parsed.data.symptomIds ?? []) as DiagnoseSymptomId[];
    const symptomLabels = symptomLabelsFromIds(symptomIds, catalog);

    let plantHint: string | null = null;
    if (parsed.data.plantId) {
      const plant = await app.prisma.plant.findFirst({
        where: { id: parsed.data.plantId, userId: req.userId! },
        select: {
          nickname: true,
          speciesLabel: true,
          indoor: true,
          heating: true,
          waterPreference: true,
          lightLevel: true,
          soilMoistureHint: true,
        },
      });
      if (!plant) return reply.status(404).send({ error: "not_found" });
      const parts = [
        `${plant.nickname}（品种描述：${plant.speciesLabel}）`,
        plant.indoor ? "摆放：室内" : "摆放：户外",
        plant.heating ? "环境：有供暖" : "环境：无供暖",
        `浇水偏好：${plant.waterPreference}，光照：${plant.lightLevel}`,
      ];
      if (plant.soilMoistureHint) {
        parts.push(`盆土干湿自评：${plant.soilMoistureHint}`);
      }
      plantHint = parts.join("；");
    }

    try {
      const diagnosis = await diagnosePlantWithVisionLlm({
        baseUrl: llm.baseUrl,
        apiKey: llm.apiKey,
        model: llm.model,
        imageBase64: parsed.data.imageBase64,
        userNote: parsed.data.userNote,
        symptomLabels: symptomLabels.length ? symptomLabels : undefined,
        plantHint,
      });
      const relatedArticles =
        symptomIds.length > 0
          ? await listArticleSummariesBySymptomIds(app.prisma, symptomIds, 8)
          : [];
      return {
        source: "llm" as const,
        diagnosis,
        disclaimer: `${DIAGNOSE_DISCLAIMER}\n${DIAGNOSE_LLM_EXTRA_DISCLAIMER}`,
        relatedArticles,
      };
    } catch (e) {
      req.log.warn({ err: String(e) }, "diagnose_llm_failed");
      return reply.status(502).send({ error: "diagnose_llm_upstream" });
    }
  });
};

export default diagnoseRoutes;
