/* tests.c
 *
 * Automated tests for the stack, the circular queue and the simulation
 * rules. It does not use display.c, so it proves the data structures work
 * without any screen code.
 *
 * Exit code: 0 if every test passed, 1 if any failed.
 */

#include <stdio.h>
#include "stack.h"
#include "cqueue.h"
#include "sim.h"

static int passed = 0;
static int failed = 0;

static void check(const char *what, int condition)
{
    if (condition) {
        printf("  PASS  %s\n", what);
        passed = passed + 1;
    } else {
        printf("  FAIL  %s\n", what);
        failed = failed + 1;
    }
}

static void section(const char *title)
{
    printf("\n%s\n", title);
}

static Snapshot makeSnap(int row, int col, int heading)
{
    Snapshot s;
    s.row = row;
    s.col = col;
    s.heading = heading;
    return s;
}

static Event makeEvent(int id, EventType type, int value)
{
    Event e;
    e.id = id;
    e.type = type;
    e.value = value;
    e.source = 'T';
    return e;
}

/* Add one request to the simulation and process it straight away. */
static StepResult request(Sim *sim, EventType type, int value)
{
    simAddEvent(sim, type, value, 'T');
    return simStep(sim);
}

/* ======================= STACK TESTS ======================= */

static void testStackEmpty(void)
{
    Stack s;
    Snapshot out;

    section("Stack: empty stack");
    stackInit(&s);
    check("top starts at -1", s.top == -1);
    check("isEmpty is true", stackIsEmpty(&s) == 1);
    check("isFull is false", stackIsFull(&s) == 0);
    check("pop on empty returns DSUNDERFLOW", stackPop(&s, &out) == DSUNDERFLOW);
    check("peek on empty returns DSUNDERFLOW", stackPeek(&s, &out) == DSUNDERFLOW);
    check("top is still -1 after the failed pop", s.top == -1);
}

static void testStackOneElement(void)
{
    Stack s;
    Snapshot out;

    section("Stack: one element");
    stackInit(&s);
    check("push returns DSOK", stackPush(&s, makeSnap(3, 4, EAST)) == DSOK);
    check("top is 0", s.top == 0);
    check("isEmpty is false", stackIsEmpty(&s) == 0);
    check("isFull is false", stackIsFull(&s) == 0);
    check("peek returns DSOK", stackPeek(&s, &out) == DSOK);
    check("peek shows the pushed values", out.row == 3 && out.col == 4 && out.heading == EAST);
    check("peek did not change top", s.top == 0);
    check("pop returns DSOK", stackPop(&s, &out) == DSOK);
    check("pop returns the same values", out.row == 3 && out.col == 4 && out.heading == EAST);
    check("top is back to -1", s.top == -1);
    check("stack is empty again", stackIsEmpty(&s) == 1);
}

static void testStackOverflow(void)
{
    Stack s;
    Snapshot out;
    int i;
    int allOk = 1;

    section("Stack: overflow");
    stackInit(&s);
    for (i = 0; i < STACKCAP; i++) {
        if (stackPush(&s, makeSnap(i, i, NORTH)) != DSOK) {
            allOk = 0;
        }
    }
    check("10 pushes all return DSOK", allOk == 1);
    check("top is 9", s.top == STACKCAP - 1);
    check("isFull is true", stackIsFull(&s) == 1);
    check("the 11th push returns DSOVERFLOW", stackPush(&s, makeSnap(99, 99, SOUTH)) == DSOVERFLOW);
    check("top is still 9 after overflow", s.top == STACKCAP - 1);
    stackPeek(&s, &out);
    check("the top item was not overwritten", out.row == STACKCAP - 1 && out.col == STACKCAP - 1);
}

static void testStackUnderflow(void)
{
    Stack s;
    Snapshot out;

    section("Stack: underflow");
    stackInit(&s);
    stackPush(&s, makeSnap(1, 1, EAST));
    stackPush(&s, makeSnap(1, 2, EAST));
    check("first pop returns DSOK", stackPop(&s, &out) == DSOK);
    check("second pop returns DSOK", stackPop(&s, &out) == DSOK);
    out = makeSnap(-99, -99, -99);
    check("third pop returns DSUNDERFLOW", stackPop(&s, &out) == DSUNDERFLOW);
    check("failed pop did not write to out", out.row == -99);
    check("top is still -1", s.top == -1);
}

