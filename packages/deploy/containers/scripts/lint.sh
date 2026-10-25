#!/usr/bin/env bash
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

# 3. Core Lint Execution Worker
run_hadolint() {
  local target_path="$1"
  local display_name="${target_path#$PACKAGE_ROOT/}"

  if [ ! -f "$target_path" ]; then
    echo "❌ Error: Dockerfile not found at $target_path"
    exit 1
  fi

  echo "🔎 Analyzing: $display_name"

  if command -v hadolint &> /dev/null; then
    hadolint "$target_path"
  else
    docker run --rm -i hadolint/hadolint < "$target_path" || {
      echo "❌ Lint failed on $display_name";
      exit 1;
    }
  fi
}

# 4. Router Logic (Determine Single Target vs Full Cascade execution)
if [ -n "$TARGET" ]; then
  # Validate explicit argument against discovered folders
  if [[ ! " ${VALID_TARGETS[*]} " =~ " ${TARGET} " ]]; then
    echo "❌ Error: Invalid lint target '$TARGET'."
    echo "👉 Available targets: ${VALID_TARGETS[*]}"
    exit 1
  fi

  echo "🔎 Commencing targeted static analysis sweep on [$TARGET]..."
  run_hadolint "$PACKAGE_ROOT/$TARGET/Dockerfile"
else
  echo "🔎 Commencing full static analysis cascade on all Dockerfiles..."

  # Optimization: If hadolint is installed locally, run it across everything concurrently via xargs
  if command -v hadolint &> /dev/null; then
    find "$PACKAGE_ROOT" -maxdepth 2 -name "Dockerfile" -print0 | xargs -0 hadolint
  else
    echo "⚠️  hadolint binary not found on host. Falling back to sequential Docker containers..."
    for target in "${VALID_TARGETS[@]}"; do
      run_hadolint "$PACKAGE_ROOT/$target/Dockerfile"
    done
  fi
fi

echo "✅ Static analysis clear. Structural code is syntactically sound!"
