# 文档中心

本目录存放 **产品 / 工程 / 设计 / 规划** 等与代码仓库同步的说明材料。实现细节以源码与测试为准；此处文档用于 **对齐范围、部署与协作**。

---

## 1. 目录约定（请按此归类新文档）

| 目录 | 用途 | 说明 |
|------|------|------|
| **[engineering/](engineering/)** | 部署、运维、环境变量 | 生产/本机如何起服务、数据库、Cron 等 |
| **[product/](product/)** | 商业与产品原始材料 | 预算、竞品、计划书草案、创意笔记等 |
| **[knowledge/](knowledge/)** | 知识库设计与治理 | 分层架构、数据来源、检索与词条策略 |
| **[superpowers/](superpowers/)** | MVP 规格与执行计划 | **实现对照的权威来源**：spec + plan |
| **[miniprogram-design/](miniprogram-design/)** | 小程序 UI 示意稿 | PNG 与页面说明，非真机截图 |
| **[reference/](reference/)** | 可复用素材 | 架构图等静态资源 |
| **[archive/](archive/)** | 归档 | 不便纳入版本流程的附件（如 Word） |

**请勿**在 `docs/` 根目录随意新增零散 `.md`；请归入上表对应子目录，并在本文件「相关链接」中补一条索引（必要时在子目录 `README.md` 中维护清单）。

---

## 2. 快速入口

| 角色 / 场景 | 建议阅读顺序 |
|-------------|----------------|
| **新接手开发** | 仓库根目录 [`README.md`](../README.md) → [`superpowers/specs/2026-05-18-wechat-mp-care-mvp-design.md`](superpowers/specs/2026-05-18-wechat-mp-care-mvp-design.md) → [`superpowers/plans/2026-05-18-wechat-mp-care-mvp.md`](superpowers/plans/2026-05-18-wechat-mp-care-mvp.md) |
| **部署与上线** | [`engineering/deployment.md`](engineering/deployment.md) |
| **知识库功能** | [`knowledge/knowledge-base-layered-search-design.md`](knowledge/knowledge-base-layered-search-design.md) → [`knowledge/knowledge-base-data-sourcing.md`](knowledge/knowledge-base-data-sourcing.md) |
| **小程序视觉对齐** | [`miniprogram-design/README.md`](miniprogram-design/README.md) |
| **商务/预算背景** | [`product/README.md`](product/README.md) |

---

## 3. 各子目录索引

- **工程**：[engineering/README.md](engineering/README.md)
- **产品与商业**：[product/README.md](product/README.md)
- **知识库**：[knowledge/README.md](knowledge/README.md)
- **MVP 规格与计划**：[superpowers/README.md](superpowers/README.md)
- **小程序设计**：[miniprogram-design/README.md](miniprogram-design/README.md)
- **参考素材**：[reference/README.md](reference/README.md)
- **归档**：[archive/README.md](archive/README.md)

---

## 4. 与自动化 / 协作的约定

- **CI 与 Cursor 规则**中若引用「MVP 设计 / 计划」，路径固定为：  
  `docs/superpowers/specs/2026-05-18-wechat-mp-care-mvp-design.md`  
  `docs/superpowers/plans/2026-05-18-wechat-mp-care-mvp.md`  
  移动或重命名这两份文件时需同步更新 `.github/` 与 `.cursor/rules/` 中的引用。
- **部署脚本**指向的部署说明为：[`engineering/deployment.md`](engineering/deployment.md)。

---

## 5. 版本与语言

- 正文以 **中文** 为主；接口名、路径、环境变量名保持 **与代码一致**（英文）。
- 表格、路径、命令块优先可 **复制执行**，避免「见上文」式模糊指代。
