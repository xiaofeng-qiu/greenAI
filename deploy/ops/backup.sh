#!/usr/bin/env bash
# greenAI 运维 - PostgreSQL 数据库备份
# Run from repository root.
# Usage: ./deploy/ops/backup.sh [output-dir]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [[ ! -f ".env" ]]; then
  echo "!! 缺少 .env 文件" >&2
  exit 1
fi
source .env

outdir="${1:-./backups}"
mkdir -p "$outdir"

# ── 从 DATABASE_URL 解析连接参数 ──
# 格式: postgresql://user:password@host:port/database
db_url="${DATABASE_URL}"
db_user=$(echo "$db_url" | sed 's|.*://||;s|:.*||')
db_pass=$(echo "$db_url" | sed 's|.*://||;s|.*:||;s|@.*||')
db_host=$(echo "$db_url" | sed 's|.*@||;s|:.*||;s|/.*||')
db_port=$(echo "$db_url" | sed 's|.*:||;s|/.*||' | grep -oP '^\d+' || echo "5432")
db_name=$(echo "$db_url" | sed 's|.*/||;s|[? ].*||')

timestamp=$(date '+%Y%m%d_%H%M%S')
filename="greenai_${timestamp}.sql.gz"
filepath="${outdir}/${filename}"

export PGPASSWORD="$db_pass"

echo "===== greenAI 数据库备份 ====="
echo "  主机: ${db_host}:${db_port}"
echo "  数据库: ${db_name}"
echo "  输出: ${filepath}"
echo ""

# ── 备份前检查连通性 ──
if ! psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -c "SELECT 1" >/dev/null 2>&1; then
  echo "!! 无法连接数据库，检查 DATABASE_URL 和网络连通性" >&2
  exit 1
fi

# ── 执行备份 ──
pg_dump \
  -h "$db_host" \
  -p "$db_port" \
  -U "$db_user" \
  -d "$db_name" \
  --no-owner \
  --no-acl \
  --format=custom \
  --compress=9 \
  --file="${filepath%.gz}" 2>&1

echo ""
echo "  压缩中……"
gzip -f "${filepath%.gz}"

# ── 结果 ──
size=$(du -h "$filepath" | cut -f1)
echo "  ✅ 备份完成: ${filepath} (${size})"
unset PGPASSWORD

# ── 清理旧备份（保留最近 14 天） ──
find "$outdir" -name "greenai_*.sql.gz" -mtime +14 -delete 2>/dev/null || true
echo "  已清理 14 天前的旧备份"
echo ""
echo "提示: 恢复命令"
echo "  gunzip -c ${filepath} | pg_restore -h ${db_host} -p ${db_port} -U ${db_user} -d ${db_name} --no-owner --no-acl"
