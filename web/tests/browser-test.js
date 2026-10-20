// End-to-end browser test. Opens index.html in headless Chromium, clicks the real controls,
// checks that every number on screen matches the simulation state, and saves screenshots
// for the report into ../docs/screenshots.
//
// Needs Playwright:   npm install playwright   then   npx playwright install chromium
// Run:                node tests/browser-test.js
// (If Chromium is somewhere else, set CHROMIUM=/path/to/chromium)
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const pageUrl = 'file://' + path.join(root, 'index.html');
const shots = path.join(root, '..', 'docs', 'screenshots');
fs.mkdirSync(shots, { recursive: true });

const results = [];
const errors = [];
function check(name, ok) { results.push([name, !!ok]); }

const { domMatchesState } = require('./dom-sync');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] }).catch(async () =>
    chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] }));

  async function fresh(view, opts) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' }, opts || {}));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/fonts|Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.goto(pageUrl + '#' + (view || 'dashboard'));
    await page.evaluate(() => { WCApp.ui.speed = 0.05; });
    await page.evaluate('window.domMatchesState = ' + domMatchesState.toString());
    return page;
  }
  const txt = async (page, sel) => (await page.locator(sel).first().textContent()).trim();
  const go = async (page, view) => { await page.evaluate((v) => { location.hash = v; }, view); await page.waitForTimeout(50); };
  const shot = async (page, name, full) => page.screenshot({ path: path.join(shots, name + '.png'), fullPage: !!full });

  // 1. normal movement through the real buttons
  let page = await fresh('simulator');
  check('page opens READY at (1, 1)', (await txt(page, '#hdr-mode')) === 'READY' && (await txt(page, '#dash-position')).startsWith('Row 1, column 1'));
  await page.click('#autorun-btn');
  await page.click('.dpad-e'); await page.click('.dpad-e'); await page.click('.dpad-s');
  check('three move requests wait in the queue', (await txt(page, '#sim-pending')) === 'Pending: MOVE E, MOVE E, MOVE S');
  await shot(page, '02-simulator-requests-queued');
  for (let i = 0; i < 3; i++) await page.click('#view-simulator [data-action="step"]');
  check('obstacle at (2, 3) blocks the third move', (await txt(page, '#hdr-mode')) === 'BLOCKED' && (await page.evaluate(() => WCApp.sim.state.col)) === 3);
  check('blocked cell is highlighted and explained', (await page.locator('.cell.hit').count()) >= 1 && (await txt(page, '#sim-status')).startsWith('Blocked'));
  await shot(page, '03-simulator-blocked-by-obstacle');
  check('blocked move saved nothing (stack holds 2)', (await page.evaluate(() => WCApp.sim.stack.size())) === 2);
  check('screen matches state after normal movement', (await page.evaluate(domMatchesState)).length === 0);

  // 2. repeated movement with Process all, which locks controls while it runs
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await page.click('#view-simulator [data-action="drain"]');
  check('controls are locked while Process all runs', await page.locator('.dpad-e').isDisabled());
  await page.waitForFunction(() => WCApp.sim.queue.isEmpty() && !WCApp.ui.draining);
  check('Process all moved 4 cells east to (1, 7)', (await page.evaluate(() => [WCApp.sim.state.row, WCApp.sim.state.col].join())) === '1,7');
  check('controls unlock afterwards', await page.locator('.dpad-e').isEnabled());
  await go(page, 'stack');
  await shot(page, '05-stack-with-history');
  check('stack view shows 6 saved positions and TOP on slot 5', (await txt(page, '#s-size')) === '6 of 10' && (await page.locator('#stack-slots .sslot.top .idx').textContent()) === '5');
  await page.click('#view-stack [data-action="back"]');
  await page.click('#view-stack [data-action="step"]');
  check('BACK restores (1, 6)', (await page.evaluate(() => [WCApp.sim.state.row, WCApp.sim.state.col].join())) === '1,6');

  // 3. queue overflow and wraparound
  page = await fresh('queue');
  await page.click('#autorun-btn-queue');
  check('the Queue view has its own auto-run switch, kept in sync', (await page.getAttribute('#autorun-btn', 'aria-pressed')) === 'false');
  for (let i = 0; i < 9; i++) await page.click('#view-queue [data-action="move"][data-dir="E"]');
  check('ninth request refused, queue FULL 8 of 8', (await txt(page, '#q-state')) === 'FULL' && (await txt(page, '#q-size')) === '8 of 8');
  check('overflow is logged as QOVERFLOW', await page.evaluate(() => WCApp.sim.log.some((e) => e.code === 'QOVERFLOW')));
  await shot(page, '04a-queue-full');
  for (let i = 0; i < 3; i++) await page.click('#view-queue [data-action="step"]');
  await page.click('#view-queue [data-action="move"][data-dir="S"]'); await page.click('#view-queue [data-action="move"][data-dir="S"]');
  check('wraparound: front 3, rear 1 shown', (await txt(page, '#q-front')) === '3' && (await txt(page, '#q-rear')) === '1');
  await shot(page, '04b-queue-wraparound');

  // 4. emergency stop and recovery
  await page.keyboard.press('Escape');
  check('Esc engages the stop and empties the queue', (await txt(page, '#hdr-mode')) === 'ESTOP' && (await txt(page, '#q-size')) === '0 of 8');
  check('safety banner appears on the current view', await page.locator('#safety-banner').isVisible());
  await page.click('#view-queue [data-action="move"][data-dir="E"]');
  await page.click('#view-queue [data-action="step"]');
  check('requests and steps are refused while stopped', (await txt(page, '#q-size')) === '0 of 8' && (await page.evaluate(() => WCApp.sim.state.col)) === 4);
  await go(page, 'safety');
  check('Resume is disabled until the operator confirms', await page.locator('#release-btn').isDisabled());
  await page.check('#ack');
  await shot(page, '06-safety-recovery-checklist');
  check('Resume enabled after confirmation with all checks passing', await page.locator('#release-btn').isEnabled());
  await page.click('#release-btn');
  check('recovery returns to READY and nothing old resumes', (await txt(page, '#hdr-mode')) === 'READY' && (await page.evaluate(() => WCApp.sim.queue.size())) === 0);

  // 5. sensor failure: conservative stop and recovery path while stopped
  page = await fresh('sensors');
  await page.click('#view-sensors [data-action="fault"]');
  await page.waitForFunction(() => WCApp.sim.state.mode === 'FAULT');
  check('sensor failure shows No reading and mode FAULT', (await txt(page, '#s-clear')) === 'No reading');
  await page.click('.topbar .estop');
  await go(page, 'safety');
  await page.check('#ack');
  check('Resume stays disabled while the sensor check fails', await page.locator('#release-btn').isDisabled());
  check('Restore sensor now is offered', await page.locator('#restore-now-btn').isVisible());
  await page.click('#restore-now-btn');
  await page.check('#ack');
  await page.click('#release-btn');
  check('after restoring and confirming, the chair is READY', (await txt(page, '#hdr-mode')) === 'READY');
  await go(page, 'sensors');
  check('the stop switched auto-run off and it stays off after recovery', (await page.getAttribute('#autorun-btn-sensors', 'aria-pressed')) === 'false');
  await page.click('#view-sensors [data-action="fault"]');
  await page.click('#view-sensors [data-action="step"]');
  check('Step on the Sensors view processes the queued failure', (await txt(page, '#hdr-mode')) === 'FAULT');
  await shot(page, '07-sensors-failure');

  // 6. event log: clearing the view leaves the simulation alone
  await go(page, 'eventlog');
  const before = await page.evaluate(() => JSON.stringify([WCApp.sim.state, WCApp.sim.queue.items, WCApp.sim.stack.items, WCApp.sim.log.length]));
  await shot(page, '08-event-log');
  await page.click('[data-action="logclear"]');
  const after = await page.evaluate(() => JSON.stringify([WCApp.sim.state, WCApp.sim.queue.items, WCApp.sim.stack.items, WCApp.sim.log.length]));
  check('Clear view does not change the simulation or delete log entries', before === after);
  await page.click('#logshow-btn');
  check('Show cleared entries brings them back', (await page.locator('#full-log li').count()) > 3);

  // 7. reset gives a consistent start state from any situation
  await go(page, 'simulator');
  await page.click('#view-simulator [data-action="reset"]');
  const rs = await page.evaluate(() => { const s = WCApp.sim.state; return [s.row, s.col, s.heading, s.mode, s.battery, s.sensorFaulty, WCApp.sim.queue.front, WCApp.sim.stack.top].join(); });
  check('Reset returns to (1, 1) E READY 100 healthy, empty queue and stack', rs === '1,1,E,READY,100,false,-1,-1');
  check('screen matches state after reset', (await page.evaluate(domMatchesState)).length === 0);

  // 8. obstacle editing and keyboard focus in the grid
  await page.click('#edit-btn');
  await page.click('#sim-grid .cell[data-row="1"][data-col="5"]');
  check('clicking a floor cell while editing places an obstacle', (await page.evaluate(() => WCApp.sim.state.grid[1][5])) === 'O');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  check('arrow key then Enter removes/places on the next cell (1, 6)', (await page.evaluate(() => WCApp.sim.state.grid[1][6])) === 'O');
  check('roving focus stays on the cell you moved to', await page.evaluate(() => document.activeElement.dataset.col === '6' && document.activeElement.tabIndex === 0));
  await page.click('#sim-grid .cell[data-row="0"][data-col="0"]');
  check('walls cannot be edited', (await page.evaluate(() => WCApp.sim.state.grid[0][0])) === '#');
  await page.click('#edit-btn');

  // 9. random clicking: 600 real button clicks, screen compared with state after every one
  page = await fresh('dashboard');
  const fuzz = await page.evaluate(async () => {
    let seed = 99;
    const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    const actions = [
      '[data-action="move"][data-dir="N"]', '[data-action="move"][data-dir="E"]', '[data-action="move"][data-dir="S"]', '[data-action="move"][data-dir="W"]',
      '[data-action="back"]', '[data-action="sense"]', '[data-action="step"]', '[data-action="step"]', '[data-action="step"]',
      '[data-action="peekq"]', '[data-action="peeks"]', '[data-action="obstacleahead"]', '[data-action="drainbattery"]', '[data-action="recharge"]',
      '[data-action="fault"]', '[data-action="restore"]', '[data-action="autorun"]', '[data-action="logclear"]', '#logshow-btn',
      '#ack', '#release-btn', '#restore-now-btn', '[data-action="reset"]', '.topbar .estop'
    ];
    const problems = [];
    for (let i = 0; i < 600; i++) {
      let sel = actions[rnd(actions.length)];
      if (sel === '.topbar .estop' && rnd(4) !== 0) sel = '[data-action="step"]';
      if (sel === '[data-action="reset"]' && rnd(5) !== 0) sel = '[data-action="step"]';
      const el = document.querySelector(sel);
      if (el && !el.disabled) el.click();
      if (i % 25 === 0) await new Promise((r) => setTimeout(r, 650)); // let auto-run take a step now and then
      const p = domMatchesState();
      if (p.length) problems.push(i + ' ' + sel + ': ' + p.join('; '));
    }
    return problems;
  });
  check('600 random clicks: screen always matched the simulation (' + fuzz.length + ' problems)', fuzz.length === 0);
  if (fuzz.length) console.log(fuzz.slice(0, 5).join('\n'));

  // 10. every scenario twice: same trace both times and same as the instant run
  page = await fresh('scenarios');
  for (const id of ['normal', 'obstacle', 'underflow', 'overflow', 'estop', 'sensor']) {
    const traces = [];
    for (let k = 0; k < 2; k++) {
      await page.click('#scenario-cards [data-id="' + id + '"][data-action="scrun"]');
      if (id === 'overflow' && k === 0) { await page.waitForTimeout(400); await shot(page, '09-scenario-lab-running'); }
      await page.waitForFunction(() => !WCApp.ui.scenario, null, { timeout: 60000 });
      traces.push(await page.inputValue('#trace'));
    }
    const instant = await page.evaluate((sid) => { const s = WC.createSimulation(); WC.scenarios.find((x) => x.id === sid).script.forEach((l) => s.exec(l)); return s.getTrace(); }, id);
    check('scenario ' + id + ': repeatable and identical to the instant run', traces[0].length > 50 && traces[0] === traces[1] && traces[0] === instant);
  }
  await page.click('#scenario-cards [data-id="estop"][data-action="scrun"]');
  await page.waitForTimeout(300);
  await page.click('.topbar .estop');
  check('emergency stop during a scenario stops the scenario', (await page.evaluate(() => !WCApp.ui.scenario && WCApp.sim.state.mode === 'ESTOP')));
  const frozen = await page.evaluate(() => JSON.stringify(WCApp.sim.state));
  await page.waitForTimeout(1200);
  check('nothing moves after that stop', frozen === (await page.evaluate(() => JSON.stringify(WCApp.sim.state))));
  await page.click('#scenario-cards [data-id="normal"][data-action="scrun"]');
  await page.waitForFunction(() => !WCApp.ui.scenario, null, { timeout: 60000 });
  check('a scenario after a stop starts cleanly from the default map', (await page.evaluate(() => WCApp.sim.state.mode)) === 'READY');

  // 11. dashboard screenshot with real activity
  await go(page, 'dashboard');
  await shot(page, '01-dashboard');

  // 12. phone width, light theme, reduced motion
  const m = await fresh('simulator', { viewport: { width: 390, height: 844 } });
  for (const v of ['dashboard', 'simulator', 'queue', 'stack', 'sensors', 'safety', 'eventlog', 'scenarios']) {
    await go(m, v);
    const over = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('390 px wide, no sideways scrolling: ' + v, over <= 0);
  }
  check('phone: emergency stop is a bar fixed to the bottom', await m.evaluate(() => getComputedStyle(document.querySelector('.topbar .estop')).position === 'fixed'));
  await go(m, 'simulator');
  await shot(m, '10-phone-simulator');
  const l = await fresh('simulator', { colorScheme: 'light' });
  check('light theme uses a light background', await l.evaluate(() => getComputedStyle(document.body).backgroundColor === 'rgb(238, 242, 248)'));
  await shot(l, '11-light-theme-simulator');
  const rm = await fresh('queue', { reducedMotion: 'reduce' });
  check('reduced motion turns animations off', await rm.evaluate(() => getComputedStyle(document.querySelector('.slot')).animationName === 'none' && getComputedStyle(document.querySelector('.chair')).transitionDuration === '0s'));

  // 13. keyboard: every control reachable with Tab has a visible focus outline
  const k = await fresh('simulator');
  let noOutline = 0;
  for (let i = 0; i < 25; i++) {
    await k.keyboard.press('Tab');
    const o = await k.evaluate(() => { const el = document.activeElement; if (el === document.body) return true; /* focus left the page after the last control */ const cs = getComputedStyle(el); return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0; });
    if (!o) noOutline++;
  }
  check('25 Tab presses: every focused control shows a focus outline', noOutline === 0);

  check('no JavaScript errors in the console', errors.length === 0);
  results.forEach((r) => console.log((r[1] ? 'PASS  ' : 'FAIL  ') + r[0]));
  if (errors.length) console.log('errors:', errors.slice(0, 5));
  const failed = results.filter((r) => !r[1]).length;
  console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed');
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