static void testStackOrderAndRepeat(void)
{
    Stack s;
    Snapshot out;
    int i;
    int cycle;
    int orderOk = 1;
    int repeatOk = 1;

    section("Stack: LIFO order and repeated push and pop");
    stackInit(&s);
    for (i = 0; i < 5; i++) {
        stackPush(&s, makeSnap(i, 0, NORTH));
    }
    for (i = 4; i >= 0; i--) {
        stackPop(&s, &out);
        if (out.row != i) {
            orderOk = 0;
        }
    }
    check("5 pushes come back in reverse order (last in, first out)", orderOk == 1);

    for (cycle = 0; cycle < 100; cycle++) {
        stackPush(&s, makeSnap(cycle, cycle, WEST));
        stackPop(&s, &out);
        if (out.row != cycle || s.top != -1) {
            repeatOk = 0;
        }
    }
    check("100 rounds of push then pop keep top at -1 and values correct", repeatOk == 1);
}

/* ======================= QUEUE TESTS ======================= */

static void testQueueEmpty(void)
{
    CQueue q;
    Event out;

    section("Queue: empty queue");
    cqInit(&q);
    check("front is 0, rear is -1, count is 0", q.front == 0 && q.rear == -1 && q.count == 0);
    check("isEmpty is true", cqIsEmpty(&q) == 1);
    check("isFull is false", cqIsFull(&q) == 0);
    check("dequeue on empty returns DSUNDERFLOW", cqDequeue(&q, &out) == DSUNDERFLOW);
    check("peek on empty returns DSUNDERFLOW", cqPeek(&q, &out) == DSUNDERFLOW);
    check("indices unchanged by the failed calls", q.front == 0 && q.rear == -1 && q.count == 0);
}

static void testQueueOneElement(void)
{
    CQueue q;
    Event out;

    section("Queue: one element");
    cqInit(&q);
    check("enqueue returns DSOK", cqEnqueue(&q, makeEvent(1, EVMOVE, EAST)) == DSOK);
    check("front 0, rear 0, count 1", q.front == 0 && q.rear == 0 && q.count == 1);
    check("peek returns the event", cqPeek(&q, &out) == DSOK && out.id == 1);
    check("peek changed nothing", q.front == 0 && q.rear == 0 && q.count == 1);
    check("dequeue returns the same event", cqDequeue(&q, &out) == DSOK && out.id == 1 && out.type == EVMOVE && out.value == EAST);
    check("queue is empty again", cqIsEmpty(&q) == 1);
}

static void testQueueOverflowUnderflow(void)
{
    CQueue q;
    Event out;
    int i;
    int allOk = 1;

    section("Queue: overflow and underflow");
    cqInit(&q);
    for (i = 1; i <= QCAP; i++) {
        if (cqEnqueue(&q, makeEvent(i, EVSENSE, 0)) != DSOK) {
            allOk = 0;
        }
    }
    check("8 enqueues all return DSOK", allOk == 1);
    check("isFull is true", cqIsFull(&q) == 1);
    check("front 0, rear 7, count 8", q.front == 0 && q.rear == 7 && q.count == 8);
    check("the 9th enqueue returns DSOVERFLOW", cqEnqueue(&q, makeEvent(9, EVSENSE, 0)) == DSOVERFLOW);
    check("indices unchanged after overflow", q.front == 0 && q.rear == 7 && q.count == 8);

    for (i = 0; i < QCAP; i++) {
        cqDequeue(&q, &out);
    }
    out = makeEvent(-99, EVSENSE, 0);
    check("dequeue on the emptied queue returns DSUNDERFLOW", cqDequeue(&q, &out) == DSUNDERFLOW);
    check("failed dequeue did not write to out", out.id == -99);
}

