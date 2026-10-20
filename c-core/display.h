/* display.h
 *
 * Everything that PRINTS lives in display.c. The stack, the queue and the
 * simulation rules never print, so they can be tested without a screen.
 */

#ifndef DISPLAYH
#define DISPLAYH

#include "sim.h"

char dirLetter(int dir);                  /* 0..3 -> N, E, S, W            */
const char *modeName(Mode m);
const char *eventName(EventType t);
const char *resultText(StepResult r);     /* a sentence for each result    */

void displayEvent(const Event *e);        /* one event on one line         */
void displayStack(const Stack *s);        /* all slots, top marked         */
void displayQueue(const CQueue *q);       /* all slots, front and rear     */
void displayGrid(const Sim *sim);
void displayStatus(const Sim *sim);
void displayIndices(const Sim *sim);      /* one line: front, rear, top    */

#endif
