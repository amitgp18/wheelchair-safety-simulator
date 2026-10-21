#!/bin/sh
# Runs every automated test. Needs: gcc, python3, node. The browser tests also need Playwright
# (npm install playwright, then npx playwright install chromium).
# The full output is saved into the last section of docs/test-report.md.
cd "$(dirname "$0")" || exit 1
out=$(mktemp)
{
  echo "Test run: $(date)"
  echo "gcc: $(gcc --version | head -1)"
  echo "node: $(node --version)"
  echo
  echo "== 0. Compiler warnings (gcc -Wall -Wextra -pedantic -std=c99, and clang if installed) =="
  for f in c-programs/wheelchair-history-stack.c c-programs/request-circular-queue.c c-programs/wheelchair-simulator.c; do
    w=$(gcc -Wall -Wextra -pedantic -std=c99 -fsyntax-only "$f" 2>&1 | grep -c "warning\|error")
    echo "gcc   $f: $w warning(s)"
    if command -v clang >/dev/null 2>&1; then
      w=$(clang -Wall -Wextra -std=c99 -fsyntax-only "$f" 2>&1 | grep -c "warning\|error")
      echo "clang $f: $w warning(s)"
    fi
  done
  echo
  echo "== 1. C programs (c-programs/tests/c-program-tests.py) =="
  python3 c-programs/tests/c-program-tests.py
  echo
  echo "== 2. Website logic (web/tests/unit-tests.js) =="
  node web/tests/unit-tests.js
  echo
  echo "== 3. C and JavaScript parity (web/tests/parity.py) =="
  python3 web/tests/parity.py
  echo
  echo "== 4. Mutation check (web/tests/mutation-check.sh) =="
  sh web/tests/mutation-check.sh
  echo
  echo "== 5. Browser tests: functional, audit of every button, demo rehearsal (web/tests/browser-tests.js) =="
  if node -e "require('playwright')" 2>/dev/null; then node web/tests/browser-tests.js | grep -E "^=====|^FAIL|passed|Total clicks|DETAILS"; else echo "NOT RUN: Playwright is not installed (npm install playwright)"; fi
} > "$out" 2>&1
# put the output into the last section of the report
python3 - "$out" <<'PY'
import sys
out = open(sys.argv[1]).read().rstrip('\n')
p = 'docs/test-report.md'
t = open(p).read()
a = t.index('<!-- RESULTS START -->') + len('<!-- RESULTS START -->')
b = t.index('<!-- RESULTS END -->')
open(p, 'w').write(t[:a] + '\n```\n' + out + '\n```\n' + t[b:])
PY
grep -E "passed|mismatches|CAUGHT|MISSED|NOT RUN|FAIL|Total clicks|warning\(s\)" "$out"
rm -f "$out"
echo "Full output saved in docs/test-report.md (last section)"
