#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 '<json-string>'"
  exit 1
fi

JSON_PAYLOAD="$1"

uv run src/main.py -p "$JSON_PAYLOAD" -o chart