#!/usr/bin/env bash
# greenAI 运维 - 日志查看
# Usage: ./deploy/ops/logs.sh [service] [options]
#   service: api (default), db, nginx, all
#   options: --tail=N, --since=5m, etc.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="deploy/docker-compose.prod.yml"
service="${1:-api}"
shift 2>/dev/null || true

case "$service" in
  api)
    echo "==> API 日志（容器）"
    exec docker compose -f "$COMPOSE_FILE" logs -f "$@" api
    ;;
  db)
    echo "==> PostgreSQL 日志（容器）"
    exec docker compose -f "$COMPOSE_FILE" logs -f "$@" db
    ;;
  nginx)
    local logdir="${NGINX_LOG_DIR:-/var/log/nginx}"
    if [[ -f "$logdir/access.log" || -f "$logdir/error.log" ]]; then
      echo "==> Nginx 日志 ($logdir)"
      echo "    access.log ← 实时跟踪 (Ctrl+C 退出)"
      echo ""
      exec tail -f "$logdir/access.log" "$logdir/error.log" "$@"
    else
      echo "!! 未找到 nginx 日志目录：$logdir" >&2
      echo "   设置 NGINX_LOG_DIR 环境变量指定路径" >&2
      exit 1
    fi
    ;;
  all|--all)
    echo "==> 同时跟踪 API + Nginx 日志"
    echo "    API:  docker compose logs -f"
    echo "    Nginx: tail -f /var/log/nginx/*.log"
    echo ""
    docker compose -f "$COMPOSE_FILE" logs -f api &
    pid_api=$!
    local logdir="${NGINX_LOG_DIR:-/var/log/nginx}"
    if [[ -f "$logdir/access.log" ]]; then
      tail -f "$logdir/access.log" "$logdir/error.log" &
      pid_nginx=$!
    fi
    trap "kill $pid_api ${pid_nginx:-} 2>/dev/null; exit" INT TERM
    wait
    ;;
  *)
    echo "用法: $0 [api|db|nginx|all] [docker logs options]"
    echo "  示例:"
    echo "    $0               # API 日志实时跟踪"
    echo "    $0 api --tail=50 # API 最近 50 行"
    echo "    $0 nginx         # Nginx access/error 日志"
    echo "    $0 db --since=1h # DB 最近 1 小时"
    exit 1
    ;;
esac
