/* stack.c
 *
 * Array-based stack. No printf here: results are returned as codes.
 */

#include "stack.h"

/* Make the stack empty. The old values stay in the array but they no
 * longer count, because everything is controlled by top. */
void stackInit(Stack *s)
{
    s->top = -1;
}

/* 1 if there are no items, otherwise 0. */
int stackIsEmpty(const Stack *s)
{
    return s->top == -1;
}

/* 1 if every slot is used, otherwise 0. */
int stackIsFull(const Stack *s)
{
    return s->top == STACKCAP - 1;
}

/* Put x on top of the stack.
 * Full stack: change nothing and return DSOVERFLOW.
 * Otherwise: move top up by one, store x there, return DSOK. */
int stackPush(Stack *s, Snapshot x)
{
    if (stackIsFull(s)) {
        return DSOVERFLOW;
    }
    s->top = s->top + 1;
    s->items[s->top] = x;
    return DSOK;
}

/* Take the newest item off the stack and give it back through out.
 * Empty stack: change nothing (out is not written) and return DSUNDERFLOW.
 * Otherwise: copy items[top] to *out, move top down by one, return DSOK. */
int stackPop(Stack *s, Snapshot *out)
{
    if (stackIsEmpty(s)) {
        return DSUNDERFLOW;
    }
    *out = s->items[s->top];
    s->top = s->top - 1;
    return DSOK;
}

/* Look at the newest item without removing it. top never changes. */
int stackPeek(const Stack *s, Snapshot *out)
{
    if (stackIsEmpty(s)) {
        return DSUNDERFLOW;
    }
    *out = s->items[s->top];
    return DSOK;
}