/* The worked example from the architecture plan, step by step. */
static void testQueueWraparound(void)
{
    CQueue q;
    Event out;
    int i;
    int orderOk = 1;

    section("Queue: wraparound (worked example)");
    cqInit(&q);
    for (i = 1; i <= 8; i++) {
        cqEnqueue(&q, makeEvent(i, EVSENSE, 0));
    }
    check("after 8 enqueues: front 0, rear 7, count 8", q.front == 0 && q.rear == 7 && q.count == 8);

    for (i = 1; i <= 3; i++) {
        cqDequeue(&q, &out);
        if (out.id != i) {
            orderOk = 0;
        }
    }
    check("3 dequeues return ids 1, 2, 3 (first in, first out)", orderOk == 1);
    check("after 3 dequeues: front 3, rear 7, count 5", q.front == 3 && q.rear == 7 && q.count == 5);

    cqEnqueue(&q, makeEvent(9, EVSENSE, 0));
    check("enqueue id 9: rear WRAPS from 7 to 0", q.rear == 0 && q.count == 6 && q.front == 3);
    cqEnqueue(&q, makeEvent(10, EVSENSE, 0));
    check("enqueue id 10: rear is 1, count 7", q.rear == 1 && q.count == 7 && q.front == 3);

    orderOk = 1;
    for (i = 4; i <= 10; i++) {
        cqDequeue(&q, &out);
        if (out.id != i) {
            orderOk = 0;
        }
    }
    check("7 dequeues return ids 4 to 10 in order, across the wrap", orderOk == 1);
    check("after 7 more dequeues: front WRAPPED to 2, rear 1, count 0", q.front == 2 && q.rear == 1 && q.count == 0);
    check("queue is empty", cqIsEmpty(&q) == 1);
    check("one more dequeue returns DSUNDERFLOW", cqDequeue(&q, &out) == DSUNDERFLOW);
}

static void testQueueFinalElement(void)
{
    CQueue q;
    Event out;

    section("Queue: removing the final element");
    cqInit(&q);
    cqEnqueue(&q, makeEvent(1, EVBACK, 0));
    cqDequeue(&q, &out);
    check("queue is empty after removing the only element", cqIsEmpty(&q) == 1);
    check("count is 0, front moved to 1, rear stays 0", q.count == 0 && q.front == 1 && q.rear == 0);
    cqEnqueue(&q, makeEvent(2, EVBACK, 0));
    check("next enqueue goes to slot 1 (front and rear agree again)", q.front == 1 && q.rear == 1 && q.count == 1);
    check("and it can be read back", cqPeek(&q, &out) == DSOK && out.id == 2);
}

static void testQueueRepeated(void)
{
    CQueue q;
    Event out;
    int i;
    int round;
    int singleOk = 1;
    int bulkOk = 1;

    section("Queue: repeated insertion and removal");
    cqInit(&q);
    for (i = 1; i <= 100; i++) {
        cqEnqueue(&q, makeEvent(i, EVSENSE, 0));
        cqDequeue(&q, &out);
        if (out.id != i || q.count != 0 || q.front < 0 || q.front >= QCAP || q.rear < 0 || q.rear >= QCAP) {
            singleOk = 0;
        }
    }
    check("100 rounds of enqueue then dequeue: ids correct, indices always 0 to 7", singleOk == 1);
    check("after 100 rounds: front 4, rear 3, count 0", q.front == 4 && q.rear == 3 && q.count == 0);

    for (round = 0; round < 5; round++) {
        for (i = 1; i <= 5; i++) {
            cqEnqueue(&q, makeEvent(i, EVMOVE, NORTH));
        }
        for (i = 1; i <= 5; i++) {
            cqDequeue(&q, &out);
            if (out.id != i) {
                bulkOk = 0;
            }
        }
    }
    check("5 rounds of filling 5 and emptying 5 keep first-in-first-out order", bulkOk == 1);
    check("queue is empty at the end", cqIsEmpty(&q) == 1);
}

/* ======================= SIMULATION TESTS ======================= */

static void testSimQueue(void)
{
    Sim sim;
    int i;
    int allOk = 1;

    section("Simulation: request queue limits and event ids");
    simInit(&sim);
    check("start: chair at (1,1) facing East, mode READY",
          sim.chair.row == 1 && sim.chair.col == 1 && sim.chair.heading == EAST && sim.chair.mode == READY);
    check("processing an empty queue returns STEPEMPTY (queue underflow)", simStep(&sim) == STEPEMPTY);

    for (i = 0; i < QCAP; i++) {
        if (simAddEvent(&sim, EVMOVE, EAST, 'T') != DSOK) {
            allOk = 0;
        }
    }
    check("8 requests are accepted", allOk == 1);
    check("the 9th request returns DSOVERFLOW", simAddEvent(&sim, EVMOVE, EAST, 'T') == DSOVERFLOW);
    check("a rejected request does not use up an id (next id is 9)", sim.nextId == 9);
    simStep(&sim);
    check("the first processed event has id 1", sim.lastEvent.id == 1);
    simStep(&sim);
    check("the second processed event has id 2", sim.lastEvent.id == 2);
}

