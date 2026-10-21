# Test report

All results come from real runs. Run `sh run-all-tests.sh` from the project folder to repeat everything; it rewrites the
block at the end of this file with the new output.

**Environment of the recorded run:** Ubuntu Linux, gcc 13.3.0, clang 18.1.3, Node.js 22.22.0, Chromium 141 through Playwright 1.56.0.
This project is a **software simulation**: no real hardware is involved, and the website runs JavaScript copies of the algorithms, not the C code.

## 1. Summary

| Suite | What it checks | Result |
|---|---|---|
| C programs (`c-programs/tests/c-program-tests.py`) | The three C programs, driven through their menus | **35 passed, 0 failed** |
| JavaScript logic (`web/tests/unit-tests.js`) | Stack, queue, simulation rules, scenarios, 8000 random actions | **76 passed, 0 failed** |
| Parity (`web/tests/parity.py`) | the C simulator and the JavaScript give the same front, rear, top, position, heading and mode after every command | **65 states compared, 0 differences** |
| Mutation check (`web/tests/mutation-check.sh`) | The code is broken 13 ways on purpose; the tests must notice each one | **13 of 13 caught** |
| Browser end-to-end (`web/tests/browser-tests.js functional`) | Real clicks and keys in headless Chromium; screen compared with state | **58 passed, 0 failed** |
| Final audit (`web/tests/browser-tests.js audit`) | Every visible button on all 8 views, 3 rounds, at 1280 px and 390 px (about 870 clicks). After each click: screen, state and event log agree; also icons, names, placeholder text, sideways scrolling, active tab, console errors | **112 passed, 0 failed** |
| Demonstration rehearsal (`web/tests/browser-tests.js demo`) | The website half of the teacher demonstration, click for click | **23 passed, 0 failed** |
| Sample outputs | The 7 saved sessions (now in `c-programs/sample-output.txt`) were replayed on the C code during an earlier review pass | 7 of 7 identical (not part of `run-all-tests.sh`; not repeated since) |
| Compiler warnings (in `run-all-tests.sh`) | `gcc -Wall -Wextra -pedantic -std=c99` and `clang -Wall -Wextra -std=c99` on all three programs | **0 warnings** |

## 2. Test cases by requirement

