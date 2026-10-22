#!/usr/bin/env bash
set -e

SOURCE_DIR="./markdown"
OUTPUT_DIR="./static-compiled/default/component/platform"

echo "[TechDocs-Build] Compiling workspace Markdown blueprints from ${SOURCE_DIR}..."

# Force mkdocs generation using a localized node execution context
npx backstage-cli repo techdocs-cli generate \
  --source-dir "$SOURCE_DIR" \
  --output-dir "$OUTPUT_DIR"

echo "[TechDocs-Build] Programmatic generation successful. Packed assets situated in ${OUTPUT_DIR}."
