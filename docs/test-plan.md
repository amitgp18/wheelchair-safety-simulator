# Test plan and results

All results below come from real runs. The full output of the last run is in [test-results.txt](test-results.txt).
To repeat everything: `sh run-all-tests.sh` from the project folder.

**Environment of the recorded run:** Ubuntu Linux, gcc 13.3.0, clang 18.1.3, Node.js 22.22.0, Chromium 141 through Playwright 1.56.0.

## Summary

| Suite | What it checks | Result |
|---|---|---|
| C lab programs (`c-programs/tests/c-program-tests.py`) | The three C programs, driven through their menus | **35 passed, 0 failed** |
| JavaScript logic (`web/tests/run-node.js`) | Stack, queue, simulation rules, scenarios, 8000 random actions | **76 passed, 0 failed** |
| Parity (`web/tests/parity.py`) | the C simulator and the JavaScript give the same front, rear, top, position, heading and mode after every command | **65 states compared, 0 differences** |
| Mutation check (`web/tests/mutation-check.sh`) | The code is broken 13 ways on purpose; the tests must notice each one | **13 of 13 caught** |
| Browser end-to-end (`web/tests/browser-test.js`) | Real clicks and keys in headless Chromium; screen compared with state | **58 passed, 0 failed** |
| Final audit (`web/tests/final-audit.js`) | Every visible button on all 8 views, 3 rounds, at 1280 px and 390 px (872 clicks). After each click: screen, state and event log agree; also icons, names, placeholder text, sideways scrolling, active tab, console errors | **112 passed, 0 failed** |
| Demonstration rehearsal (`web/tests/demo-rehearsal.js`) | The website half of the teacher demonstration, click for click | **23 passed, 0 failed** |
| Sample outputs | The 7 saved sessions in `c-programs/sample-output/` replayed on the C code during the earlier review pass | 7 of 7 identical (not part of `run-all-tests.sh`; not repeated in the final pass) |
| Compiler warnings (in `run-all-tests.sh`) | `gcc -Wall -Wextra -pedantic -std=c99` and `clang -Wall -Wextra -std=c99` on all three programs | **0 warnings** |
| Earlier `c-core` version (reference) | Its own test file | 126 passed, 0 failed |

## Test cases by requirement

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
| 27 | No script errors | console checked during the whole browser run and the final audit (872 clicks, two widths) | | | Pass |
| 28 | Log, queue, stack and counters stay synchronized | after every audit click: log entries add up to queue size, stack size, move count and stop count; saved positions form an unbroken path | | | Pass |
| 29 | Every button works | all visible, enabled buttons on all 8 views clicked in 3 rounds at 2 widths; no error, screen equals state each time | | | Pass |
| 30 | No broken icons or placeholder text | every `use` reference resolves; visible text scanned for `undefined`, `NaN`, `TODO`, `lorem`, `placeholder` | | | Pass |
| 31 | Phone navigation | the active tab is scrolled into view in the tab bar on all 8 views | | | Pass |
| 32 | Demonstration works as written | `demo-rehearsal.js` performs the script's website steps | | | Pass |

## Mutation check (does each test really test something?)

Each line below is a copy of the code with one rule broken. Every one made at least one test fail:
obstacle check removed, stop does not flush the queue, move does not save history, history saved even when blocked,
BACK restores the wrong cell, rear does not wrap, front does not wrap, last dequeue does not reset to -1,
stack full check off by one, steps run during the stop, sensor failure does not stop moves,
recovery skips the checks, recovery without confirmation.

## Not verified

- **Your own computer and CodeTantra.** All runs were on Linux. The C code is standard C99 and should compile anywhere, but compile and run it once in CodeTantra before submitting.
- **Other browsers.** Only Chromium was tested automatically. Firefox, Safari and phone browsers were not tested. The page needs a browser from 2023 or later (it uses CSS `color-mix`).
- **Larger screens.** Tested at 1280 px and 390 px only.
- **Screen readers.** Labels and live announcements are in place, but no screen reader was used to check them.
- **The sensor-failure scenario against C.** the C simulator has no sensor failure, so that scenario is compared only inside JavaScript.