| # | Requirement | How it is tested | C | JS logic | Browser |
|---|---|---|---|---|---|
| 1 | Empty stack and queue | pop, peek and display on empty; dequeue on empty | Pass | Pass | |
| 2 | One element | push then pop; enqueue gives front 0 rear 0 | Pass | Pass | |
| 3 | Stack overflow | 6th push with SIZE 5; 11th saved move in the simulator is refused | Pass | Pass | |
| 4 | Stack underflow | pop on empty; BACK with nothing saved | Pass | Pass | Pass (scenario) |
| 5 | Queue overflow | 6th enqueue with MAX 5; 9th request with size 8 | Pass | Pass | Pass |
| 6 | Wraparound | rear goes 4 to 0 to 1, order S W N E S | Pass | Pass | Pass (front 3, rear 1) |
| 7 | Removing the final element | front and rear back to -1, next enqueue restarts at 0 | Pass | Pass | |
| 8 | Repeated insert and remove | 20 to 40 rounds, structure empty and correct after | Pass | Pass | |
| 9 | Size and indices match contents | 8000 random actions: size, front, rear, top, filled slots always agree | | Pass | Pass (600 random clicks, screen equals state) |
| 10 | Rejected moves not saved | blocked move leaves the stack unchanged; random test checks every refused step | Pass | Pass | Pass |
| 11 | Backtracking restores the right state | BACK returns to the stack top; saved positions always form an unbroken path | Pass | Pass | Pass |
| 12 | Obstacles and walls block movement | obstacle at (2, 3), wall to the north; random test: chair never on a wall or obstacle | Pass | Pass | Pass |
| 13 | Emergency stop acts at once | pending requests removed, stack kept, stop counted once | Pass | Pass | Pass |
| 14 | Nothing runs while stopped | new requests refused, steps refused, chair frozen during a scenario | Pass | Pass | Pass |
| 15 | Recovery needs explicit action | C: must type 1; web: checkbox plus four passing checks | Pass | Pass | Pass |
| 16 | Old commands never resume blindly | after recovery the queue is empty; queued moves are checked against the room when they run | | Pass | Pass |
| 17 | Invalid sensor data stops the chair | sensor failure gives FAULT and refuses moves; "no reading" shown | | Pass | Pass |
| 18 | Reset gives a consistent start | position, heading, battery, sensor, counts, queue and stack all reset | | Pass | Pass |
| 19 | Log is accurate | a move logs ENQUEUE, DEQUEUE, PUSH, MOVED; a blocked move logs no PUSH | | Pass | |
| 20 | Clearing the log view changes nothing | state, queue, stack and log length identical before and after | | Pass | Pass |
| 21 | Scenarios repeat exactly | each of the six scenarios run twice gives identical traces, equal to the instant run | | Pass | Pass |
| 22 | Wrong input never hangs a C program | a letter at the menu, letters as a position, "yes" at the release prompt, end of input | Pass | | |
| 23 | Repeated clicks cannot overlap | controls lock while Process all or a scenario runs | | | Pass |
| 24 | Phone width | no sideways scrolling at 390 px on all 8 views; stop button fixed at the bottom | | | Pass |
| 25 | Keyboard and focus | arrow, B, N and Esc keys; grid editing with arrows and Enter; focus outline on every Tab stop | | | Pass |
| 26 | Reduced motion and light theme | animations off with reduced motion; light background in light mode | | | Pass |
| 27 | No script errors | console checked during the whole browser run and the final audit (about 870 clicks, two widths) | | | Pass |
| 28 | Log, queue, stack and counters stay synchronized | after every audit click: log entries add up to queue size, stack size, move count and stop count; saved positions form an unbroken path | | | Pass |
| 29 | Every button works | all visible, enabled buttons on all 8 views clicked in 3 rounds at 2 widths; no error, screen equals state each time | | | Pass |
| 30 | No broken icons or placeholder text | every `use` reference resolves; visible text scanned for `undefined`, `NaN`, `TODO`, `lorem`, `placeholder` | | | Pass |
| 31 | Phone navigation | the active tab is scrolled into view in the tab bar on all 8 views | | | Pass |
| 32 | Demonstration works as written | `browser-tests.js demo` performs the script's website steps | | | Pass |

### Mutation check (does each test really test something?)

Each line below is a copy of the code with one rule broken. Every one made at least one test fail:
obstacle check removed, stop does not flush the queue, move does not save history, history saved even when blocked,
BACK restores the wrong cell, rear does not wrap, front does not wrap, last dequeue does not reset to -1,
stack full check off by one, steps run during the stop, sensor failure does not stop moves,
recovery skips the checks, recovery without confirmation.

## 3. Final checklist

### Verified and working (each item was run)

#### C programs (`c-programs/`)

- [x] All three programs compile with **0 warnings** under `gcc -Wall -Wextra -pedantic -std=c99` and `clang -Wall -Wextra -std=c99`.
- [x] **35 of 35** scripted tests pass (`c-programs/tests/c-program-tests.py`): empty, one element, overflow, underflow, wraparound,
  removing the last element, repeated insert and remove, obstacle, emergency stop and release, and wrong input.
- [x] A letter or the end of the input at any prompt no longer hangs a program (it used to loop forever).
- [x] Typed by hand: the simulator demonstration sequence gives exactly the output in [viva-and-demo.md](viva-and-demo.md);
  the stack program gives `STACK OVERFLOW` on the 6th push, pops come back last in first out, then `STACK UNDERFLOW`.

#### Website logic (`web/js/`)

- [x] **76 of 76** logic tests pass (`node web/tests/unit-tests.js`), including 8000 random actions that check size, front, rear,
  top and filled slots after every action, and that the chair never stands on a wall or obstacle.
