// All browser tests in one file. Opens index.html in headless Chromium and clicks the real controls.
//
//   node tests/browser-tests.js              run all three suites
//   node tests/browser-tests.js functional   end-to-end checks, saves the screenshots used in the README
//   node tests/browser-tests.js audit        clicks every button on every view at 1280 px and 390 px
//   node tests/browser-tests.js demo         performs the website half of the teacher demonstration
//
// Needs Playwright:  npm install playwright   then   npx playwright install chromium
// (If Chromium is somewhere else, set CHROMIUM=/path/to/chromium)
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

// ---------- checks shared by the suites (they run INSIDE the page, so they must not use Node) ----------

function domMatchesState() {
  const sim = WCApp.sim, q = sim.queue, st = sim.stack, s = sim.state;
  const text = (id) => document.getElementById(id).textContent.trim();
  const p = [];
  if (text('q-front') !== String(q.front)) p.push('front shown ' + text('q-front') + ' but is ' + q.front);
  if (text('q-rear') !== String(q.rear)) p.push('rear');
  if (text('q-size') !== q.size() + ' of ' + q.capacity) p.push('queue size');
  if (text('t-queue') !== q.size() + ' / ' + q.capacity) p.push('dashboard queue');
  if (document.querySelectorAll('#queue-slots .slot.filled').length !== q.size()) p.push('filled queue slots');
  const frontTag = document.querySelectorAll('#queue-slots .tag:not(.rear)');
  if (q.isEmpty() ? frontTag.length !== 0 : frontTag.length !== 1) p.push('FRONT tag count');
  if (text('s-top') !== String(st.top)) p.push('top');
  if (text('t-stack') !== st.size() + ' / ' + st.capacity) p.push('dashboard stack');
  if (document.querySelectorAll('#stack-slots .sslot.filled').length !== st.size()) p.push('filled stack slots');
  if (text('hdr-mode') !== s.mode || text('dash-mode') !== s.mode) p.push('mode');
  if (text('hdr-battery') !== s.battery + '%') p.push('battery');
  if (text('t-stops') !== String(s.estopCount)) p.push('stop count');
  const chair = document.querySelector('#sim-grid .chair').style.transform;
  if (chair !== 'translate(' + s.col * 100 + '%, ' + s.row * 100 + '%)') p.push('chair drawn at ' + chair + ' but is at ' + s.row + ',' + s.col);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 12; c++) {
    const ch = s.grid[r][c];
    const want = ch === '#' ? 'wall' : ch === 'O' ? 'obstacle' : ch === 'S' ? 'start' : ch === 'G' ? 'goal' : 'floor';
    if (document.querySelector('#sim-grid .cell[data-row="' + r + '"][data-col="' + c + '"]').dataset.type !== want) p.push('cell ' + r + ',' + c);
  }
  const bannerOn = !document.getElementById('safety-banner').hidden;
  if (bannerOn !== ['ESTOP', 'FAULT', 'DEPLETED'].includes(s.mode)) p.push('safety banner');
  return p;
}

function ledgerMatches() {
  const sim = WCApp.sim, s = sim.state, p = [];
  let enq = 0, deq = 0, flushed = 0, push = 0, pop = 0, moved = 0, stops = 0;
  sim.log.forEach((e) => {
    if (e.code === 'ENQUEUE') enq++;
    if (e.code === 'DEQUEUE') deq++;
    if (e.code === 'PUSH') push++;
    if (e.code === 'POP') pop++;
    if (e.code === 'MOVED') moved++;
    if (e.code === 'ESTOP' && e.message.indexOf('EMERGENCY STOP engaged') === 0) {
      stops++;
      const m = /(\d+) pending request/.exec(e.message);
      if (m) flushed += Number(m[1]);
    }
  });
  if (sim.log.length >= 2000) return ['log reached its 2000 entry limit; ledger not valid'];
  if (enq - deq - flushed !== sim.queue.size()) p.push('queue size ' + sim.queue.size() + ' but log says ' + (enq - deq - flushed));
  if (push - pop !== sim.stack.size()) p.push('stack size ' + sim.stack.size() + ' but log says ' + (push - pop));
  if (moved !== s.movesMade) p.push('moves ' + s.movesMade + ' but log has ' + moved + ' MOVED');
  if (stops !== s.estopCount) p.push('stops ' + s.estopCount + ' but log has ' + stops);
  // Every saved position must be a real, free cell, and the stack must form a path of single steps
  // ending next to the chair.
  const pts = sim.stack.items.slice(0, sim.stack.top + 1).concat([{ row: s.row, col: s.col }]);
  for (let i = 1; i < pts.length; i++) {
    const d = Math.abs(pts[i].row - pts[i - 1].row) + Math.abs(pts[i].col - pts[i - 1].col);
    if (d !== 1) p.push('saved path jumps between entries ' + (i - 1) + ' and ' + i);
  }
  return p;
}


