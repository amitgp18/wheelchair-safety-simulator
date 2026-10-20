/* sim.h
 *
 * The wheelchair world: a grid, the chair, the history stack and the
 * request queue. This file uses the stack and the queue but never prints.
 *
 * This is a SOFTWARE SIMULATION. It is not connected to any real wheelchair.
 */

#ifndef SIMH
#define SIMH

#include "stack.h"
#include "cqueue.h"

#define ROWS 8
#define COLS 12
#define CELLCM 50          /* one grid cell is 50 cm                      */
#define SENSORMAXCELLS 6   /* the simulated sensor sees 6 cells = 300 cm  */
#define SIMESTOPPED 10     /* simAddEvent returns this while ESTOP is on  */

/* Direction codes. They are also stored in Snapshot.heading and
 * in Event.value for a move request. */
enum { NORTH = 0, EAST = 1, SOUTH = 2, WEST = 3 };

/* Safety mode of the chair. */
typedef enum {
    READY,     /* normal                                        */
    BLOCKED,   /* the last move was refused: wall or obstacle   */
    ARRIVED,   /* standing on the goal cell                     */
    ESTOP      /* emergency stop is latched                     */
} Mode;

typedef struct {
    int row;       /* 0 is the top row                */
    int col;       /* 0 is the left column            */
    int heading;   /* direction code 0 to 3           */
    Mode mode;
} Wheelchair;

/* What happened when one request was processed. */
typedef enum {
    STEPMOVED,      /* moved one cell, snapshot pushed                      */
    STEPARRIVED,    /* moved onto the goal                                  */
    STEPBLOCKED,    /* wall, obstacle or map edge ahead: did not move       */
    STEPFULL,       /* history stack full (stack overflow): did not move    */
    STEPBACKED,     /* went back one saved position                         */
    STEPNOHISTORY,  /* BACK with an empty stack (stack underflow)           */
    STEPSENSED,     /* distance reading taken, see lastClearance            */
    STEPEMPTY,      /* the queue was empty (queue underflow)                */
    STEPESTOP       /* emergency stop is on: nothing was processed          */
} StepResult;

typedef struct {
    char grid[ROWS][COLS];   /* '#' wall, 'O' obstacle, '.' floor, 'S' start, 'G' goal */
    Wheelchair chair;
    Stack history;           /* positions to go back to (LIFO)   */
    CQueue requests;         /* pending requests (FIFO)          */
    Event lastEvent;         /* the event most recently dequeued */
    int nextId;              /* id given to the next stored event */
    int lastClearance;       /* last sensor reading in cm, -1 if none yet */
} Sim;

void simInit(Sim *sim);
int  simInBounds(int row, int col);
int  simCellFree(const Sim *sim, int row, int col);
int  simAddEvent(Sim *sim, EventType type, int value, char source);
StepResult simStep(Sim *sim);
int  simEmergencyStop(Sim *sim);
void simRelease(Sim *sim);
int  simClearanceAhead(const Sim *sim);
int  simToggleObstacle(Sim *sim, int row, int col);

#endif
