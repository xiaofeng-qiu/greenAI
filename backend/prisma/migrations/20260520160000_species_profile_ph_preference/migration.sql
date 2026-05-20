-- Preferred soil pH range cached on SpeciesProfile; sourced from Baidu Baike
-- description heuristic (extractPhPreferenceFromText) or LLM inference.
ALTER TABLE "SpeciesProfile" ADD COLUMN IF NOT EXISTS "phPreferredMin" DOUBLE PRECISION;
ALTER TABLE "SpeciesProfile" ADD COLUMN IF NOT EXISTS "phPreferredMax" DOUBLE PRECISION;
