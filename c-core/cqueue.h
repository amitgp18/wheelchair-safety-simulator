/* cqueue.h
 *
 * Bounded circular queue of events (movement requests and sensor requests).
 *
 * Convention:
 *   items[0 .. QCAP-1]  the storage, treated as a ring
 *   front               index of the OLDEST item (the next one to leave)
 *   rear                index of the NEWEST item (the last one that arrived)
 *   count               how many items are stored
 *
 *   start:   front = 0, rear = -1, count = 0
 *   empty:   count == 0
 *   full:    count == QCAP
 *   wrap:    next index = (index + 1) % QCAP
 *
 * We keep a separate count so "full" and "empty" can never be confused.
 * front and rear are NOT reset when the queue becomes empty.
 */

#ifndef CQUEUEH
#define CQUEUEH

#include "dscodes.h"

#define QCAP 8

typedef enum {
    EVMOVE,    /* move one cell; value = direction code 0 to 3 */
    EVBACK,    /* go back to the previous saved position       */
    EVSENSE    /* take a distance reading                      */
} EventType;

typedef struct {
    int id;          /* unique number: 1, 2, 3 ...                        */
    EventType type;  /* what kind of request this is                      */
    int value;       /* for EVMOVE the direction code, otherwise 0        */
    char source;     /* metadata: who made it. K = keyboard, T = test     */
} Event;

typedef struct {
    Event items[QCAP];
    int front;
    int rear;
    int count;
} CQueue;

void cqInit(CQueue *q);
int  cqIsEmpty(const CQueue *q);
int  cqIsFull(const CQueue *q);
int  cqEnqueue(CQueue *q, Event e);            /* DSOK or DSOVERFLOW  */
int  cqDequeue(CQueue *q, Event *out);         /* DSOK or DSUNDERFLOW */
int  cqPeek(const CQueue *q, Event *out);      /* DSOK or DSUNDERFLOW */

#endif
