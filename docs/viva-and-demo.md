# Viva and demonstration guide

Two parts: simple answers for the viva, then a 4-minute demonstration with the exact keys and the real output.

## Part 1: viva answers

Short answers in plain words. The code examples are from `c-programs/`.

### The project in two sentences

A software model of a wheelchair controller: movement requests wait in a **circular queue** and are carried out in order,
and every position the chair leaves is saved on a **stack** so BACK can retrace the path. Safety rules (walls, obstacles,
emergency stop, sensor failure) are plain if/else checks. Nothing is connected to hardware.

### Quick answers (say these first)

**LIFO, last in first out.** The last item put in is the first one taken out, like a pile of plates: you take the top plate.
My stack works like this. BACK must return to the most recent position first.

**FIFO, first in first out.** The first item put in is the first one taken out, like a queue at a ticket counter.
My queue works like this. Requests are carried out in the order they arrived.

**Push.** Put an item on top of the stack. Check "is it full?" first, then `top++`, then store: `stack[++top] = x`.
In the project the old position is pushed just before a successful move.

**Pop.** Take the top item off the stack. Check "is it empty?" first, read `stack[top]`, then `top--`.
In the project BACK pops and the chair returns to that position.

**Enqueue.** Add an item at the rear of the queue. If the queue is empty set `front = rear = 0`, otherwise `rear = (rear + 1) % MAX`, then store.
In the project every MOVE, BACK or SENSE request is enqueued.

**Dequeue.** Remove the item at the front. Read `queue[front]`. If `front == rear` it was the last one, so set both to -1;
otherwise `front = (front + 1) % MAX`. In the project "process next request" dequeues.

**Circular queue.** A queue in an array where the index goes back to 0 after the last slot, using `%`.
A plain array queue wastes the slots freed at the front, or must shift every item left. The circular one reuses them with no shifting.
Example with MAX 5: rear 4 then `(4 + 1) % 5 = 0`, so the next item goes into slot 0.

**Overflow.** Adding to a full structure. Stack: `top == SIZE - 1`. Queue: `(rear + 1) % MAX == front`.
The program prints a message and changes nothing. In the project the 11th saved move or the 9th waiting request is refused.

**Underflow.** Removing from an empty structure. Stack: `top == -1`. Queue: `front == -1`.
The program prints a message and changes nothing, so it never reads outside the array.

**Time complexity.** Push, pop, peek, enqueue, dequeue, "is empty" and "is full" are all **O(1)**: each one changes one index and one array slot,
whatever the number of items. Displaying every item is **O(n)**. The memory is fixed, one array each.

**Why a stack for history and a queue for requests?** History is undone from the newest backwards (LIFO). Requests are served from the oldest forwards (FIFO).

### Likely follow-up questions

| Question | Short answer |
|---|---|
| Why `top = -1` and not 0? | Index 0 is a valid slot. -1 means "no slot used yet", so `top + 1` is the number of items. |
| Why must the queue be circular when I could shift items? | Shifting is O(n) for every dequeue. Wrapping is O(1). |
| How do you tell full from empty in the queue? | Empty: `front == -1`. Full: `(rear + 1) % MAX == front`. Using -1 for empty keeps the two cases apart. |
| How many items are in the queue? | `(rear - front + MAX) % MAX + 1`, or 0 when `front == -1`. |
| What happens to the stack when the emergency stop is pressed? | Kept. The queue is emptied, so old requests never run on their own after recovery. |
| What is a blocked move? | The next cell is a wall, an obstacle or outside the room. It is refused before anything is pushed. |
| What is the difference between the C program and the website? | Same algorithms, separate code. The website also has battery, sensor failure, obstacle editing, recovery checks and scenarios. |

### Stack

- **Why a stack?** BACK must return to the most recent position first. That is last in, first out.
- **Empty:** `top == -1`. **Full:** `top == SIZE - 1`.
- **Push:** check full first, then `top++`, then store. **Pop:** check empty first, read `stack[top]`, then `top--`.
- **Overflow** is pushing onto a full stack; **underflow** is popping an empty one. Both are checked before `top` changes, so nothing outside the array is touched.
- **Time:** push, pop and peek are O(1).
- **When is the position pushed?** Just before a successful move. A blocked move is refused before the push, so it never enters the history.
- **Why refuse a move when the stack is full?** If the chair moved without saving, BACK would later jump over the unsaved cells.

### Circular queue

