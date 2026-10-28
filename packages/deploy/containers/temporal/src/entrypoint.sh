#!/usr/bin/env bash
set -euo pipefail

# Fallback defaults if variables aren't injected by docker-compose
export POSTGRES_HOST="${POSTGRES_HOST:-postgres-store}"
export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
export POSTGRES_DB="${POSTGRES_DB:-backstage_plugin_catalog}"
export POSTGRES_USER="${POSTGRES_USER:-backstage}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-backstage_secret_pass}"
export TEMPORAL_VISIBILITY_DB="${TEMPORAL_VISIBILITY_DB:-temporal_visibility}"
export TEMPORAL_LOG_LEVEL="${TEMPORAL_LOG_LEVEL:-info}"

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
export PGPASSWORD="$POSTGRES_PASSWORD"

if [[ "$POSTGRES_DB" == "$TEMPORAL_VISIBILITY_DB" ]]; then
  echo "Temporal's default and visibility databases must be different." >&2
  exit 1
fi

psql --no-psqlrc --set ON_ERROR_STOP=1 --host "$POSTGRES_HOST" --port "$POSTGRES_PORT" \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set "db=$TEMPORAL_VISIBILITY_DB" <<'SQL'
SELECT format('CREATE DATABASE %I', :'db')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'db') \gexec
SQL

for store in temporal visibility; do
  database="$POSTGRES_DB"
  if [[ "$store" == visibility ]]; then
    database="$TEMPORAL_VISIBILITY_DB"
  fi
  sql_tool=(temporal-sql-tool --plugin postgres12 --endpoint "$POSTGRES_HOST" --port "$POSTGRES_PORT" --user "$POSTGRES_USER" --database "$database")
  initialized="$(psql --no-psqlrc --set ON_ERROR_STOP=1 --host "$POSTGRES_HOST" --port "$POSTGRES_PORT" \
    --username "$POSTGRES_USER" --dbname "$database" --tuples-only --no-align \
    --command "SELECT to_regclass('public.schema_version') IS NOT NULL")"
  if [[ "$initialized" == f ]]; then
    "${sql_tool[@]}" setup-schema -v 0.0
  elif [[ "$initialized" != t ]]; then
    echo "Unable to determine Temporal schema state for database $database." >&2
    exit 1
  fi
  "${sql_tool[@]}" update-schema -d "/etc/temporal/schema/postgresql/v12/${store}/versioned"
done

export POSTGRES_DB_JSON POSTGRES_USER_JSON POSTGRES_PASSWORD_JSON TEMPORAL_VISIBILITY_DB_JSON TEMPORAL_LOG_LEVEL_JSON POSTGRES_ADDR_JSON
POSTGRES_DB_JSON="$(printf '%s' "$POSTGRES_DB" | jq -Rs .)"
POSTGRES_USER_JSON="$(printf '%s' "$POSTGRES_USER" | jq -Rs .)"
POSTGRES_PASSWORD_JSON="$(printf '%s' "$POSTGRES_PASSWORD" | jq -Rs .)"
TEMPORAL_VISIBILITY_DB_JSON="$(printf '%s' "$TEMPORAL_VISIBILITY_DB" | jq -Rs .)"
TEMPORAL_LOG_LEVEL_JSON="$(printf '%s' "$TEMPORAL_LOG_LEVEL" | jq -Rs .)"
POSTGRES_ADDR_JSON="$(printf '%s:%s' "$POSTGRES_HOST" "$POSTGRES_PORT" | jq -Rs .)"

envsubst < /etc/temporal/config/config.yaml > /etc/temporal/config/development.yaml
unset PGPASSWORD SQL_PASSWORD POSTGRES_PASSWORD_JSON

echo "🚀 Igniting Consolidated Temporal Services Loop on Frontend Port ${TEMPORAL_FRONTEND_PORT}..."
exec temporal-server --root /etc/temporal --config config --env development start
