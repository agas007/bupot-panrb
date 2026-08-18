#!/usr/bin/env bash
# graphify: session start update (Gemini CLI hook)
# Must output ONLY JSON on stdout. Logs go to stderr. Never blocks the session.
set -euo pipefail

cat > /dev/null || true

msg="$(graphify update . 2>&1 | head -n 1 || true)"

GRAPHIFY_MSG="$msg" python3 -c '
import json,os
m=os.environ.get("GRAPHIFY_MSG","")
print(json.dumps({"systemMessage":m,"suppressOutput":True}))
' 2>/dev/null || echo '{"suppressOutput": true}'
exit 0