- **Why a queue?** Requests should be served in the order they arrive: first in, first out.
- **Empty:** `front == -1` and `rear == -1`. **Full:** `(rear + 1) % MAX == front`.
- **Enqueue:** if empty set both to 0, otherwise `rear = (rear + 1) % MAX`, then store.
- **Dequeue:** read `queue[front]`; if `front == rear` it was the last item, so both go back to -1; otherwise `front = (front + 1) % MAX`.
- **What does `%` do?** It gives the remainder. `(4 + 1) % 5 = 0`, so the index wraps from the last slot to slot 0.
- **Why circular?** A plain array queue cannot reuse the slots freed at the front without shifting every item. The circular one reuses them for free.
- **Time:** enqueue and dequeue are O(1).

### Safety logic

- **Order of checks for a move:** emergency stop, empty battery (web only), failed sensor (web only), then "is the next cell free?". `isFree()` checks the grid range first, then wall `#` or obstacle `O`.
- **Why is the emergency stop not in the queue?** A queue is fair: it would make the stop wait behind up to eight older requests. A safety command must act at once.
- **What does the stop do?** Sets the mode to ESTOP, removes every waiting request, keeps the stack, and refuses new requests and processing.
- **How do you leave it?** C: option 11 and type 1. Web: tick the confirmation and pass four checks (queue empty, sensor working, battery above 0, chair cell clear).
- **Why are old requests removed?** So nothing resumes blindly after a stop. The operator decides again what to do.
- **Revalidation:** a queued move is checked against the room at the moment it runs, not when it was added. An obstacle placed in between still blocks it.
- **Sensor failure (web):** the sensor returns no reading, the mode becomes FAULT and moves are refused. This is a conservative (fail-safe) stop.
- **Simulated sensor:** it counts free cells ahead, up to 6 cells of 50 cm, so at most 300 cm.

### Things that are not in the lab sheets (and what they mean)

| Used in | What | Meaning |
|---|---|---|
| simulator | `struct Position`, `struct Event` | Groups related values: row, column, heading; id, type, direction |
| simulator | `char grid[8][13]` | A 2D array: `grid[r][c]` is row r, column c. Each row is a string, so 13 chars for 12 cells plus the end mark |
| simulator | `\|\|`, `&&`, `!` | or, and, not |
| all three | `if (scanf(...) != 1)` | scanf returns how many values it read; not 1 means the input was not a number |
| all three | `clearInput()` with `getchar()` | Throws away the rest of a wrong line so the next prompt works |
| all three | `feof(stdin)` and `EOF` | True when there is no more input at all; the program stops instead of looping |
| queue, simulator | `scanf(" %c", ...)` | The space skips the Enter key left from the previous input |

### Honest answers to tricky questions

- **Does the website run your C code?** No. It has its own JavaScript version of the same algorithms. A parity test feeds the same commands to both and they agree on queue, stack, position and mode after every command.
- **Is this a real wheelchair controller?** No. It is an educational simulation. A real one would need certified hardware, real sensors, timing guarantees and testing.
- **Is there AI?** No. Every rule is an if/else check you can read.

## Part 2: teacher demonstration

Every step below was run for real before it was written down. The C steps were typed into the compiled `wheelchair-simulator`.
The website steps are performed, click for click, by `node web/tests/browser-tests.js demo` (23 checks, all passed).
The times are a suggested pace for talking, not measured; the clicks themselves take seconds.

**What to say first (10 seconds):**
"This is a software simulation of a wheelchair controller. Move requests wait in a circular queue and are carried out in order.
Every place the chair leaves is saved on a stack, so BACK can retrace the path. Nothing is connected to hardware and there is no AI."

### Before you start (do this once, 1 minute)

- [ ] Compile: `cd c-programs` then `gcc -Wall -Wextra -std=c99 -o wheelchair-simulator wheelchair-simulator.c`
- [ ] Open `web/index.html` in Chrome or Edge. Leave the page on the Dashboard.
- [ ] Have `c-programs/sample-output.txt` open in case the live C run fails.

### Part A: the C program (about 1 minute 45 seconds)

Run `./wheelchair-simulator`. Type each line below and press Enter.

| Step | You type | What appears (real output) | What to say |
|---|---|---|---|
| 1 | `1` then `E`, twice. Then `1` then `S` | `Request #1 added`, `#2`, `#3`. The line `[front=0 rear=2 top=-1 mode=READY]` | "Enqueue adds at the rear. Three requests are waiting. The stack is empty, top is minus one." |
| 2 | `4`, `4` | `Moved to (1, 2)`, then `Moved to (1, 3)`. The status line ends `top=1` | "Dequeue takes from the front, first in first out. Each move pushed the old position, so top is now 1." |
| 3 | `4` | `BLOCKED: wall, obstacle or edge ahead. Chair did not move`. The status line shows `top=1` and `mode=BLOCKED` | "The cell to the south is the obstacle. The move was refused and nothing was pushed, so top is still 1." |
| 4 | `8` | `slot 1: (1, 2) facing E <-- TOP` and `slot 0: (1, 1) facing E` | "The stack holds the two cells the chair left. The last one in is on top." |
| 5 | `1` `E`, then `1` `E`, then `10` | `EMERGENCY STOP. 2 pending request(s) removed` and `The stack is kept, so BACK still works after release`. Mode `ESTOP` | "The stop does not wait in the queue. It acts at once and clears the waiting requests." |
| 6 | `1` `E` | `REFUSED: emergency stop is on` | "While stopped, nothing new is accepted." |
| 7 | `11` then `1` | `Emergency stop released` | "Release needs an explicit confirmation." |
| 8 | `2` then `4` | `Went back to (1, 2)`. The status line shows `top=0` | "BACK popped the stack. Last in, first out." |
| 9 | `12` | `Program terminated` | |

