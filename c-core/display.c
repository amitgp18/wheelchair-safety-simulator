/* display.c
 *
 * All printing for the demo. These functions only READ the structures.
 */

#include <stdio.h>
#include "display.h"

char dirLetter(int dir)
{
    if (dir == NORTH) {
        return 'N';
    }
    if (dir == EAST) {
        return 'E';
    }
    if (dir == SOUTH) {
        return 'S';
    }
    return 'W';
}

const char *modeName(Mode m)
{
    if (m == READY) {
        return "READY";
    }
    if (m == BLOCKED) {
        return "BLOCKED";
    }
    if (m == ARRIVED) {
        return "ARRIVED";
    }
    return "ESTOP";
}

const char *eventName(EventType t)
{
    if (t == EVMOVE) {
        return "MOVE";
    }
    if (t == EVBACK) {
        return "BACK";
    }
    return "SENSE";
}

const char *resultText(StepResult r)
{
    switch (r) {
    case STEPMOVED:
        return "Moved one cell. A snapshot was PUSHED on the stack.";
    case STEPARRIVED:
        return "Moved onto the goal. ARRIVED.";
    case STEPBLOCKED:
        return "BLOCKED: wall, obstacle or map edge. The chair did not move.";
    case STEPFULL:
        return "STACK OVERFLOW: the history stack is full, so the move was refused. Use BACK to free a slot.";
    case STEPBACKED:
        return "Went back one step. A snapshot was POPPED from the stack.";
    case STEPNOHISTORY:
        return "STACK UNDERFLOW: nothing saved to go back to. The chair did not move.";
    case STEPSENSED:
        return "Sensor reading taken.";
    case STEPEMPTY:
        return "QUEUE UNDERFLOW: no pending requests to process.";
    case STEPESTOP:
        return "EMERGENCY STOP is on. Nothing was processed. Release it first.";
    }
    return "Unknown result.";
}

void displayEvent(const Event *e)
{
    printf("#%d %s", e->id, eventName(e->type));
    if (e->type == EVMOVE) {
        printf(" %c", dirLetter(e->value));
    }
    printf(" (source %c)", e->source);
}

void displayStack(const Stack *s)
{
    int i;

    printf("STACK of saved positions (top = %d, count = %d of %d)\n",
           s->top, s->top + 1, STACKCAP);
    for (i = STACKCAP - 1; i >= 0; i--) {
        printf("  slot %2d : ", i);
        if (i <= s->top) {
            printf("(row %d, col %d) facing %c",
                   s->items[i].row, s->items[i].col,
                   dirLetter(s->items[i].heading));
            if (i == s->top) {
                printf("   <-- TOP");
            }
        } else {
            printf("empty");
        }
        printf("\n");
    }
    if (s->top == -1) {
        printf("  (the stack is empty: top = -1)\n");
    }
}

/* A slot holds a live item if it is within count steps of front,
 * going forward around the ring. */
static int slotInUse(const CQueue *q, int slot)
{
    int distance = (slot - q->front + QCAP) % QCAP;
    return distance < q->count;
}

void displayQueue(const CQueue *q)
{
    int i;

    printf("CIRCULAR QUEUE of requests (front = %d, rear = %d, count = %d of %d)\n",
           q->front, q->rear, q->count, QCAP);
    for (i = 0; i < QCAP; i++) {
        printf("  slot %d : ", i);
        if (slotInUse(q, i)) {
            displayEvent(&q->items[i]);
            if (i == q->front) {
                printf("   <-- FRONT");
            }
            if (i == q->rear) {
                printf("   <-- REAR");
            }
        } else {
            printf("empty");
        }
        printf("\n");
    }
    if (q->count == 0) {
        printf("  (the queue is empty: the next enqueue goes into slot %d)\n",
               (q->rear + 1) % QCAP);
    }
}

void displayGrid(const Sim *sim)
{
    static const char arrows[4] = { '^', '>', 'v', '<' };
    int r;
    int c;

    for (r = 0; r < ROWS; r++) {
        printf("  ");
        for (c = 0; c < COLS; c++) {
            if (r == sim->chair.row && c == sim->chair.col) {
                putchar(arrows[sim->chair.heading]);
            } else {
                putchar(sim->grid[r][c]);
            }
        }
        putchar('\n');
    }
    printf("  # wall   O obstacle   S start   G goal   ^ > v < wheelchair\n");
}

void displayStatus(const Sim *sim)
{
    printf("Wheelchair: row %d, col %d, facing %c, mode %s\n",
           sim->chair.row, sim->chair.col,
           dirLetter(sim->chair.heading), modeName(sim->chair.mode));
    if (sim->lastClearance < 0) {
        printf("Sensor: no reading yet\n");
    } else {
        printf("Sensor: last reading %d cm ahead\n", sim->lastClearance);
    }
}

void displayIndices(const Sim *sim)
{
    printf("[queue: front=%d rear=%d count=%d/%d]  [stack: top=%d count=%d/%d]  [mode %s]\n",
           sim->requests.front, sim->requests.rear,
           sim->requests.count, QCAP,
           sim->history.top, sim->history.top + 1, STACKCAP,
           modeName(sim->chair.mode));
}
