/* main.c
 *
 * Text menu that demonstrates the stack and the circular queue.
 * All the rules live in sim.c; all the printing of structures lives in
 * display.c. This file only reads the keyboard and calls them.
 *
 * This is a SOFTWARE SIMULATION. It is not connected to any real wheelchair
 * and it is not connected to the website.
 */

#include <stdio.h>
#include <ctype.h>
#include <string.h>
#include "sim.h"
#include "display.h"

/* Set to 1 when the keyboard input ends (Ctrl+D, or a piped file runs out). */
static int inputEnded = 0;

/* Print a prompt and read one line. Returns 1 on success, 0 at end of input. */
static int readLine(const char *prompt, char *line, int size)
{
    printf("%s", prompt);
    fflush(stdout);
    if (fgets(line, size, stdin) == NULL) {
        inputEnded = 1;
        return 0;
    }
    return 1;
}

/* Read a whole number. Returns -1 if the user typed something else. */
static int readNumber(const char *prompt)
{
    char line[64];
    int value;

    if (!readLine(prompt, line, sizeof(line))) {
        return -1;
    }
    if (sscanf(line, "%d", &value) != 1) {
        return -1;
    }
    return value;
}

/* Read N, E, S or W (either case). Returns a direction code or -1. */
static int readDirection(void)
{
    char line[64];

    if (!readLine("Direction (N, E, S or W): ", line, sizeof(line))) {
        return -1;
    }
    switch (toupper((unsigned char)line[0])) {
    case 'N':
        return NORTH;
    case 'E':
        return EAST;
    case 'S':
        return SOUTH;
    case 'W':
        return WEST;
    }
    return -1;
}

static void printMenu(void)
{
    printf("---------------- MENU ----------------\n");
    printf("  1  Enqueue a MOVE request\n");
    printf("  2  Enqueue a BACK request\n");
    printf("  3  Enqueue a SENSE request\n");
    printf("  4  Process next request (dequeue)\n");
    printf("  5  Peek at the front of the queue\n");
    printf("  6  Peek at the top of the stack\n");
    printf("  7  Show the stack\n");
    printf("  8  Show the queue\n");
    printf("  9  Show the grid and status\n");
    printf(" 10  Place or remove an obstacle\n");
    printf(" 11  EMERGENCY STOP\n");
    printf(" 12  Release emergency stop\n");
    printf(" 13  Reset everything\n");
    printf("  0  Exit\n");
    printf("--------------------------------------\n");
}

/* Enqueue one request and say what happened. */
static void addRequest(Sim *sim, EventType type, int value)
{
    int result = simAddEvent(sim, type, value, 'K');

    if (result == DSOK) {
        printf("ENQUEUED event #%d (%s).\n", sim->nextId - 1, eventName(type));
    } else if (result == DSOVERFLOW) {
        printf("QUEUE OVERFLOW: the queue is full (%d of %d). Request rejected.\n",
               sim->requests.count, QCAP);
        printf("Process some requests first.\n");
    } else {
        printf("REFUSED: emergency stop is on. Release it first.\n");
    }
}

/* Dequeue one request, carry it out and say what happened. */
static void processNext(Sim *sim)
{
    StepResult result = simStep(sim);

    if (result != STEPEMPTY && result != STEPESTOP) {
        printf("DEQUEUED event ");
        displayEvent(&sim->lastEvent);
        printf("\n");
    }
    printf("%s\n", resultText(result));
    if (result == STEPSENSED) {
        printf("Clearance ahead: %d cm\n", sim->lastClearance);
    }
}

static void peekQueue(const Sim *sim)
{
    Event e;

    if (cqPeek(&sim->requests, &e) == DSUNDERFLOW) {
        printf("QUEUE UNDERFLOW: the queue is empty, nothing to peek at.\n");
    } else {
        printf("Front of the queue: ");
        displayEvent(&e);
        printf("  (not removed)\n");
    }
}

static void peekStack(const Sim *sim)
{
    Snapshot s;

    if (stackPeek(&sim->history, &s) == DSUNDERFLOW) {
        printf("STACK UNDERFLOW: the stack is empty, nothing to peek at.\n");
    } else {
        printf("Top of the stack: (row %d, col %d) facing %c  (not removed)\n",
               s.row, s.col, dirLetter(s.heading));
    }
}

int main(void)
{
    Sim sim;
    int choice;
    int row;
    int col;
    int dir;
    char line[64];

    simInit(&sim);
    printf("Smart Assistive Wheelchair - stack and queue demo (C)\n");
    printf("Software simulation only: no real wheelchair, no website link.\n\n");
    displayGrid(&sim);
    printf("\n");

    while (1) {
        printMenu();
        choice = readNumber("Choose an option: ");
        if (inputEnded) {
            break;
        }
        printf("\n");
        if (choice == 0) {
            break;
        }

        switch (choice) {
        case 1:
            dir = readDirection();
            if (dir < 0) {
                printf("Not a direction. Nothing was enqueued.\n");
            } else {
                addRequest(&sim, EVMOVE, dir);
            }
            break;
        case 2:
            addRequest(&sim, EVBACK, 0);
            break;
        case 3:
            addRequest(&sim, EVSENSE, 0);
            break;
        case 4:
            processNext(&sim);
            break;
        case 5:
            peekQueue(&sim);
            break;
        case 6:
            peekStack(&sim);
            break;
        case 7:
            displayStack(&sim.history);
            break;
        case 8:
            displayQueue(&sim.requests);
            break;
        case 9:
            displayGrid(&sim);
            displayStatus(&sim);
            break;
        case 10:
            row = readNumber("Row (0 to 7): ");
            col = readNumber("Column (0 to 11): ");
            if (simToggleObstacle(&sim, row, col)) {
                printf("Obstacle toggled at row %d, col %d.\n", row, col);
            } else {
                printf("That cell cannot be changed (outside the grid, a wall, the start, the goal or the wheelchair).\n");
            }
            break;
        case 11:
            row = simEmergencyStop(&sim);
            printf("EMERGENCY STOP latched. %d pending request(s) thrown away.\n", row);
            printf("The stack was kept, so BACK still works after release.\n");
            break;
        case 12:
            if (readLine("Type YES to release the emergency stop: ", line, sizeof(line))
                && strncmp(line, "YES", 3) == 0) {
                simRelease(&sim);
                printf("Emergency stop released.\n");
            } else {
                printf("Not released.\n");
            }
            break;
        case 13:
            simInit(&sim);
            printf("Everything was reset.\n");
            break;
        default:
            printf("Please choose a number from the menu.\n");
            break;
        }
        displayIndices(&sim);
        printf("\n");
    }

    printf("Goodbye.\n");
    return 0;
}