static void testBoundary(void)
{
    Sim sim;

    section("Simulation: boundary checking");
    simInit(&sim);
    check("(0,0) and (7,11) are inside the grid", simInBounds(0, 0) == 1 && simInBounds(7, 11) == 1);
    check("(-1,0), (8,0), (0,-1), (0,12) are outside", simInBounds(-1, 0) == 0 && simInBounds(8, 0) == 0 && simInBounds(0, -1) == 0 && simInBounds(0, 12) == 0);
    check("an outside cell is never free", simCellFree(&sim, -1, 5) == 0 && simCellFree(&sim, 3, 12) == 0);
    check("a wall cell is not free", simCellFree(&sim, 0, 0) == 0);
    check("the start cell is free", simCellFree(&sim, 1, 1) == 1);

    check("moving North from (1,1) into the wall is blocked", request(&sim, EVMOVE, NORTH) == STEPBLOCKED);
    sim.grid[0][1] = '.';
    check("with a gap in the wall the chair can reach row 0", request(&sim, EVMOVE, NORTH) == STEPMOVED && sim.chair.row == 0);
    check("moving North again would leave the map: blocked, no crash", request(&sim, EVMOVE, NORTH) == STEPBLOCKED && sim.chair.row == 0);
}

static void testObstacleBlocked(void)
{
    Sim sim;
    StepResult r1;
    StepResult r2;
    StepResult r3;
    StepResult r4;

    section("Simulation: movement blocked by an obstacle");
    simInit(&sim);
    r1 = request(&sim, EVMOVE, EAST);
    r2 = request(&sim, EVMOVE, EAST);
    check("two moves East succeed", r1 == STEPMOVED && r2 == STEPMOVED);
    check("chair is at (1,3) and the stack holds 2 snapshots", sim.chair.row == 1 && sim.chair.col == 3 && sim.history.top == 1);

    r3 = request(&sim, EVMOVE, SOUTH);
    check("moving South into the obstacle at (2,3) returns STEPBLOCKED", r3 == STEPBLOCKED);
    check("the chair did not move", sim.chair.row == 1 && sim.chair.col == 3);
    check("mode is BLOCKED", sim.chair.mode == BLOCKED);
    check("nothing was pushed (top is still 1)", sim.history.top == 1);

    r4 = request(&sim, EVMOVE, EAST);
    check("a free move afterwards works and mode returns to READY", r4 == STEPMOVED && sim.chair.mode == READY && sim.chair.col == 4);
}

static void testBacktrack(void)
{
    Sim sim;

    section("Simulation: backtracking with the stack");
    simInit(&sim);
    request(&sim, EVMOVE, SOUTH);
    check("moved South to (2,1), facing South", sim.chair.row == 2 && sim.chair.col == 1 && sim.chair.heading == SOUTH);
    check("BACK returns to (1,1)", request(&sim, EVBACK, 0) == STEPBACKED && sim.chair.row == 1 && sim.chair.col == 1);
    check("BACK restored the old heading (East)", sim.chair.heading == EAST);
    check("the stack is empty again", stackIsEmpty(&sim.history) == 1);

    request(&sim, EVMOVE, EAST);
    request(&sim, EVMOVE, EAST);
    request(&sim, EVBACK, 0);
    check("two moves then one BACK leaves the chair at (1,2)", sim.chair.col == 2 && sim.history.top == 0);
}

static void testBackUnderflow(void)
{
    Sim sim;

    section("Simulation: BACK with an empty stack (stack underflow)");
    simInit(&sim);
    check("BACK returns STEPNOHISTORY", request(&sim, EVBACK, 0) == STEPNOHISTORY);
    check("the chair did not move", sim.chair.row == 1 && sim.chair.col == 1);
    check("top is still -1", sim.history.top == -1);
}

static void testHistoryFull(void)
{
    Sim sim;
    int i;
    int dir;
    int allMoved = 1;

    section("Simulation: history stack full (stack overflow during a move)");
    simInit(&sim);
    for (i = 0; i < STACKCAP; i++) {
        dir = (i % 2 == 0) ? EAST : WEST;
        if (request(&sim, EVMOVE, dir) != STEPMOVED) {
            allMoved = 0;
        }
    }
    check("10 moves back and forth all succeed", allMoved == 1);
    check("the stack is full (top 9)", sim.history.top == STACKCAP - 1);
    check("the 11th move is refused with STEPFULL", request(&sim, EVMOVE, EAST) == STEPFULL);
    check("the chair did not move and top is still 9", sim.chair.col == 1 && sim.history.top == STACKCAP - 1);
    check("BACK frees one slot", request(&sim, EVBACK, 0) == STEPBACKED && sim.history.top == STACKCAP - 2);
    check("now a move works again", request(&sim, EVMOVE, EAST) == STEPMOVED && sim.history.top == STACKCAP - 1);
}