- [x] **Stack:** overflow at the 11th saved move (refused, chair stays, top stays 9); underflow on BACK with nothing saved
  (`SUNDERFLOW`, nothing changes); last in, first out.
- [x] **Queue:** overflow on the 9th request (`QOVERFLOW`, queue unchanged); underflow on dequeue when empty;
  wraparound (rear 7, then 0, then 1 while front is 3); last removal returns front and rear to -1.
- [x] **Obstacle blocking:** a move into the obstacle at (2, 3) is refused, the mode becomes BLOCKED, and nothing is pushed.
- [x] **Emergency stop:** acts at once, removes every waiting request, keeps the stack, refuses new requests and steps,
  and recovery needs the confirmation box plus four passing checks.
- [x] **Sensor failure:** reading becomes "No reading", mode FAULT, moves are refused.
- [x] **Mutation check: 13 of 13.** The code was deliberately broken 13 ways (for example "stop does not flush the queue",
  "rear does not wrap", "blocked move is saved") and the tests noticed every one.

#### C and JavaScript agree

- [x] `web/tests/parity.py` feeds the same commands to the compiled C simulator and to the JavaScript simulation:
  **65 states compared, 0 differences** (front, rear, top, position, heading, mode after every command).
  The sensor-failure scenario is not part of this, because the C program has no sensor failure.

#### Website in a real browser (headless Chromium)

- [x] **58 of 58** end-to-end checks (`web/tests/browser-tests.js functional`): real clicks and keys, 600 random clicks with the screen
  compared to the simulation state after every click, six scenarios each run twice with identical traces, phone width,
  light theme, reduced motion, keyboard focus.
- [x] **Final audit, 112 of 112** (`web/tests/browser-tests.js audit`). It clicked about **870 controls** (every visible, enabled button on
  all 8 views, three rounds, at 1280 px and 390 px wide). After every click it checked that:
  the screen matches the simulation, the event log adds up to the real queue size, stack size, move count and stop count,
  and the saved positions form an unbroken path. It also checked that every icon points at a real symbol, every control has a
  name, there is no placeholder text (`undefined`, `NaN`, `TODO`, `lorem`, and similar), there is no sideways scrolling,
  the active tab is visible, phone buttons are at least 32 px (map cells excepted, see limitations),
  and there are **no script errors, console errors or warnings**.
  The audit was also run against a deliberately broken copy (a move that is not counted) and it failed, so it does notice problems.
- [x] **Demonstration rehearsal, 23 of 23** (`web/tests/browser-tests.js demo`): the website half of the demonstration, click for click.
- [x] Event log, queue, stack, chair position, move counter and stop counter stayed synchronized in all of the above.
- [x] Served over http (`python3 -m http.server`): all files load with status 200, no console messages other than the blocked
  Google Fonts request used for the offline test.

### Needs manual verification (not possible from here)

- [ ] **Compile and run each C program on your own computer or in CodeTantra.** All runs here were on Linux with gcc.
  The code is plain C99, but nobody has tried it on your machine.
- [ ] **Open `web/index.html` by double-clicking it** in the browser you will use for the demonstration, and run the demonstration
  once on the real machine and projector, with a stopwatch. The times in the script are suggestions.
- [ ] **Other browsers and real phones.** Only Chromium was tested. Check Firefox, Safari and an actual phone if you will show it
  on one.
- [ ] **Screen reader.** Labels and live announcements are in place, but no screen reader was used.
- [ ] **Larger screens** such as a 1920 px projector. Tested at 1280 px and 390 px only.
- [ ] **Take your own C screenshots** (list further down); the report should show your own run.
- [ ] **Check the submission format** with your instructor (file names, whether web files are accepted, report layout).
- [ ] If you want to run the full test script yourself on Windows, it needs Git Bash or WSL, plus Python 3, Node.js and gcc.

### Known limitations

