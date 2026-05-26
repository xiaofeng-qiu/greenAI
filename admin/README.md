# greenAI 运维管理（Admin）

独立进程，与主 API（`backend/`）共用 **同一 PostgreSQL** 与 Prisma schema（`../backend/prisma/schema.prisma`）。`prisma generate` 会在 `backend/generated/admin-client` 生成管理端专用 Client（与主 API 的 `@prisma/client` 并存，且适用于仅构建 `backend` 的 Docker 镜像）。

通过 **Bearer `ADMIN_API_TOKEN`** 访问 JSON API，并内置简易 Web 页（`public/`）。

## 功能

| 能力 | HTTP | 说明 |
|------|------|------|
| 用户管理 | `GET /api/users`、`GET /api/users/:id` | 分页列表、详情（含植物与设备摘要） |
| 硬件关联植物 | `GET /api/hardware/plants`、`GET /api/hardware/plants/:plantId` | 设备 `plantId` 非空的植物及最近读数 / 详情 |
| 设备上报日志 | `GET /api/logs/device-ingest` | `DeviceIngestLog`，支持 `deviceId`、`userId`、`level` 筛选 |
| 系统日志聚合 | `GET /api/logs/system` | 通知发送记录、任务 `lastError`、设备 warn/error 日志；可选配置文件尾部 |

健康检查（无需 Token）：`GET /health`

## 环境变量

见仓库根目录 `.env.example` 中 **Admin 运维控制台** 一节。

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | 与主 API 相同 |
| `ADMIN_API_TOKEN` | 长度 ≥ 24 的随机串，`Authorization: Bearer …` |
| `ADMIN_PORT` | 默认 `3100` |
| `ADMIN_SYSTEM_LOG_PATH` | 可选；宿主机日志文件路径，用于尾部展示 |

## 本地运行

```bash
cd admin
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:3100/`，在页顶保存与 `.env` 中一致的 `ADMIN_API_TOKEN`。

生产构建：

```bash
npm run build
npm start
```

## 安全说明

- 控制台须 **内网或 VPN** 暴露，勿对公网裸奔。
- Token 与主 API 的 `JWT_SECRET` 独立；轮换时同时更新运维人员配置。