### Part B: the website (about 2 minutes 15 seconds)

Open `web/index.html`.

| Step | You do | What the screen shows | What to say |
|---|---|---|---|
| 1 | Dashboard: point at the tiles | `READY`, Pending queue `0 / 8`, Stack `0 / 10` | "Everything on the screen is read from the real queue and stack." |
| 2 | **Queue** tab. Press **Auto-run on** so it says **Auto-run off**. Press **MOVE E** 8 times | Size `8 of 8`, front `0`, rear `7`, state `FULL`, and the line `(rear + 1) % 8 = (7 + 1) % 8 = 0, which equals front = 0` | "This is the full test for a circular queue." |
| 3 | Press **MOVE E** a 9th time | The request is refused. The log says QOVERFLOW. Size stays 8 | "Overflow is refused, nothing is overwritten." |
| 4 | Press **Step one request** 3 times | front `3`, rear `7`, size `5` | "Three leave from the front." |
| 5 | Press **MOVE W** twice | rear goes to `0` and then `1`, front stays `3`, size `7` | "Rear wrapped from slot 7 back to slot 0 using the percent operator. That is the circular part." |
| 6 | **Stack** tab | Three saved positions, top `2`. Press **Peek at top** and the top is not removed | "Three moves, three positions saved." |
| 7 | **Simulator** tab. Press **Reset**. Press **BACK**, then **Step** | The log says SUNDERFLOW. The chair stays at (1, 1) | "BACK with nothing saved is an underflow. It is refused, nothing breaks." |
| 8 | Press **Reset**. Press the east arrow twice and the south arrow once. Press **Step** 3 times (auto-run stays off from step 2 until you press it again) | Third step: `BLOCKED`, the obstacle cell highlighted, chair at (1, 3), stack top `1` | "A blocked move is not saved on the stack." |
| 9 | Press the east arrow twice, then **Esc** | Red banner, mode `ESTOP`, queue empty, stack still top `1`. Press the east arrow once: nothing is queued | "Same behaviour as the C program." |
| 10 | **Safety** tab | **Resume operation** is disabled. Tick the box. Four checks pass and Resume enables. Press it: mode `READY` | "Recovery needs the operator and four passing checks." |
| 11 | **Event log** tab. Press **Clear view**, then **Show cleared entries** | The list empties, then comes back | "Clearing the view never changes the simulation. Every action was logged." |

**Optional if you have 30 seconds left:** **Sensors** tab, press **Inject sensor failure**, then **Step**. The reading becomes `No reading` and the mode `FAULT`; moves are refused. Press **Restore sensor** and **Step** to return.

### If something goes wrong

| Problem | What to do |
|---|---|
| The C program does not compile on the lab machine | Show `c-programs/sample-output.txt` (section Simulator, session A), which is a real session, and say so |
| You pressed the wrong button on the website | Press **Reset** on the Simulator tab. Reload the page if needed: it always starts clean |
| A fixed scenario is running and you want to stop | Press **Stop** on its card, or **Reset** |
| The page looks wrong | Use Chrome or Edge. Very old browsers are not supported |
| You are asked "does the website run your C code?" | "No. It is a separate JavaScript version of the same algorithms. A test feeds both the same commands and compares front, rear, top, position and mode after every command: 65 states, no differences." |
| You are asked "is this a real wheelchair controller?" | "No. It is an educational simulation, not a safety-certified controller." |

### Extra short demonstrations, if asked

- **Stack overflow (C stack program):** push 5 positions (SIZE is 5), push a 6th: `STACK OVERFLOW`. Pop six times: five positions come back last in first out, then `STACK UNDERFLOW. No position to pop`.
- **Wraparound in C (queue program):** `c-programs/sample-output.txt` (section Queue program, session B) shows `Queue is Full`. The test `P2 wraparound` shows rear going 4 to 0 to 1 with order S W N E S.
- **Scenario lab:** each of the six scenarios replays a fixed command list and gives the same result every time. They take 8 to 14 seconds each, so use them only if there is time.
