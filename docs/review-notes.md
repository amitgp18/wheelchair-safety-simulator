# Code review notes

What the integration review found, in order of impact, and what was done. Nothing working was thrown away.

## Fixed

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

## Final pre-submission pass (found and fixed)

1. **Phone: the active tab was out of sight.** The tab bar scrolls sideways, and opening Queue, Stack, Sensors, Safety, Event log
   or Scenario lab left the highlighted tab off screen, so the person could not see where they were. The page now centres the active tab.
   The new audit check failed for six views before the fix and passes after it.
2. **Faded queue and stack labels were read by screen readers.** When a slot empties its old label fades out visually but stayed in the page,
   so an empty slot could be read as "MOVE S". The faded label is now hidden from assistive technology and the slot is announced as empty.
3. **No page icon.** Normal Chrome asks the server for `favicon.ico`; over `python3 -m http.server` that is a 404 in the console.
   The page now has its own small inline icon. A stray non-standard `<meta>` tag was also removed.
4. **Test additions only:** `final-audit.js` (every button, both widths, log and state ledger), `demo-rehearsal.js`, a compiler warning check
   in `run-all-tests.sh`, and a shared `dom-sync.js`. The audit was proved sensitive by running it against a broken copy.

Nothing in the stack, queue, safety or simulation logic needed to change in this pass.

## Checked and found correct

- Stack starts at -1, push and pop correct, overflow and underflow leave the data unchanged (C and JS).
- Queue front and rear conventions identical in the C queue program, the C simulator and JavaScript; wraparound and last-element reset correct.
- Displayed sizes and indices always match the data (600 random clicks in the browser, 8000 random actions in logic).
- Refused moves never enter the history; BACK always restores the top of the stack.
- Emergency stop cannot be bypassed by queued commands; recovery needs confirmation and passing checks.

## Kept as it is, on purpose

- `c-core/` (earlier multi-file C version with a count-based queue) is kept for reference and marked as such in `c-core/NOTE.md`.
- The Word file from an earlier misunderstanding was removed from the project folder; it is not part of the deliverables.
- The earlier planning documents in Claude Docs (Architecture and Plan, C Core guide) describe the count-based queue.
  The files in `docs/` are now the source of truth.
