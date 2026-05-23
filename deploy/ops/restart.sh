#!/usr/bin/env bash
# greenAI 运维 - 重启 API 栈（重建镜像，不重启数据库）
# Run from repository root.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="deploy/docker-compose.prod.yml"
API_PORT="${API_PUBLISH_PORT:-3000}"

echo "===== greenAI 重启 ====="
echo ""

# ── 拉取最新代码（如果有） ──
if git fetch origin 2>/dev/null; then
  behind=$(git rev-list --count HEAD..@{u} 2>/dev/null || echo "0")
  if [[ "$behind" -gt 0 ]]; then
    echo "  ⚠️  本地落后远程 ${behind} 次提交。先 git pull 再重启？"
    echo "     强制重启（不更新代码）: ./deploy/ops/restart.sh --force"
    if [[ "${1:-}" != "--force" ]]; then
      echo "     中止。"
      exit 1
    fi
    echo "     已强制，跳过 git pull"
  fi
else
  echo "  ⚠️  无法连接远程，使用本地代码"
fi

echo "── 重建 API 镜像并启动 ──"
docker compose -f "$COMPOSE_FILE" up -d --build api

echo ""
echo "── 等待健康检查 (localhost:${API_PORT}) ──"
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1; then
    echo "  ✅ API 已就绪"
    echo ""
    echo "重启完成。"
    exit 0
  fi
  sleep 1
done

echo "!! 重启后健康检查超时，请检查日志：" >&2
echo "   docker compose -f ${COMPOSE_FILE} logs -f api" >&2
exit 1
