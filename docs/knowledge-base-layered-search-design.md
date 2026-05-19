# 知识库设计：分层品种 / 病害 / 环境库 + 搜索体系

> 版本：2026-05-19  
> 状态：设计稿（与当前仓库 `SpeciesProfile`、`diagnoseEngine`、`miniprogram/data/knowledge.js`、`GET /knowledge/articles` 对齐并规划演进）  
> 数据来源与治理：[知识库：数据来源与进库治理](./knowledge-base-data-sourcing.md)

---

## 1. 目标与非目标

### 1.1 目标

- **分层**：品种、病害虫害、环境与养护语境三类知识**边界清晰**，可独立迭代，又能**交叉引用**（例如某品种易感病害、某症状在干燥环境下的优先解释）。
- **搜索**：同一套「入口体验」下支持**别名/俗名**、**全文**、**结构化过滤**（科属、难度、季节、室内外），并为后续 **向量语义检索** 预留扩展点。
- **与产品闭环一致**：识别建档、今日任务、诊断 triage、百科外链、LLM 推断**有明确的数据落点与降级路径**。

### 1.2 非目标（本阶段可明确砍掉）

- 不做「可替代植保站/实验室」的**确诊级**病虫害库（保留免责声明与规则/LLM 辅助定位）。
- 不要求第一天就上**重 CMS**；允许「DB + 简单管理接口 / 脚本导入」起步。
- 不强制**多语言**；先中文主库，字段预留 `locale` 即可。

---

## 2. 概念分层（逻辑架构）

```
                    ┌─────────────────────────────────────┐
                    │         搜索与编排层 (Search)        │
                    │  查询解析 → 多索引召回 → 融合排序      │
                    └─────────────────┬───────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
┌───────────────┐             ┌───────────────┐             ┌───────────────┐
│ L1 品种库      │             │ L2 病害/虫害库 │             │ L3 环境/语境库 │
│ Taxon / 俗名   │◄──关联────►│ 症状/病原/防治 │◄──关联────►│ 区域/季节/场景 │
│ 养护要点       │             │ 规则与词条     │             │ 与引擎参数对齐 │
└───────────────┘             └───────────────┘             └───────────────┘
        │                             │                             │
        └─────────────────────────────┴─────────────────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │ L0 可选：规范层（Taxon ID / 外部 ID） │
                    │  Wikipedia / POWO / 国标 仅作映射   │
                    └───────────────────────────────────┘
```

### 2.1 L1 品种库（已有基础：`SpeciesProfile`）

**职责**：回答「**这是什么植物、难不难养、要点是什么**」。

**建议演进字段（设计级，非立即实现清单）**：

| 维度 | 说明 |
|------|------|
| 身份 | `nameKey`（已有）、`displayName`（已有）、**别名表** `SpeciesAlias(nameKey, alias, locale)` |
| 分类 | `taxonFamily`（已有）；可选 `taxonGenus`、外部 `externalRefs[]` |
| 养护摘要 | `careDifficulty`、`careSummary`（已有）；可选结构化标签：`lightNeed`、`waterNeed`（枚举或 1–5） |
| 来源与质量 | `source`（已有）；`confidence`、`reviewedAt`、`contentHash`（防 LLM 漂移重复写） |
| 关系 | **多对多** → L2「常见病虫害」关联表；**多对多** → L3「推荐环境区间」 |

**写入策略（与现有一致）**：先查 `nameKey` → 未命中再 LLM → 落库；人工审核后可 `source=manual` 锁定关键字段。

### 2.2 L2 病害 / 虫害 / 生理障碍库

**职责**：回答「**症状可能是什么、先做什么、何时就医/找专家**」。

**与现有代码对齐**：

- 今日 MVP：`diagnoseEngine` 的 **`DiagnoseSymptomId` 目录** + **规则集 → `DiagnoseCause`** 是「**可检索的症状面**」。
- 知识库层建议把「**词条正文**」从代码/静态 JSON 中**逐步迁出**到 DB 或独立文档存储，但 **symptom id** 保持**稳定 API**（小程序与后端契约）。

**建议实体**：

| 实体 | 用途 |
|------|------|
| `SymptomNode` | `id` 与 `diagnoseEngine` 对齐；`group`、`label`、`sortOrder` |
| `PestDiseaseArticle` | 一篇可读词条：`slug`、`title`、`summary`、`bodyMd`、`severityHint`、`disclaimerVersion` |
| `SymptomArticleMap` | 多对多：某症状入口关联多篇深度文（主从、优先级） |
| `SpeciesPestSusceptibility` | 可选：品种 × 词条权重（「绿萝常见 X」）供搜索加权 |

