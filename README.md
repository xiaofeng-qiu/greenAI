# GreenAI Bot (greenAI)

面向家庭的植物养护管理工具。后端 Fastify + Prisma + PostgreSQL，前端主推 **uni-app** 跨端工程（H5 / App / 小程序），旧微信原生小程序（`miniprogram/`）不再维护。uni-app 见 [`uniapp/README.md`](uniapp/README.md)；跨端策略见 [docs/engineering/cross-platform-clients.md](docs/engineering/cross-platform-clients.md)。

## 功能一览

### 客户端（uni-app）

| Tab / 页面 | 功能 |
|---|---|
| **首页**（`pages/index/index`） | 天气大卡、待办浇水/施肥统计、植物横滑、常用工具（植物识别/土壤识别/病虫害诊断）、今日任务 |
| **养护**（`pages/care/care`） | 植物列表，添加/编辑/删除，养护计划 |
| **知识**（`pages/knowledge/knowledge`） | 养护知识搜索与文章详情 |
| **我**（`pages/me/me`） | 账户、时区/定位/天气、传感器绑定码、设备语音文案 |
| **病虫害诊断**（`pages/diagnose/diagnose`） | 拍照+症状勾选+AI 诊断 |
### 后端 API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/health` | 健康检查 |
| POST | `/auth/wechat` | 微信 `jscode2session` 登录，返回 JWT |
| POST | `/auth/guest` | 创建或恢复 H5 匿名访客，返回 JWT 与本机访客密钥 |
| GET | `/users/me` | 获取/创建当前用户 |
| PATCH | `/users/me` | 更新时区、经纬度 |
| GET | `/plants` | 用户植物列表 |
| POST | `/plants` | 添加植物 |
| GET | `/plants/:id` | 植物详情 |
| PATCH | `/plants/:id` | 编辑植物 |
| DELETE | `/plants/:id` | 删除植物 |
| POST | `/plants/:id/regenerate` | 重新生成养护计划 |
| POST | `/plants/identify` | 百度 AI 拍照识花（需配置密钥） |
| GET | `/tasks/today` | 今日任务列表 |
| POST | `/tasks/:id/complete` | 完成任务（自动重算下次计划） |
| POST | `/tasks/:id/skip` | 跳过任务 |
| POST | `/subscribe/report` | 上报订阅消息结果 |
| GET | `/weather/forecast` | 用户所在地 3 天天气预报 |
| POST | `/diagnose/symptoms` | 规则式症状诊断 |
| POST | `/diagnose/photo` | 视觉 LLM 植物诊断 |
| POST | `/soil/estimate-photo` | 土壤照片 LLM 分析 |
| GET | `/knowledge/search?q=` | 养护知识搜索 |
| GET | `/devices` | 当前用户全部传感器设备 |
| GET | `/devices/:id/logs` | 当前用户某设备的最近运行日志（JWT，`?limit=` 默认 50，最大 200）|
| PATCH | `/devices/:id` | 设备绑定 / 解绑植物、改名 |
| POST | `/devices/binding-codes` | 登录用户生成一次性设备绑定码（自研固件 claim）|
| POST | `/devices/claim-binding-code` | 固件用绑定码 + `hardwareId` 预建 `Device`（可选返回 `sensorKey`；`userId` 仅服务端内部使用）|
| GET | `/plants/:id/sensor/series` | 植物绑定设备的近期读数序列（默认 72h，下采样 ≤240 点）|
| GET | `/metrics/summary` | 内部统计概览 |
| POST | `/internal/reminders` | HMAC 鉴权的内部提醒任务 |
| POST | `/internal/sensors/ingest` | 设备侧 HMAC 上报传感器读数（温/湿/pH/光照，幂等）|
| POST | `/internal/sensors/logs` | 设备侧 HMAC 上报运行/诊断日志（与 ingest 共用签名与密钥）|

### 养护引擎

- **浇水间隔计算**：根据植物浇水偏好（喜湿/中性/耐旱）、室内外、有无暖气、光照等级、盆土湿度提示综合计算基础天数
- **天气系数调整**：结合 Open-Meteo 预报的降水量、湿度、阴天天数，自动缩短或延长浇水间隔
- **传感器融合（可选）**：如已绑定设备且读数新鲜（近 6h），`tempC` 覆盖天气温度、`soilMoisture` 映射为土壤湿度提示、`lux` 映射为光照等级；pH 按物种偏好评估，仅做展示提示不介入间隔计算
- **施肥计划**：根据浇水节奏按比例生成施肥任务
- **计划重算**：每次完成/跳过任务后自动生成后续 horizon 内的任务
- **订阅提醒**：通过微信订阅消息推送养护提醒，含失败重试退避

## 快速开始

### 前置条件

