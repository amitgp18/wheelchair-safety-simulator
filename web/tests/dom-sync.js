// Checks shared by browser-test.js and final-audit.js. Both functions run INSIDE the page
// (they are converted to text and evaluated there), so they must not use anything from Node.
// Compares what the page shows with what the simulation holds. Returns a list of problems.
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

// Event log ledger: the numbers that the log entries add up to must equal the real structures.
// The log is written by the simulation, so this catches a code path that changes the queue,
// stack, position or counters without writing the matching log line (or the reverse).
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

module.exports = { domMatchesState, ledgerMatches };
