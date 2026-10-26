#!/usr/bin/env bash

##
# Google Container Structure Tests - uses declarative YAML tests against a built image
##
set -euo pipefail

# 1. Resolve paths early relative to the script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE}")" && pwd)"
PACKAGE_ROOT="$(cd "$SCRIPT_DIR/../" && pwd)"

TARGET="${1:-}"

# 2. Dynamic Target Discovery (Find all folders containing a Dockerfile)
VALID_TARGETS=()
while IFS= read -r -d '' df; do
  service_dir=$(dirname "$df")
  service_name=$(basename "$service_dir")
  if [[ "$service_name" != "scripts" && "$service_name" != "node_modules" && "$service_name" != "__tests__" ]]; then
    VALID_TARGETS+=("$service_name")
  fi
done < <(find "$PACKAGE_ROOT" -maxdepth 2 -name "Dockerfile" -print0)

# 3. Core Blueprint Test Worker
run_structure_test() {
  local target_name="$1"
  # FIX 1: Explicitly target the new .cst.yaml (Container Structure Test) format extension
  local config_file="${PACKAGE_ROOT}/${target_name}/__tests__/${target_name}.cst.yaml"

  # FIX 2: Standardize the image reference to match your build-script.sh output schema
  local registry="${REGISTRY:-localhost:32443/ai-crew-suite}"
  local image_tag="latest"
  local image_ref="${registry}/workbench-${target_name}:${image_tag}"

  # Silently skip if this specific service doesn't have a localized structural test written yet
  if [ ! -f "$config_file" ]; then
    echo "ℹ️  No structural test blueprint found at $config_file, skipping."
    return 0
  fi

  echo "🧱 Validating container structure for [${target_name}] -> ${target_name}.cst.yaml..."

  if command -v container-structure-test &> /dev/null; then
    container-structure-test test --image "$image_ref" --config "$config_file"
  else
    echo "⚠️  container-structure-test binary not found. Executing via Docker..."
    docker run --rm \
      -v /var/run/docker.sock:/var/run/docker.sock \
      -v "${config_file}:/config.yaml" \
      gcr.io/container-structure-test/container-structure-test:latest \
      test --image "$image_ref" --config /config.yaml
  fi
}

# 4. Router Logic (Determine Single Target vs Full Cascade execution)
if [ -n "$TARGET" ]; then
  if [[ ! " ${VALID_TARGETS[*]} " =~ " ${TARGET} " ]]; then
    echo "❌ Error: Invalid structure test target '$TARGET'."
    echo "👉 Available targets: ${VALID_TARGETS[*]}"
    exit 1
  fi

  run_structure_test "$TARGET"
else
  echo "🧱 Commencing full container structure validation cascade..."
  for target in "${VALID_TARGETS[@]}"; do
    echo -e "\n📋 Triggering structural assertion for: $target"
    run_structure_test "$target"
  done
fi

echo -e "\n✅ All structural configurations match expectations!"
