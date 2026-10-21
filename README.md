# Smart Assistive Wheelchair Control and Safety Simulator

A second-year college project for CSS2281 (C Programming and Data Structures Lab).
It shows an **array stack** and a **bounded circular queue** working inside a small wheelchair
safety simulation, first as C console programs and then as a browser simulator.

## Honest scope

- Everything is a **software simulation**. No real sensor, motor, camera, ESP32 or wheelchair is connected, and there is no AI.
- The C programs and the website are **two separate implementations of the same algorithms**.
  The website runs JavaScript. It does **not** run the C code, and there is no bridge between them.
- Evidence that they behave the same: `web/tests/parity.py` feeds the same scenarios to the compiled C program and to the
  JavaScript simulation and compares queue, stack, position, heading and mode after every command (65 states, 0 differences).
- This is an educational model. It is not a safety-certified wheelchair controller.

## Architecture

```
            same rules, written twice
   ┌──────────────────────────┐     ┌──────────────────────────────────────────┐
   │ C (c-programs/)            │     │ Browser (web/)                            │
   │ history stack (C)         │     │ structures.js  Stack, CircularQueue       │
   │ request queue (C)         │     │ safety.js      sensor, mode rules, checks │
   │ wheelchair simulator (C)  │     │ simulation.js  state, moves, log, trace   │
   │  (menu, printf)           │     │ ui.js          drawing and input only     │
   └────────────┬─────────────┘     └───────────────────┬──────────────────────┘
                │      tests/parity.py compares          │
                └────────── both, command by command ────┘
```

How a request flows (both versions):

1. A **move, BACK or SENSE request** is added to the rear of the **circular queue** (size 8).
2. **Processing** removes the request at the front (first in, first out).
3. For a move, the rules are checked **at that moment**: emergency stop, empty battery, failed sensor, then "is the next cell free?".
4. If the move is allowed, the **old position is pushed on the stack** (size 10) and the chair moves one cell.
   A refused move changes nothing and saves nothing.
5. **BACK** pops the stack and returns to that position (last in, first out).
6. **Emergency stop** never enters the queue. It acts at once, removes every waiting request, keeps the stack,
   and refuses new requests until the operator confirms recovery and the checks pass.

In the browser, `ui.js` never edits the state. It calls methods on the simulation object and redraws from it,
so every number on screen is read from the real queue and stack.

## Folder structure

```
wheelchair-sim/
├── README.md                 this file
├── run-all-tests.sh          runs every test and writes docs/test-results.txt
├── c-programs/               the C programs to submit (lab style, one file each)
│   ├── wheelchair-history-stack.c
│   ├── request-circular-queue.c
│   ├── wheelchair-simulator.c
│   ├── sample-output/        real terminal sessions
│   ├── tests/c-program-tests.py     35 scripted tests for the three programs
│   └── README.md
├── web/                      the website
│   ├── index.html  tests.html  README.md
│   ├── css/styles.css
│   ├── js/config.js  structures.js  safety.js  simulation.js  scenarios.js  ui.js
│   └── tests/tests.js  run-node.js  browser-test.js  final-audit.js  demo-rehearsal.js  dom-sync.js  parity.py  mutation-check.sh
├── docs/
│   ├── data-structures.md    the stack and queue explained, C next to JavaScript
│   ├── final-checklist.md    verified / needs manual verification / known limitations
│   ├── demo-script.md        rehearsed 4-minute teacher demonstration, exact keys and expected output
│   ├── test-plan.md          test plan and the real results
│   ├── test-results.txt      full output of the last run of run-all-tests.sh
│   ├── screenshots.md        screenshot checklist for the report
│   ├── screenshots/          12 screenshots taken by the browser test
│   ├── viva-notes.md         short answers for the viva
│   └── review-notes.md       what the code review found and fixed
└── c-core/                   earlier multi-file C version, kept for reference only (see c-core/NOTE.md)
```

## Run it

**C programs** (gcc or clang; on Windows use MinGW, MSYS2 or CodeTantra):

```
cd c-programs
gcc -Wall -Wextra -std=c99 -o wheelchair-simulator wheelchair-simulator.c
./wheelchair-simulator                          (Windows: wheelchair-simulator.exe)
```

Programs 1 and 2 compile the same way. To run the C tests: `python3 tests/c-program-tests.py` (needs Python 3 and gcc).

**Website**: open `web/index.html` by double-clicking it. Nothing to install and no internet needed
(fonts load from Google Fonts when online; offline the page uses system fonts).
It needs a recent browser: it was tested in Chromium (Chrome and Edge use the same engine). Firefox and Safari were not tested.
If your browser blocks something when opened as a file, run `python3 -m http.server 8000` inside `web/` and open http://localhost:8000.

**All tests at once** (from the project folder; needs gcc, Python 3 and Node.js; the browser tests also need
`npm install playwright` and a Chromium, see below):

```
sh run-all-tests.sh
```

It prints a short summary and writes the full output to `docs/test-results.txt`. On Windows use Git Bash or WSL.

**Website tests one by one**:

```
cd web
node tests/run-node.js          76 logic tests, including 8000 random actions
python3 tests/parity.py         C and JavaScript compared (needs gcc and node)
sh tests/mutation-check.sh      breaks the code 13 ways and checks the tests notice
node tests/browser-test.js      58 end-to-end checks in headless Chromium (needs: npm install playwright, then npx playwright install chromium)
node tests/final-audit.js       clicks every button on every view at 1280 px and 390 px, checks screen, state and log each time
node tests/demo-rehearsal.js    performs the website half of the teacher demonstration
```

Or open `web/tests.html` to see the logic tests in the browser.

Results are in [docs/test-plan.md](docs/test-plan.md) and the honest summary of what is and is not verified is in
[docs/final-checklist.md](docs/final-checklist.md).

## For the demonstration and viva

- [docs/demo-script.md](docs/demo-script.md): a 4-minute demonstration with the exact keys and the real output.
- [docs/viva-notes.md](docs/viva-notes.md): simple answers on LIFO, FIFO, push, pop, enqueue, dequeue, circular queues,
  overflow, underflow and time complexity.
- [docs/data-structures.md](docs/data-structures.md): the stack and queue explained step by step.

## Put it on GitHub

The folder is a git repository. To publish it, create an empty repository on github.com (no README, no .gitignore), then in this folder run:

```
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git branch -M main
git push -u origin main
```

GitHub asks you to sign in (a personal access token or the GitHub CLI `gh auth login`). Do not put the token in any file.
