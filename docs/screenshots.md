# Screenshot checklist for the report

The 12 website screenshots in `screenshots/` were taken automatically by `web/tests/browser-test.js`
(run it again to refresh them). Take the C screenshots yourself in your own terminal or CodeTantra,
because the report should show your own run.

## Website (already captured)

| File | Shows | Suggested report section |
|---|---|---|
| 01-dashboard.png | Status, battery, distance, queue and stack sizes, stop count, latest events | System overview |
| 02-simulator-requests-queued.png | Room grid with three move requests waiting | Simulation |
| 03-simulator-blocked-by-obstacle.png | Move into the obstacle at (2, 3) refused, cell highlighted, message | Obstacle and boundary checking |
| 04a-queue-full.png | 8 of 8 slots, FULL, the formula (rear + 1) % 8 = front | Circular queue: overflow |
| 04b-queue-wraparound.png | front 3, rear 1 after wrapping round | Circular queue: wraparound |
| 05-stack-with-history.png | Saved positions with TOP marked and "Next BACK restores" | Stack |
| 06-safety-recovery-checklist.png | Emergency stop engaged, four checks, confirmation | Safety logic |
| 07-sensors-failure.png | Sensor failure: No reading, FAULT banner | Sensor and fail-safe stop |
| 08-event-log.png | Timestamped log of queue, stack, movement and safety events | Event log |
| 09-scenario-lab-running.png | A scenario running with live grid, log and trace | Testing |
| 10-phone-simulator.png | Phone layout with the stop bar at the bottom | Responsive design |
| 11-light-theme-simulator.png | Light theme | Accessibility |

## C programs (take these yourself)

- [ ] Compiling program 3 with no warnings (`gcc -Wall -Wextra -std=c99 ...`)
- [ ] Program 1: push three positions, display, pop, then pop on an empty stack (STACK UNDERFLOW)
- [ ] Program 1: sixth push with SIZE 5 (STACK OVERFLOW)
- [ ] Program 2: queue full (Queue is Full) and the display after wraparound showing `front = 2, rear = 1`
- [ ] Program 3: option 9 showing the grid, then a blocked move into the obstacle
- [ ] Program 3: emergency stop with requests waiting (`2 pending request(s) removed`) and the release prompt
- [ ] The C test run: `python3 lab-sheet/tests/labtests.py` ending in `35 passed, 0 failed`
- [ ] The website logic tests: `node web/tests/run-node.js` ending in `76 passed, 0 failed`
- [ ] The parity check: `python3 web/tests/parity.py` ending in `65 state checks, 0 mismatches`

Tip: `lab-sheet/sample-output/` has the same sessions as text, if you want to compare with what you see.
