#!/usr/bin/env bash
# greenAI 运维 - 服务状态检查
# Run from repository root.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

source .env 2>/dev/null || true
COMPOSE_FILE="deploy/docker-compose.prod.yml"
API_PORT="${API_PUBLISH_PORT:-3000}"

echo "===== greenAI 服务状态 ====="
echo ""

# ── Docker 容器 ──
echo "── Docker 容器 ──"
if docker compose -f "$COMPOSE_FILE" ps 2>/dev/null; then
  echo ""
  echo "  容器资源使用："
  docker stats --no-stream $(docker compose -f "$COMPOSE_FILE" ps -q) 2>/dev/null || echo "  (stats 不可用)"
else
  echo "  Docker 栈未运行"
fi
echo ""

# ── API 健康检查 ──
echo "── API 健康检查 ──"
if curl -fsS "http://127.0.0.1:${API_PORT}/health" 2>/dev/null; then
  echo ""
  echo "  ✅ /health OK"
else
  echo "  ❌ /health 不可达 (127.0.0.1:${API_PORT})"
fi
echo ""

# ── Nginx ──
echo "── Nginx ──"
if command -v nginx &>/dev/null; then
  if systemctl is-active --quiet nginx 2>/dev/null; then
    echo "  ✅ nginx 运行中 ($(nginx -v 2>&1 | grep -oP '[\d.]+' | head -1))"
  else
    echo "  ⚠️  nginx 已安装但未运行"
  fi
  if [[ -f "/etc/nginx/sites-enabled/greenai.conf" ]]; then
    echo "  ✅ greenAI 站点已启用"
  elif [[ -f "/etc/nginx/conf.d/greenai.conf" ]]; then
    echo "  ✅ greenAI 配置已安装 (conf.d)"
  else
    echo "  ⚠️  greenAI nginx 配置未安装"
  fi
else
  echo "  ⚠️  nginx 未安装"
fi
echo ""

# ── 磁盘 ──
echo "── 磁盘使用 ──"
docker system df 2>/dev/null | head -4 || echo "  (Docker df 不可用)"
echo ""

# ── 证书过期 ──
if [[ -n "${NGINX_SSL_CERT:-}" && -f "${NGINX_SSL_CERT:-}" ]]; then
  echo "── SSL 证书 ──"
  openssl x509 -in "$NGINX_SSL_CERT" -noout -enddate 2>/dev/null | sed 's/notAfter=/  过期时间: /'
fi