static void testArrival(void)
{
    Sim sim;
    int i;
    StepResult last = STEPEMPTY;
    int allMoved = 1;

    section("Simulation: reaching the goal");
    simInit(&sim);
    for (i = 0; i < 3; i++) {
        if (request(&sim, EVMOVE, SOUTH) != STEPMOVED) {
            allMoved = 0;
        }
    }
    for (i = 0; i < 6; i++) {
        last = request(&sim, EVMOVE, EAST);
        if (i < 5 && last != STEPMOVED) {
            allMoved = 0;
        }
    }
    check("the first 8 moves are ordinary moves", allMoved == 1);
    check("the 9th move returns STEPARRIVED", last == STEPARRIVED);
    check("chair is on the goal (4,7) and mode is ARRIVED", sim.chair.row == 4 && sim.chair.col == 7 && sim.chair.mode == ARRIVED);
    check("the stack holds 9 snapshots", sim.history.top == 8);
}

static void testSensor(void)
{
    Sim sim;

    section("Simulation: distance sensor");
    simInit(&sim);
    check("East from the start: 9 free cells but the sensor stops at 300 cm", simClearanceAhead(&sim) == 300);
    sim.chair.heading = SOUTH;
    check("South from the start: 5 free cells = 250 cm", simClearanceAhead(&sim) == 250);
    sim.chair.heading = EAST;
    check("placing an obstacle at (1,4) works", simToggleObstacle(&sim, 1, 4) == 1);
    check("East now sees 2 free cells = 100 cm", simClearanceAhead(&sim) == 100);
    check("a SENSE request stores the reading", request(&sim, EVSENSE, 0) == STEPSENSED && sim.lastClearance == 100);
    check("removing the obstacle works", simToggleObstacle(&sim, 1, 4) == 1 && simClearanceAhead(&sim) == 300);
    check("a wall cannot be toggled", simToggleObstacle(&sim, 0, 0) == 0);
    check("the cell under the chair cannot be toggled", simToggleObstacle(&sim, 1, 1) == 0);
}

static void testEmergencyStop(void)
{
    Sim sim;
    int flushed;

    section("Simulation: emergency stop");
    simInit(&sim);
    simAddEvent(&sim, EVMOVE, EAST, 'T');
    simAddEvent(&sim, EVMOVE, EAST, 'T');
    simAddEvent(&sim, EVMOVE, EAST, 'T');
    simStep(&sim);
    check("one move done, two requests still waiting", sim.chair.col == 2 && sim.requests.count == 2 && sim.history.top == 0);

    flushed = simEmergencyStop(&sim);
    check("emergency stop reports 2 requests thrown away", flushed == 2);
    check("mode is ESTOP", sim.chair.mode == ESTOP);
    check("the queue is empty", cqIsEmpty(&sim.requests) == 1);
    check("the stack was kept (top still 0)", sim.history.top == 0);

    check("processing is refused with STEPESTOP", simStep(&sim) == STEPESTOP);
    check("new requests are refused with SIMESTOPPED", simAddEvent(&sim, EVMOVE, EAST, 'T') == SIMESTOPPED);
    check("the refused request was not stored", sim.requests.count == 0);
    check("the chair did not move", sim.chair.col == 2);

    simRelease(&sim);
    check("after release the mode is READY", sim.chair.mode == READY);
    check("BACK still works with the kept stack", request(&sim, EVBACK, 0) == STEPBACKED && sim.chair.col == 1);
    check("normal moves work again", request(&sim, EVMOVE, EAST) == STEPMOVED);
}

int main(void)
{
    printf("Wheelchair C core: automated tests\n");

    testStackEmpty();
    testStackOneElement();
    testStackOverflow();
    testStackUnderflow();
    testStackOrderAndRepeat();

    testQueueEmpty();
    testQueueOneElement();
    testQueueOverflowUnderflow();
    testQueueWraparound();
    testQueueFinalElement();
    testQueueRepeated();

    testSimQueue();
    testBoundary();
    testObstacleBlocked();
    testBacktrack();
    testBackUnderflow();
    testHistoryFull();
    testArrival();
    testSensor();
    testEmergencyStop();

    printf("\nResult: %d passed, %d failed\n", passed, failed);
    if (failed == 0) {
        printf("ALL TESTS PASSED\n");
        return 0;
    }
    printf("SOME TESTS FAILED\n");
    return 1;
}
