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

# 3. Core Vulnerability Scan Worker
run_trivy() {
  local target_name="$1"
  local image_tag="local/${target_name}:latest"

  echo "🛡️  Scanning image [${image_tag}] for high/critical security vulnerabilities..."

  if command -v trivy &> /dev/null; then
    trivy image --severity HIGH,CRITICAL --exit-code 1 "$image_tag"
  else
    echo "⚠️  trivy binary not found on host. Running via Docker wrapper..."
    docker run --rm \
      -v /var/run/docker.sock:/var/run/docker.sock \
      -v "${HOME}/.cache/trivy:/root/.cache" \
      aquasec/trivy:latest image --severity HIGH,CRITICAL --exit-code 1 "$image_tag"
  fi
}

# 4. Router Logic (Determine Single Target vs Full Cascade execution)
if [ -n "$TARGET" ]; then
  if [[ ! " ${VALID_TARGETS[*]} " =~ " ${TARGET} " ]]; then
    echo "❌ Error: Invalid security scan target '$TARGET'."
    echo "👉 Available targets: ${VALID_TARGETS[*]}"
    exit 1
  fi

  run_trivy "$TARGET"
else
  echo "🛡️  Commencing full security scan cascade across all images..."
  for target in "${VALID_TARGETS[@]}"; do
    echo -e "\n🔒 Triggering security profile assessment for: $target"
    run_trivy "$target"
  done
fi

echo "✅ Security profile clear. No high or critical CVEs detected!"
