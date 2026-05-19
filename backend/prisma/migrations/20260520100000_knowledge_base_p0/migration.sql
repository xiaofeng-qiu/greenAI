-- CreateEnum
CREATE TYPE "KnowledgeArticleLayer" AS ENUM ('species_guide', 'pest_disease', 'environment');

-- CreateEnum
CREATE TYPE "KnowledgeArticleStatus" AS ENUM ('draft', 'published');

-- CreateTable
CREATE TABLE "KnowledgeArticle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "layer" "KnowledgeArticleLayer" NOT NULL DEFAULT 'species_guide',
    "status" "KnowledgeArticleStatus" NOT NULL DEFAULT 'draft',
    "locale" TEXT NOT NULL DEFAULT 'zh',
    "coverTone" INTEGER NOT NULL DEFAULT 0,
    "sections" JSONB,
    "disclaimerVersion" TEXT,
    "publishedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeArticle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeArticle_slug_key" ON "KnowledgeArticle"("slug");

CREATE INDEX "KnowledgeArticle_status_deletedAt_idx" ON "KnowledgeArticle"("status", "deletedAt");

-- CreateTable
CREATE TABLE "SpeciesAlias" (
    "id" TEXT NOT NULL,
    "speciesProfileId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'zh',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpeciesAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SpeciesAlias_speciesProfileId_alias_locale_key" ON "SpeciesAlias"("speciesProfileId", "alias", "locale");

CREATE INDEX "SpeciesAlias_alias_idx" ON "SpeciesAlias"("alias");

ALTER TABLE "SpeciesAlias" ADD CONSTRAINT "SpeciesAlias_speciesProfileId_fkey" FOREIGN KEY ("speciesProfileId") REFERENCES "SpeciesProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
