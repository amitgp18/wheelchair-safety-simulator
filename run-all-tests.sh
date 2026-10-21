#!/bin/sh
# Runs every automated test and writes the full output to docs/test-results.txt.
# Needs: gcc, python3, node. The browser test also needs Playwright (npm install playwright).
cd "$(dirname "$0")" || exit 1
out=docs/test-results.txt
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
  echo "== 2. JavaScript logic (web/tests/run-node.js) =="
  node web/tests/run-node.js
  echo
  echo "== 3. C and JavaScript parity (web/tests/parity.py) =="
  python3 web/tests/parity.py
  echo
  echo "== 4. Mutation check (web/tests/mutation-check.sh) =="
  sh web/tests/mutation-check.sh
  echo
  echo "== 5. Browser end-to-end (web/tests/browser-test.js) =="
  if node -e "require('playwright')" 2>/dev/null; then node web/tests/browser-test.js; else echo "NOT RUN: Playwright is not installed (npm install playwright)"; fi
  echo
  echo "== 6. Final audit: every button, desktop and phone width (web/tests/final-audit.js) =="
  if node -e "require('playwright')" 2>/dev/null; then node web/tests/final-audit.js | grep -E "^FAIL|passed|Total clicks|DETAILS"; else echo "NOT RUN: Playwright is not installed (npm install playwright)"; fi
  echo
  echo "== 7. Demonstration rehearsal (web/tests/demo-rehearsal.js) =="
  if node -e "require('playwright')" 2>/dev/null; then node web/tests/demo-rehearsal.js | grep -E "^FAIL|passed"; else echo "NOT RUN: Playwright is not installed (npm install playwright)"; fi
  echo
  echo "== 8. Earlier c-core version (reference only) =="
  tmp=$(mktemp -d)
  gcc -Wall -Wextra -std=c99 -o "$tmp/tests" c-core/tests.c c-core/sim.c c-core/stack.c c-core/cqueue.c && "$tmp/tests" | tail -2
} > "$out" 2>&1
grep -E "passed|mismatches|CAUGHT|MISSED|NOT RUN|FAIL|Total clicks|warning\(s\)" "$out"
echo "Full output: $out"