**类型维度**（便于过滤）：`kind`: `fungal` | `bacterial` | `viral` | `pest` | `physiological` | `cultural`。

### 2.3 L3 环境 / 语境库

**职责**：回答「**在什么气候/季节/室内条件下，养护建议与风险提示如何变化**」。

**与现有引擎对齐**：

- `PlantEnv`（室内、暖气、光照、盆土自报、窗台朝向、空调、跳过 streak）与 **`careEngine` 间隔乘子** —— L3 应能**引用**这些枚举或文档化「含义」，避免文档与代码漂移两套真理。
- `WeatherSnapshot` / 预报 bias —— L3 可提供「**华东梅雨季**」「**北方暖气房**」等**人类可读块**，后端用 `regionTag` 或 `climateZone` 与天气服务 loosely 耦合。

**建议实体**：

| 实体 | 用途 |
|------|------|
| `CareContextArticle` | 场景文：`slug`、`title`、`bodyMd`、`tags[]`（如 `heating_indoor`, `meiyu`, `south_window`） |
| `RegionProfile` | 可选：省/市粗粒度默认建议（与 `userWeather` 缓存键策略协调） |

**原则**：L3 **不重复实现** care 公式；只存**解释性内容**与**标签**，公式仍在 `careEngine`。

### 2.4 L0 规范层（可选）

- **外部分类 ID**（如 COL、GBIF）仅存映射表：`SpeciesProfile.id` ↔ `externalTaxonId`。
- **不在 MVP 强依赖**：识别链仍以百度/俗名 + `nameKey` 为主。

---

## 3. 数据模型要点（PostgreSQL / Prisma 方向）

- **全文**：`title`、`summary`、`body` 使用 `tsvector`（中文需 `zh_CN` 配置或插件）或先用 **`pg_trgm` + `ILIKE`** 降低首版成本。
- **别名**：单独表，避免 `displayName` 爆炸；搜索时 **nameKey OR 任意 alias hit**。
- **版本**：词条 `version`、`publishedAt`；搜索默认只查 `status=published`。
- **软删**：`deletedAt`，避免历史链接 404。

索引建议（实现阶段）：

- `SpeciesProfile(nameKey)` — 已有 unique。
- `SpeciesAlias(lower(alias))` btree 或 trigram。
- `PestDiseaseArticle` GIN on `to_tsvector('simple', title || ' ' || coalesce(summary,''))`（中文分词方案确定后再换 `zhparser` 等）。

---

## 4. 搜索体系设计

### 4.1 统一查询模型

**用户输入**：单行 `q`（自然语言或关键词）+ 可选 `filters`。

**响应结构**（建议）：

```json
{
  "query": "绿萝 叶尖发黄",
  "interpretation": {
    "tokens": ["绿萝", "叶尖", "发黄"],
    "layersTouched": ["species", "pest_disease"]
  },
  "buckets": {
    "species": [{ "id", "title", "snippet", "score", "matchField" }],
    "articles": [{ "id", "slug", "title", "snippet", "layer", "score" }],
    "symptoms": [{ "id", "label", "group", "score" }]
  },
  "suggestedActions": ["open_diagnose_with_symptoms", "open_species"]
}
```

### 4.2 分层召回策略（多路合并）

| 通道 | 适用层 | 做法 |
|------|--------|------|
| A 精确键 | L1 | `normalizeSpeciesNameKey(q)` → `SpeciesProfile` / `SpeciesAlias` |
| B 关键词全文 | L1/L2/L3 | PostgreSQL FTS 或 trigram `title/summary/body` |
| C 症状词典 | L2 | `q` 与 `SymptomNode.label` 做包含/分词匹配 → 返回 symptom id 供跳转诊断 |
| D 结构化过滤 | 全部 | `filters.difficulty`、`filters.taxonFamily`、`filters.kind` |

**融合排序（初版可解释、可调参）**：

1. 精确 `nameKey` / `alias` 命中 **置顶**。
2. 标题命中 > 摘要 > 正文。
3. **物种词条**在「用户已有该品种植物」上下文（若带 `userId`）加权（需登录态接口）。
4. 同分按 `updatedAt` / 人工 `boost` 字段。

### 4.3 API 形态（建议）

