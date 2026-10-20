// Rehearses the browser half of the teacher demonstration (docs/demo-script.md) with real clicks,
// exactly in the order the script says, and checks what the screen shows at each step.
// Run:  node tests/demo-rehearsal.js        (needs Playwright, like browser-test.js)
const path = require('path');
const { chromium } = require('playwright');
const { domMatchesState, ledgerMatches } = require('./dom-sync');

const results = [];
const check = (name, ok, extra) => { results.push([name, !!ok]); if (!ok) console.log('   detail: ' + extra); };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] }).catch(() =>
    chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] }));
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.evaluate('window.domMatchesState = ' + domMatchesState.toString());
  await page.evaluate('window.ledgerMatches = ' + ledgerMatches.toString());
  const txt = async (sel) => (await page.locator(sel).first().textContent()).trim();
  const go = async (v) => { await page.evaluate((h) => { location.hash = h; }, v); await page.waitForTimeout(80); };
  const synced = async () => (await page.evaluate(() => domMatchesState().concat(ledgerMatches()))).length === 0;
  const q = () => page.evaluate(() => ({ front: WCApp.sim.queue.front, rear: WCApp.sim.queue.rear, size: WCApp.sim.queue.size() }));
  const logHas = (code) => page.evaluate((c) => WCApp.sim.log.some((e) => e.code === c), code);

  // W1 dashboard
  check('W1 dashboard: READY, queue 0 / 8, stack 0 / 10', (await txt('#hdr-mode')) === 'READY' && (await txt('#t-queue')) === '0 / 8' && (await txt('#t-stack')) === '0 / 10');

  // W2 queue: overflow and wraparound by hand
  await go('queue');
  await page.click('#autorun-btn-queue');
  check('W2 auto-run is off', (await page.getAttribute('#autorun-btn-queue', 'aria-pressed')) === 'false');
  for (let i = 0; i < 8; i++) await page.click('#view-queue [data-action="move"][data-dir="E"]');
  let s = await q();
  check('W2 eight MOVE E fill the queue: front 0, rear 7, size 8', s.front === 0 && s.rear === 7 && s.size === 8, JSON.stringify(s));
  console.log('   queue state shows: "' + (await txt('#q-state')) + '", formula line: ' + (await txt('#queue-formula')));
  await page.click('#view-queue [data-action="move"][data-dir="E"]');
  s = await q();
  check('W2 ninth request refused (QOVERFLOW), queue unchanged', (await logHas('QOVERFLOW')) && s.size === 8 && s.rear === 7, JSON.stringify(s));
  for (let i = 0; i < 3; i++) await page.click('#view-queue [data-action="step"]');
  s = await q();
  check('W2 three steps: front 3, rear 7, size 5', s.front === 3 && s.rear === 7 && s.size === 5, JSON.stringify(s));
  await page.click('#view-queue [data-action="move"][data-dir="W"]');
  await page.click('#view-queue [data-action="move"][data-dir="W"]');
  s = await q();
  check('W2 two more requests wrap around: rear 0 then 1, front 3, size 7', s.front === 3 && s.rear === 1 && s.size === 7, JSON.stringify(s));
  console.log('   formula line: ' + (await txt('#queue-formula')));
  check('W2 screen, state and log agree', await synced());

  // W2b stack view after 3 moves
  await go('stack');
  const top = await page.evaluate(() => WCApp.sim.stack.top);
  check('W2b stack holds the 3 positions the chair left (top = 2)', top === 2 && (await txt('#s-top')) === '2', String(top));
  await page.click('#view-stack [data-action="peeks"]');
  check('W2b peek reads the top without removing it', (await page.evaluate(() => WCApp.sim.stack.top)) === 2);

  // W3 reset, then underflow: BACK with nothing saved
  await go('simulator');
  await page.click('#view-simulator [data-action="reset"]');
  await page.click('#view-simulator [data-action="back"]');
  await page.click('#view-simulator [data-action="step"]');
  check('W3 BACK on an empty stack is refused: SUNDERFLOW logged, chair stays at (1, 1)',
    (await logHas('SUNDERFLOW')) && (await page.evaluate(() => WCApp.sim.state.row + ',' + WCApp.sim.state.col)) === '1,1');

  // W4 obstacle: E, E, S
  await page.click('#view-simulator [data-action="reset"]');
  await page.click('.dpad-e'); await page.click('.dpad-e'); await page.click('.dpad-s');
  for (let i = 0; i < 3; i++) await page.click('#view-simulator [data-action="step"]');
  check('W4 third move is BLOCKED by the obstacle; chair at (1, 3); stack top 1 (two saved)',
    (await txt('#hdr-mode')) === 'BLOCKED' && (await page.evaluate(() => WCApp.sim.state.row + ',' + WCApp.sim.state.col + ',' + WCApp.sim.stack.top)) === '1,3,1');
  check('W4 sync', await synced());

  // W5 emergency stop with two requests waiting, then recovery
  await page.click('.dpad-e'); await page.click('.dpad-e');
  await page.keyboard.press('Escape');
  check('W5 Esc: mode ESTOP, queue emptied, stack kept (top 1), red banner shown',
    (await txt('#hdr-mode')) === 'ESTOP' && (await q()).size === 0 && (await page.evaluate(() => WCApp.sim.stack.top)) === 1 && await page.locator('#safety-banner').isVisible());
  await page.click('.dpad-e');
  check('W5 a new request is refused while stopped', (await q()).size === 0);
  await go('safety');
  check('W5 Resume is disabled until the box is ticked', await page.locator('#release-btn').isDisabled());
  await page.check('#ack');
  check('W5 after ticking, the four checks pass and Resume is enabled', await page.locator('#release-btn').isEnabled());
  await page.click('#release-btn');
  console.log('   mode after Resume: ' + (await txt('#hdr-mode')));
  check('W5 Resume: mode READY, queue empty, stack still holds 2 positions (top 1)',
    (await txt('#hdr-mode')) === 'READY' && (await q()).size === 0 && (await page.evaluate(() => WCApp.sim.stack.top)) === 1);
  check('W5 sync', await synced());

  // W6 sensor failure
  await go('sensors');
  await page.click('#view-sensors [data-action="fault"]');
  await page.click('#view-sensors [data-action="step"]');
  check('W6 sensor failure: FAULT and "No reading"', (await txt('#hdr-mode')) === 'FAULT' && (await txt('#s-clear')) === 'No reading');
  await page.click('#view-sensors [data-action="restore"]');
  await page.click('#view-sensors [data-action="step"]');
  check('W6 restore: sensor reads again', (await txt('#s-clear')) !== 'No reading');

  // W7 event log: clear view does not change anything
  await go('eventlog');
  const before = await page.evaluate(() => JSON.stringify([WCApp.sim.state.row, WCApp.sim.state.col, WCApp.sim.queue.front, WCApp.sim.queue.rear, WCApp.sim.stack.top, WCApp.sim.log.length]));
  await page.click('[data-action="logclear"]');
  const after = await page.evaluate(() => JSON.stringify([WCApp.sim.state.row, WCApp.sim.state.col, WCApp.sim.queue.front, WCApp.sim.queue.rear, WCApp.sim.stack.top, WCApp.sim.log.length]));
  check('W7 Clear view changes only the view (state, queue, stack and log length identical)', before === after, before + ' vs ' + after);
  await page.click('#logshow-btn');
  check('W7 Show cleared entries brings them back', await page.locator('#logshow-btn').isHidden());

  check('no script errors during the rehearsal', errors.length === 0, errors.join(' | '));
  await browser.close();
  const failed = results.filter((r) => !r[1]);
  console.log(results.map((r) => (r[1] ? 'PASS  ' : 'FAIL  ') + r[0]).join('\n'));
  console.log((results.length - failed.length) + ' passed, ' + failed.length + ' failed');
  process.exit(failed.length ? 1 : 0);
})();
