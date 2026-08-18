#!/usr/bin/env bash
# graphify: incremental update after write/replace (Gemini CLI hook)
# Must output ONLY JSON on stdout. Low-noise: no systemMessage.
set -euo pipefail

cat > /dev/null || true

graphify update . >/dev/null 2>&1 || true
echo '{"suppressOutput": true}'
exit 0
