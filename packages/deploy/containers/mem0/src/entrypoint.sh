#!/usr/bin/env bash
set -euo pipefail

# Establish baseline connectivity defaults
export MEM0_PORT="${MEM0_PORT:-8000}"
export MEM0_PROVIDER_API_KEY="${MEM0_PROVIDER_API_KEY:-}"
export POSTGRES_HOST="${POSTGRES_HOST:-postgres-store}"
export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
export APP_DB_NAME="${APP_DB_NAME:-${POSTGRES_DB:-backstage_plugin_catalog}}"
export HISTORY_DB_PATH="${HISTORY_DB_PATH:-/app/history.db}"
export OPENAI_API_KEY="${MEM0_PROVIDER_API_KEY:-${OPENAI_API_KEY:-}}"

echo "📡 Checking database availability for Mem0 at ${POSTGRES_HOST}:${POSTGRES_PORT}..."
while ! nc -z "$POSTGRES_HOST" "$POSTGRES_PORT" >/dev/null 2>&1; do
  echo "⏳ Waiting for pgvector/PostgreSQL database container..."
  sleep 2
done

echo "✅ Database verified! Applying Mem0 application migrations..."
cd /app/server
alembic upgrade head

echo "🚀 Igniting Mem0 FastAPI REST Engine..."
exec uvicorn main:app --host 0.0.0.0 --port "$MEM0_PORT"
