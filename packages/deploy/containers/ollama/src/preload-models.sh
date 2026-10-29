#!/usr/bin/env bash
set -euo pipefail

export OLLAMA_HOST=127.0.0.1:39431
: "${OLLAMA_MODELS:?OLLAMA_MODELS must be set}"

log_file="$(mktemp)"
ollama serve >"$log_file" 2>&1 &
server_pid=$!
cleanup() {
  kill "$server_pid" 2>/dev/null || :
  wait "$server_pid" 2>/dev/null || :
  rm -f "$log_file"
}
trap cleanup EXIT

ready=false
for ((attempt = 0; attempt < 60; attempt++)); do
  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "Ollama build server exited before becoming ready:" >&2
    cat "$log_file" >&2
    exit 1
  fi
  if ollama list >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  echo "Timed out waiting for the Ollama build server:" >&2
  cat "$log_file" >&2
  exit 1
fi

for model in llama3.2:latest bge-m3:latest llama-guard3:1b; do
  ollama pull "$model"
  name="${model%:*}"
  tag="${model##*:}"
  manifest_path="registry.ollama.ai/library/$name/$tag"
  if [[ ! -s "$OLLAMA_MODELS/manifests-v2/$manifest_path" &&
        ! -s "$OLLAMA_MODELS/manifests/$manifest_path" ]]; then
    echo "Model $model was not saved under $OLLAMA_MODELS" >&2
    exit 1
  fi
  ollama show "$model" --modelfile >/dev/null
done
