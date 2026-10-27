#!/usr/bin/env bash
set -euo pipefail

# 1. Resolve paths early relative to the script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE}")" && pwd)"
CONTAINERS_PKG_ROOT="$(cd "$SCRIPT_DIR/../" && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/../../../../" && pwd)"

# 2. Dynamic Target Discovery (Find all folders containing a Dockerfile)
VALID_TARGETS=()
while IFS= read -r -d '' df; do
  service_dir=$(dirname "$df")
  service_name=$(basename "$service_dir")
  if [[ "$service_name" != "scripts" && "$service_name" != "node_modules" && "$service_name" != "__tests__" ]]; then
    VALID_TARGETS+=("$service_name")
  fi
done < <(find "$CONTAINERS_PKG_ROOT" -maxdepth 2 -name "Dockerfile" -print0)

TARGET="${1:-}"

# 3. Global Cleanup Function (Explicitly bound via parameter to survive function scopes)
execute_cleanup() {
  local target_name="$1"
  local pruned_dir="out-${target_name}"

  echo -e "\n🧹 Sweeping up temporary build directories for ${target_name}..."
  cd "$MONOREPO_ROOT"
  rm -rf "$pruned_dir"
  echo -e "✂️ Pruning dangling Docker images..."
  docker image prune -f
}

# 4. Core Compilation Function
compile_image() {
  local target_name="$1"

  # Register the trap dynamically with the parameter safely injected as a literal string
  trap 'execute_cleanup "'"${target_name}"'"' EXIT

  # Establish the target registry fallback (Aligns with local tests by default)
  local registry="${REGISTRY:-local}"
  local image_tag="${IMAGE_TAG:-latest}"
  local full_image_tag=""

  if [[ "$registry" == "local" ]]; then
    full_image_tag="${registry}/${target_name}:${image_tag}"
  else
    full_image_tag="${registry}/workbench-${target_name}:${image_tag}"
  fi

  # Determine the docker build execution strategy
  local build_action="--load"
  if [[ "${CI:-false}" == "true" ]]; then
    build_action="--push"
  fi

  cd "$MONOREPO_ROOT"
  echo "📦 [$target_name] Passing build context to Docker Engine..."

  # Development images rely on Compose to mount the consumer workspace and its
  # dependencies; no repository skeleton or compiled application is baked in.
  docker buildx build $build_action \
    -t "$full_image_tag" \
    -f "packages/deploy/containers/${target_name}/Dockerfile" .

  echo -e "\n✅ $target_name image compiled successfully as: $full_image_tag"

  # Clear the trap immediately on normal completion so it can reset cleanly for multi-cascades
  trap - EXIT
  execute_cleanup "$target_name"
}

# 5. Router Logic (Determine Single Target vs Full Cascade execution)
if [ -n "$TARGET" ]; then
  # Validate explicit argument
  if [[ ! " ${VALID_TARGETS[*]} " =~ " ${TARGET} " ]]; then
    echo "❌ Error: Invalid target '$TARGET'."
    echo "👉 Available targets: ${VALID_TARGETS[*]}"
    exit 1
  fi
  compile_image "$TARGET"
else
  echo "🔄 No explicit target provided. Initiating a full structural build cascade..."
  for target in "${VALID_TARGETS[@]}"; do
    echo -e "\n🔨 Triggering build process for: $target"
    compile_image "$target"
  done
fi
