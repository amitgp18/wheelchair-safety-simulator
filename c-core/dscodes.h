/* dscodes.h
 *
 * Result codes shared by the stack and the circular queue.
 *
 * Every stack and queue function RETURNS one of these codes instead of
 * printing a message. That keeps the data structures independent from the
 * user interface: the caller decides what to show on the screen.
 */

#ifndef DSCODESH
#define DSCODESH

enum {
    DSOK = 0,         /* the operation worked                      */
    DSOVERFLOW = 1,   /* tried to add to a structure that is full  */
    DSUNDERFLOW = 2   /* tried to remove from an empty structure   */
};

#endif