- It is a simulation. It is not a safety-certified controller and must not be used to control a real wheelchair.
- The C programs and the website are two separate implementations of the same rules. They are compared by tests, not connected.
- Features that exist only on the website: battery, sensor failure, obstacle editing, the four-point recovery checklist,
  the six scenarios, and the event log view.
- In the C programs directions must be typed as capital letters N, E, S, W.
- Scenarios use fixed delays and take 8 to 14 seconds each.
- On a 390 px phone the room cells are about 25 px wide, below the usual 32 px tap size. The room is readable but placing
  obstacles by touch is fiddly. All other buttons meet 32 px.
- The page needs a browser from 2023 or later (it uses CSS `color-mix`). Fonts load from Google Fonts when online;
  offline it falls back to system fonts.
- State is not saved. Reloading the page starts again, and nothing is stored in a browser database.
- The event log keeps the newest 2000 entries.
- Reset during an emergency stop is allowed as a full restart (empty queue and stack); the log says so.

## 4. Defects found by the reviews and fixed

### First review

1. **C programs looped forever on wrong input (all three).** Typing a letter at a menu, or reaching the end of input,
   made each program print its menu millions of times. Letters given as a position also pushed random values.
   Fixed with a scanf return check, `clearInput()` and `feof(stdin)`. Seven new C tests cover it.
2. **Queue view could not show overflow.** It told the user to turn auto-run off, but the switch was only on the Simulator view,
   so requests were processed before the queue filled. Added the switch to the Queue view; all switches stay in sync.
3. **Sensor view could not process its own requests** once auto-run was off (it is switched off by every emergency stop).
   Added Step and auto-run controls there.
4. **Hidden buttons showed anyway.** CSS `display` on buttons overrode the `hidden` attribute, so "Stop" appeared on every
   scenario card and "Restore sensor now" showed with a healthy sensor. Added a global `[hidden]` rule.
5. **No safety state on most views.** Only the header badge changed. Added a banner on every view for ESTOP, FAULT and an empty
   battery, with a link to where you fix it.
6. **Keyboard focus in the room grid jumped back to cell (1, 1)** after every change. Focus now stays on the cell you moved to.
7. **Reset during an emergency stop** cleared it without saying so. It still does (a full restart with an empty queue), but the log now states it.
8. **Queue display helper could loop forever** if the indices were ever corrupted. It now walks a fixed count of slots.
9. **A crash inside the tests hid all results.** Crashes are now reported as a failed test.
10. Smaller: dashboard tiles left one tile alone on a row; queue ring pointer labels were clipped; battery wording mixed
    "percent" and "%"; popped stack slot label differed from the others; unused code removed; a no-JavaScript message added.

### Final pre-submission pass

1. **Phone: the active tab was out of sight.** The tab bar scrolls sideways, and opening Queue, Stack, Sensors, Safety, Event log
   or Scenario lab left the highlighted tab off screen, so the person could not see where they were. The page now centres the active tab.
   The new audit check failed for six views before the fix and passes after it.
2. **Faded queue and stack labels were read by screen readers.** When a slot empties its old label fades out visually but stayed in the page,
   so an empty slot could be read as "MOVE S". The faded label is now hidden from assistive technology and the slot is announced as empty.
3. **No page icon.** Normal Chrome asks the server for `favicon.ico`; over `python3 -m http.server` that is a 404 in the console.
   The page now has its own small inline icon. A stray non-standard `<meta>` tag was also removed.
4. **Test additions only:** `browser-tests.js audit` (every button, both widths, log and state ledger), `browser-tests.js demo`, a compiler warning check
   in `run-all-tests.sh`, and a shared `dom-sync.js`. The audit was proved sensitive by running it against a broken copy.

Nothing in the stack, queue, safety or simulation logic needed to change in this pass.

### Checked and found correct

