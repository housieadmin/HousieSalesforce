#!/usr/bin/env bash
set -euo pipefail
ORG="${1:-}"
if [[ -z "$ORG" ]]; then
  echo "Usage: ./scripts/deploy.sh <org-alias>"
  exit 2
fi
sf project deploy start --manifest manifest/package.xml --target-org "$ORG" --wait 60
