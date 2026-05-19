import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

/** 小程序 `miniprogram/data/knowledge.js` 导出的文章条（与线上 DB 字段对齐的展示形态）。 */
export type StaticKnowledgeArticle = {
  id: string;
  title: string;
  summary?: string;
  body?: string;
  coverTone?: number;
  sections?: unknown;
};

export function loadStaticKnowledgeArticles(): StaticKnowledgeArticle[] {
  try {
    const modPath = join(__dirname, "../../../miniprogram/data/knowledge.js");
    const articles = require(modPath) as unknown;
    return Array.isArray(articles) ? (articles as StaticKnowledgeArticle[]) : [];
  } catch {
    return [];
  }
}
