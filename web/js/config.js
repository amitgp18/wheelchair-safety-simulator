/* config.js
   Every number the simulation uses lives here, so the C programs and the
   browser version can be compared line by line.
   Rows and columns are counted from 0 at the top-left corner. One cell = 50 cm. */
(function () {
  'use strict';
  var WC = (globalThis.WC = globalThis.WC || {});

  WC.config = {
    ROWS: 8,
    COLS: 12,
    QCAP: 8,            // queue size, same as QSIZE in the C program
    STACKCAP: 10,       // stack size, same as STACKSIZE in the C program
    CELLCM: 50,         // one grid cell is 50 cm
    SENSORMAXCELLS: 6,  // the simulated sensor looks 6 cells ahead = 300 cm
    BATTERYSTART: 100,
    MOVECOST: 2,        // each successful move or backtrack costs 2 percent
    LOWBATTERY: 20,     // warning below this value
    AUTORUNMS: 600,     // delay between automatic steps (web only)
    START: { row: 1, col: 1, heading: 'E' },
    // # wall   O obstacle   . floor   S start   G goal   (same map as the C program)
    DEFAULTMAP: [
      '############',
      '#S.........#',
      '#..O.......#',
      '#.....O....#',
      '#......G...#',
      '#...O......#',
      '#..........#',
      '############'
    ],
    DELTA: { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] },
    DIRNAME: { N: 'north', E: 'east', S: 'south', W: 'west' }
  };
})();
