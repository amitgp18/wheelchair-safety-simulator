/* safety.js
   Sensor and safety rules. All of this is SIMULATED: the "sensor" just counts free
   cells on the grid. Nothing is connected to hardware. No page code here.

   Rules are checked in this order when the wheelchair wants to move:
     1. ESTOP      emergency stop engaged
     2. DEPLETED   battery is 0
     3. FAULT      sensor failed, so the chair stops (fail safe)
     4. the next cell must be free (checked by the caller) */
(function () {
  'use strict';
  var WC = (globalThis.WC = globalThis.WC || {});
  var C = WC.config;

  // Can the wheelchair stand on (r, c)? Range check first, then wall or obstacle.
  function isFree(grid, r, c) {
    if (r < 0 || r >= C.ROWS || c < 0 || c >= C.COLS) { return false; }
    return grid[r][c] !== '#' && grid[r][c] !== 'O';
  }

  function describeCell(grid, r, c) {
    if (r < 0 || r >= C.ROWS || c < 0 || c >= C.COLS) { return 'edge of the room'; }
    if (grid[r][c] === '#') { return 'wall'; }
    if (grid[r][c] === 'O') { return 'obstacle'; }
    return 'free cell';
  }

  // Simulated distance sensor: free cells ahead (at most 6) times 50 cm.
  function clearanceFrom(grid, row, col, dir) {
    var d = C.DELTA[dir];
    var r = row + d[0];
    var c = col + d[1];
    var cells = 0;
    while (cells < C.SENSORMAXCELLS && isFree(grid, r, c)) {
      cells++;
      r += d[0];
      c += d[1];
    }
    return cells * C.CELLCM;
  }

  // null means "no reading" because the sensor has failed.
  function clearance(state, dir) {
    if (state.sensorFaulty) { return null; }
    return clearanceFrom(state.grid, state.row, state.col, dir || state.heading);
  }

  function checkMoveAllowed(state) {
    if (state.mode === 'ESTOP') {
      return { ok: false, code: 'ESTOP', message: 'Refused: emergency stop is engaged.' };
    }
    if (state.battery <= 0) {
      return { ok: false, code: 'DEPLETED', message: 'Refused: battery is empty (simulated).' };
    }
    if (state.sensorFaulty) {
      return { ok: false, code: 'FAULT', message: 'Refused: sensor failure, fail-safe stop (simulated).' };
    }
    return { ok: true };
  }

  // Which mode fits the current situation? ESTOP is never left by this function.
  function settleMode(state) {
    if (state.mode === 'ESTOP') { return 'ESTOP'; }
    if (state.battery <= 0) { return 'DEPLETED'; }
    if (state.sensorFaulty) { return 'FAULT'; }
    if (state.grid[state.row][state.col] === 'G') { return 'ARRIVED'; }
    return 'READY';
  }

  // Revalidation before the wheelchair may resume after an emergency stop.
  function recoveryChecks(state, queue) {
    return [
      { id: 'queue', label: 'No old movement requests are waiting',
        ok: queue.isEmpty(), detail: queue.isEmpty() ? 'Queue is empty' : queue.size() + ' request(s) still queued' },
      { id: 'sensor', label: 'Distance sensor is responding',
        ok: !state.sensorFaulty, detail: state.sensorFaulty ? 'Sensor failure is active' : 'Sensor responds (simulated)' },
      { id: 'battery', label: 'Battery is above 0%',
        ok: state.battery > 0, detail: 'Battery ' + state.battery + '%' },
      { id: 'cell', label: 'Wheelchair cell is clear',
        ok: isFree(state.grid, state.row, state.col),
        detail: 'Cell (' + state.row + ', ' + state.col + ') is ' + describeCell(state.grid, state.row, state.col) }
    ];
  }

  WC.safety = {
    isFree: isFree,
    describeCell: describeCell,
    clearanceFrom: clearanceFrom,
    clearance: clearance,
    checkMoveAllowed: checkMoveAllowed,
    settleMode: settleMode,
    recoveryChecks: recoveryChecks
  };
})();
