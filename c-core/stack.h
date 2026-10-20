/* stack.h
 *
 * Array-based stack that remembers previous wheelchair positions.
 *
 * Convention:
 *   items[0 .. STACKCAP-1]  the storage
 *   top                     index of the NEWEST item
 *   top == -1               the stack is empty
 *   top == STACKCAP - 1     the stack is full
 *   number of items         top + 1
 */

#ifndef STACKH
#define STACKH

#include "dscodes.h"

#define STACKCAP 10

/* One saved wheelchair state ("movement state").
 * heading is a direction code: 0 = North, 1 = East, 2 = South, 3 = West. */
typedef struct {
    int row;
    int col;
    int heading;
} Snapshot;

typedef struct {
    Snapshot items[STACKCAP];
    int top;
} Stack;

void stackInit(Stack *s);
int  stackIsEmpty(const Stack *s);
int  stackIsFull(const Stack *s);
int  stackPush(Stack *s, Snapshot x);           /* DSOK or DSOVERFLOW  */
int  stackPop(Stack *s, Snapshot *out);         /* DSOK or DSUNDERFLOW */
int  stackPeek(const Stack *s, Snapshot *out);  /* DSOK or DSUNDERFLOW */

#endif
