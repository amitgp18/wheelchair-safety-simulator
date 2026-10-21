# Wheelchair Safety Simulator (website)

A browser simulation of the Smart Assistive Wheelchair Control and Safety project.
Plain HTML, CSS and JavaScript. No framework, no build step, no database, no paid service.

**Honest scope.** Everything is simulated. No sensor, motor, camera or wheelchair is connected, and there is no AI.
The page runs JavaScript copies of the stack and circular queue from the C lab programs. It does not run the C program.

## Run it

Option 1 (simplest): open `index.html` by double-clicking it. Everything works from a file.

Option 2 (local server, if your browser blocks something): in this folder run one of

    npx serve .
    python3 -m http.server 8000

then open the address it prints (for example http://localhost:8000).

Fonts (IBM Plex, Barlow) load from Google Fonts when you are online. Offline, the page falls back to your system fonts and still works.

## Run the tests

    node tests/run-node.js        76 logic tests (stack, queue, rules, scenarios, 8000 random actions)
    open tests.html               the same tests inside the browser
    python3 tests/parity.py       compares this JavaScript with ../c-programs/wheelchair-simulator.c (needs gcc and node)
    sh tests/mutation-check.sh    breaks the code 13 ways and confirms the tests notice
    node tests/browser-test.js    58 end-to-end checks in headless Chromium, saves screenshots to ../docs/screenshots
    node tests/final-audit.js     clicks every button on every view at 1280 px and 390 px; checks screen, state and log after each click
    node tests/demo-rehearsal.js  performs the website half of the teacher demonstration (../docs/demo-script.md)
                                  (needs: npm install playwright, then npx playwright install chromium)

## Files

| File | What it does |
|---|---|
| index.html | Page structure, 8 views, local SVG icons |
| css/styles.css | Design tokens, layout, dark and light themes, reduced motion |
| js/config.js | Every constant (sizes, battery cost, the default map) |
| js/structures.js | Stack and CircularQueue, written the same way as the C programs |
| js/safety.js | Simulated sensor, mode rules, recovery checks |
| js/simulation.js | Grid, wheelchair, queue and stack use, event log, command language, trace |
| js/scenarios.js | The six scenarios as plain text commands |
| js/ui.js | Drawing and event handling only. It never edits state directly |
| tests/ | Logic tests, browser end-to-end test, C parity check, mutation check |

## Keys

Arrow keys or W A S D add a move request. B adds BACK. N processes one request. Esc is the emergency stop.
In Edit obstacles mode the arrow keys move between cells and Enter or Space places or removes an obstacle.

## Same convention as the C lab programs

Stack: `top = -1` is empty. Queue: `front = -1` and `rear = -1` are empty, full when `(rear + 1) % MAX == front`,
and both go back to -1 when the last item leaves. Sizes: queue 8, stack 10, grid 8 by 12.
