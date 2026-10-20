#include <stdio.h>

#define ROWS 8
#define COLS 12
#define STACKSIZE 10
#define QSIZE 8

#define READY 0
#define BLOCKED 1
#define ARRIVED 2
#define ESTOP 3

/* movement state saved on the stack */
struct Position {
    int row;
    int col;
    char heading;
};

/* request stored in the queue: type is M (move), B (back) or S (sense) */
struct Event {
    int id;
    char type;
    char dir;
};

/* # wall, O obstacle, . floor, S start, G goal */
char grid[ROWS][COLS + 1] = {
    "############",
    "#S.........#",
    "#..O.......#",
    "#.....O....#",
    "#......G...#",
    "#...O......#",
    "#..........#",
    "############"
};

/* stack of previous positions */
struct Position history[STACKSIZE];
struct Position popped;
int top = -1;

/* circular queue of requests */
struct Event queue[QSIZE];
struct Event current;
int front = -1;
int rear = -1;
int nextId = 1;

/* wheelchair state */
int chairRow = 1;
int chairCol = 1;
char heading = 'E';
int mode = READY;
int dRow, dCol;

// throws away the rest of a line the user typed wrongly (for example a letter)
void clearInput() {
    int ch = getchar();
    while (ch != '\n' && ch != EOF)
        ch = getchar();
}

/* ---------- stack ---------- */

int push(struct Position p) {
    if (top == STACKSIZE - 1) {
        printf("STACK OVERFLOW: history is full\n");
        return 0;
    }
    top++;
    history[top] = p;
    return 1;
}

int pop() {
    if (top == -1) {
        printf("STACK UNDERFLOW: nothing to go back to\n");
        return 0;
    }
    popped = history[top];
    top--;
    return 1;
}

void peekStack() {
    if (top == -1) {
        printf("Stack is empty\n");
        return;
    }
    printf("Top of stack: (%d, %d) facing %c\n",
           history[top].row, history[top].col, history[top].heading);
}

void showStack() {
    int i;

    if (top == -1) {
        printf("Stack is empty (top = -1)\n");
        return;
    }
    printf("Stack (top = %d):\n", top);
    for (i = top; i >= 0; i--) {
        printf("  slot %d: (%d, %d) facing %c", i,
               history[i].row, history[i].col, history[i].heading);
        if (i == top)
            printf("   <-- TOP");
        printf("\n");
    }
}

/* ---------- circular queue ---------- */

int enqueue(char type, char dir) {
    if ((rear + 1) % QSIZE == front) {
        printf("QUEUE OVERFLOW: queue is full\n");
        return 0;
    }
    if (front == -1) {
        front = 0;
        rear = 0;
    } else {
        rear = (rear + 1) % QSIZE;
    }
    queue[rear].id = nextId;
    queue[rear].type = type;
    queue[rear].dir = dir;
    printf("Request #%d added\n", nextId);
    nextId++;
    return 1;
}

int dequeue() {
    if (front == -1) {
        printf("QUEUE UNDERFLOW: no pending requests\n");
        return 0;
    }
    current = queue[front];
    if (front == rear) {
        front = -1;
        rear = -1;
    } else {
        front = (front + 1) % QSIZE;
    }
    return 1;
}

void printEvent(struct Event e) {
    printf("#%d ", e.id);
    if (e.type == 'M')
        printf("MOVE %c", e.dir);
    else if (e.type == 'B')
        printf("BACK");
    else
        printf("SENSE");
}

void peekQueue() {
    if (front == -1) {
        printf("Queue is empty\n");
        return;
    }
    printf("Front of queue: ");
    printEvent(queue[front]);
    printf("\n");
}

void showQueue() {
    int i;

    if (front == -1) {
        printf("Queue is empty (front = -1, rear = -1)\n");
        return;
    }
    printf("Queue (front = %d, rear = %d):\n", front, rear);
    i = front;
    while (1) {
        printf("  slot %d: ", i);
        printEvent(queue[i]);
        if (i == front)
            printf("   <-- FRONT");
        if (i == rear)
            printf("   <-- REAR");
        printf("\n");

        if (i == rear)
            break;
        i = (i + 1) % QSIZE;
    }
}

/* ---------- rules of the grid ---------- */

/* returns 1 if the chair may stand on (r, c) */
int isFree(int r, int c) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS)
        return 0;
    if (grid[r][c] == '#' || grid[r][c] == 'O')
        return 0;
    return 1;
}

void setDelta(char d) {
    dRow = 0;
    dCol = 0;
    if (d == 'N')
        dRow = -1;
    else if (d == 'S')
        dRow = 1;
    else if (d == 'E')
        dCol = 1;
    else if (d == 'W')
        dCol = -1;
}

void settleMode() {
    if (grid[chairRow][chairCol] == 'G')
        mode = ARRIVED;
    else
        mode = READY;
}