- Stack starts at -1, push and pop correct, overflow and underflow leave the data unchanged (C and JS).
- Queue front and rear conventions identical in the C queue program, the C simulator and JavaScript; wraparound and last-element reset correct.
- Displayed sizes and indices always match the data (600 random clicks in the browser, 8000 random actions in logic).
- Refused moves never enter the history; BACK always restores the top of the stack.
- Emergency stop cannot be bypassed by queued commands; recovery needs confirmation and passing checks.

## 5. Screenshots to take yourself (C programs)

The website screenshots are in `docs/screenshots/` (made by the browser test). The report should show your own C runs:

- [ ] Compiling the simulator with no warnings (`gcc -Wall -Wextra -std=c99 ...`)
- [ ] Stack program: push three positions, display, pop, then pop on an empty stack (STACK UNDERFLOW)
- [ ] Stack program: sixth push with SIZE 5 (STACK OVERFLOW)
- [ ] Queue program: queue full (Queue is Full) and the display after wraparound showing `front = 2, rear = 1`
- [ ] Simulator: option 9 showing the grid, then a blocked move into the obstacle
- [ ] Simulator: emergency stop with requests waiting (`2 pending request(s) removed`) and the release prompt
- [ ] The website logic tests: `node web/tests/unit-tests.js` ending in `76 passed, 0 failed`
- [ ] The parity check: `python3 web/tests/parity.py` ending in `65 state checks, 0 mismatches`

Tip: `c-programs/sample-output/` has the same sessions as text, if you want to compare with what you see.

## 6. Full output of the last run