// =====================================================================================
// Suite: functional
// =====================================================================================
async function suiteFunctional(browser) {
const root = path.join(__dirname, '..');
const pageUrl = 'file://' + path.join(root, 'index.html');
const shots = path.join(root, '..', 'docs', 'screenshots');
fs.mkdirSync(shots, { recursive: true });

const results = [];
const errors = [];
function check(name, ok) { results.push([name, !!ok]); }

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
  // Only the screenshots used in the README are kept, to keep the repository small.
  const KEEP = ['01-dashboard', '03-simulator-blocked-by-obstacle', '04b-queue-wraparound', '05-stack-with-history', '06-safety-recovery-checklist', '10-phone-simulator'];
  const shot = async (page, name, full) => !KEEP.includes(name) ? null : page.screenshot({ path: path.join(shots, name + '.png'), fullPage: !!full });

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
  return failed;

}


// =====================================================================================
// Suite: audit
// =====================================================================================
async function suiteAudit(browser) {
const pageUrl = 'file://' + path.join(__dirname, '..', 'index.html');
const VIEWS = ['dashboard', 'simulator', 'queue', 'stack', 'sensors', 'safety', 'eventlog', 'scenarios'];
const results = [];
const problems = [];
const check = (name, ok, detail) => { results.push([name, !!ok]); if (!ok) problems.push(name + (detail ? ' :: ' + detail : '')); };

    let totalClicks = 0;

  for (const vp of [{ name: 'desktop', width: 1280, height: 800 }, { name: 'phone', width: 390, height: 844 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, colorScheme: 'dark', hasTouch: vp.name === 'phone' });
    const page = await ctx.newPage();
    const messages = [];
    page.on('pageerror', (e) => messages.push('pageerror: ' + e.message));
    // 'Failed to load resource' is the browser's own line for the font request that this audit blocks on purpose;
    // any other failed request is caught by the requestfailed handler below.
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/^Failed to load resource/.test(m.text())) messages.push(m.type() + ': ' + m.text()); });
    let fontBlocked = 0;
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => { fontBlocked++; r.abort(); });
    page.on('requestfailed', (r) => { if (!/fonts\.(googleapis|gstatic)\.com/.test(r.url())) messages.push('requestfailed: ' + r.url()); });
    await page.goto(pageUrl + '#dashboard');
    await page.evaluate(() => { WCApp.ui.speed = 0.02; });
    await page.evaluate('window.domMatchesState = ' + domMatchesState.toString());
    await page.evaluate('window.ledgerMatches = ' + ledgerMatches.toString());
    const tag = '[' + vp.name + '] ';

    check(tag + 'the page declares its own icon (so a browser does not ask for favicon.ico and log a 404)', await page.evaluate(() => !!document.querySelector('link[rel~="icon"]')));
    check(tag + 'page title is a name, not a placeholder', (await page.title()).length > 5);

    // ---- static checks per view ----
    for (const v of VIEWS) {
      await page.evaluate((h) => { location.hash = h; }, v);
      await page.waitForTimeout(60);
      const info = await page.evaluate((view) => {
        const root = document.getElementById('view-' + view);
        const out = { visible: !root.hidden, brokenIcons: [], unnamed: [], bad: [], small: [], overflow: document.documentElement.scrollWidth - window.innerWidth };
        document.querySelectorAll('use').forEach((u) => {
          const ref = u.getAttribute('href');
          if (!ref || !document.querySelector(ref)) out.brokenIcons.push(ref);
        });
        const shown = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
        document.querySelectorAll('button, a[href], input, select, textarea').forEach((e) => {
          if (!shown(e)) return;
          const name = (e.getAttribute('aria-label') || e.textContent || e.title || (e.labels && e.labels[0] && e.labels[0].textContent) || '').trim();
          if (!name) out.unnamed.push(e.outerHTML.slice(0, 80));
          if (e.tagName === 'BUTTON' && !e.classList.contains('cell')) {
            const r = e.getBoundingClientRect();
            if (r.height < 32 || r.width < 32) out.small.push((e.textContent.trim() || e.getAttribute('aria-label')) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
          }
        });
        const text = root.innerText;
        const re = /\b(undefined|NaN|null|TODO|TBD|FIXME|lorem|ipsum|placeholder|coming soon|\[object)\b/i;
        const m = re.exec(text);
        if (m) out.bad.push(m[0]);
        return out;
      }, v);
      check(tag + v + ' view is shown', info.visible);
      const tabIn = await page.evaluate(() => {
        const a = document.querySelector('#tabs a[aria-current="page"]');
        if (!a) return 'no active tab';
        const l = document.getElementById('tabs').getBoundingClientRect(), r = a.getBoundingClientRect();
        return r.left >= l.left - 1 && r.right <= l.right + 1 ? 'ok' : 'active tab "' + a.textContent.trim() + '" is outside the tab bar (' + Math.round(r.left) + '..' + Math.round(r.right) + ' vs ' + Math.round(l.left) + '..' + Math.round(l.right) + ')';
      });
      check(tag + v + ': the active tab is visible in the tab bar', tabIn === 'ok', tabIn);
      check(tag + v + ': every icon points at a real symbol', info.brokenIcons.length === 0, info.brokenIcons.join());
      check(tag + v + ': every visible control has a name', info.unnamed.length === 0, info.unnamed.join(' | '));
      check(tag + v + ': no placeholder or broken text', info.bad.length === 0, info.bad.join());
      check(tag + v + ': no sideways scrolling', info.overflow <= 0, 'overflow ' + info.overflow + 'px');
      if (vp.name === 'phone') check(tag + v + ': buttons are at least 32 px (tap size)', info.small.length === 0, info.small.join(' | '));
    }

    // ---- click every button, several rounds, checking after each click ----
    let clicks = 0, skipped = 0;
    const clickAll = async (round) => {
      for (const v of VIEWS) {
        await page.evaluate((h) => { location.hash = h; }, v);
        await page.waitForTimeout(40);
        const n = await page.locator('#view-' + v + ' button, header button').count();
        for (let i = 0; i < n; i++) {
          const b = page.locator('#view-' + v + ' button, header button').nth(i);
          // wait for any animation or running scenario to finish so the check sees a settled screen
          await page.waitForFunction(() => !WCApp.ui.draining, null, { timeout: 15000 }).catch(() => {});
          if (!(await b.isVisible()) || !(await b.isEnabled())) { skipped++; continue; }
          const label = ((await b.textContent()) || '').trim() || (await b.getAttribute('aria-label')) || (await b.getAttribute('data-action'));
          // Scenario Run buttons are covered by the full browser test (run twice); here we only start and stop one.
          await b.click({ timeout: 4000 }).catch((e) => { messages.push('click failed on "' + label + '": ' + e.message.split('\n')[0]); });
          clicks++;
          await page.waitForFunction(() => !WCApp.ui.draining, null, { timeout: 20000 }).catch(() => { messages.push('still busy after "' + label + '"'); });
          // a running scenario owns the state; stop it before comparing
          await page.evaluate(() => { document.querySelectorAll('[data-action="scstop"]').forEach((x) => { if (!x.hidden) x.click(); }); });
          await page.waitForTimeout(15);
          const sync = await page.evaluate(() => domMatchesState().concat(ledgerMatches()));
          if (sync.length) { check(tag + 'round ' + round + ' ' + v + ' "' + label + '": screen, state and log agree', false, sync.join('; ')); }
        }
      }
    };
    for (let round = 1; round <= 3; round++) await clickAll(round);
    totalClicks += clicks;
    check(tag + 'clicked ' + clicks + ' controls (' + skipped + ' disabled or hidden skipped); screen, state and log agreed after every click',
      !problems.some((p) => p.startsWith(tag + 'round')));
    check(tag + 'no script errors, console errors or warnings during the whole audit', messages.length === 0, messages.slice(0, 5).join(' | '));
    console.log(tag + 'fonts blocked on purpose (offline check): ' + fontBlocked + ' request(s); page used its fallback fonts');
    await ctx.close();
  }

  const failed = results.filter((r) => !r[1]);
  console.log(results.map((r) => (r[1] ? 'PASS  ' : 'FAIL  ') + r[0]).join('\n'));
  if (problems.length) console.log('\nDETAILS\n' + problems.join('\n'));
  console.log('\nTotal clicks: ' + totalClicks);
  console.log((results.length - failed.length) + ' passed, ' + failed.length + ' failed');
  return failed.length;

}


// =====================================================================================
// Suite: demo
// =====================================================================================
async function suiteDemo(browser) {
const results = [];
const check = (name, ok, extra) => { results.push([name, !!ok]); if (!ok) console.log('   detail: ' + extra); };

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
  const failed = results.filter((r) => !r[1]);
  console.log(results.map((r) => (r[1] ? 'PASS  ' : 'FAIL  ') + r[0]).join('\n'));
  console.log((results.length - failed.length) + ' passed, ' + failed.length + ' failed');
  return failed.length;

}


// ---------- run ----------
(async () => {
  const which = process.argv[2] || 'all';
  const suites = { functional: suiteFunctional, audit: suiteAudit, demo: suiteDemo };
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] }).catch(() =>
    chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] }));
  let bad = 0;
  for (const name of Object.keys(suites)) {
    if (which !== 'all' && which !== name) continue;
    console.log('\n===== suite: ' + name + ' =====');
    bad += await suites[name](browser);
  }
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
