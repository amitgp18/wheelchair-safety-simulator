# Viva notes

Short answers in plain words. The code examples are from `lab-sheet/`.

## The project in two sentences

A software model of a wheelchair controller: movement requests wait in a **circular queue** and are carried out in order,
and every position the chair leaves is saved on a **stack** so BACK can retrace the path. Safety rules (walls, obstacles,
emergency stop, sensor failure) are plain if/else checks. Nothing is connected to hardware.

## Quick answers (say these first)

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

## Likely follow-up questions

| Question | Short answer |
|---|---|
| Why `top = -1` and not 0? | Index 0 is a valid slot. -1 means "no slot used yet", so `top + 1` is the number of items. |
| Why must the queue be circular when I could shift items? | Shifting is O(n) for every dequeue. Wrapping is O(1). |
| How do you tell full from empty in the queue? | Empty: `front == -1`. Full: `(rear + 1) % MAX == front`. Using -1 for empty keeps the two cases apart. |
| How many items are in the queue? | `(rear - front + MAX) % MAX + 1`, or 0 when `front == -1`. |
| What happens to the stack when the emergency stop is pressed? | Kept. The queue is emptied, so old requests never run on their own after recovery. |
| What is a blocked move? | The next cell is a wall, an obstacle or outside the room. It is refused before anything is pushed. |
| What is the difference between the C program and the website? | Same algorithms, separate code. The website also has battery, sensor failure, obstacle editing, recovery checks and scenarios. |

## Stack

- **Why a stack?** BACK must return to the most recent position first. That is last in, first out.
- **Empty:** `top == -1`. **Full:** `top == SIZE - 1`.
- **Push:** check full first, then `top++`, then store. **Pop:** check empty first, read `stack[top]`, then `top--`.
- **Overflow** is pushing onto a full stack; **underflow** is popping an empty one. Both are checked before `top` changes, so nothing outside the array is touched.
- **Time:** push, pop and peek are O(1).
- **When is the position pushed?** Just before a successful move. A blocked move is refused before the push, so it never enters the history.
- **Why refuse a move when the stack is full?** If the chair moved without saving, BACK would later jump over the unsaved cells.

## Circular queue

- **Why a queue?** Requests should be served in the order they arrive: first in, first out.
- **Empty:** `front == -1` and `rear == -1`. **Full:** `(rear + 1) % MAX == front`.
- **Enqueue:** if empty set both to 0, otherwise `rear = (rear + 1) % MAX`, then store.
- **Dequeue:** read `queue[front]`; if `front == rear` it was the last item, so both go back to -1; otherwise `front = (front + 1) % MAX`.
- **What does `%` do?** It gives the remainder. `(4 + 1) % 5 = 0`, so the index wraps from the last slot to slot 0.
- **Why circular?** A plain array queue cannot reuse the slots freed at the front without shifting every item. The circular one reuses them for free.
- **Time:** enqueue and dequeue are O(1).

## Safety logic

- **Order of checks for a move:** emergency stop, empty battery (web only), failed sensor (web only), then "is the next cell free?". `isFree()` checks the grid range first, then wall `#` or obstacle `O`.
- **Why is the emergency stop not in the queue?** A queue is fair: it would make the stop wait behind up to eight older requests. A safety command must act at once.
- **What does the stop do?** Sets the mode to ESTOP, removes every waiting request, keeps the stack, and refuses new requests and processing.
- **How do you leave it?** C: option 11 and type 1. Web: tick the confirmation and pass four checks (queue empty, sensor working, battery above 0, chair cell clear).
- **Why are old requests removed?** So nothing resumes blindly after a stop. The operator decides again what to do.
- **Revalidation:** a queued move is checked against the room at the moment it runs, not when it was added. An obstacle placed in between still blocks it.
- **Sensor failure (web):** the sensor returns no reading, the mode becomes FAULT and moves are refused. This is a conservative (fail-safe) stop.
- **Simulated sensor:** it counts free cells ahead, up to 6 cells of 50 cm, so at most 300 cm.

## Things that are not in the lab sheets (and what they mean)

| Used in | What | Meaning |
|---|---|---|
| program 3 | `struct Position`, `struct Event` | Groups related values: row, column, heading; id, type, direction |
| program 3 | `char grid[8][13]` | A 2D array: `grid[r][c]` is row r, column c. Each row is a string, so 13 chars for 12 cells plus the end mark |
| program 3 | `\|\|`, `&&`, `!` | or, and, not |
| all three | `if (scanf(...) != 1)` | scanf returns how many values it read; not 1 means the input was not a number |
| all three | `clearInput()` with `getchar()` | Throws away the rest of a wrong line so the next prompt works |
| all three | `feof(stdin)` and `EOF` | True when there is no more input at all; the program stops instead of looping |
| program 2, 3 | `scanf(" %c", ...)` | The space skips the Enter key left from the previous input |

## Honest answers to tricky questions

- **Does the website run your C code?** No. It has its own JavaScript version of the same algorithms. A parity test feeds the same commands to both and they agree on queue, stack, position and mode after every command.
- **Is this a real wheelchair controller?** No. It is an educational simulation. A real one would need certified hardware, real sensors, timing guarantees and testing.
- **Is there AI?** No. Every rule is an if/else check you can read.

## Demonstration

The full, rehearsed 4-minute demonstration with exact keys and expected output is in [demo-script.md](demo-script.md).
