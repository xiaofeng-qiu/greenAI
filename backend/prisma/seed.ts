/**
 * 将 `miniprogram/data/knowledge.js` 同步到 DB（幂等 upsert）。
 * 运行：在 `backend` 目录执行 `npx prisma db seed`
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PrismaClient,
  KnowledgeArticleLayer,
  KnowledgeArticleStatus,
} from "@prisma/client";
import { normalizeSpeciesNameKey } from "../src/lib/speciesNameKey.js";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const prisma = new PrismaClient();

type RawArticle = {
  id: string;
  title: string;
  summary?: string;
  body?: string;
  coverTone?: number;
  sections?: unknown;
};

function layerForSlug(slug: string): KnowledgeArticleLayer {
  if (slug === "winter_care" || slug === "fertilize_basics") {
    return KnowledgeArticleLayer.environment;
  }
  return KnowledgeArticleLayer.species_guide;
}

const ARTICLE_TAGS: Record<
  string,
  { symptomIds: string[]; speciesNameKeys: string[] }
> = {
  epipremnum: {
    symptomIds: ["leaf_yellow_uniform", "leaf_brown_tips"],
    speciesNameKeys: [
      normalizeSpeciesNameKey("绿萝"),
      normalizeSpeciesNameKey("epipremnum"),
    ],
  },
  monstera: {
    symptomIds: ["leaf_brown_tips", "leaf_curl_deform"],
    speciesNameKeys: [normalizeSpeciesNameKey("龟背竹")],
  },
  succulent: {
    symptomIds: ["wilting_dry_soil", "leaf_spots_brown"],
    speciesNameKeys: [
      normalizeSpeciesNameKey("多肉植物"),
      normalizeSpeciesNameKey("多肉"),
    ],
  },
  peace_lily: {
    symptomIds: ["leaf_brown_tips", "wilting_dry_soil"],
    speciesNameKeys: [
      normalizeSpeciesNameKey("白掌"),
      normalizeSpeciesNameKey("一帆风顺"),
    ],
  },
  fertilize_basics: {
    symptomIds: ["growth_slow_pale"],
    speciesNameKeys: [],
  },
  winter_care: {
    symptomIds: ["leaf_brown_tips", "wilting_dry_soil"],
    speciesNameKeys: [],
  },
};

async function main() {
  const modPath = join(__dirname, "../../miniprogram/data/knowledge.js");
  const articles = require(modPath) as unknown;
  if (!Array.isArray(articles)) {
    throw new Error("knowledge.js must export an array");
  }
  const now = new Date();
  for (const a of articles as RawArticle[]) {
    if (!a?.id || !a.title) continue;
    const slug = String(a.id);
    const tags = ARTICLE_TAGS[slug] ?? {
      symptomIds: [] as string[],
      speciesNameKeys: [] as string[],
    };
    await prisma.knowledgeArticle.upsert({
      where: { slug },
      create: {
        slug,
        title: a.title,
        summary: a.summary ?? "",
        body: a.body ?? "",
        layer: layerForSlug(slug),
        status: KnowledgeArticleStatus.published,
        locale: "zh",
        coverTone: typeof a.coverTone === "number" ? a.coverTone : 0,
        sections: Array.isArray(a.sections) ? a.sections : undefined,
        symptomIds: tags.symptomIds,
        speciesNameKeys: tags.speciesNameKeys,
        disclaimerVersion: "kb-1",
        publishedAt: now,
      },
      update: {
        title: a.title,
        summary: a.summary ?? "",
        body: a.body ?? "",
        layer: layerForSlug(slug),
        status: KnowledgeArticleStatus.published,
        coverTone: typeof a.coverTone === "number" ? a.coverTone : 0,
        sections: Array.isArray(a.sections) ? a.sections : undefined,
        symptomIds: tags.symptomIds,
        speciesNameKeys: tags.speciesNameKeys,
        deletedAt: null,
        publishedAt: now,
      },
    });
  }
  console.log(`Seeded ${articles.length} knowledge articles.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
