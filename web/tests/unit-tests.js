/* tests.js
   Logic tests for the stack, the circular queue, the simulation and the scenarios.
   They need no page. Run them in a terminal:  node tests/unit-tests.js */
(function () {
  'use strict';
  var WC = (globalThis.WC = globalThis.WC || {});

  WC.runTests = function () {
    var results = [];
    function check(name, condition) { results.push({ name: name, pass: !!condition }); }
    function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

    try {

    function run(sim, lines) { lines.forEach(function (l) { sim.exec(l); }); }
    function lastLog(sim) { return sim.log[sim.log.length - 1]; }
    function hasLog(sim, code) { return sim.log.some(function (e) { return e.code === code; }); }

    /* ---------- stack ---------- */
    var st = new WC.Stack(5);
    check('stack: new stack is empty with top = -1', st.isEmpty() && st.top === -1 && st.size() === 0);
    check('stack: pop on empty gives SUNDERFLOW and changes nothing', eq(st.pop(), { ok: false, code: 'SUNDERFLOW' }) && st.top === -1);
    check('stack: peek on empty gives SUNDERFLOW', st.peek().code === 'SUNDERFLOW');
    st.push('a');
    check('stack: one element, top = 0', st.top === 0 && st.peek().item === 'a' && !st.isEmpty());
    check('stack: pop returns the element and top goes back to -1', st.pop().item === 'a' && st.top === -1);
    ['a', 'b', 'c', 'd', 'e'].forEach(function (x) { st.push(x); });
    check('stack: full at top = 4', st.isFull() && st.top === 4);
    var over = st.push('f');
    check('stack: overflow refused, data and top unchanged', over.code === 'SOVERFLOW' && st.top === 4 && st.peek().item === 'e');
    check('stack: last in, first out', st.pop().item === 'e' && st.pop().item === 'd' && st.pop().item === 'c');
    var rep = true;
    var st2 = new WC.Stack(3);
    for (var i = 0; i < 30; i++) { st2.push(i); if (st2.pop().item !== i) { rep = false; } }
    check('stack: 30 push and pop rounds leave it empty and correct', rep && st2.top === -1);

    /* ---------- circular queue ---------- */
    var q = new WC.CircularQueue(5);
    check('queue: new queue is empty with front = -1 and rear = -1', q.isEmpty() && q.front === -1 && q.rear === -1 && q.size() === 0);
    check('queue: dequeue on empty gives QUNDERFLOW and changes nothing', q.dequeue().code === 'QUNDERFLOW' && q.front === -1);
    q.enqueue('a');
    check('queue: one element gives front = 0 and rear = 0', q.front === 0 && q.rear === 0 && q.size() === 1);
    check('queue: removing the final element resets front and rear to -1', q.dequeue().item === 'a' && q.front === -1 && q.rear === -1);
    ['a', 'b', 'c', 'd', 'e'].forEach(function (x) { q.enqueue(x); });
    check('queue: full after 5 items, front = 0 and rear = 4', q.isFull() && q.front === 0 && q.rear === 4 && q.size() === 5);
    check('queue: overflow refused, nothing changed', q.enqueue('f').code === 'QOVERFLOW' && q.rear === 4 && q.size() === 5);
    q.dequeue();
    q.dequeue();
    q.enqueue('f');
    q.enqueue('g');
    check('queue: wraparound, rear goes 4 to 0 to 1 and front is 2', q.front === 2 && q.rear === 1 && q.size() === 5);
    check('queue: first in, first out after wraparound', eq(q.toArray().map(function (x) { return x.item; }), ['c', 'd', 'e', 'f', 'g']));
    check('queue: full again after wraparound', q.isFull() && q.enqueue('h').code === 'QOVERFLOW');
    var q2 = new WC.CircularQueue(3);
    var qok = true;
    for (var j = 0; j < 40; j++) { q2.enqueue(j); if (q2.dequeue().item !== j) { qok = false; } }
    check('queue: 40 enqueue and dequeue rounds leave it empty and correct', qok && q2.front === -1 && q2.rear === -1);

    /* ---------- simulation ---------- */
    var sim = WC.createSimulation();
    check('sim: starts at (1, 1) facing E, READY, battery 100, queue and stack empty',
      sim.state.row === 1 && sim.state.col === 1 && sim.state.heading === 'E' && sim.state.mode === 'READY' &&
      sim.state.battery === 100 && sim.queue.isEmpty() && sim.stack.isEmpty());

    run(sim, ['MOVE E', 'DRAIN']);
    check('sim: normal move east to (1, 2) saves (1, 1) before moving',
      sim.state.row === 1 && sim.state.col === 2 && sim.stack.top === 0 && sim.stack.peek().item.row === 1 && sim.stack.peek().item.col === 1);

    sim = WC.createSimulation();
    run(sim, ['MOVE N', 'DRAIN']);
    check('sim: wall boundary blocks the move, nothing pushed, mode BLOCKED',
      sim.state.row === 1 && sim.stack.top === -1 && sim.state.mode === 'BLOCKED' && hasLog(sim, 'BLOCKED'));

    run(sim, ['MAP', 'MOVE E', 'MOVE E', 'MOVE S', 'DRAIN']);
    check('sim: obstacle at (2, 3) blocks the move, chair stays at (1, 3), stack top is 1',
      sim.state.row === 1 && sim.state.col === 3 && sim.state.mode === 'BLOCKED' && sim.stack.top === 1);

    sim = WC.createSimulation();
    run(sim, ['SENSE', 'DRAIN']);
    check('sim: sensor at start reads 300 cm (capped)', lastLog(sim).message.indexOf('300 cm') !== -1);
    run(sim, ['MOVE E', 'MOVE E', 'MOVE S', 'DRAIN', 'SENSE', 'DRAIN']);
    check('sim: sensor facing the obstacle reads 0 cm and warns', hasLog(sim, 'NEAROBSTACLE') && sim.log.some(function (e) { return e.message.indexOf('0 cm') !== -1; }));

    sim = WC.createSimulation();
    run(sim, ['BACK', 'DRAIN']);
    check('sim: BACK with an empty stack gives SUNDERFLOW and the chair stays', hasLog(sim, 'SUNDERFLOW') && sim.state.row === 1 && sim.state.col === 1);

    sim = WC.createSimulation();
    var codes = [];
    for (var k = 0; k < 9; k++) { codes.push(sim.enqueueMove('E').code); }
    check('sim: ninth request gives QOVERFLOW, queue stays at 8 items, front 0 rear 7',
      codes[8] === 'QOVERFLOW' && sim.queue.size() === 8 && sim.queue.front === 0 && sim.queue.rear === 7);
    check('sim: request numbers are not used up by a refused request', sim.state.nextSeq === 9);

    sim = WC.createSimulation();
    run(sim, ['MOVE E', 'MOVE E', 'MOVE E', 'STEP', 'ESTOP']);
    check('sim: ESTOP removes the 2 pending requests, keeps the stack, counts one stop',
      sim.queue.isEmpty() && sim.stack.top === 0 && sim.state.mode === 'ESTOP' && sim.state.estopCount === 1);
    var refused = sim.enqueueMove('E');
    var stepRes = sim.step();
    check('sim: during ESTOP new requests and steps are refused, the chair does not move',
      refused.code === 'REFUSED' && stepRes.code === 'ESTOP' && sim.state.col === 2);
    var noAck = sim.release(false);
    check('sim: recovery without operator confirmation is refused', noAck.code === 'NOTCONFIRMED' && sim.state.mode === 'ESTOP');
    sim.state.sensorFaulty = true;
    var failed = sim.release(true);
    check('sim: recovery is refused while the sensor is failed', failed.code === 'CHECKSFAILED' && sim.state.mode === 'ESTOP');
    sim.restoreSensorNow();
    check('sim: recovery succeeds after revalidation passes and resumes as READY', sim.release(true).code === 'RELEASED' && sim.state.mode === 'READY');
    run(sim, ['BACK', 'DRAIN']);
    check('sim: BACK works after recovery using the kept stack', sim.state.col === 1 && sim.stack.top === -1);

    sim = WC.createSimulation();
    sim.emergencyStop();
    sim.emergencyStop();
    check('sim: pressing ESTOP twice counts only once', sim.state.estopCount === 1);

    sim = WC.createSimulation();
    var moves = ['E', 'W'];
    for (var m = 0; m < 11; m++) { sim.enqueueMove(moves[m % 2]); sim.step(); }
    check('sim: 11th saved move is refused with SOVERFLOW, chair does not move, top stays 9',
      hasLog(sim, 'SOVERFLOW') && sim.stack.top === 9 && sim.state.col === 1);

    sim = WC.createSimulation();
    run(sim, ['FAULT', 'DRAIN']);
    check('sim: sensor fault sets mode FAULT', sim.state.mode === 'FAULT' && sim.state.sensorFaulty);
    run(sim, ['MOVE E', 'DRAIN', 'SENSE', 'DRAIN']);
    check('sim: moves are refused and the sensor gives no reading while FAULT',
      sim.state.col === 1 && hasLog(sim, 'NOREADING') && sim.stack.top === -1);
    run(sim, ['RESTORE', 'DRAIN']);
    check('sim: restoring the sensor returns to READY', sim.state.mode === 'READY');

    sim = WC.createSimulation();
    sim.drainBattery(85);
    check('sim: battery below 20 gives a low-battery warning once', hasLog(sim, 'LOWBATTERY') && sim.state.battery === 15);
    sim.drainBattery(50);
    check('sim: battery 0 gives DEPLETED and refuses moves', sim.state.mode === 'DEPLETED' && sim.enqueueMove('E').ok && sim.step().code === 'DEPLETED' && sim.state.col === 1);
    sim.recharge();
    check('sim: recharge restores battery and leaves DEPLETED', sim.state.battery === 100 && sim.state.mode === 'READY');

    sim = WC.createSimulation();
    var t1 = sim.toggleObstacle(1, 4);
    var t2 = sim.toggleObstacle(1, 4);
    var t3 = sim.toggleObstacle(0, 0);
    var t4 = sim.toggleObstacle(1, 1);
    check('sim: obstacles can be placed and removed on floor cells only',
      t1.code === 'PLACED' && t2.code === 'REMOVED' && t3.code === 'NOEDIT' && t4.code === 'NOEDIT');

    sim = WC.createSimulation();
    run(sim, ['MOVE E', 'MOVE E', 'DRAIN']);
    sim.toggleObstacle(1, 2);
    run(sim, ['BACK', 'DRAIN']);
    check('sim: BACK onto a cell that now has an obstacle is refused and nothing is popped',
      sim.state.col === 3 && sim.stack.top === 1 && sim.state.mode === 'BLOCKED');

    sim = WC.createSimulation();
    run(sim, ['MOVE E', 'DRAIN']);
    var before = JSON.stringify([sim.state, sim.queue.items, sim.stack.items]);
    var logLength = sim.log.length;
    sim.log.length = 0; // what a "clear log" must never touch is the state
    check('sim: emptying the log array does not change the simulation state',
      before === JSON.stringify([sim.state, sim.queue.items, sim.stack.items]) && logLength > 0);

    sim = WC.createSimulation();
    run(sim, ['MOVE E', 'MOVE E', 'DRAIN', 'RESET']);
    check('sim: RESET keeps the map, empties queue and stack and returns the chair to the start',
      sim.state.row === 1 && sim.state.col === 1 && sim.stack.isEmpty() && sim.queue.isEmpty() && sim.state.battery === 100);

    /* ---------- revalidation, reset and log accuracy ---------- */
    sim = WC.createSimulation();
    sim.enqueueMove('E');
    sim.toggleObstacle(1, 2);
    var rv = sim.step();
    check('revalidation: a queued move is checked against the room at the moment it runs',
      rv.code === 'BLOCKED' && sim.state.col === 1 && sim.stack.top === -1);

    sim = WC.createSimulation();
    sim.enqueueMove('E');
    sim.enqueueMove('E');
    sim.emergencyStop();
    sim.release(true);
    var after = sim.step();
    check('after recovery the old requests are gone, so nothing resumes blindly',
      after.code === 'QUNDERFLOW' && sim.state.col === 1);

    sim = WC.createSimulation();
    run(sim, ['FAULT', 'MOVE E', 'DRAIN']);
    check('a sensor failure queued before a move makes the move refused (conservative stop)',
      sim.state.col === 1 && sim.state.mode === 'FAULT' && hasLog(sim, 'FAULT'));

    sim = WC.createSimulation();
    run(sim, ['MOVE E', 'MOVE S', 'DRAIN', 'FAULT', 'DRAIN']);
    sim.drainBattery(30);
    sim.toggleObstacle(3, 3);
    sim.enqueueMove('E');
    sim.emergencyStop();
    sim.reset(false);
    var rs = sim.state;
    check('reset while stopped gives the full start state (position, heading, battery, sensor, counts, queue, stack)',
      rs.row === 1 && rs.col === 1 && rs.heading === 'E' && rs.mode === 'READY' && rs.battery === 100 &&
      !rs.sensorFaulty && rs.estopCount === 0 && rs.movesMade === 0 && rs.nextSeq === 1 &&
      sim.queue.isEmpty() && sim.queue.front === -1 && sim.stack.top === -1 && sim.state.grid[3][3] === 'O');
    check('reset while stopped says in the log that it cleared the stop', /cleared the emergency stop/.test(sim.log[sim.log.length - 1].message));
    sim.reset(true);
    check('reset with the default map removes placed obstacles', sim.state.grid[3][3] === '.');

    sim = WC.createSimulation();
    var n0 = sim.log.length;
    sim.enqueueMove('E');
    sim.step();
    var codes1 = sim.log.slice(n0).map(function (e) { return e.code; });
    check('log for a successful move reads ENQUEUE, DEQUEUE, PUSH, MOVED in that order', eq(codes1, ['ENQUEUE', 'DEQUEUE', 'PUSH', 'MOVED']));
    n0 = sim.log.length;
    sim.enqueueMove('N');
    sim.step();
    var codes2 = sim.log.slice(n0).map(function (e) { return e.code; });
    check('log for a blocked move reads ENQUEUE, DEQUEUE, BLOCKED with no PUSH', eq(codes2, ['ENQUEUE', 'DEQUEUE', 'BLOCKED']));

    /* ---------- random testing: 8000 random actions, checking the rules after every one ---------- */
    (function () {
      var seed = 12345;
      function rnd(n) { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; }
      var bad = { cell: 0, queue: 0, stack: 0, estopQueue: 0, battery: 0, fault: 0, history: 0, chain: 0, back: 0, mode: 0 };
      var MODES = ['READY', 'BLOCKED', 'ARRIVED', 'FAULT', 'ESTOP', 'DEPLETED'];
      for (var run2 = 0; run2 < 20; run2++) {
        var fz = WC.createSimulation();
        for (var step = 0; step < 400; step++) {
          var s = fz.state;
          var a = rnd(17);
          var before = { row: s.row, col: s.col, top: fz.stack.top };
          var front = fz.queue.peek();
          var topSnap = fz.stack.peek();
          var r = null;
          if (a <= 3) { fz.enqueueMove('NESW'.charAt(a)); }
          else if (a === 4) { fz.enqueueBack(); }
          else if (a === 5) { fz.enqueueSense(); }
          else if (a === 6) { if (rnd(4) === 0) { fz.enqueueFault(); } else { fz.enqueueRestore(); } }
          else if (a <= 9) { r = fz.step(); }
          else if (a === 10) { if (rnd(6) === 0) { fz.emergencyStop(); } else { r = fz.step(); } }
          else if (a === 11) { fz.release(rnd(2) === 0); }
          else if (a === 12) { fz.restoreSensorNow(); }
          else if (a === 13) { fz.toggleObstacle(rnd(8), rnd(12)); }
          else if (a === 14) { if (rnd(3) === 0) { fz.drainBattery(1 + rnd(30)); } else { fz.recharge(); } }
          else if (a === 15) { fz.placeObstacleAhead(); }
          else { if (rnd(10) === 0) { fz.reset(rnd(2) === 0); } else { r = fz.step(); } }
          s = fz.state;
          var q = fz.queue;
          var st3 = fz.stack;
          if (!WC.safety.isFree(s.grid, s.row, s.col)) { bad.cell++; }
          var arr = q.toArray();
          var used = {};
          arr.forEach(function (x) { used[x.slot] = true; });
          var qok = q.size() >= 0 && q.size() <= q.capacity && arr.length === q.size() && ((q.front === -1) === (q.rear === -1));
          for (var i = 0; i < q.capacity; i++) { if (!!q.items[i] !== !!used[i]) { qok = false; } }
          if (!qok) { bad.queue++; }
          var sok = st3.top >= -1 && st3.top < st3.capacity;
          for (var j = 0; j < st3.capacity; j++) { if ((j <= st3.top) !== !!st3.items[j]) { sok = false; } }
          if (!sok) { bad.stack++; }
          if (s.mode === 'ESTOP' && !q.isEmpty()) { bad.estopQueue++; }
          if (s.battery < 0 || s.battery > 100 || (s.battery === 0 && s.mode !== 'ESTOP' && s.mode !== 'DEPLETED')) { bad.battery++; }
          if (s.sensorFaulty && s.battery > 0 && s.mode !== 'ESTOP' && s.mode !== 'FAULT') { bad.fault++; }
          if (MODES.indexOf(s.mode) === -1) { bad.mode++; }
          if (r) {
            var dist = Math.abs(s.row - before.row) + Math.abs(s.col - before.col);
            if (r.code === 'MOVED') {
              if (dist !== 1 || Math.abs(st3.top - before.top) !== 1) { bad.history++; }
              if (front.ok && front.item.type === 'BACK' && !(topSnap.ok && topSnap.item.row === s.row && topSnap.item.col === s.col)) { bad.back++; }
            } else if (dist !== 0 || st3.top !== before.top) { bad.history++; }
          }
          // saved positions plus the chair must form a path of single steps
          var path = [];
          for (var k = 0; k <= st3.top; k++) { path.push(st3.items[k]); }
          path.push({ row: s.row, col: s.col });
          for (var m = 1; m < path.length; m++) {
            if (Math.abs(path[m].row - path[m - 1].row) + Math.abs(path[m].col - path[m - 1].col) !== 1) { bad.chain++; break; }
          }
        }
      }
      check('random: the wheelchair never stands on a wall or obstacle', bad.cell === 0);
      check('random: queue size, front, rear and filled slots always agree', bad.queue === 0);
      check('random: stack top and filled slots always agree', bad.stack === 0);
      check('random: the queue is always empty while the emergency stop is on', bad.estopQueue === 0);
      check('random: battery stays 0 to 100 and an empty battery always stops movement', bad.battery === 0);
      check('random: a failed sensor always stops movement (FAULT unless ESTOP or DEPLETED)', bad.fault === 0);
      check('random: a refused request never moves the chair or changes the stack; a move changes both by one', bad.history === 0);
      check('random: BACK always returns to the position that was on top of the stack', bad.back === 0);
      check('random: saved positions and the chair always form an unbroken path', bad.chain === 0);
      check('random: the mode is always one of the six known modes', bad.mode === 0);
    })();

    /* ---------- scenarios ---------- */
    WC.scenarios.forEach(function (sc) {
      function play() { var s = WC.createSimulation(); sc.script.forEach(function (l) { s.exec(l); }); return s; }
      var a = play();
      var b = play();
      check('scenario "' + sc.title + '": two runs give identical traces', a.getTrace() === b.getTrace() && a.getTrace().length > 0);
    });
    var sc = {};
    WC.scenarios.forEach(function (x) { sc[x.id] = x; });
    function playId(id) { var s = WC.createSimulation(); sc[id].script.forEach(function (l) { s.exec(l); }); return s; }
    var s1 = playId('normal');
    check('scenario normal: reaches the goal then goes back one step', hasLog(s1, 'ARRIVED') && s1.state.row === 4 && s1.state.col === 6 && s1.state.mode === 'READY');
    var s2 = playId('obstacle');
    check('scenario obstacle: blocked once, then reaches (2, 4) by going around', hasLog(s2, 'BLOCKED') && s2.state.row === 2 && s2.state.col === 4);
    var s3 = playId('underflow');
    check('scenario underflow: SUNDERFLOW logged twice', s3.log.filter(function (e) { return e.code === 'SUNDERFLOW'; }).length === 2);
    var s4 = playId('overflow');
    check('scenario overflow: QOVERFLOW logged once and the queue ends empty', s4.log.filter(function (e) { return e.code === 'QOVERFLOW'; }).length === 1 && s4.queue.isEmpty());
    var s5 = playId('estop');
    check('scenario estop: one stop, recovery done, back at (1, 1)', s5.state.estopCount === 1 && hasLog(s5, 'RELEASED') && s5.state.col === 1 && s5.state.mode === 'READY');
    var s6 = playId('sensor');
    check('scenario sensor: FAULT, refused move, no reading, restore, then moves', hasLog(s6, 'FAULT') && hasLog(s6, 'NOREADING') && s6.state.col === 2 && s6.state.mode === 'READY');

    } catch (err) {
      // a crash is reported as a failed test, never hidden
      results.push({ name: 'tests stopped early with an error: ' + err.message, pass: false });
    }
    return results;
  };
})();

/* Terminal runner. Only active when this file is started with node; the code above does not need it. */
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  var vm = require('vm');
  var fs = require('fs');
  var path = require('path');
  var root = path.join(__dirname, '..');
  ['js/config.js', 'js/structures.js', 'js/safety.js', 'js/simulation.js', 'js/scenarios.js'].forEach(function (f) {
    vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
  });
  var results = globalThis.WC.runTests();
  var failed = 0;
  results.forEach(function (r) {
    if (!r.pass) { failed++; }
    console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name);
  });
  console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
