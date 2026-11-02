#!/usr/bin/env bash
set -euo pipefail
ORG="${1:-}"
if [[ -z "$ORG" ]]; then echo "Usage: ./scripts/run-tests.sh <org-alias>"; exit 2; fi
sf apex run test --target-org "$ORG" --tests HousieDomainRulesTest --result-format human --wait 60
