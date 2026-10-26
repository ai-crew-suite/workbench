#!/usr/bin/env bash
set -euo pipefail

# Establish baseline connectivity defaults
export MEM0_EMBEDDER_MODEL="${MEM0_EMBEDDER_MODEL:-text-embedding-3-small}"
export MEM0_EMBEDDER_PROVIDER="${MEM0_EMBEDDER_PROVIDER:-openai}"
export MEM0_LLM_MAX_TOKENS="${MEM0_LLM_MAX_TOKENS:-2000}"
export MEM0_LLM_MODEL="${MEM0_LLM_MODEL:-gpt-4o-mini}"
export MEM0_LLM_PROVIDER="${MEM0_LLM_PROVIDER:-openai}"
export MEM0_LLM_TEMPERATURE="${MEM0_LLM_TEMPERATURE:-0.1}"
export MEM0_PORT="${MEM0_PORT:-8000}"
export MEM0_PROVIDER_API_KEY="${MEM0_PROVIDER_API_KEY:-}"
export POSTGRES_HOST="${POSTGRES_HOST:-postgres-store}"
export POSTGRES_PORT="${POSTGRES_PORT:-5432}"

# ==============================================================================
# VENDOR ENVIRONMENT ATTRIBUTE ROUTING MATRIX
# ==============================================================================
if [[ -n "$MEM0_PROVIDER_API_KEY" ]]; then
  case "${MEM0_LLM_PROVIDER}" in
    openai)
      export OPENAI_API_KEY="$MEM0_PROVIDER_API_KEY"
      ;;
    anthropic)
      export ANTHROPIC_API_KEY="$MEM0_PROVIDER_API_KEY"
      ;;
    azure_openai)
      export AZURE_OPENAI_API_KEY="$MEM0_PROVIDER_API_KEY"
      ;;
    *)
      # Fallback pass-through for generalized OpenAI-compatible proxies
      export OPENAI_API_KEY="$MEM0_PROVIDER_API_KEY"
      ;;
  esac
fi

echo "📡 Checking database availability for Mem0 at ${POSTGRES_HOST}:${POSTGRES_PORT}..."
while ! nc -z "$POSTGRES_HOST" "$POSTGRES_PORT" >/dev/null 2>&1; do
  echo "⏳ Waiting for pgvector/PostgreSQL database container..."
  sleep 2
done

echo "✅ Database verified! Preparing dynamic config mappings..."

# Safe string token expansion substituting all environmental metrics cleanly
eval "echo \"$(cat /app/config.yaml)\"" > /app/runtime_config.yaml

echo "🚀 Igniting Mem0 FastAPI REST Engine..."
# Explicitly set the configuration path target expected by the self-hosted server module
export MEM0_CONFIG_PATH="/app/runtime_config.yaml"
exec uvicorn server.main:app --host 0.0.0.0 --port "$MEM0_PORT"
