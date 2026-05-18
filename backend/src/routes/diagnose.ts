import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  DIAGNOSE_SYMPTOM_IDS,
  diagnoseFromSymptoms,
  listSymptomCatalog,
  type DiagnoseSymptomId,
} from "../domain/diagnoseEngine.js";
import { authenticate } from "../lib/authGuard.js";

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

const diagnoseRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  app.get("/diagnose/catalog", async () => ({
    symptoms: listSymptomCatalog(),
  }));

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

    return diagnoseFromSymptoms(
      parsed.data.symptomIds as DiagnoseSymptomId[],
      env
    );
  });
};

export default diagnoseRoutes;