<!-- RESULTS START -->
```
Test run: Wed Oct 21 08:45:24 IST 2026
gcc: gcc (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0
node: v22.22.0

== 0. Compiler warnings (gcc -Wall -Wextra -pedantic -std=c99, and clang if installed) ==
gcc   c-programs/wheelchair-history-stack.c: 0 warning(s)
clang c-programs/wheelchair-history-stack.c: 0 warning(s)
gcc   c-programs/request-circular-queue.c: 0 warning(s)
clang c-programs/request-circular-queue.c: 0 warning(s)
gcc   c-programs/wheelchair-simulator.c: 0 warning(s)
clang c-programs/wheelchair-simulator.c: 0 warning(s)

== 1. C programs (c-programs/tests/c-program-tests.py) ==
PASS  P1 empty stack: display, pop and peek all report empty or underflow
PASS  P1 one element: push, peek, display, pop, then empty again
PASS  P1 stack overflow: the 6th push prints STACK OVERFLOW and the top stays (5, 5)
PASS  P1 stack underflow: third pop on a stack of two prints STACK UNDERFLOW
PASS  P1 last in, first out: pops come back (1,3), (1,2), (1,1)
PASS  P1 repeated push and pop: 20 rounds, stack empty at the end
PASS  P2 empty queue: dequeue, peek and display all say Queue is Empty
PASS  P2 one element: front = 0 and rear = 0, then removed and empty again
PASS  P2 queue overflow: 6th enqueue prints Queue is Full, front = 0, rear = 4
PASS  P2 queue underflow: dequeue on an empty queue prints Queue is Empty
PASS  P2 wraparound: rear wraps from 4 to 0 then 1, front = 2, order S W N E S
PASS  P2 removing the final element resets front and rear to -1, next enqueue restarts at 0
PASS  P2 repeated insertion and removal: 20 rounds, no Full, no Empty message, queue empty at the end
PASS  P2 invalid move X is rejected
PASS  P3 queue underflow and stack underflow are both reported
PASS  P3 normal movement: two moves East reach (1, 3)
PASS  P3 movement blocked by an obstacle at (2, 3): chair stays at (1, 3), mode BLOCKED, nothing pushed
PASS  P3 wall boundary: moving North from the start is blocked, chair stays, nothing pushed
PASS  P3 queue overflow: the 9th request prints QUEUE OVERFLOW, rear = 7, front = 0
PASS  P3 circular wraparound: after 3 removals and 2 more requests rear wraps to 1, front = 3
PASS  P3 removing the final queue element: front and rear return to -1
PASS  P3 stack overflow: the 11th saved move is refused, chair stays put
PASS  P3 reaching the goal after 9 moves prints Destination reached and mode ARRIVED
PASS  P3 sensor: clearance ahead from the start is 300 cm
PASS  P3 emergency stop: 2 requests removed, new request refused, processing refused
PASS  P3 emergency stop: stack kept (top = 0) and queue empty while stopped
PASS  P3 release: answering 0 keeps ESTOP, answering 1 releases it, BACK then works
PASS  wheelchair-history-stack: a letter at the menu prints Invalid choice and the program carries on
PASS  request-circular-queue: a letter at the menu prints Invalid choice and the program carries on
PASS  wheelchair-simulator: a letter at the menu prints Invalid choice and the program carries on
PASS  wheelchair-history-stack: end of input stops the program instead of looping
PASS  request-circular-queue: end of input stops the program instead of looping
PASS  wheelchair-simulator: end of input stops the program instead of looping
PASS  P1: letters instead of a position are refused and nothing is pushed
PASS  P3: answering yes instead of 1 does not release the emergency stop

35 passed, 0 failed

== 2. Website logic (web/tests/unit-tests.js) ==
PASS  stack: new stack is empty with top = -1
PASS  stack: pop on empty gives SUNDERFLOW and changes nothing
PASS  stack: peek on empty gives SUNDERFLOW
PASS  stack: one element, top = 0
PASS  stack: pop returns the element and top goes back to -1
PASS  stack: full at top = 4
PASS  stack: overflow refused, data and top unchanged
PASS  stack: last in, first out
PASS  stack: 30 push and pop rounds leave it empty and correct
PASS  queue: new queue is empty with front = -1 and rear = -1
PASS  queue: dequeue on empty gives QUNDERFLOW and changes nothing
PASS  queue: one element gives front = 0 and rear = 0
PASS  queue: removing the final element resets front and rear to -1
PASS  queue: full after 5 items, front = 0 and rear = 4
PASS  queue: overflow refused, nothing changed
PASS  queue: wraparound, rear goes 4 to 0 to 1 and front is 2
PASS  queue: first in, first out after wraparound
PASS  queue: full again after wraparound
PASS  queue: 40 enqueue and dequeue rounds leave it empty and correct
PASS  sim: starts at (1, 1) facing E, READY, battery 100, queue and stack empty
PASS  sim: normal move east to (1, 2) saves (1, 1) before moving
PASS  sim: wall boundary blocks the move, nothing pushed, mode BLOCKED
PASS  sim: obstacle at (2, 3) blocks the move, chair stays at (1, 3), stack top is 1
PASS  sim: sensor at start reads 300 cm (capped)
PASS  sim: sensor facing the obstacle reads 0 cm and warns
PASS  sim: BACK with an empty stack gives SUNDERFLOW and the chair stays
PASS  sim: ninth request gives QOVERFLOW, queue stays at 8 items, front 0 rear 7
PASS  sim: request numbers are not used up by a refused request
PASS  sim: ESTOP removes the 2 pending requests, keeps the stack, counts one stop
PASS  sim: during ESTOP new requests and steps are refused, the chair does not move
PASS  sim: recovery without operator confirmation is refused
PASS  sim: recovery is refused while the sensor is failed
PASS  sim: recovery succeeds after revalidation passes and resumes as READY
PASS  sim: BACK works after recovery using the kept stack
PASS  sim: pressing ESTOP twice counts only once
PASS  sim: 11th saved move is refused with SOVERFLOW, chair does not move, top stays 9
PASS  sim: sensor fault sets mode FAULT
PASS  sim: moves are refused and the sensor gives no reading while FAULT
PASS  sim: restoring the sensor returns to READY
PASS  sim: battery below 20 gives a low-battery warning once
PASS  sim: battery 0 gives DEPLETED and refuses moves
PASS  sim: recharge restores battery and leaves DEPLETED
PASS  sim: obstacles can be placed and removed on floor cells only
PASS  sim: BACK onto a cell that now has an obstacle is refused and nothing is popped
PASS  sim: emptying the log array does not change the simulation state
PASS  sim: RESET keeps the map, empties queue and stack and returns the chair to the start
PASS  revalidation: a queued move is checked against the room at the moment it runs
PASS  after recovery the old requests are gone, so nothing resumes blindly
PASS  a sensor failure queued before a move makes the move refused (conservative stop)
PASS  reset while stopped gives the full start state (position, heading, battery, sensor, counts, queue, stack)
PASS  reset while stopped says in the log that it cleared the stop
PASS  reset with the default map removes placed obstacles
PASS  log for a successful move reads ENQUEUE, DEQUEUE, PUSH, MOVED in that order
PASS  log for a blocked move reads ENQUEUE, DEQUEUE, BLOCKED with no PUSH
PASS  random: the wheelchair never stands on a wall or obstacle
PASS  random: queue size, front, rear and filled slots always agree
PASS  random: stack top and filled slots always agree
PASS  random: the queue is always empty while the emergency stop is on
PASS  random: battery stays 0 to 100 and an empty battery always stops movement
PASS  random: a failed sensor always stops movement (FAULT unless ESTOP or DEPLETED)
PASS  random: a refused request never moves the chair or changes the stack; a move changes both by one
PASS  random: BACK always returns to the position that was on top of the stack
PASS  random: saved positions and the chair always form an unbroken path
PASS  random: the mode is always one of the six known modes
PASS  scenario "Normal movement": two runs give identical traces
PASS  scenario "Obstacle detection": two runs give identical traces
PASS  scenario "Stack underflow": two runs give identical traces
PASS  scenario "Queue overflow": two runs give identical traces
PASS  scenario "Emergency stop": two runs give identical traces
PASS  scenario "Sensor failure": two runs give identical traces
PASS  scenario normal: reaches the goal then goes back one step
PASS  scenario obstacle: blocked once, then reaches (2, 4) by going around
PASS  scenario underflow: SUNDERFLOW logged twice
PASS  scenario overflow: QOVERFLOW logged once and the queue ends empty
PASS  scenario estop: one stop, recovery done, back at (1, 1)
PASS  scenario sensor: FAULT, refused move, no reading, restore, then moves

76 passed, 0 failed

== 3. C and JavaScript parity (web/tests/parity.py) ==
ok   normal 15 commands compared
ok   obstacle 12 commands compared
ok   underflow 10 commands compared
ok   overflow 17 commands compared
ok   estop 11 commands compared
skip sensor (uses sensor failure, which the C program does not have)
65 state checks, 0 mismatches

== 4. Mutation check (web/tests/mutation-check.sh) ==
CAUGHT  obstacle and wall check removed (6 failing tests)
CAUGHT  emergency stop does not flush queue (6 failing tests)
CAUGHT  move does not save history (10 failing tests)
CAUGHT  history saved even when blocked (6 failing tests)
CAUGHT  BACK restores the wrong cell (5 failing tests)
CAUGHT  queue rear does not wrap with % (3 failing tests)
CAUGHT  queue front does not wrap with % (1 failing tests)
CAUGHT  last dequeue does not reset to -1 (6 failing tests)
CAUGHT  stack full check off by one (5 failing tests)
CAUGHT  steps run during emergency stop (3 failing tests)
CAUGHT  sensor failure does not stop moves (4 failing tests)
CAUGHT  recovery skips the checks (2 failing tests)
CAUGHT  recovery without confirmation (3 failing tests)

== 5. Browser tests: functional, audit of every button, demo rehearsal (web/tests/browser-tests.js) ==
===== suite: functional =====
58 passed, 0 failed
===== suite: audit =====
Total clicks: 866
112 passed, 0 failed
===== suite: demo =====
23 passed, 0 failed
```
<!-- RESULTS END -->
