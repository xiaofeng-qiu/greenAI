-- KnowledgeArticle: symptom + species tagging for search / diagnose / identify

ALTER TABLE "KnowledgeArticle" ADD COLUMN IF NOT EXISTS "symptomIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "KnowledgeArticle" ADD COLUMN IF NOT EXISTS "speciesNameKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS "KnowledgeArticle_symptomIds_idx" ON "KnowledgeArticle" USING GIN ("symptomIds");

CREATE INDEX IF NOT EXISTS "KnowledgeArticle_speciesNameKeys_idx" ON "KnowledgeArticle" USING GIN ("speciesNameKeys");