- Node.js 20+
- 微信开发者工具
- Docker & Docker Compose（可选，用于本地后端部署）
- PostgreSQL 16（如不通过 Docker Compose）

### 1. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，至少填写：

```env
WECHAT_APPID=wx你的小程序AppId
WECHAT_SECRET=你的小程序AppSecret
JWT_SECRET=一个至少16位的随机字符串
POSTGRES_PASSWORD=数据库密码
DATABASE_URL=postgresql://greenai:密码@db:5432/greenai
```

### 2. 启动后端（Docker Compose）

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build
```

API 默认监听 `http://localhost:3000`。

### Mock 数据库（与生产数据库隔离）

本仓库提供独立的 `mock` 数据库容器，和默认数据库在账号、库名、端口、数据卷上完全隔离：

- 生产/默认开发库：`localhost:5432`，`greenai`
- Mock 库：`localhost:15432`，`greenai_mock`

启动 mock 库：

```bash
docker compose up -d db_mock
```

连接串（示例）：

```env
DATABASE_URL_MOCK=postgresql://greenai_mock:greenai_mock@localhost:15432/greenai_mock
```

如需让后端连接 mock 库，启动前把 `DATABASE_URL` 临时切换为该值即可（或在单独 `.env.mock` 中维护）。

### 3. 本地开发启动后端

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy    # 或 migrate dev 首次建库
npm run dev
```

### 4. 运行 uni-app（H5）

```bash
cd uniapp
npm install
npm run dev:h5
```

浏览器打开 `http://localhost:5173` 即可（API 地址自动取 `window.location.hostname:3000`）。

### 5. 运行测试

```bash
cd backend
npm test          # 90 单元测试·8 集成测试（设 `SKIP_INTEGRATION_TESTS=1` 可跳过）
npm run build     # TypeScript 编译
```

## 文档

- **索引与文件清单**：[docs/README.md](docs/README.md)
- **文档写作规范**（结构、内容、排版）：[docs/writing-standard.md](docs/writing-standard.md)
- **部署说明**：[docs/engineering/deployment.md](docs/engineering/deployment.md)

## 部署

### 一键部署脚本

`deploy/deploy.sh` 自动完成 nginx 反代 + Docker Compose 栈启动：

```bash
# 最小部署（仅 Docker 栈，nginx 需手动配置）
./deploy/deploy.sh

# 带 nginx 反代 + HTTPS
NGINX_DOMAIN=plant.example.com \
NGINX_SSL_CERT=/etc/letsencrypt/live/plant.example.com/fullchain.pem \
NGINX_SSL_KEY=/etc/letsencrypt/live/plant.example.com/privkey.pem \
./deploy/deploy.sh
```

部署脚本执行流程：

| 步骤 | 说明 |
|---|---|
| [1/3] Nginx | 检测 nginx → 无则安装 → 生成配置（模板：`deploy/nginx-greenai.conf`）→ 启用站点 → `nginx -t` → reload（有 HTTPS 证书时自动取消注释 SSL 配置） |
| [2/3] Docker | `docker compose -f deploy/docker-compose.prod.yml up -d --build` |
| [3/3] 健康检查 | 轮询 `localhost:API_PUBLISH_PORT/health` |

> 如需跳过 nginx 配置只起 Docker 栈，不设置 `NGINX_DOMAIN` 即可。

### Docker Compose 部署（仅 API）

```bash
# 从项目根目录执行
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build api
```

### 运维脚本

`deploy/ops/` 提供日常运维命令：

| 脚本 | 用途 | 示例 |
|---|---|---|
| `status.sh` | 检查 Docker 容器、API 健康、Nginx、磁盘、SSL 证书 | `./deploy/ops/status.sh` |
| `logs.sh` | 实时跟踪日志（api/db/nginx/all） | `./deploy/ops/logs.sh nginx` |
| `restart.sh` | 重建 API 镜像并重启，等待健康检查 | `./deploy/ops/restart.sh` |
| `backup.sh` | PostgreSQL 备份（`pg_dump` custom 格式，保留 14 天） | `./deploy/ops/backup.sh ./backups` |

### 环境变量