- `GET /knowledge/search?q=&limit=&layer=` — `layer`：`species_guide` | `pest_disease` | `environment` | `all`（默认 `all`）；联合 `SpeciesProfile` / 别名、全文与 **`speciesNameKeys`**。
- `GET /knowledge/species/:nameKey` — 品种详情（含 `aliases`）；响应含 **`relatedArticles`**（`speciesNameKeys` 命中）。
- `GET /knowledge/articles/:slug` — 单篇；DB 命中时含 **`layer` / `symptomIds` / `speciesNameKeys`**。
- `GET /knowledge/by-symptom/:symptomId` — 按稳定症状 id 返回关联词条摘要。
- `GET /diagnose/catalog` — 症状目录；每条含可选 **`relatedArticles`**（与 `symptomIds` 对齐）。

**鉴权**：搜索与单篇可读可 **公开只读**；写接口 **管理员或内网**。

### 4.4 客户端（小程序）

- **短期**：保留 `knowledge.js` + `bestKnowledgeMatch` 作离线兜底；在线时调 `GET /knowledge/search`。
- **长期**：包体只带 symptom 枚举与少量兜底文案，正文走 CDN/接口缓存。

### 4.5 向量检索（可选 P2）

- 字段：`embedding vector(1536)`（模型变更时版本列 `embeddingModel`）。
- 用途：`q` 与 `summary` 语义近但字面不同（「叶子焦边」≈「叶尖褐色」）。
- **混合检索**：`final = α * keywordScore + (1-α) * cosineSimilarity`，α 可配置。

---

## 5. 与现有模块的集成点

| 模块 | 集成方式 |
|------|----------|
| `POST /plants/identify` | 返回 **`relatedArticles`**（`speciesNameKeys` 命中 `normalizeSpeciesNameKey(识别名)`） |
| `plant-edit` | 识别结果优先 **`relatedArticles`**；在线时用 **`/knowledge/search`** 防抖增强「查看养护知识」链接 |
| `POST /diagnose` | 症状 id 不变；响应含 **`relatedArticles`**（`symptomIds` 命中） |
| `GET /knowledge/articles` | 迁移期：DB 空则 **fallback** 读 `miniprogram/data/knowledge.js`（与现 `knowledge.ts` 行为一致） |

---

## 6. 内容生产与治理

- **LLM**：仅作 **初稿** 或「缺条时的生成」，写入 `draft`；**发布**需人工或规则校验（长度、禁用医疗承诺词、免责声明版本号）。
- **冲突**：同一 `nameKey` 以 `manual` 覆盖 LLM 字段策略（已有 `source` 枚举可扩展 `curated`）。
- **审计**：`KnowledgeEditLog(actor, entity, diff, at)`。

---

## 7. 迭代路线（建议）

| 阶段 | 内容 |
|------|------|
| P0 | DB 化当前 `knowledge.js` 文章；`GET /knowledge/search` 关键词 + `SpeciesProfile`/`SpeciesAlias` 联合；小程序一条入口 | **已实现骨架**：`KnowledgeArticle` + `SpeciesAlias` 迁移与 seed；`/knowledge/search`、`/knowledge/articles/:slug`、`/knowledge/species/:nameKey`；列表 DB 优先否则静态；发现页远程搜索合并、详情页远程拉单篇 |
| P1 | L2 词条与 `SymptomNode` 对齐；诊断结果页链到词条 | **已实现**：`KnowledgeArticle.symptomIds` + seed 映射；`POST /diagnose` 与 `POST /diagnose/llm` 返回 **`relatedArticles`**；`GET /diagnose/catalog` 每条症状带 **`relatedArticles`**；小程序诊断页「延伸阅读」跳转发现详情 |
| P2 | L3 场景文 + 地域标签；混合检索或向量 |
| P3 | 管理后台 / 导入流水线 / 多语言 |

---

## 8. 风险与约束

- **微信合规**：订阅与诊断文案避免「包治」「确诊」；词条统一 `disclaimerVersion`。
- **性能**：搜索走只读副本或连接池；热门 `q` 短 TTL 缓存。
- **中文分词**：选型前可用 `pg_trgm` + 2-gram 过渡，避免过早绑定难运维插件。

---

## 9. 小结

- **分层**：L1 品种（已有核心）、L2 病害/症状词条、L3 环境与场景解释；L0 外部分类可选。  
- **搜索**：多路召回（键 / 全文 / 症状词典 / 过滤）+ 可解释融合排序；预留向量。  
- **演进**：静态 `knowledge.js` → DB + 统一搜索 API；诊断 symptom id **长期稳定**；养护公式仍在 `careEngine`，知识库不重复造轮子。
