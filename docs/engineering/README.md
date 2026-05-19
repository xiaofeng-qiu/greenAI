# 工程文档

与 **运行环境、部署、数据库迁移、运维** 相关的内容。

## 本目录文件

| 文件 | 说明 |
|------|------|
| [deployment.md](deployment.md) | 环境变量、Docker Compose、本机 Node 部署、Cron 提醒、观测与排错 |

## 相关代码

- `deploy/` — Compose、部署脚本  
- `backend/docker-entrypoint.sh` — 容器内迁移等  
- `backend/prisma/` — Schema 与迁移  
