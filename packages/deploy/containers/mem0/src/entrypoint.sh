#!/usr/bin/env bash
set -euo pipefail

# Establish baseline connectivity defaults
export MEM0_EMBEDDER_MODEL="${MEM0_EMBEDDER_MODEL:-text-embedding-3-small}"
export MEM0_EMBEDDER_PROVIDER="${MEM0_EMBEDDER_PROVIDER:-openai}"
export MEM0_LLM_MODEL="${MEM0_LLM_MODEL:-gpt-4o-mini}"
export MEM0_LLM_PROVIDER="${MEM0_LLM_PROVIDER:-openai}"
export MEM0_PORT="${MEM0_PORT:-8000}"
export MEM0_PROVIDER_API_KEY="${MEM0_PROVIDER_API_KEY:-}"
export POSTGRES_HOST="${POSTGRES_HOST:-postgres-store}"
export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
export APP_DB_NAME="${APP_DB_NAME:-${POSTGRES_DB:-backstage_plugin_catalog}}"
export HISTORY_DB_PATH="${HISTORY_DB_PATH:-/app/history.db}"
export MEM0_DEFAULT_LLM_MODEL="$MEM0_LLM_MODEL"
export MEM0_DEFAULT_EMBEDDER_MODEL="$MEM0_EMBEDDER_MODEL"

if [[ "$MEM0_LLM_PROVIDER" != openai || "$MEM0_EMBEDDER_PROVIDER" != openai ]]; then
  echo "Mem0 v2.2.1 initializes with OpenAI providers; configure other providers through its API after startup." >&2
  exit 1
fi
export OPENAI_API_KEY="${MEM0_PROVIDER_API_KEY:-${OPENAI_API_KEY:-}}"
if [[ -n "${MEM0_LLM_MAX_TOKENS:-}" || -n "${MEM0_LLM_TEMPERATURE:-}" ]]; then
  echo "Mem0 v2.2.1 ignores MEM0_LLM_MAX_TOKENS and MEM0_LLM_TEMPERATURE; configure them through its API." >&2
fi

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
