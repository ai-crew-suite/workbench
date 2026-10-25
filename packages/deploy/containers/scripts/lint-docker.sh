#!/usr/bin/env bash
# Lint all Dockerfiles in the current directory and its subdirectories using Hadolint.
set -euo pipefail

# Find all Dockerfiles under the current directory (or change path as needed)
# and pass them directly into the official Hadolint container.
find . -type f -name "Dockerfile*" | while read -r dockerfile; do
  echo "Linting: $dockerfile"
  docker run --rm -i hadolint/hadolint < "$dockerfile"
done
