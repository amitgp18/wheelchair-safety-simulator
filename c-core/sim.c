/* sim.c
 *
 * Rules of the wheelchair world. Uses the stack and the queue, never prints.
 */

#include "sim.h"

/* The default map. 8 rows of 12 characters.
 *   # wall   O obstacle   . free floor   S start   G goal
 * The goal is 9 moves from the start, so a normal route fits in the
 * 10 positions the history stack can hold. */
static const char *defaultMap[ROWS] = {
    "############",
    "#S.........#",
    "#..O.......#",
    "#.....O....#",
    "#......G...#",
    "#...O......#",
    "#..........#",
    "############"
};

/* ---------- small private helpers ---------- */

/* Turn a direction code into a step: dRow and dCol are each -1, 0 or 1. */
static void dirToDelta(int dir, int *dRow, int *dCol)
{
    *dRow = 0;
    *dCol = 0;
    if (dir == NORTH) {
        *dRow = -1;
    } else if (dir == SOUTH) {
        *dRow = 1;
    } else if (dir == EAST) {
        *dCol = 1;
    } else if (dir == WEST) {
        *dCol = -1;
    }
}

/* After the chair has settled on a cell: ARRIVED on the goal, else READY. */
static void settleMode(Sim *sim)
{
    if (sim->grid[sim->chair.row][sim->chair.col] == 'G') {
        sim->chair.mode = ARRIVED;
    } else {
        sim->chair.mode = READY;
    }
}

/* ---------- public functions ---------- */

/* Build a fresh world: copy the map, find the start, empty the stack and
 * the queue, face East, mode READY. */
void simInit(Sim *sim)
{
    int r;
    int c;

    stackInit(&sim->history);
    cqInit(&sim->requests);
    sim->nextId = 1;
    sim->lastClearance = -1;

    sim->lastEvent.id = 0;
    sim->lastEvent.type = EVSENSE;
    sim->lastEvent.value = 0;
    sim->lastEvent.source = '-';

    sim->chair.row = 1;
    sim->chair.col = 1;
    for (r = 0; r < ROWS; r++) {
        for (c = 0; c < COLS; c++) {
            sim->grid[r][c] = defaultMap[r][c];
            if (defaultMap[r][c] == 'S') {
                sim->chair.row = r;
                sim->chair.col = c;
            }
        }
    }
    sim->chair.heading = EAST;
    sim->chair.mode = READY;
}

/* Boundary check: 1 if (row, col) is inside the grid, otherwise 0.
 * Always call this BEFORE reading grid[row][col]. */