| 变量 | 必需 | 说明 |
|---|---|---|
| `WECHAT_APPID` | ✅ | 微信小程序 AppID |
| `WECHAT_SECRET` | ✅ | 微信小程序 AppSecret |
| `JWT_SECRET` | ✅ | JWT 签名密钥（≥16 字符） |
| `DATABASE_URL` | ✅ | Postgres 连接串（本地开发用 `localhost`，Compose 内网用 `db`） |
| `POSTGRES_PASSWORD` | ✅ | Compose 部署时 Postgres 密码 |
| `CRON_HMAC_SECRET` | ✅ | 内部任务 HMAC 签名密钥 |
| `SENSOR_HMAC_SECRET` | 否 | 传感器读数与设备日志 ingest 共用 HMAC 密钥（不设则 `/internal/sensors/ingest` 与 `/internal/sensors/logs` 返回 503，融合退化为原路线）|
| `SUBSCRIBE_TEMPLATE_ID` | ✅ | 微信订阅消息模板 ID |
| `PORT` | 否 | API 监听端口（默认 3000） |
| `BAIDU_API_KEY` | 否 | 百度 AI 植物识别（需同时填 `BAIDU_SECRET_KEY`） |
| `BAIDU_SECRET_KEY` | 否 | 百度 AI 密钥 |
| `DIAGNOSE_LLM_API_KEY` | 否 | 视觉诊断 LLM API Key（兼容 OpenAI / DashScope） |
| `DIAGNOSE_LLM_BASE_URL` | 否 | 视觉诊断 LLM 地址（默认 OpenAI，DashScope 用 `https://dashscope.aliyuncs.com/compatible-mode/v1`） |
| `DIAGNOSE_LLM_MODEL` | 否 | 视觉诊断 LLM 模型（默认 `gpt-4o-mini`，DashScope 推荐 `qwen3-vl-plus-2025-09-23`） |
| `SKIP_INTEGRATION_TESTS` | 否 | 设为 `1` 跳过需数据库的集成测试 |
| `API_PUBLISH_PORT` | 否 | Compose 发布端口（默认 3000） |
| `NGINX_DOMAIN` | 否 | nginx server_name（设置后 deploy.sh 自动生成反代配置） |
| `NGINX_SSL_CERT` | 否 | SSL 证书路径（与 `NGINX_SSL_KEY` 同时设置且文件存在时启用 HTTPS） |
| `NGINX_SSL_KEY` | 否 | SSL 证书私钥路径 |

## CI

GitHub Actions 每个 push 自动执行（`.github/workflows/ci.yml`）：

- **Backend**：TypeScript 编译 + 单元测试（PostgreSQL service container）
- **Docker Compose**：Compose 文件配置校验
- **Miniprogram JSON**：小程序 JSON 配置文件完整性校验

## 技术栈

| 层 | 技术 |
|---|---|
| **后端框架** | Fastify 4 (TypeScript)，`bodyLimit: 20MB`（处理 base64 图片） |
| **ORM** | Prisma (PostgreSQL) |
| **认证** | JWT + 微信 jscode2session |
| **天气预报** | Open-Meteo API |
| **AI** | 百度 AI 植物识别、OpenAI 兼容 LLM 视觉诊断（支持 DashScope Qwen） |
| **部署** | Docker Compose (API + PostgreSQL 16) |
| **客户端** | uni-app (Vue 3 + Vite)，支持 H5 / App / 各端小程序 |
| **CI** | GitHub Actions |

## 项目结构

```
greenAI/
├── backend/                  # Fastify API 服务
│   ├── src/
│   │   ├── routes/           # 路由处理器
│   │   ├── services/         # 外部 API 调用（微信、Open-Meteo、百度等）
│   │   ├── domain/           # 养护引擎业务逻辑
│   │   └── lib/              # 工具函数（时区、日期等）
│   ├── prisma/               # Schema + 迁移
│   └── Dockerfile
├── miniprogram/              # ⛔ 不再维护，旧微信小程序
│   ├── pages/
│   ├── images/icons-src/
│   ├── images/icons-png/
│   ├── utils/
│   └── data/
├── uniapp/                   # ✅ 主前端：uni-app（Vue3+Vite：H5 / App / 小程序）
│   ├── src/pages/            # 首页、养护、知识、我、病虫害诊断
│   ├── src/utils/            # API_BASE、request 封装、图片处理
│   └── src/static/tab/       # Tab 图标（占位图需替换为设计稿）
├── deploy/                   # 部署配置
│   ├── docker-compose.prod.yml
│   ├── nginx-greenai.conf    # nginx 反代配置模板（由 deploy.sh 生成部署）
│   ├── deploy.sh             # 一键部署（nginx 设置 + Docker 栈）
│   ├── deploy.ps1            # Windows PowerShell 部署
│   └── ops/                  # 运维脚本
│       ├── status.sh         # 服务状态检查
│       ├── logs.sh           # 日志查看（api/db/nginx）
│       ├── restart.sh        # 重启 API
│       └── backup.sh         # PostgreSQL 备份
├── scripts/
│   ├── ship.mjs              # 一键提交+推送脚本
│   ├── render-svg-icons.mjs  # SVG → PNG（小程序图标）
│   └── write-uniapp-tab-placeholders.mjs  # 生成 uni-app Tab 占位图标
└── .github/workflows/
    └── ci.yml                # GitHub Actions CI
```
