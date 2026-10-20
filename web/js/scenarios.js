/* scenarios.js
   Six one-click scenarios. Each is plain text, one command per line, using the same
   words as the plan: MOVE, BACK, SENSE, FAULT, RESTORE (add a request),
   STEP, DRAIN (process requests), ESTOP, RELEASE, RESET, PEEKQ, PEEKS.
   Every scenario starts with MAP, which loads the default map, so it can be repeated. */
(function () {
  'use strict';
  var WC = (globalThis.WC = globalThis.WC || {});

  WC.scenarios = [
    {
      id: 'normal',
      title: 'Normal movement',
      summary: 'Three moves south, six east to the destination, then one step back.',
      watch: 'Each request enters the queue, leaves it, and pushes the old position on the stack. Mode ends as ARRIVED, then READY after BACK.',
      script: [
        'MAP',
        'MOVE S', 'MOVE S', 'MOVE S', 'DRAIN',
        'MOVE E', 'MOVE E', 'MOVE E', 'MOVE E', 'MOVE E', 'DRAIN',
        'MOVE E', 'DRAIN',
        'BACK', 'DRAIN'
      ]
    },
    {
      id: 'obstacle',
      title: 'Obstacle detection',
      summary: 'Drive east, try to go south into an obstacle, read the sensor, then go around it.',
      watch: 'The blocked move changes mode to BLOCKED, saves nothing on the stack, and the sensor reads 0 cm.',
      script: [
        'MAP',
        'MOVE E', 'MOVE E', 'DRAIN',
        'MOVE S', 'DRAIN',
        'SENSE', 'DRAIN',
        'MOVE E', 'DRAIN',
        'MOVE S', 'DRAIN'
      ]
    },
    {
      id: 'underflow',
      title: 'Stack underflow',
      summary: 'Ask for BACK with nothing saved, move once, go back, and ask again.',
      watch: 'Popping an empty stack logs SUNDERFLOW and changes nothing. The top stays at -1.',
      script: [
        'MAP',
        'BACK', 'DRAIN',
        'MOVE E', 'DRAIN',
        'BACK', 'DRAIN',
        'BACK', 'DRAIN',
        'PEEKS'
      ]
    },
    {
      id: 'overflow',
      title: 'Queue overflow',
      summary: 'Add nine requests without processing any, then process three and add two more.',
      watch: 'The ninth request is refused with QOVERFLOW. After three removals, new requests wrap around to slots 0 and 1.',
      script: [
        'MAP',
        'MOVE E', 'MOVE E', 'MOVE E', 'MOVE E', 'MOVE E', 'MOVE E', 'MOVE E', 'MOVE E',
        'MOVE E',
        'PEEKQ',
        'STEP', 'STEP', 'STEP',
        'MOVE W', 'MOVE W',
        'DRAIN'
      ]
    },
    {
      id: 'estop',
      title: 'Emergency stop',
      summary: 'Queue three moves, process one, press the emergency stop, then recover and go back.',
      watch: 'The stop acts at once. The two waiting requests are removed, new requests and steps are refused, and the stack is kept. Recovery revalidates before BACK works.',
      script: [
        'MAP',
        'MOVE E', 'MOVE E', 'MOVE E', 'STEP',
        'ESTOP',
        'MOVE E', 'STEP',
        'RELEASE',
        'BACK', 'DRAIN'
      ]
    },
    {
      id: 'sensor',
      title: 'Sensor failure',
      summary: 'Read the sensor, inject a failure, try to move, restore the sensor, and move again.',
      watch: 'While the sensor is failed, mode is FAULT and moves are refused. The reading shows no reading instead of a number.',
      script: [
        'MAP',
        'SENSE', 'DRAIN',
        'FAULT', 'DRAIN',
        'MOVE E', 'DRAIN',
        'SENSE', 'DRAIN',
        'RESTORE', 'DRAIN',
        'MOVE E', 'DRAIN'
      ]
    }
  ];
})();
