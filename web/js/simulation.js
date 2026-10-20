/* simulation.js
   The simulation: grid, wheelchair, battery, mode, the request queue, the history
   stack and the event log. It never touches the page. The page (ui.js) asks it to do
   things and then draws whatever state it finds here.

   Flow, same as the C program:
     add a request  ->  circular queue  ->  step  ->  move  ->  old position pushed on the stack
     BACK request                       ->  step  ->  pop the stack and return there
     EMERGENCY STOP skips the queue: it acts at once, removes pending requests, keeps the stack. */
(function () {
  'use strict';
  var WC = (globalThis.WC = globalThis.WC || {});
  var C = WC.config;
  var S = function () { return WC.safety; };

  function copyMap() {
    return C.DEFAULTMAP.map(function (row) { return row.split(''); });
  }
  function pad4(n) { return ('0000' + n).slice(-4); }
  function eventLabel(ev) { return ev.type === 'MOVE' ? 'MOVE ' + ev.dir : ev.type; }
  function pos(s) { return '(' + s.row + ', ' + s.col + ')'; }

  WC.createSimulation = function () {
    var sim = {};
    var listeners = [];
    var effects = [];      // things that just happened, used only for animation
    var logSeq = 0;
    var traceLines = [];
    var cmdCount = 0;

    function build(grid) {
      sim.state = {
        grid: grid,
        row: C.START.row,
        col: C.START.col,
        heading: C.START.heading,
        battery: C.BATTERYSTART,
        mode: 'READY',
        sensorFaulty: false,
        estopCount: 0,
        movesMade: 0,
        nextSeq: 1,          // request numbers (like nextId in the C program)
        lowWarned: false
      };
      sim.stack = new WC.Stack(C.STACKCAP);
      sim.queue = new WC.CircularQueue(C.QCAP);
      sim.log = [];
      logSeq = 0;
      traceLines = [];
      cmdCount = 0;
    }

    function log(level, code, message, group) {
      logSeq++;
      sim.log.push({ seq: logSeq, time: new Date(), level: level, code: code, message: message, group: group || 'system' });
      if (sim.log.length > 2000) { sim.log.shift(); }
    }

    function res(ok, code, extra) {
      var r = { ok: ok, code: code };
      if (extra) { for (var k in extra) { r[k] = extra[k]; } }
      return r;
    }

    function commit() {
      var e = effects;
      effects = [];
      listeners.forEach(function (fn) { fn(sim, e); });
    }

    // Every public action runs inside act(), so the page is told exactly once per action.
    function act(fn) {
      var r = fn();
      commit();
      return r;
    }

    sim.subscribe = function (fn) { listeners.push(fn); };
    sim.note = function (level, code, message, group) { log(level, code, message, group); commit(); };

    /* ---------- adding requests (producers) ---------- */

    function enqueueEvent(type, dir) {
      var s = sim.state;
      if (s.mode === 'ESTOP') {
        log('error', 'REFUSED', 'Request refused: emergency stop is engaged. Recover first.', 'safety');
        return res(false, 'REFUSED');
      }
      var ev = { seq: s.nextSeq, type: type, dir: dir || null };
      var r = sim.queue.enqueue(ev);
      if (!r.ok) {
        log('error', 'QOVERFLOW', 'Queue overflow: all ' + C.QCAP + ' slots are used. Request refused, queue unchanged.', 'queue');
        return res(false, 'QOVERFLOW');
      }
      s.nextSeq++;
      effects.push({ kind: 'enqueue', slot: r.index });
      log('info', 'ENQUEUE', 'Request #' + ev.seq + ' ' + eventLabel(ev) + ' added at rear slot ' + r.index +
        ' (front=' + sim.queue.front + ', rear=' + sim.queue.rear + ').', 'queue');
      return res(true, 'QUEUED', { seq: ev.seq });
    }

    sim.enqueueMove = function (dir) {
      if (!C.DELTA[dir]) { return res(false, 'INVALID'); }
      return act(function () { return enqueueEvent('MOVE', dir); });
    };
    sim.enqueueBack = function () { return act(function () { return enqueueEvent('BACK'); }); };
    sim.enqueueSense = function () { return act(function () { return enqueueEvent('SENSE'); }); };
    sim.enqueueFault = function () { return act(function () { return enqueueEvent('FAULT'); }); };
    sim.enqueueRestore = function () { return act(function () { return enqueueEvent('RESTORE'); }); };

    /* ---------- processing one request (consumer) ---------- */

    function spendBattery() {
      var s = sim.state;
      s.battery = Math.max(0, s.battery - C.MOVECOST);
      checkBatteryWarnings();
    }

    function checkBatteryWarnings() {
      var s = sim.state;
      if (s.battery > 0 && s.battery < C.LOWBATTERY && !s.lowWarned) {
        s.lowWarned = true;
        log('warn', 'LOWBATTERY', 'Low battery warning: ' + s.battery + '% left (simulated).', 'sensor');
      }
      if (s.battery === 0) {
        s.mode = S().settleMode(s);
        log('error', 'DEPLETED', 'Battery is empty (simulated). Movement is refused until it is recharged or the simulation is reset.', 'sensor');
      }
    }

    function doMove(dir) {
      var s = sim.state;
      var prevHeading = s.heading;
      s.heading = dir;
      var rule = S().checkMoveAllowed(s);
      if (!rule.ok) {
        log('warn', rule.code, rule.message, 'safety');
        effects.push({ kind: 'refused' });
        return res(false, rule.code);
      }
      var d = C.DELTA[dir];
      var nr = s.row + d[0];
      var nc = s.col + d[1];
      if (!S().isFree(s.grid, nr, nc)) {
        s.mode = 'BLOCKED';
        log('warn', 'BLOCKED', 'Blocked: ' + S().describeCell(s.grid, nr, nc) + ' at (' + nr + ', ' + nc + '). The wheelchair did not move and nothing was saved.', 'move');
        effects.push({ kind: 'blocked', row: nr, col: nc, dir: dir });
        return res(false, 'BLOCKED');
      }
      // Save the old position BEFORE moving. A full stack refuses the move, because moving
      // without saving would make BACK jump over cells that were never saved.
      var snapshot = { row: s.row, col: s.col, heading: prevHeading };
      var p = sim.stack.push(snapshot);
      if (!p.ok) {
        log('error', 'SOVERFLOW', 'Stack overflow: all ' + C.STACKCAP + ' saved positions are used. Move refused. Use BACK to free a slot.', 'stack');
        effects.push({ kind: 'refused' });
        return res(false, 'SOVERFLOW');
      }
      effects.push({ kind: 'push', slot: p.index });
      log('info', 'PUSH', 'Saved ' + pos(snapshot) + ' facing ' + snapshot.heading + ' in stack slot ' + p.index + ' (top=' + sim.stack.top + ').', 'stack');
      s.row = nr;
      s.col = nc;
      s.movesMade++;
      effects.push({ kind: 'moved' });
      spendBattery();
      s.mode = S().settleMode(s);
      log('info', 'MOVED', 'Moved ' + dir + ' to ' + pos(s) + '. Battery ' + s.battery + '%.', 'move');
      if (s.mode === 'ARRIVED') { log('info', 'ARRIVED', 'Destination reached.', 'move'); }
      return res(true, 'MOVED');
    }

    function doBack() {
      var s = sim.state;
      var rule = S().checkMoveAllowed(s);
      if (!rule.ok) {
        log('warn', rule.code, rule.message, 'safety');
        effects.push({ kind: 'refused' });
        return res(false, rule.code);
      }
      var top = sim.stack.peek();
      if (!top.ok) {
        log('error', 'SUNDERFLOW', 'Stack underflow: no earlier position is saved. The wheelchair stays where it is.', 'stack');
        return res(false, 'SUNDERFLOW');
      }
      var snap = top.item;
      if (!S().isFree(s.grid, snap.row, snap.col)) {
        // An obstacle was placed on the saved cell after it was saved. Nothing is popped.
        s.mode = 'BLOCKED';
        log('warn', 'BLOCKED', 'Cannot go back: ' + S().describeCell(s.grid, snap.row, snap.col) + ' at ' + pos(snap) + '. The saved position stays on the stack.', 'move');
        effects.push({ kind: 'blocked', row: snap.row, col: snap.col, dir: s.heading });
        return res(false, 'BLOCKED');
      }
      var p = sim.stack.pop();
      effects.push({ kind: 'pop', slot: p.index, label: pos(snap) + ' facing ' + snap.heading });
      log('info', 'POP', 'Restored ' + pos(snap) + ' facing ' + snap.heading + ' from stack slot ' + p.index + ' (top=' + sim.stack.top + ').', 'stack');
      s.row = snap.row;
      s.col = snap.col;
      s.heading = snap.heading;
      s.movesMade++;
      effects.push({ kind: 'moved' });
      spendBattery();
      s.mode = S().settleMode(s);
      log('info', 'MOVED', 'Went back to ' + pos(s) + '. Battery ' + s.battery + '%.', 'move');
      if (s.mode === 'ARRIVED') { log('info', 'ARRIVED', 'Destination reached.', 'move'); }
      return res(true, 'MOVED');
    }

    function doSense() {
      var s = sim.state;
      var cm = S().clearance(s);
      if (cm === null) {
        log('warn', 'NOREADING', 'Sensor returned no reading (simulated sensor failure).', 'sensor');
        return res(false, 'NOREADING');
      }
      log('info', 'SENSE', 'Simulated distance ahead (' + C.DIRNAME[s.heading] + '): ' + cm + ' cm.', 'sensor');
      if (cm < C.CELLCM) {
        log('warn', 'NEAROBSTACLE', 'Obstacle detected: less than ' + C.CELLCM + ' cm ahead (simulated).', 'sensor');
      }
      return res(true, 'SENSED', { cm: cm });
    }

    function doStep() {
      var s = sim.state;
      if (s.mode === 'ESTOP') {
        log('error', 'ESTOP', 'Emergency stop is engaged. Queued commands are not executed.', 'safety');
        return res(false, 'ESTOP');
      }
      var d = sim.queue.dequeue();
      if (!d.ok) {
        log('error', 'QUNDERFLOW', 'Queue underflow: no pending requests to process.', 'queue');
        return res(false, 'QUNDERFLOW');
      }
      var ev = d.item;
      effects.push({ kind: 'dequeue', slot: d.index, label: eventLabel(ev) });
      log('info', 'DEQUEUE', 'Dequeued request #' + ev.seq + ' ' + eventLabel(ev) + ' from front slot ' + d.index +
        ' (front=' + sim.queue.front + ', rear=' + sim.queue.rear + ').', 'queue');
      if (ev.type === 'MOVE') { return doMove(ev.dir); }
      if (ev.type === 'BACK') { return doBack(); }
      if (ev.type === 'SENSE') { return doSense(); }
      if (ev.type === 'FAULT') {
        s.sensorFaulty = true;
        s.mode = S().settleMode(s);
        log('warn', 'FAULT', 'Sensor failure injected (simulated). Fail-safe stop: movement is refused until the sensor is restored.', 'sensor');
        return res(true, 'FAULT');
      }
      if (ev.type === 'RESTORE') {
        s.sensorFaulty = false;
        s.mode = S().settleMode(s);
        log('info', 'RESTORE', 'Sensor restored (simulated). Mode is ' + s.mode + '.', 'sensor');
        return res(true, 'RESTORE');
      }
      return res(false, 'UNKNOWN');
    }

    sim.step = function () { return act(doStep); };

    sim.drain = function () {
      return act(function () {
        var count = 0;
        while (!sim.queue.isEmpty() && sim.state.mode !== 'ESTOP' && count < 100) {
          doStep();
          count++;
        }
        return res(true, 'DRAINED', { count: count });
      });
    };

    /* ---------- emergency stop and recovery (never queued) ---------- */

    sim.emergencyStop = function () {
      return act(function () {
        var s = sim.state;
        if (s.mode === 'ESTOP') {
          log('info', 'ESTOP', 'Emergency stop is already engaged.', 'safety');
          return res(true, 'ESTOP', { flushed: 0 });
        }
        s.mode = 'ESTOP';
        s.estopCount++;
        var flushed = 0;
        while (!sim.queue.isEmpty()) {
          var d = sim.queue.dequeue();
          effects.push({ kind: 'dequeue', slot: d.index, label: eventLabel(d.item) });
          flushed++;
        }
        effects.push({ kind: 'estop' });
        log('error', 'ESTOP', 'EMERGENCY STOP engaged. Movement frozen. ' + flushed + ' pending request(s) removed. ' +
          'The stack was kept (' + sim.stack.size() + ' saved position(s)).', 'safety');
        return res(true, 'ESTOP', { flushed: flushed });
      });
    };

    sim.recoveryChecks = function () { return S().recoveryChecks(sim.state, sim.queue); };

    // Helper during recovery: a failed sensor must be repaired before the checks can pass.
    sim.restoreSensorNow = function () {
      return act(function () {
        sim.state.sensorFaulty = false;
        log('info', 'RESTORE', 'Sensor restored by the operator during recovery (simulated).', 'safety');
        return res(true, 'RESTORE');
      });
    };

    sim.release = function (acknowledged) {
      return act(function () {
        var s = sim.state;
        if (s.mode !== 'ESTOP') {
          log('info', 'RELEASE', 'Emergency stop is not engaged.', 'safety');
          return res(false, 'NOTSTOPPED');
        }
        if (!acknowledged) {
          log('warn', 'RECOVERYREFUSED', 'Recovery refused: the operator has not confirmed that the area is clear.', 'safety');
          return res(false, 'NOTCONFIRMED');
        }
        var failing = sim.recoveryChecks().filter(function (c) { return !c.ok; });
        if (failing.length > 0) {
          log('warn', 'RECOVERYREFUSED', 'Recovery refused. Check failed: ' + failing.map(function (c) { return c.label; }).join('; ') + '.', 'safety');
          return res(false, 'CHECKSFAILED');
        }
        s.mode = 'READY';
        s.mode = S().settleMode(s);
        log('info', 'RELEASED', 'Recovery complete. All ' + sim.recoveryChecks().length + ' revalidation checks passed. ' +
          'Old requests were not resumed. Mode is ' + s.mode + ' at ' + pos(s) + '.', 'safety');
        return res(true, 'RELEASED');
      });
    };

    /* ---------- environment events (not queued) ---------- */

    sim.toggleObstacle = function (r, c) {
      return act(function () {
        var s = sim.state;
        if (r < 0 || r >= C.ROWS || c < 0 || c >= C.COLS) { return res(false, 'INVALID'); }
        var ch = s.grid[r][c];
        if (ch !== '.' && ch !== 'O') {
          log('warn', 'NOEDIT', 'Cell (' + r + ', ' + c + ') cannot be changed: walls, the start and the destination stay fixed.', 'sensor');
          return res(false, 'NOEDIT');
        }
        if (r === s.row && c === s.col) {
          log('warn', 'NOEDIT', 'Cell (' + r + ', ' + c + ') holds the wheelchair, so nothing can be placed there.', 'sensor');
          return res(false, 'NOEDIT');
        }
        if (ch === '.') {
          s.grid[r][c] = 'O';
          log('warn', 'OBSTACLE', 'Obstacle placed at (' + r + ', ' + c + ').', 'sensor');
          return res(true, 'PLACED');
        }
        s.grid[r][c] = '.';
        log('info', 'OBSTACLE', 'Obstacle removed from (' + r + ', ' + c + ').', 'sensor');
        return res(true, 'REMOVED');
      });
    };

    sim.placeObstacleAhead = function () {
      var s = sim.state;
      var d = C.DELTA[s.heading];
      var r = s.row + d[0];
      var c = s.col + d[1];
      if (r < 0 || r >= C.ROWS || c < 0 || c >= C.COLS || s.grid[r][c] !== '.') {
        return act(function () {
          log('warn', 'NOEDIT', 'No free floor cell directly ahead to place an obstacle on.', 'sensor');
          return res(false, 'NOEDIT');
        });
      }
      return sim.toggleObstacle(r, c);
    };

    sim.drainBattery = function (amount) {
      return act(function () {
        var s = sim.state;
        s.battery = Math.max(0, s.battery - amount);
        log('warn', 'BATTERY', 'Simulated battery drain of ' + amount + '%. Battery is ' + s.battery + '%.', 'sensor');
        checkBatteryWarnings();
        return res(true, 'BATTERY');
      });
    };

    sim.recharge = function () {
      return act(function () {
        var s = sim.state;
        s.battery = C.BATTERYSTART;
        s.lowWarned = false;
        if (s.mode === 'DEPLETED') { s.mode = S().settleMode(s); }
        log('info', 'RECHARGE', 'Simulated recharge. Battery is ' + s.battery + '%.', 'sensor');
        return res(true, 'RECHARGE');
      });
    };

    /* ---------- peeking and resetting ---------- */

    sim.peekQueue = function () {
      return act(function () {
        var p = sim.queue.peek();
        if (!p.ok) { log('info', 'PEEKQ', 'Queue is empty (front=-1, rear=-1).', 'queue'); return res(false, 'EMPTY'); }
        log('info', 'PEEKQ', 'Front of queue: request #' + p.item.seq + ' ' + eventLabel(p.item) + ' in slot ' + p.index + '.', 'queue');
        return res(true, 'PEEKQ');
      });
    };

    sim.peekStack = function () {
      return act(function () {
        var p = sim.stack.peek();
        if (!p.ok) { log('info', 'PEEKS', 'Stack is empty (top=-1).', 'stack'); return res(false, 'EMPTY'); }
        log('info', 'PEEKS', 'Top of stack: ' + pos(p.item) + ' facing ' + p.item.heading + ' in slot ' + p.index + '.', 'stack');
        return res(true, 'PEEKS');
      });
    };

    // Rebuilds queue, stack, battery, sensor and mode. The map keeps its obstacles unless asked.
    sim.reset = function (useDefaultMap) {
      return act(function () {
        var wasStopped = sim.state.mode === 'ESTOP';
        build(useDefaultMap ? copyMap() : sim.state.grid.map(function (row) { return row.slice(); }));
        log('info', 'RESET', 'Simulation reset' + (useDefaultMap ? ' with the default map.' : ' (map kept as it is).') +
          (wasStopped ? ' This full restart also cleared the emergency stop. Queue and stack start empty, so nothing old can resume.' : ''), 'system');
        effects.push({ kind: 'reset' });
        return res(true, 'RESET');
      });
    };

    /* ---------- command language (used by the Scenario Lab) ---------- */

    // One command per line, same words as the plan. Every command adds one trace line.
    sim.exec = function (line) {
      var text = String(line).trim();
      if (text === '' || text.charAt(0) === '#') { return null; }
      var parts = text.toUpperCase().split(/\s+/);
      var cmd = parts[0];
      var r;
      if (cmd === 'MAP') { r = sim.reset(true); }
      else if (cmd === 'MOVE') { r = sim.enqueueMove(parts[1]); }
      else if (cmd === 'BACK') { r = sim.enqueueBack(); }
      else if (cmd === 'SENSE') { r = sim.enqueueSense(); }
      else if (cmd === 'FAULT') { r = sim.enqueueFault(); }
      else if (cmd === 'RESTORE') { r = sim.enqueueRestore(); }
      else if (cmd === 'STEP') { r = sim.step(); }
      else if (cmd === 'DRAIN') { r = sim.drain(); }
      else if (cmd === 'ESTOP') { r = sim.emergencyStop(); }
      else if (cmd === 'RELEASE') { r = sim.release(true); }
      else if (cmd === 'RESET') { r = sim.reset(false); }
      else if (cmd === 'PEEKQ') { r = sim.peekQueue(); }
      else if (cmd === 'PEEKS') { r = sim.peekStack(); }
      else { r = res(false, 'UNKNOWN'); }
      sim.addTrace(text.toUpperCase(), r.code);
      return r;
    };

    // One trace line per command. No clock and no random numbers, so a run can be repeated exactly.
    sim.addTrace = function (command, outcome) {
      var s = sim.state;
      cmdCount++;
      traceLines.push(pad4(cmdCount) + ' ' + command + ' | ' + outcome +
        ' | q[front=' + sim.queue.front + ' rear=' + sim.queue.rear + ' size=' + sim.queue.size() + ']' +
        ' s[top=' + sim.stack.top + ' size=' + sim.stack.size() + ']' +
        ' | ' + pos(s) + ' ' + s.heading + ' ' + s.mode);
    };
    sim.getTrace = function () { return traceLines.join('\n'); };

    build(copyMap());
    log('info', 'READY', 'Simulation ready. All sensor data is simulated. Nothing is connected to a real wheelchair.', 'system');
    return sim;
  };

  WC.eventLabel = eventLabel;
})();
