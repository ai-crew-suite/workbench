#!/usr/bin/env bash
set -euo pipefail

# 1. Capture the build target and validate against all 8 explicit container targets
TARGET="${1:-}"
VALID_TARGETS=("frontend" "backend" "temporal" "mem0" "grafana" "otel-collector" "prometheus" "tempo")

if [[ ! " ${VALID_TARGETS[*]} " =~ " ${TARGET} " ]]; then
  echo "❌ Error: Missing or invalid target. Usage: $0 [frontend|backend|temporal|mem0|grafana|otel-collector|prometheus|tempo]"
  exit 1
fi

# 2. Establish the target registry fallback
REGISTRY="${REGISTRY:-localhost:32443/ai-crew-suite}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# 3. Determine the docker build execution strategy
BUILD_ACTION="--load"
if [[ "${CI:-false}" == "true" ]]; then
  BUILD_ACTION="--push"
fi

# 4. Resolve the monorepo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE}")" && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/../../../../" && pwd)"

# Define the isolated temporary directories
SKELETON_DIR=".build-skeleton-${TARGET}"
PRUNED_DIR="out-${TARGET}"

# Define the cleanup function at the top so the script knows what to do on exit
cleanup() {
  echo -e "\n🧹 Sweeping up temporary build directories..."
  cd "$MONOREPO_ROOT"
  rm -rf "$SKELETON_DIR" "$PRUNED_DIR"
  echo -e "\n✂️ Pruning dangling Docker images..."
  docker image prune -f
}

# Register the trap. This catches normal completion AND unexpected build errors.
trap cleanup EXIT

# 5. Execute optimization: node monorepo structure mirroring is ONLY required for frontend/backend targets
if [[ "$TARGET" == "frontend" || "$TARGET" == "backend" ]]; then
  echo "🚀 Pre-formatting Monorepo Structural Graph for: $TARGET"
  cd "$MONOREPO_ROOT"

  rm -rf "$SKELETON_DIR"
  mkdir -p "$SKELETON_DIR"

  # Mirror package.json AND tsconfig.json configurations, strictly ignoring artifacts
  find . -type f \( -name "package.json" -o -name "tsconfig.json" \) \
    -not -path "*/node_modules/*" \
    -not -path "*/out-*" \
    -not -path "*/.build-skeleton-*" | while read -r file; do
      mkdir -p "$SKELETON_DIR/$(dirname "$file")"
      cp "$file" "$SKELETON_DIR/$file"
  done

  # Bring in global workspace metadata roots into the unique skeleton directory
  cp yarn.lock .yarnrc.yml backstage.json* "$SKELETON_DIR/" 2>/dev/null || true
  if [ -d ".yarn" ]; then
    cp -r .yarn "$SKELETON_DIR/"
  fi

  BUILD_ARGS=("--build-arg" "SKELETON_DIR=$SKELETON_DIR")
else
  echo "🚀 Processing static infrastructure engine target: $TARGET"
  cd "$MONOREPO_ROOT"
  BUILD_ARGS=()
fi

echo "📦 [$TARGET] Structural metadata isolated. Passing context to Docker Engine..."

# Execute the image compilation step pointing to the respective subdirectory Dockerfile
docker buildx build $BUILD_ACTION \
  "${BUILD_ARGS[@]}" \
  -t "${REGISTRY}/workbench-${TARGET}:${IMAGE_TAG}" \
  -f "packages/deploy/containers/${TARGET}/Dockerfile" .

echo -e "\n✅ $TARGET image compiled successfully!"
