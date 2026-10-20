/* cqueue.c
 *
 * Bounded circular queue. No printf here: results are returned as codes.
 */

#include "cqueue.h"

/* Start empty: front = 0, rear = -1, count = 0.
 * rear = -1 means "one step before slot 0", so the first enqueue,
 * which does rear + 1, lands in slot 0. */
void cqInit(CQueue *q)
{
    q->front = 0;
    q->rear = -1;
    q->count = 0;
}

/* 1 if no items are stored, otherwise 0. */
int cqIsEmpty(const CQueue *q)
{
    return q->count == 0;
}

/* 1 if all QCAP slots are used, otherwise 0. */
int cqIsFull(const CQueue *q)
{
    return q->count == QCAP;
}

/* Add e at the back of the queue.
 * Full queue: change nothing and return DSOVERFLOW.
 * Otherwise: move rear forward one slot (wrapping from QCAP-1 to 0),
 * store e there, count goes up by one, return DSOK. */
int cqEnqueue(CQueue *q, Event e)
{
    if (cqIsFull(q)) {
        return DSOVERFLOW;
    }
    q->rear = (q->rear + 1) % QCAP;
    q->items[q->rear] = e;
    q->count = q->count + 1;
    return DSOK;
}

/* Remove the oldest item and give it back through out.
 * Empty queue: change nothing (out is not written), return DSUNDERFLOW.
 * Otherwise: copy items[front] to *out, move front forward one slot
 * (wrapping), count goes down by one, return DSOK. */
int cqDequeue(CQueue *q, Event *out)
{
    if (cqIsEmpty(q)) {
        return DSUNDERFLOW;
    }
    *out = q->items[q->front];
    q->front = (q->front + 1) % QCAP;
    q->count = q->count - 1;
    return DSOK;
}

/* Look at the oldest item without removing it. No index changes. */
int cqPeek(const CQueue *q, Event *out)
{
    if (cqIsEmpty(q)) {
        return DSUNDERFLOW;
    }
    *out = q->items[q->front];
    return DSOK;
}
