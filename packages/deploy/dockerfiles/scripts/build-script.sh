#!/usr/bin/env bash
set -euo pipefail

# 1. Capture the build target (must be 'frontend' or 'backend')
TARGET="${1:-}"
if [[ "$TARGET" != "frontend" && "$TARGET" != "backend" ]]; then
  echo "❌ Error: Missing or invalid target. Usage: $0 [frontend|backend]"
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

echo "🚀 Pre-formatting Monorepo Structural Graph for: $TARGET"

cd "$MONOREPO_ROOT"

# 5. Scope the skeleton folder uniquely to the target to avoid parallel race conditions
SKELETON_DIR=".build-skeleton-${TARGET}"
rm -rf "$SKELETON_DIR"
mkdir -p "$SKELETON_DIR"

# 6. Mirror package.json AND tsconfig.json configurations, strictly ignoring artifacts
find . -type f \( -name "package.json" -o -name "tsconfig.json" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/out-*" \
  -not -path "*/.build-skeleton-*" | while read -r file; do
    mkdir -p "$SKELETON_DIR/$(dirname "$file")"
    cp "$file" "$SKELETON_DIR/$file"
done

# Bring in global workspace metadata roots into the unique skeleton directory
cp yarn.lock .yarnrc.yml backstage.json* "$SKELETON_DIR/"
if [ -d ".yarn" ]; then
  cp -r .yarn "$SKELETON_DIR/"
fi

echo "📦 [$TARGET] Structural metadata isolated. Passing context to Docker Engine..."

# Execute the image compilation step, passing the unique skeleton name via a build-arg
docker buildx build $BUILD_ACTION \
  --build-arg SKELETON_DIR="$SKELETON_DIR" \
  -t "${REGISTRY}/workbench-${TARGET}-base:${IMAGE_TAG}" \
  -f "packages/deploy/dockerfiles/${TARGET}/Dockerfile" .

# Clean up the localized metadata directory
rm -rf "$SKELETON_DIR"

echo -e "\n✅ $TARGET base image compiled successfully!"
