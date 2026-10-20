#!/bin/sh
# Mutation check: copies the code, breaks one rule on purpose, and confirms the logic tests notice.
# A good test suite must FAIL for every broken copy. Usage: sh tests/mutation-check.sh
cd "$(dirname "$0")/.." || exit 1
try() {
  name="$1"; file="$2"; expr="$3"
  tmp=$(mktemp -d)
  cp -r js tests "$tmp"/
  sed -i "$expr" "$tmp/$file"
  if cmp -s "$file" "$tmp/$file"; then echo "SKIP  $name (pattern not found)"; rm -rf "$tmp"; return; fi
  fails=$(cd "$tmp" && timeout 30 node tests/run-node.js 2>&1 | grep -c '^FAIL')
  if [ "$fails" -gt 0 ]; then echo "CAUGHT  $name ($fails failing tests)"; else echo "MISSED  $name"; fi
  rm -rf "$tmp"
}
try "obstacle and wall check removed"      js/simulation.js 's/if (!S().isFree(s.grid, nr, nc)) {/if (false) {/'
try "emergency stop does not flush queue"   js/simulation.js 's/while (!sim.queue.isEmpty()) {/while (false) {/'
try "move does not save history"            js/simulation.js 's/var p = sim.stack.push(snapshot);/var p = { ok: true, index: 0 };/'
try "history saved even when blocked"       js/simulation.js 's/s.mode = .BLOCKED.;$/s.mode = "BLOCKED"; sim.stack.push({ row: s.row, col: s.col, heading: s.heading });/'
try "BACK restores the wrong cell"          js/simulation.js 's/      s.row = snap.row;/      s.row = snap.row; if (snap.row > 1) { s.row = snap.row - 1; }/'
try "queue rear does not wrap with %"       js/structures.js 's/      this.rear = (this.rear + 1) % this.capacity;/      this.rear = this.rear + 1;/'
try "queue front does not wrap with %"      js/structures.js 's/      this.front = (this.front + 1) % this.capacity;/      this.front = this.front + 1;/'
try "last dequeue does not reset to -1"     js/structures.js 's/      this.front = -1;             \/\/ that was the last item: back to empty/      this.front = this.front;/'
try "stack full check off by one"           js/structures.js 's/return this.top === this.capacity - 1;/return this.top === this.capacity;/'
try "steps run during emergency stop"       js/simulation.js "s/if (s.mode === 'ESTOP') {\$/if (false) {/"
try "sensor failure does not stop moves"    js/safety.js 's/if (state.sensorFaulty) {$/if (false) {/'
try "recovery skips the checks"             js/simulation.js 's/if (failing.length > 0) {/if (false) {/'
try "recovery without confirmation"         js/simulation.js 's/if (!acknowledged) {/if (false) {/'
