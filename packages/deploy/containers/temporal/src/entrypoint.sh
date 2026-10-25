#!/usr/bin/env bash
set -euo pipefail

# Fallback defaults if variables aren't injected by docker-compose
export POSTGRES_HOST="${POSTGRES_HOST:-postgres-store}"
export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
export POSTGRES_DB="${POSTGRES_DB:-backstage_plugin_catalog}"
export POSTGRES_USER="${POSTGRES_USER:-backstage}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-backstage_secret_pass}"

# Expose internal Temporal Service ports to the environment tracker
export TEMPORAL_FRONTEND_MEMBERSHIP_PORT="${TEMPORAL_FRONTEND_MEMBERSHIP_PORT:-6933}"
export TEMPORAL_FRONTEND_PORT="${TEMPORAL_FRONTEND_PORT:-7233}"
export TEMPORAL_HISTORY_MEMBERSHIP_PORT="${TEMPORAL_HISTORY_MEMBERSHIP_PORT:-6934}"
export TEMPORAL_HISTORY_PORT="${TEMPORAL_HISTORY_PORT:-7234}"
export TEMPORAL_MATCHING_MEMBERSHIP_PORT="${TEMPORAL_MATCHING_MEMBERSHIP_PORT:-6935}"
export TEMPORAL_MATCHING_PORT="${TEMPORAL_MATCHING_PORT:-7235}"
export TEMPORAL_METRICS_PORT="${TEMPORAL_METRICS_PORT:-9090}"
export TEMPORAL_WORKER_MEMBERSHIP_PORT="${TEMPORAL_WORKER_MEMBERSHIP_PORT:-6936}"
export TEMPORAL_WORKER_PORT="${TEMPORAL_WORKER_PORT:-7236}"

echo "📡 Checking database availability at ${POSTGRES_HOST}:${POSTGRES_PORT}..."
while ! nc -z "$POSTGRES_HOST" "$POSTGRES_PORT" >/dev/null 2>&1; do
  echo "⏳ Waiting for pgvector/PostgreSQL container to accept connections..."
  sleep 2
done

echo "✅ Database connection confirmed! Auditing Temporal structural schemas..."

export SQL_PASSWORD="$POSTGRES_PASSWORD"

# 1. Initialize the database schema if it doesn't exist
temporal-sql-tool --plugin postgres --endpoint "$POSTGRES_HOST" --port "$POSTGRES_PORT" --user "$POSTGRES_USER" --database "$POSTGRES_DB" setup-schema || true

# 2. Run the versioned updates to bring it up to current release structures
temporal-sql-tool --plugin postgres --endpoint "$POSTGRES_HOST" --port "$POSTGRES_PORT" --user "$POSTGRES_USER" --database "$POSTGRES_DB" update-schema -d /etc/temporal/schema/postgresql/v96/temporal/versioned || true

echo "🚀 Igniting Consolidated Temporal Services Loop on Frontend Port ${TEMPORAL_FRONTEND_PORT}..."
exec temporal-server start \
  --config /etc/temporal/config/config.yaml \
  --services=frontend,history,matching,worker
