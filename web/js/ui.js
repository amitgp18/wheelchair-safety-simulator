/* ui.js
   Draws the simulation and handles clicks and keys. This file never changes the
   simulation directly: it calls sim.something() and then draws whatever state it finds.
   Rule of thumb: if a number is on screen, it was read from sim.state, sim.queue or sim.stack. */
(function () {
  'use strict';
  var WC = globalThis.WC;
  var C = WC.config;
  var sim = WC.createSimulation();

  var ui = {
    view: 'dashboard',
    autoRun: true,
    autoTimer: null,
    draining: false,        // true while "Process all" is stepping through the queue
    editMode: false,
    focusRow: 1,            // the grid cell that receives Tab focus while editing obstacles
    focusCol: 1,
    speed: 1,               // scenario and Process all delays are multiplied by this (tests use a small value)
    logFilter: 'all',
    logFromSeq: 0,          // entries up to this number are hidden by "Clear view"; the simulation keeps them
    scenario: null,         // set while a scenario is playing
    grids: [],
    reduceMotion: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  };

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined) { e.textContent = text; }
    return e;
  }
  function icon(id, cls) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'ico' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#' + id);
    svg.appendChild(use);
    return svg;
  }
  function pos(r, c) { return '(' + r + ', ' + c + ')'; }
  function shortLabel(ev) {
    if (ev.type === 'MOVE') { return 'MV ' + ev.dir; }
    return { BACK: 'BACK', SENSE: 'SENSE', FAULT: 'FAULT', RESTORE: 'REST' }[ev.type] || ev.type;
  }
  function fullLabel(ev) { return '#' + ev.seq + ' ' + WC.eventLabel(ev); }

  /* ---------- announcements for screen readers and the status line ---------- */

  function say(message, level) {
    var target = level === 'error' ? $('alert') : $('announce');
    target.textContent = '';
    window.setTimeout(function () { target.textContent = message; }, 30);
    var line = $('sim-status');
    line.textContent = message;
    line.dataset.level = level || 'info';
  }
  function sayLast() {
    var last = sim.log[sim.log.length - 1];
    if (last) { say(last.message, last.level); }
  }

  /* ---------- the room grid ---------- */

  function buildGrid(root, interactive) {
    root.textContent = '';
    var frame = el('div', 'gridframe');
    var top = el('div', 'axis axis-top');
    top.setAttribute('aria-hidden', 'true');
    for (var c = 0; c < C.COLS; c++) { top.appendChild(el('span', '', String(c))); }
    var left = el('div', 'axis axis-left');
    left.setAttribute('aria-hidden', 'true');
    for (var r = 0; r < C.ROWS; r++) { left.appendChild(el('span', '', String(r))); }
    var wrap = el('div', 'gridwrap' + (interactive ? '' : ' mini'));
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Room grid, ' + C.ROWS + ' rows by ' + C.COLS + ' columns');
    var cells = el('div', 'cells');
    var g = { root: root, wrap: wrap, cells: [], interactive: interactive };
    for (r = 0; r < C.ROWS; r++) {
      g.cells[r] = [];
      for (c = 0; c < C.COLS; c++) {
        var cell = interactive ? el('button', 'cell') : el('div', 'cell');
        if (interactive) {
          cell.type = 'button';
          cell.tabIndex = -1;
          cell.dataset.row = r;
          cell.dataset.col = c;
          cell.dataset.action = 'cell';
        } else {
          cell.setAttribute('aria-hidden', 'true');
        }
        g.cells[r][c] = cell;
        cells.appendChild(cell);
      }
    }
    wrap.appendChild(cells);
    g.restore = el('div', 'restore');
    wrap.appendChild(g.restore);
    g.chair = el('div', 'chair');
    var body = el('div', 'chair-body');
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    var tri = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tri.setAttribute('d', 'M12 3l7 17-7-4-7 4z');
    svg.appendChild(tri);
    body.appendChild(svg);
    g.chair.appendChild(body);
    g.chairSvg = svg;
    wrap.appendChild(g.chair);
    frame.appendChild(top);
    frame.appendChild(left);
    frame.appendChild(wrap);
    root.appendChild(frame);
    ui.grids.push(g);
    return g;
  }

  var HEADING_DEG = { N: 0, E: 90, S: 180, W: 270 };
  var rotation = { sim: 90, sc: 90 };

  function updateGrid(g, key, effects) {
    var s = sim.state;
    for (var r = 0; r < C.ROWS; r++) {
      for (var c = 0; c < C.COLS; c++) {
        var ch = s.grid[r][c];
        var type = ch === '#' ? 'wall' : ch === 'O' ? 'obstacle' : ch === 'S' ? 'start' : ch === 'G' ? 'goal' : 'floor';
        var cell = g.cells[r][c];
        if (cell.dataset.type !== type) {
          cell.dataset.type = type;
          cell.className = 'cell ' + type;
          cell.textContent = '';
          if (type === 'obstacle') { cell.appendChild(icon('i-brick')); }
          if (type === 'goal') { cell.appendChild(icon('i-flag')); }
          if (type === 'start') { cell.textContent = 'S'; }
        }
        if (g.interactive) {
          var names = { wall: 'wall', obstacle: 'obstacle', start: 'start', goal: 'destination', floor: 'free floor' };
          var label = 'Row ' + r + ', column ' + c + ', ' + names[type];
          if (r === s.row && c === s.col) { label += ', wheelchair here'; }
          if (type === 'floor' || type === 'obstacle') { label += ui.editMode ? '. Press to ' + (type === 'floor' ? 'place' : 'remove') + ' an obstacle' : ''; }
          cell.setAttribute('aria-label', label);
          cell.tabIndex = ui.editMode && r === ui.focusRow && c === ui.focusCol ? 0 : -1;
        }
      }
    }
    g.wrap.classList.toggle('editing', g.interactive && ui.editMode);
    g.chair.style.transform = 'translate(' + (s.col * 100) + '%, ' + (s.row * 100) + '%)';
    // keep the arrow turning the short way round
    var target = HEADING_DEG[s.heading];
    var cur = rotation[key];
    var diff = ((target - (cur % 360)) + 540) % 360 - 180;
    rotation[key] = cur + diff;
    g.chairSvg.style.transform = 'rotate(' + rotation[key] + 'deg)';
    g.chair.className = 'chair' + (s.mode === 'ESTOP' ? ' is-estop' : s.mode === 'BLOCKED' ? ' is-blocked' : s.mode === 'FAULT' ? ' is-fault' : s.mode === 'DEPLETED' ? ' is-depleted' : '');

    var top = sim.stack.peek();
    if (top.ok) {
      g.restore.classList.add('on');
      g.restore.style.transform = 'translate(' + (top.item.col * 100) + '%, ' + (top.item.row * 100) + '%)';
    } else {
      g.restore.classList.remove('on');
    }

    effects.forEach(function (e) {
      if (e.kind === 'blocked') {
        g.chair.dataset.dir = e.dir;
        g.chair.classList.remove('bump');
        void g.chair.offsetWidth;
        g.chair.classList.add('bump');
        window.setTimeout(function () { g.chair.classList.remove('bump'); }, 450);
        var cell2 = g.cells[e.row] && g.cells[e.row][e.col];
        if (cell2) {
          cell2.classList.add('hit');
          window.setTimeout(function () { cell2.classList.remove('hit'); }, 1200);
        }
      }
    });
  }

  /* ---------- queue and stack pictures ---------- */

  function renderQueue(effects) {
    var q = sim.queue;
    var cap = q.capacity;
    var enter = {};
    var leave = {};
    effects.forEach(function (e) {
      if (e.kind === 'enqueue') { enter[e.slot] = true; }
      if (e.kind === 'dequeue' && !ui.reduceMotion) { leave[e.slot] = e.label; }
    });

    $('q-cap').textContent = String(cap);
    $('q-size').textContent = q.size() + ' of ' + cap;
    $('q-front').textContent = String(q.front);
    $('q-rear').textContent = String(q.rear);
    $('q-state').textContent = q.isEmpty() ? 'EMPTY' : q.isFull() ? 'FULL' : 'OK';

    // linear slots
    var list = $('queue-slots');
    list.textContent = '';
    for (var i = 0; i < cap; i++) {
      var item = q.items[i];
      var li = el('li', 'slot' + (item ? ' filled' : '') + (enter[i] ? ' enter' : ''));
      li.appendChild(el('span', 'idx', 'slot ' + i));
      if (item) {
        li.appendChild(el('span', 'content', fullLabel(item)));
      } else if (leave[i]) {
        li.classList.add('leave');
        // The old label only fades out for the eye. Screen readers are told the slot is empty.
        var ghost = el('span', 'content', leave[i]);
        ghost.setAttribute('aria-hidden', 'true');
        li.appendChild(ghost);
        li.appendChild(el('span', 'sr', 'empty'));
      } else {
        li.appendChild(el('span', 'content empty', 'empty'));
      }
      var tags = el('span', 'tags');
      if (i === q.front) { tags.appendChild(el('span', 'tag', 'FRONT')); }
      if (i === q.rear) { tags.appendChild(el('span', 'tag rear', 'REAR')); }
      li.appendChild(tags);
      var ariaText = 'Slot ' + i + ': ' + (item ? fullLabel(item) : 'empty') + (i === q.front ? ', front' : '') + (i === q.rear ? ', rear' : '');
      li.setAttribute('aria-label', ariaText);
      list.appendChild(li);
    }

    // ring picture (SVG text built from numbers only)
    var cx = 130, cy = 130, R = 80, rr = 23;
    var svg = '<svg viewBox="0 0 260 260" focusable="false">';
    svg += '<circle cx="130" cy="130" r="' + R + '" fill="none" stroke="currentColor" stroke-opacity="0.12" stroke-width="1"/>';
    for (var k = 0; k < cap; k++) {
      var a = (-90 + k * (360 / cap)) * Math.PI / 180;
      var x = cx + R * Math.cos(a);
      var y = cy + R * Math.sin(a);
      var filled = !!q.items[k];
      var label = filled ? shortLabel(q.items[k]) : (leave[k] ? leave[k].replace('MOVE ', 'MV ') : '');
      svg += '<circle class="ring-slot' + (filled ? ' filled' : '') + (enter[k] ? ' enter' : '') + '" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + rr + '"/>';
      if (label) { svg += '<text class="ring-text' + (!filled ? ' ring-ghost' : '') + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '">' + label + '</text>'; }
      svg += '<text class="ring-index" x="' + (cx + (R - 33) * Math.cos(a)).toFixed(1) + '" y="' + (cy + (R - 33) * Math.sin(a) + 3).toFixed(1) + '">' + k + '</text>';
      var ptr = '';
      if (k === q.front) { ptr += 'F'; }
      if (k === q.rear) { ptr += (ptr ? '+R' : 'R'); }
      if (ptr) {
        svg += '<text class="ring-ptr" x="' + (cx + (R + 33) * Math.cos(a)).toFixed(1) + '" y="' + (cy + (R + 33) * Math.sin(a)).toFixed(1) + '">' + ptr + '</text>';
      }
    }
    svg += '<text class="ring-centre" x="130" y="126">front ' + q.front + '</text><text class="ring-centre" x="130" y="142">rear ' + q.rear + '</text>';
    svg += '</svg>';
    var ring = $('queue-ring');
    ring.innerHTML = svg; // only numbers and short fixed labels from this file
    ring.setAttribute('aria-label', 'Circular queue with ' + q.size() + ' of ' + cap + ' slots used, front ' + q.front + ', rear ' + q.rear);

    var arr = q.toArray();
    $('queue-fifo').textContent = arr.length === 0
      ? 'Next out: nothing. The queue is empty.'
      : 'Next out  ' + arr.map(function (x) { return fullLabel(x.item); }).join('  ->  ') + '  Last in';
    var f;
    if (q.isEmpty()) {
      f = 'Empty: front = -1 and rear = -1. The next request goes to slot 0.';
    } else if (q.isFull()) {
      f = 'Full: (rear + 1) % ' + cap + ' = (' + q.rear + ' + 1) % ' + cap + ' = ' + ((q.rear + 1) % cap) + ', which equals front = ' + q.front + '. New requests are refused.';
    } else {
      f = 'Next request goes to slot (rear + 1) % ' + cap + ' = (' + q.rear + ' + 1) % ' + cap + ' = ' + q.nextRearSlot() + '.';
    }
    $('queue-formula').textContent = f;
  }

  function renderStack(effects) {
    var st = sim.stack;
    var enter = {};
    var leave = {};
    effects.forEach(function (e) {
      if (e.kind === 'push') { enter[e.slot] = true; }
      if (e.kind === 'pop' && !ui.reduceMotion) { leave[e.slot] = e.label; }
    });
    var list = $('stack-slots');
    list.textContent = '';
    for (var i = st.capacity - 1; i >= 0; i--) {
      var item = st.items[i];
      var cls = 'sslot' + (item ? ' filled' : '') + (i === st.top ? ' top' : '') + (enter[i] ? ' enter' : '');
      var li = el('li', cls);
      li.appendChild(el('span', 'idx', String(i)));
      if (item) {
        li.appendChild(el('span', 'content', pos(item.row, item.col) + ' facing ' + item.heading));
      } else if (leave[i]) {
        li.classList.add('leave');
        // The old label only fades out for the eye. Screen readers are told the slot is empty.
        var ghost = el('span', 'content', leave[i]);
        ghost.setAttribute('aria-hidden', 'true');
        li.appendChild(ghost);
        li.appendChild(el('span', 'sr', 'empty'));
      } else {
        li.appendChild(el('span', 'content empty', 'empty'));
      }
      li.appendChild(i === st.top ? el('span', 'tag', 'TOP') : el('span'));
      li.setAttribute('aria-label', 'Slot ' + i + ': ' + (item ? pos(item.row, item.col) + ' facing ' + item.heading : 'empty') + (i === st.top ? ', top of stack' : ''));
      list.appendChild(li);
    }
    var top = st.peek();
    $('stack-next').textContent = top.ok
      ? 'BACK returns to ' + pos(top.item.row, top.item.col) + ' facing ' + top.item.heading + '   (dashed cell on the room grid)'
      : 'Nothing saved. BACK would cause a stack underflow.';
    $('s-cap').textContent = String(st.capacity);
    $('s-size').textContent = st.size() + ' of ' + st.capacity;
    $('s-top').textContent = String(st.top);
    $('s-state').textContent = st.isEmpty() ? 'EMPTY' : st.isFull() ? 'FULL' : 'OK';
  }

  /* ---------- status panels ---------- */

  var MODE_TEXT = {
    READY: 'Normal operation. Moves are allowed.',
    BLOCKED: 'The last move was refused because the next cell is not free. Moves in other directions are allowed.',
    ARRIVED: 'The wheelchair is on the destination cell.',
    FAULT: 'The distance sensor failed. Movement is refused until the sensor is restored (fail-safe stop).',
    ESTOP: 'Emergency stop engaged. Movement is frozen and nothing queued will run. Recover from the Safety view.',
    DEPLETED: 'The simulated battery is empty. Recharge it or reset the simulation.'
  };

  function clearanceText(cm) { return cm === null ? 'No reading' : cm + ' cm'; }

  function renderStatus() {
    var s = sim.state;
    var cm = WC.safety.clearance(s);
    document.body.dataset.mode = s.mode;

    ['hdr-mode', 'dash-mode'].forEach(function (id) { $(id).dataset.mode = s.mode; $(id).textContent = s.mode; });
    $('hdr-battery').textContent = s.battery + '%';
    $('hdr-clear').textContent = clearanceText(cm);

    $('dash-modetext').textContent = MODE_TEXT[s.mode];
    $('dash-position').textContent = 'Row ' + s.row + ', column ' + s.col + '  facing ' + C.DIRNAME[s.heading];
    $('t-battery').textContent = s.battery + '%';
    var level = s.battery <= 0 ? 'empty' : s.battery < C.LOWBATTERY ? 'low' : 'ok';
    ['t-batbar', 's-batbar'].forEach(function (id) { $(id).style.width = s.battery + '%'; $(id).dataset.level = level; });
    $('t-clear').textContent = clearanceText(cm);
    $('t-clear-note').textContent = cm === null ? 'Sensor failure (simulated)' : 'Facing ' + C.DIRNAME[s.heading];
    $('t-queue').textContent = sim.queue.size() + ' / ' + sim.queue.capacity;
    $('t-queue-note').textContent = 'front ' + sim.queue.front + '  rear ' + sim.queue.rear;
    $('t-stack').textContent = sim.stack.size() + ' / ' + sim.stack.capacity;
    $('t-stack-note').textContent = 'top ' + sim.stack.top;
    $('t-stops').textContent = String(s.estopCount);
    $('t-moves').textContent = String(s.movesMade);

    // sensors view
    $('s-clear').textContent = clearanceText(cm);
    var seg = $('s-segments');
    seg.textContent = '';
    seg.className = 'segments' + (cm === null ? ' none' : '');
    for (var i = 0; i < C.SENSORMAXCELLS; i++) { seg.appendChild(el('i', cm !== null && i < cm / C.CELLCM ? 'on' : '')); }
    $('s-clear-note').textContent = cm === null
      ? 'The sensor has failed, so there is no reading. The wheelchair stops moving until it is restored.'
      : 'Facing ' + C.DIRNAME[s.heading] + '. Each segment is one 50 cm cell, up to 300 cm.';
    var tb = $('s-dirs');
    tb.textContent = '';
    ['N', 'E', 'S', 'W'].forEach(function (d) {
      var tr = el('tr', d === s.heading ? 'current' : '');
      tr.appendChild(el('td', '', C.DIRNAME[d].charAt(0).toUpperCase() + C.DIRNAME[d].slice(1) + (d === s.heading ? ' (facing)' : '')));
      tr.appendChild(el('td', 'mono', clearanceText(WC.safety.clearance(s, d))));
      tb.appendChild(tr);
    });
    $('s-battery').textContent = s.battery + '%';
    $('s-battery-note').textContent = s.battery <= 0 ? 'Battery empty. Movement refused.'
      : s.battery < C.LOWBATTERY ? 'Low battery warning (below ' + C.LOWBATTERY + '%).'
      : 'Each move or backtrack uses ' + C.MOVECOST + '%.';

    // banner shown on every view while movement is stopped for a safety reason
    var banner = $('safety-banner');
    var BANNER = {
      ESTOP: ['Emergency stop engaged.', 'Movement is frozen and waiting requests were removed.', '#safety', 'Go to recovery'],
      FAULT: ['Sensor failure.', 'The wheelchair stops until the simulated sensor is restored.', '#sensors', 'Open sensors'],
      DEPLETED: ['Battery empty.', 'Movement is refused until the simulated battery is recharged.', '#sensors', 'Open sensors']
    }[s.mode];
    banner.hidden = !BANNER;
    if (BANNER) {
      banner.dataset.mode = s.mode;
      $('banner-icon').setAttribute('href', s.mode === 'ESTOP' ? '#i-stop' : s.mode === 'FAULT' ? '#i-warn' : '#i-battery');
      $('banner-title').textContent = BANNER[0];
      $('banner-text').textContent = ' ' + BANNER[1];
      $('banner-link').setAttribute('href', BANNER[2]);
      $('banner-link').textContent = BANNER[3];
      $('banner-link').hidden = ui.view === BANNER[2].slice(1);
    }

    // simulator view
    var arr = sim.queue.toArray();
    $('sim-pending').textContent = arr.length === 0 ? 'Pending: none' : 'Pending: ' + arr.map(function (x) { return WC.eventLabel(x.item); }).join(', ');
  }

  function renderSafety() {
    var s = sim.state;
    var engaged = s.mode === 'ESTOP';
    $('safety-state').dataset.engaged = String(engaged);
    $('safety-headline').textContent = engaged ? 'Emergency stop engaged' : 'Normal operation';
    $('safety-text').textContent = engaged
      ? 'Movement is frozen. ' + sim.stack.size() + ' saved position(s) are kept. Complete the recovery steps to resume.'
      : 'The emergency stop is ready. Pressing it freezes the wheelchair at once.';
    $('safety-count').textContent = String(s.estopCount);
    $('safety-queue').textContent = String(sim.queue.size());
    $('safety-stack').textContent = String(sim.stack.size());

    var list = $('recovery-list');
    list.textContent = '';
    var checks = sim.recoveryChecks();
    var allOk = true;
    checks.forEach(function (c) {
      if (!c.ok) { allOk = false; }
      var li = el('li');
      var ic = icon(c.ok ? 'i-check' : 'i-x', c.ok ? 'ok' : 'bad');
      li.appendChild(ic);
      var box = el('div');
      box.appendChild(el('span', '', c.label));
      box.appendChild(el('small', '', (c.ok ? 'Pass: ' : 'Fail: ') + c.detail));
      li.appendChild(box);
      list.appendChild(li);
    });
    $('recovery-intro').textContent = engaged
      ? 'These checks run again every time you press Resume. Old requests are never resumed.'
      : 'Recovery is only needed after an emergency stop. The checks below show the current state.';
    var ack = $('ack');
    ack.disabled = !engaged;
    if (!engaged) { ack.checked = false; }
    $('release-btn').disabled = !(engaged && allOk && ack.checked) || !!ui.scenario;
    $('restore-now-btn').hidden = !(engaged && s.sensorFaulty);
  }

  /* ---------- event log ---------- */

  function fmtTime(d) {
    function p(n) { return ('0' + n).slice(-2); }
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  function fillLog(listEl, entries, max) {
    listEl.textContent = '';
    if (entries.length === 0) {
      var li0 = el('li');
      li0.appendChild(el('span', 'none', 'No events to show.'));
      listEl.appendChild(li0);
      return;
    }
    for (var i = entries.length - 1, n = 0; i >= 0 && n < max; i--, n++) {
      var e = entries[i];
      var li = el('li');
      li.dataset.level = e.level;
      var t = el('time', '', fmtTime(e.time));
      t.setAttribute('datetime', e.time.toISOString());
      li.appendChild(t);
      li.appendChild(el('span', 'code', e.code));
      li.appendChild(el('span', 'msg', e.message));
      listEl.appendChild(li);
    }
  }

  function renderLogs() {
    var visible = sim.log.filter(function (e) { return e.seq > ui.logFromSeq; });
    var hidden = sim.log.length - visible.length;
    var filtered = ui.logFilter === 'all' ? visible : visible.filter(function (e) { return e.group === ui.logFilter; });
    fillLog($('full-log'), filtered, 300);
    fillLog($('dash-log'), visible, 6);
    fillLog($('sc-log'), visible, 6);
    $('logshow-btn').hidden = hidden === 0;
    $('log-note').textContent = hidden > 0
      ? hidden + ' older entr' + (hidden === 1 ? 'y is' : 'ies are') + ' hidden from this view. Clearing the view does not change the simulation.'
      : 'Newest first. ' + visible.length + ' event' + (visible.length === 1 ? '' : 's') + ' recorded' + (ui.logFilter === 'all' ? '.' : ', ' + filtered.length + ' shown.');
  }

  /* ---------- scenario lab ---------- */

  function buildScenarioCards() {
    var box = $('scenario-cards');
    box.textContent = '';
    WC.scenarios.forEach(function (sc) {
      var card = el('article', 'card');
      card.dataset.id = sc.id;
      card.appendChild(el('h2', '', sc.title));
      card.appendChild(el('p', '', sc.summary));
      card.appendChild(el('p', 'watch', 'Watch for: ' + sc.watch));
      var row = el('div', 'btnrow');
      var run = el('button', 'btn primary');
      run.type = 'button';
      run.dataset.action = 'scrun';
      run.dataset.id = sc.id;
      run.appendChild(icon('i-play'));
      run.appendChild(document.createTextNode('Run'));
      var stop = el('button', 'btn');
      stop.type = 'button';
      stop.dataset.action = 'scstop';
      stop.dataset.id = sc.id;
      stop.textContent = 'Stop';
      stop.hidden = true;
      var reset = el('button', 'btn');
      reset.type = 'button';
      reset.dataset.action = 'screset';
      reset.appendChild(icon('i-reset'));
      reset.appendChild(document.createTextNode('Reset'));
      row.appendChild(run);
      row.appendChild(stop);
      row.appendChild(reset);
      card.appendChild(row);
      var det = el('details');
      det.appendChild(el('summary', '', 'Show the commands'));
      det.appendChild(el('pre', '', sc.script.join('\n')));
      card.appendChild(det);
      box.appendChild(card);
    });
  }

  function renderScenarios() {
    var running = ui.scenario;
    document.querySelectorAll('#scenario-cards .card').forEach(function (card) {
      var mine = running && running.id === card.dataset.id;
      card.dataset.running = String(!!mine);
      card.querySelector('[data-action="scrun"]').disabled = !!running;
      card.querySelector('[data-action="screset"]').disabled = !!running;
      card.querySelector('[data-action="scstop"]').hidden = !mine;
    });
    var s = sim.state;
    $('sc-state').textContent = s.mode + '  ' + pos(s.row, s.col) + '  q ' + sim.queue.size() + '  s ' + sim.stack.size();
    $('trace').value = sim.getTrace();
    var t = $('trace');
    t.scrollTop = t.scrollHeight;
  }

  /* ---------- locking, so repeated clicks cannot overlap ---------- */

  function renderLocks() {
    var locked = !!ui.scenario || ui.draining;
    document.querySelectorAll('.lockable').forEach(function (b) { b.disabled = locked; });
    document.body.dataset.locked = String(locked);
    document.querySelectorAll('[data-action="autorun"]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(ui.autoRun));
      b.querySelector('.autorun-text').textContent = ui.autoRun ? 'Auto-run on' : 'Auto-run off';
    });
    var edit = $('edit-btn');
    edit.setAttribute('aria-pressed', String(ui.editMode));
    $('edit-text').textContent = ui.editMode ? 'Editing obstacles' : 'Edit obstacles';
  }

  /* ---------- one redraw for everything ---------- */

  function render(effects) {
    effects = effects || [];
    if (effects.some(function (e) { return e.kind === 'reset'; })) { ui.logFromSeq = 0; }
    renderStatus();
    updateGrid(ui.grids[0], 'sim', effects);
    updateGrid(ui.grids[1], 'sc', effects);
    renderQueue(effects);
    renderStack(effects);
    renderSafety();
    renderLogs();
    renderScenarios();
    renderLocks();
    effects.forEach(function (e) {
      if (e.kind === 'estop') {
        if (ui.autoRun) { ui.autoRun = false; }
        renderLocks();
      }
    });
  }

  sim.subscribe(function (_sim, effects) { render(effects); });

  /* ---------- running things ---------- */

  function emergencyStop() {
    var wasAuto = ui.autoRun;
    if (ui.scenario) { stopScenario('Scenario stopped by the emergency stop.'); }
    ui.draining = false;
    ui.autoRun = false;
    sim.emergencyStop();
    if (wasAuto) { sim.note('info', 'AUTORUN', 'Auto-run was switched off by the emergency stop. It stays off until you turn it on again.', 'safety'); }
    say('Emergency stop engaged. Movement is frozen.', 'error');
  }

  function drainAnimated() {
    if (ui.draining || ui.scenario) { return; }
    if (sim.queue.isEmpty()) { sim.step(); sayLast(); return; }
    ui.draining = true;
    renderLocks();
    (function next() {
      if (!ui.draining) { return; }
      if (sim.queue.isEmpty() || sim.state.mode === 'ESTOP') { ui.draining = false; renderLocks(); sayLast(); return; }
      sim.step();
      window.setTimeout(next, 380 * ui.speed);
    })();
  }

  function autoTick() {
    if (!ui.autoRun || ui.scenario || ui.draining) { return; }
    if (sim.queue.isEmpty() || sim.state.mode === 'ESTOP') { return; }
    sim.step();
    sayLast();
  }

  /* ---------- scenario player ---------- */

  function stopScenario(message) {
    var run = ui.scenario;
    if (!run) { return; }
    window.clearTimeout(run.timer);
    ui.autoRun = run.savedAuto && sim.state.mode !== 'ESTOP';
    ui.scenario = null;
    $('sc-run').textContent = message || 'Stopped.';
    renderLocks();
    renderScenarios();
    renderSafety();
  }

  function runScenario(id) {
    if (ui.scenario || ui.draining) { return; }
    var sc = WC.scenarios.filter(function (x) { return x.id === id; })[0];
    if (!sc) { return; }
    var run = { id: id, index: 0, savedAuto: ui.autoRun, timer: null, draining: false };
    ui.scenario = run;
    ui.autoRun = false;
    renderLocks();
    $('sc-run').textContent = 'Running "' + sc.title + '"...';
    function next() {
      if (ui.scenario !== run) { return; }
      var line;
      if (run.draining) {
        if (sim.queue.isEmpty() || sim.state.mode === 'ESTOP') {
          run.draining = false;
          sim.addTrace('DRAIN', 'DRAINED');
          renderScenarios();
          run.timer = window.setTimeout(next, 250 * ui.speed);
          return;
        }
        sim.step();
        run.timer = window.setTimeout(next, 420 * ui.speed);
        return;
      }
      if (run.index >= sc.script.length) {
        stopScenario('Finished "' + sc.title + '". Press Run to repeat it with identical results.');
        say('Scenario finished: ' + sc.title, 'info');
        return;
      }
      line = sc.script[run.index];
      run.index++;
      $('sc-run').textContent = 'Step ' + run.index + ' of ' + sc.script.length + ':  ' + line;
      if (line === 'DRAIN') {
        run.draining = true;
        run.timer = window.setTimeout(next, 200 * ui.speed);
        return;
      }
      sim.exec(line);
      run.timer = window.setTimeout(next, 650 * ui.speed);
    }
    run.timer = window.setTimeout(next, 100);
  }

  /* ---------- actions ---------- */

  var DIRS = { ArrowUp: 'N', ArrowDown: 'S', ArrowLeft: 'W', ArrowRight: 'E', w: 'N', a: 'W', s: 'S', d: 'E', W: 'N', A: 'W', S: 'S', D: 'E' };

  function locked() {
    if (ui.scenario) { say('A scenario is running. Press Stop to take control.', 'warn'); return true; }
    if (ui.draining) { return true; }
    return false;
  }

  function doAction(name, node) {
    if (name === 'estop') { emergencyStop(); return; }
    if (name === 'scstop') { stopScenario('Stopped by the user.'); sim.note('info', 'SCENARIO', 'Scenario stopped by the user.', 'system'); return; }
    if (name === 'scrun') { runScenario(node.dataset.id); return; }
    if (name === 'copytrace') { copyTrace(); return; }
    if (name === 'logclear') {
      ui.logFromSeq = sim.log.length ? sim.log[sim.log.length - 1].seq : 0;
      renderLogs();
      say('Event log view cleared. The simulation was not changed.', 'info');
      return;
    }
    if (name === 'logshow') { ui.logFromSeq = 0; renderLogs(); return; }
    if (name === 'autorun') {
      ui.autoRun = !ui.autoRun;
      renderLocks();
      say(ui.autoRun ? 'Auto-run on.' : 'Auto-run off. Use Step to process requests.', 'info');
      return;
    }
    if (locked()) { return; }
    switch (name) {
      case 'move': sim.enqueueMove(node.dataset.dir); sayLast(); break;
      case 'back': sim.enqueueBack(); sayLast(); break;
      case 'sense': sim.enqueueSense(); sayLast(); break;
      case 'fault': sim.enqueueFault(); sayLast(); break;
      case 'restore': sim.enqueueRestore(); sayLast(); break;
      case 'step': sim.step(); sayLast(); break;
      case 'drain': drainAnimated(); break;
      case 'peekq': sim.peekQueue(); sayLast(); break;
      case 'peeks': sim.peekStack(); sayLast(); break;
      case 'reset': sim.reset(false); say('Simulation reset. Obstacles you placed were kept.', 'info'); break;
      case 'resetmap': sim.reset(true); say('Simulation reset with the default map.', 'info'); break;
      case 'edit':
        ui.editMode = !ui.editMode;
        render([]);
        say(ui.editMode ? 'Obstacle editing on. Select a floor cell to place or remove an obstacle.' : 'Obstacle editing off.', 'info');
        break;
      case 'cell':
        if (!ui.editMode) { say('Turn on Edit obstacles to change the room.', 'info'); break; }
        ui.focusRow = parseInt(node.dataset.row, 10);
        ui.focusCol = parseInt(node.dataset.col, 10);
        sim.toggleObstacle(parseInt(node.dataset.row, 10), parseInt(node.dataset.col, 10));
        sayLast();
        break;
      case 'obstacleahead': sim.placeObstacleAhead(); sayLast(); break;
      case 'drainbattery': sim.drainBattery(20); sayLast(); break;
      case 'recharge': sim.recharge(); sayLast(); break;
      case 'restorenow': sim.restoreSensorNow(); sayLast(); break;
      case 'release': {
        var r = sim.release($('ack').checked);
        $('ack').checked = false;
        sayLast();
        if (r.ok) { render([]); }
        break;
      }
      case 'screset':
        sim.reset(true);
        $('sc-run').textContent = 'Reset. Choose a scenario and press Run.';
        say('Simulation reset with the default map.', 'info');
        break;
      default: break;
    }
  }

  function copyTrace() {
    var text = sim.getTrace();
    var label = $('copy-text');
    function done(msg) { label.textContent = msg; window.setTimeout(function () { label.textContent = 'Copy trace'; }, 1800); }
    function fallback() {
      var ta = $('trace');
      ta.focus();
      ta.select();
      done('Selected. Press Ctrl+C');
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done('Copied'); }, fallback);
      } else { fallback(); }
    } catch (err) { fallback(); }
  }

  /* ---------- events ---------- */

  document.addEventListener('click', function (e) {
    var node = e.target.closest('[data-action]');
    if (!node || node.disabled) { return; }
    doAction(node.dataset.action, node);
  });

  document.addEventListener('change', function (e) {
    if (e.target.id === 'log-filter') { ui.logFilter = e.target.value; renderLogs(); }
    if (e.target.id === 'ack') { renderSafety(); }
  });

  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) { return; }
    var t = e.target;
    var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
    if (e.key === 'Escape') {
      if (e.repeat) { return; }
      e.preventDefault();
      emergencyStop();
      return;
    }
    // inside the room grid, arrow keys move between cells while editing obstacles
    if (t && t.classList && t.classList.contains('cell') && ui.editMode) {
      var r = parseInt(t.dataset.row, 10);
      var c = parseInt(t.dataset.col, 10);
      var nr = r + (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0);
      var nc = c + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0);
      if ((nr !== r || nc !== c) && nr >= 0 && nr < C.ROWS && nc >= 0 && nc < C.COLS) {
        e.preventDefault();
        t.tabIndex = -1;
        ui.focusRow = nr;
        ui.focusCol = nc;
        ui.grids[0].cells[nr][nc].tabIndex = 0;
        ui.grids[0].cells[nr][nc].focus();
      }
      return;
    }
    if (typing || e.repeat) { return; }
    var dir = DIRS[e.key];
    if (dir) {
      if (ui.view === 'eventlog' || ui.view === 'scenarios' || ui.view === 'safety') { return; }
      e.preventDefault();
      if (!locked()) { sim.enqueueMove(dir); sayLast(); }
    } else if (e.key === 'b' || e.key === 'B') {
      if (!locked()) { sim.enqueueBack(); sayLast(); }
    } else if (e.key === 'n' || e.key === 'N') {
      if (!locked()) { sim.step(); sayLast(); }
    }
  });

  /* ---------- views ---------- */

  var VIEWS = { dashboard: 'view-dashboard', simulator: 'view-simulator', queue: 'view-queue', stack: 'view-stack', sensors: 'view-sensors', safety: 'view-safety', eventlog: 'view-eventlog', scenarios: 'view-scenarios' };

  function route() {
    var name = (location.hash || '').replace('#', '');
    if (!VIEWS[name]) { name = 'dashboard'; }
    ui.view = name;
    Object.keys(VIEWS).forEach(function (k) { $(VIEWS[k]).hidden = k !== name; });
    document.querySelectorAll('#tabs a').forEach(function (a) {
      if (a.getAttribute('href') === '#' + name) { a.setAttribute('aria-current', 'page'); } else { a.removeAttribute('aria-current'); }
    });
    // On a narrow screen the tab bar scrolls sideways. Centre the active tab so the person can see where they are.
    var activeTab = document.querySelector('#tabs a[aria-current="page"]');
    var tabBar = $('tabs');
    if (activeTab && tabBar.scrollWidth > tabBar.clientWidth) {
      var a = activeTab.getBoundingClientRect();
      var b = tabBar.getBoundingClientRect();
      tabBar.scrollLeft += (a.left + a.width / 2) - (b.left + b.width / 2);
    }
    document.title = {
      dashboard: 'Dashboard', simulator: 'Simulator', queue: 'Queue', stack: 'Stack', sensors: 'Sensors',
      safety: 'Safety', eventlog: 'Event log', scenarios: 'Scenario lab'
    }[name] + ' - Wheelchair Safety Simulator';
  }
  window.addEventListener('hashchange', function () { route(); renderStatus(); });

  /* ---------- start ---------- */

  buildGrid($('sim-grid'), true);
  buildGrid($('sc-grid'), false);
  buildScenarioCards();
  route();
  render([]);
  ui.autoTimer = window.setInterval(autoTick, C.AUTORUNMS);
  window.WCApp = { sim: sim, ui: ui }; // handy for testing in the browser console
})();