void moveChair(char dir) {
    struct Position before;
    int newRow, newCol;

    before.row = chairRow;
    before.col = chairCol;
    before.heading = heading;

    heading = dir;
    setDelta(dir);
    newRow = chairRow + dRow;
    newCol = chairCol + dCol;

    if (!isFree(newRow, newCol)) {
        mode = BLOCKED;
        printf("BLOCKED: wall, obstacle or edge ahead. Chair did not move\n");
        return;
    }
    if (!push(before)) {
        printf("Move refused. Use BACK to free a slot\n");
        return;
    }
    chairRow = newRow;
    chairCol = newCol;
    settleMode();
    printf("Moved to (%d, %d)\n", chairRow, chairCol);
    if (mode == ARRIVED)
        printf("Destination reached!\n");
}

void goBack() {
    if (!pop())
        return;
    chairRow = popped.row;
    chairCol = popped.col;
    heading = popped.heading;
    settleMode();
    printf("Went back to (%d, %d)\n", chairRow, chairCol);
}

void senseDistance() {
    int r, c, cells = 0;

    setDelta(heading);
    r = chairRow + dRow;
    c = chairCol + dCol;
    while (cells < 6 && isFree(r, c)) {
        cells++;
        r = r + dRow;
        c = c + dCol;
    }
    printf("Clearance ahead: %d cm\n", cells * 50);
}

/* take the oldest request out of the queue and carry it out */
void processNext() {
    if (mode == ESTOP) {
        printf("EMERGENCY STOP is on. Nothing processed\n");
        return;
    }
    if (!dequeue())
        return;

    printf("Processing ");
    printEvent(current);
    printf("\n");

    if (current.type == 'M')
        moveChair(current.dir);
    else if (current.type == 'B')
        goBack();
    else
        senseDistance();
}

void addRequest(char type, char dir) {
    if (mode == ESTOP) {
        printf("REFUSED: emergency stop is on\n");
        return;
    }
    enqueue(type, dir);
}

/* ---------- emergency stop ---------- */

void emergencyStop() {
    int flushed = 0;

    mode = ESTOP;
    while (front != -1) {
        dequeue();
        flushed++;
    }
    printf("EMERGENCY STOP. %d pending request(s) removed\n", flushed);
    printf("The stack is kept, so BACK still works after release\n");
}

void releaseStop() {
    int sure;

    if (mode != ESTOP) {
        printf("Emergency stop is not on\n");
        return;
    }
    printf("Enter 1 to confirm release: ");
    if (scanf("%d", &sure) != 1) {
        clearInput();
        sure = 0;               // anything that is not 1 keeps the stop on
    }
    if (sure == 1) {
        settleMode();
        printf("Emergency stop released\n");
    } else {
        printf("Not released\n");
    }
}

/* ---------- display ---------- */

void printMode() {
    if (mode == READY)
        printf("READY");
    else if (mode == BLOCKED)
        printf("BLOCKED");
    else if (mode == ARRIVED)
        printf("ARRIVED");
    else
        printf("ESTOP");
}

void showGrid() {
    int r, c;

    for (r = 0; r < ROWS; r++) {
        printf("  ");
        for (c = 0; c < COLS; c++) {
            if (r == chairRow && c == chairCol)
                printf("C");
            else
                printf("%c", grid[r][c]);
        }
        printf("\n");
    }
    printf("  # wall  O obstacle  S start  G goal  C wheelchair\n");
    printf("Wheelchair at (%d, %d) facing %c, mode ", chairRow, chairCol, heading);
    printMode();
    printf("\n");
}

void showIndicators() {
    printf("[front=%d rear=%d top=%d mode=", front, rear, top);
    printMode();
    printf("]\n");
}

/* ---------- main menu ---------- */

int main() {
    int choice;
    char dir;

    printf("Smart Assistive Wheelchair Simulator\n");
    printf("Software simulation only. Not connected to a real wheelchair\n");

    do {
        printf("\n1. Add MOVE request\n");
        printf("2. Add BACK request\n");
        printf("3. Add SENSE request\n");
        printf("4. Process next request\n");
        printf("5. Peek front of queue\n");
        printf("6. Peek top of stack\n");
        printf("7. Show queue\n");
        printf("8. Show stack\n");
        printf("9. Show grid and status\n");
        printf("10. EMERGENCY STOP\n");
        printf("11. Release emergency stop\n");
        printf("12. Exit\n");

        printf("Enter your choice: ");
        if (scanf("%d", &choice) != 1) {
            if (feof(stdin))
                break;          // no more input at all, so stop
            clearInput();
            choice = 0;         // goes to "Invalid choice"
        }

        switch (choice) {
            case 1:
                printf("Enter direction (N, E, S or W): ");
                scanf(" %c", &dir);
                if (dir == 'N' || dir == 'E' || dir == 'S' || dir == 'W')
                    addRequest('M', dir);
                else
                    printf("Invalid direction\n");
                break;
            case 2:
                addRequest('B', '-');
                break;
            case 3:
                addRequest('S', '-');
                break;
            case 4:
                processNext();
                break;
            case 5:
                peekQueue();
                break;
            case 6:
                peekStack();
                break;
            case 7:
                showQueue();
                break;
            case 8:
                showStack();
                break;
            case 9:
                showGrid();
                break;
            case 10:
                emergencyStop();
                break;
            case 11:
                releaseStop();
                break;
            case 12:
                printf("Program terminated\n");
                break;
            default:
                printf("Invalid choice\n");
        }
        if (choice != 12)
            showIndicators();
    } while (choice != 12);

    return 0;
}
