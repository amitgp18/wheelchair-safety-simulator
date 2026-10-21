# Final pre-submission checklist

Nothing below is marked as passed unless it was actually run. The evidence for every "verified" line is in
[test-results.txt](test-results.txt) (written by `sh run-all-tests.sh`). Environment of the recorded run: Ubuntu Linux,
gcc 13.3.0, clang 18.1.3, Node.js 22.22.0, Chromium 141 through Playwright 1.56.0.

This project is a **software simulation**. No real sensor, motor, camera, ESP32 or wheelchair is connected, and there is no AI.
The website runs JavaScript copies of the stack and circular queue; it does not run the C programs.

## 1. Verified and working (each item was run)

### C programs (`c-programs/`)

- [x] All three programs compile with **0 warnings** under `gcc -Wall -Wextra -pedantic -std=c99` and `clang -Wall -Wextra -std=c99`.
- [x] **35 of 35** scripted tests pass (`c-programs/tests/c-program-tests.py`): empty, one element, overflow, underflow, wraparound,
  removing the last element, repeated insert and remove, obstacle, emergency stop and release, and wrong input.
- [x] A letter or the end of the input at any prompt no longer hangs a program (it used to loop forever).
- [x] Typed by hand: the simulator demonstration sequence gives exactly the output in [demo-script.md](demo-script.md);
  the stack program gives `STACK OVERFLOW` on the 6th push, pops come back last in first out, then `STACK UNDERFLOW`.

### Website logic (`web/js/`)

- [x] **76 of 76** logic tests pass (`node web/tests/run-node.js`), including 8000 random actions that check size, front, rear,
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

### C and JavaScript agree

- [x] `web/tests/parity.py` feeds the same commands to the compiled the C simulator and to the JavaScript simulation:
  **65 states compared, 0 differences** (front, rear, top, position, heading, mode after every command).
  The sensor-failure scenario is not part of this, because the C program has no sensor failure.

### Website in a real browser (headless Chromium)

- [x] **58 of 58** end-to-end checks (`web/tests/browser-test.js`): real clicks and keys, 600 random clicks with the screen
  compared to the simulation state after every click, six scenarios each run twice with identical traces, phone width,
  light theme, reduced motion, keyboard focus.
- [x] **Final audit, 112 of 112** (`web/tests/final-audit.js`). It clicked **872 controls** (every visible, enabled button on
  all 8 views, three rounds, at 1280 px and 390 px wide). After every click it checked that:
  the screen matches the simulation, the event log adds up to the real queue size, stack size, move count and stop count,
  and the saved positions form an unbroken path. It also checked that every icon points at a real symbol, every control has a
  name, there is no placeholder text (`undefined`, `NaN`, `TODO`, `lorem`, and similar), there is no sideways scrolling,
  the active tab is visible, phone buttons are at least 32 px (map cells excepted, see limitations),
  and there are **no script errors, console errors or warnings**.
  The audit was also run against a deliberately broken copy (a move that is not counted) and it failed, so it does notice problems.
- [x] **Demonstration rehearsal, 23 of 23** (`web/tests/demo-rehearsal.js`): the website half of the demonstration, click for click.
- [x] Event log, queue, stack, chair position, move counter and stop counter stayed synchronized in all of the above.
- [x] Served over http (`python3 -m http.server`): all files load with status 200, no console messages other than the blocked
  Google Fonts request used for the offline test.

### Earlier version

- [x] `c-core/` (reference only) still passes its own 126 tests.

## 2. Needs manual verification (not possible from here)

- [ ] **Compile and run each C program on your own computer or in CodeTantra.** All runs here were on Linux with gcc.
  The code is plain C99, but nobody has tried it on your machine.
- [ ] **Open `web/index.html` by double-clicking it** in the browser you will use for the demonstration, and run the demonstration
  once on the real machine and projector, with a stopwatch. The times in the script are suggestions.
- [ ] **Other browsers and real phones.** Only Chromium was tested. Check Firefox, Safari and an actual phone if you will show it
  on one.
- [ ] **Screen reader.** Labels and live announcements are in place, but no screen reader was used.
- [ ] **Larger screens** such as a 1920 px projector. Tested at 1280 px and 390 px only.
- [ ] **Take your own C screenshots** (list in [screenshots.md](screenshots.md)); the report should show your own run.
- [ ] **Check the submission format** with your instructor (file names, whether web files are accepted, report layout).
- [ ] **Push to GitHub.** The local repository is ready; creating the online copy needs your GitHub login (steps in the README).
- [ ] If you want to run the full test script yourself on Windows, it needs Git Bash or WSL, plus Python 3, Node.js and gcc.

## 3. Known limitations

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
- The earlier planning documents in Claude Docs (Architecture and Plan, C Core guide) still describe the older count-based queue.
  The files in `docs/` are the source of truth.
