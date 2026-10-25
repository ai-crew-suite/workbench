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
  local skeleton_dir=".build-skeleton-${target_name}"
  local pruned_dir="out-${target_name}"

  echo -e "\n🧹 Sweeping up temporary build directories for ${target_name}..."
  cd "$MONOREPO_ROOT"
  rm -rf "$skeleton_dir" "$pruned_dir"
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

  local skeleton_dir=".build-skeleton-${target_name}"

  # Execute optimization for Node applications vs static engines
  local build_args=()
  if [[ "$target_name" == "frontend" || "$target_name" == "backend" ]]; then
    echo "🚀 Pre-formatting Monorepo Structural Graph for Node Target: $target_name"
    cd "$MONOREPO_ROOT"

    rm -rf "$skeleton_dir"
    mkdir -p "$skeleton_dir"

    # Mirror package.json AND tsconfig.json configurations, strictly ignoring artifacts
    find . -type f \( -name "package.json" -o -name "tsconfig.json" \) \
      -not -path "*/node_modules/*" \
      -not -path "*/out-*" \
      -not -path "*/.build-skeleton-*" | while read -r file; do
        mkdir -p "$skeleton_dir/$(dirname "$file")"
        cp "$file" "$skeleton_dir/$file"
    done

    # Bring in global workspace metadata roots into the unique skeleton directory
    cp yarn.lock .yarnrc.yml backstage.json* "$skeleton_dir/" 2>/dev/null || true
    if [ -d ".yarn" ]; then
      cp -r .yarn "$skeleton_dir/"
    fi

    build_args=("--build-arg" "SKELETON_DIR=$skeleton_dir")
  else
    echo "🚀 Processing static infrastructure engine target: $target_name"
    cd "$MONOREPO_ROOT"
  fi

  echo "📦 [$target_name] Structural metadata isolated. Passing context to Docker Engine..."

  # Execute the image compilation step pointing to the relative path from monorepo root
  docker buildx build $build_action \
    "${build_args[@]}" \
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
