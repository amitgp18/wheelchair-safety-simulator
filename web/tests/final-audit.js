// Final pre-submission audit. Opens the real page in headless Chromium at a desktop and a phone width,
// clicks EVERY button on EVERY view (several rounds), and after each click checks:
//   - no script error and no console error or warning
//   - the screen matches the simulation (domMatchesState)
//   - the event log adds up to the real queue, stack, position and counters (ledgerMatches)
// It also checks icons, placeholder text, accessible names, sideways scrolling and tap size.
//
// Run:  node tests/final-audit.js        (needs Playwright, same as browser-test.js)
const path = require('path');
const { chromium } = require('playwright');
const { domMatchesState, ledgerMatches } = require('./dom-sync');

const pageUrl = 'file://' + path.join(__dirname, '..', 'index.html');
const VIEWS = ['dashboard', 'simulator', 'queue', 'stack', 'sensors', 'safety', 'eventlog', 'scenarios'];
const results = [];
const problems = [];
const check = (name, ok, detail) => { results.push([name, !!ok]); if (!ok) problems.push(name + (detail ? ' :: ' + detail : '')); };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] }).catch(() =>
    chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] }));
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

  await browser.close();
  const failed = results.filter((r) => !r[1]);
  console.log(results.map((r) => (r[1] ? 'PASS  ' : 'FAIL  ') + r[0]).join('\n'));
  if (problems.length) console.log('\nDETAILS\n' + problems.join('\n'));
  console.log('\nTotal clicks: ' + totalClicks);
  console.log((results.length - failed.length) + ' passed, ' + failed.length + ' failed');
  process.exit(failed.length ? 1 : 0);
})();