int simInBounds(int row, int col)
{
    return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

/* Obstacle check: 1 if the chair may stand on (row, col).
 * Not free: outside the grid, a wall '#', or an obstacle 'O'. */
int simCellFree(const Sim *sim, int row, int col)
{
    char cell;

    if (!simInBounds(row, col)) {
        return 0;
    }
    cell = sim->grid[row][col];
    if (cell == '#' || cell == 'O') {
        return 0;
    }
    return 1;
}

/* Put a new request in the queue.
 * Returns DSOK, DSOVERFLOW (queue full) or SIMESTOPPED (emergency stop on).
 * The id is only used up when the event is really stored. */
int simAddEvent(Sim *sim, EventType type, int value, char source)
{
    Event e;

    if (sim->chair.mode == ESTOP) {
        return SIMESTOPPED;
    }
    e.id = sim->nextId;
    e.type = type;
    e.value = value;
    e.source = source;
    if (cqEnqueue(&sim->requests, e) == DSOVERFLOW) {
        return DSOVERFLOW;
    }
    sim->nextId = sim->nextId + 1;
    return DSOK;
}

/* Handle a MOVE request. Order of the rules:
 *   1. remember where we are now (the "before" snapshot)
 *   2. turn to face the requested direction
 *   3. next cell not free?  -> BLOCKED, do not move, nothing pushed
 *   4. history stack full?  -> stack overflow, do not move
 *   5. push the snapshot, move one cell, settle the mode */
static StepResult doMove(Sim *sim, int dir)
{
    Snapshot before;
    int dRow;
    int dCol;
    int newRow;
    int newCol;

    before.row = sim->chair.row;
    before.col = sim->chair.col;
    before.heading = sim->chair.heading;

    sim->chair.heading = dir;
    dirToDelta(dir, &dRow, &dCol);
    newRow = before.row + dRow;
    newCol = before.col + dCol;

    if (!simCellFree(sim, newRow, newCol)) {
        sim->chair.mode = BLOCKED;
        return STEPBLOCKED;
    }
    if (stackPush(&sim->history, before) == DSOVERFLOW) {
        return STEPFULL;
    }
    sim->chair.row = newRow;
    sim->chair.col = newCol;
    settleMode(sim);
    if (sim->chair.mode == ARRIVED) {
        return STEPARRIVED;
    }
    return STEPMOVED;
}

/* Handle a BACK request: pop the last saved position and return to it.
 * Empty stack -> stack underflow, nothing moves.
 * If an obstacle was placed on that cell since, push the snapshot back
 * (so nothing is lost) and refuse. */
static StepResult doBack(Sim *sim)
{
    Snapshot previous;

    if (stackPop(&sim->history, &previous) == DSUNDERFLOW) {
        return STEPNOHISTORY;
    }
    if (!simCellFree(sim, previous.row, previous.col)) {
        stackPush(&sim->history, previous);
        sim->chair.mode = BLOCKED;
        return STEPBLOCKED;
    }
    sim->chair.row = previous.row;
    sim->chair.col = previous.col;
    sim->chair.heading = previous.heading;
    settleMode(sim);
    return STEPBACKED;
}

/* Process ONE request: dequeue the oldest and carry it out.
 * Emergency stop is checked first, so nothing is even dequeued while it is on. */
StepResult simStep(Sim *sim)
{
    Event e;

    if (sim->chair.mode == ESTOP) {
        return STEPESTOP;
    }
    if (cqDequeue(&sim->requests, &e) == DSUNDERFLOW) {
        return STEPEMPTY;
    }
    sim->lastEvent = e;

    if (e.type == EVMOVE) {
        return doMove(sim, e.value);
    }
    if (e.type == EVBACK) {
        return doBack(sim);
    }
    sim->lastClearance = simClearanceAhead(sim);
    return STEPSENSED;
}

/* Emergency stop. It does NOT wait in the queue: it takes effect at once.
 * Latch ESTOP and throw away every pending request (by dequeuing them).
 * The history stack is kept, so you can still go back after release.
 * Returns how many pending requests were thrown away. */
int simEmergencyStop(Sim *sim)
{
    Event dropped;
    int flushed = 0;

    sim->chair.mode = ESTOP;
    while (cqDequeue(&sim->requests, &dropped) == DSOK) {
        flushed = flushed + 1;
    }
    return flushed;
}

/* Leave emergency stop (the menu asks the user to confirm first). */
void simRelease(Sim *sim)
{
    if (sim->chair.mode == ESTOP) {
        settleMode(sim);
    }
}

/* Simulated distance sensor: how many centimetres of free floor are
 * straight ahead, counting at most SENSORMAXCELLS cells. */
int simClearanceAhead(const Sim *sim)
{
    int dRow;
    int dCol;
    int row;
    int col;
    int cells = 0;

    dirToDelta(sim->chair.heading, &dRow, &dCol);
    row = sim->chair.row + dRow;
    col = sim->chair.col + dCol;
    while (cells < SENSORMAXCELLS && simCellFree(sim, row, col)) {
        cells = cells + 1;
        row = row + dRow;
        col = col + dCol;
    }
    return cells * CELLCM;
}

/* Place an obstacle on a free floor cell, or remove one.
 * Returns 1 if the cell changed. Walls, the start, the goal, the cell
 * under the chair and anything outside the grid are left alone. */
int simToggleObstacle(Sim *sim, int row, int col)
{
    if (!simInBounds(row, col)) {
        return 0;
    }
    if (row == sim->chair.row && col == sim->chair.col) {
        return 0;
    }
    if (sim->grid[row][col] == '.') {
        sim->grid[row][col] = 'O';
        return 1;
    }
    if (sim->grid[row][col] == 'O') {
        sim->grid[row][col] = '.';
        return 1;
    }
    return 0;
}
