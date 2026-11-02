#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 6 ] || [ "$1" != build ] || [ "$2" != -f ] || \
  [ "$4" != -d ] || [ "$5" != "$TECHDOCS_CONTAINER_OUTPUT" ] || [ "$6" != -v ]; then
  echo "[TechDocs-Build] Unexpected MkDocs arguments: $*" >&2
  exit 1
fi

security_options=$(docker info --format '{{json .SecurityOptions}}')
user_options=()
if [[ "$security_options" != *'"name=rootless"'* ]]; then
  user_options=(--user "$(id -u):$(id -g)")
fi

docker run --rm --pull=always \
  "${user_options[@]}" \
  --workdir /input \
  --env HOME=/tmp \
  --volume "$TECHDOCS_CONTAINER_SOURCE:/input" \
  --volume "$TECHDOCS_CONTAINER_OUTPUT:/output" \
  spotify/techdocs:latest build -f "/input/$3" -d /output -v
