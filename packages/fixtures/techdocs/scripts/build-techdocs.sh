#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="./markdown"
FINAL_OUTPUT_DIR="./static-compiled/default/component/platform"
OUTPUT_PARENT=$(dirname "$FINAL_OUTPUT_DIR")
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

mkdir -p "$OUTPUT_PARENT"
TMP_COMPILATION_DIR=$(mktemp -d "$OUTPUT_PARENT/.techdocs-build.XXXXXXXX")
TMP_COMPILATION_DIR=$(cd "$TMP_COMPILATION_DIR" && pwd)
trap 'rm -rf "$TMP_COMPILATION_DIR"' EXIT

mkdir -p "$TMP_COMPILATION_DIR/source" "$TMP_COMPILATION_DIR/output" "$TMP_COMPILATION_DIR/bin"
cp -R "$SOURCE_DIR/." "$TMP_COMPILATION_DIR/source/"
ln -s "$SCRIPT_DIR/mkdocs-container.sh" "$TMP_COMPILATION_DIR/bin/mkdocs"

echo "[TechDocs-Build] Compiling workspace Markdown blueprints from ${SOURCE_DIR}..."

PATH="$TMP_COMPILATION_DIR/bin:$PATH" \
TECHDOCS_CONTAINER_SOURCE="$TMP_COMPILATION_DIR/source" \
TECHDOCS_CONTAINER_OUTPUT="$TMP_COMPILATION_DIR/output" \
npx @techdocs/cli generate \
  -v \
  --no-docker \
  --source-dir "$TMP_COMPILATION_DIR/source" \
  --output-dir "$TMP_COMPILATION_DIR/output"

echo "[TechDocs-Build] Compilation successful. Moving assets to target workspace location..."

if [ -e "$FINAL_OUTPUT_DIR" ]; then
  mv "$FINAL_OUTPUT_DIR" "$TMP_COMPILATION_DIR/previous"
fi
if ! mv "$TMP_COMPILATION_DIR/output" "$FINAL_OUTPUT_DIR"; then
  if [ -e "$TMP_COMPILATION_DIR/previous" ]; then
    mv "$TMP_COMPILATION_DIR/previous" "$FINAL_OUTPUT_DIR" || {
      echo "[TechDocs-Build] Could not restore previous output; it remains at $TMP_COMPILATION_DIR/previous." >&2
      trap - EXIT
    }
  fi
  exit 1
fi

echo "[TechDocs-Build] Complete! Assets successfully situated in ${FINAL_OUTPUT_DIR}."
