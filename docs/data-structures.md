# Data structures: stack and circular queue

Both are fixed-size arrays with index variables. There is no linked list and no library data structure.
The C programs and the JavaScript use **the same conventions**, listed here. They are separate code:
the browser runs the JavaScript version, not the C program.

| | C (`lab-sheet/`) | JavaScript (`web/js/structures.js`) |
|---|---|---|
| Stack size | `SIZE 5` (program 1), `STACKSIZE 10` (program 3) | `STACKCAP 10` |
| Queue size | `MAX 5` (program 2), `QSIZE 8` (program 3) | `QCAP 8` |
| Stack empty | `top == -1` | `top === -1` |
| Stack full | `top == SIZE - 1` | `top === capacity - 1` |
| Queue empty | `front == -1` (and `rear == -1`) | same |
| Queue full | `(rear + 1) % MAX == front` | same |
| Result of a failed operation | prints a message, nothing changes | returns `{ ok: false, code: 'SOVERFLOW' }` and similar, nothing changes |

## Stack (history of previous positions)

Last in, first out. The stack holds the positions the wheelchair has left, so BACK always returns to the most recent one.

```
push(p):  if top == SIZE - 1  -> overflow, stop
          top = top + 1
          stack[top] = p

pop():    if top == -1        -> underflow, stop
          p = stack[top]
          top = top - 1
          return p

peek():   if top == -1 -> empty, otherwise read stack[top] without changing top
```

Example with SIZE 3:

| Operation | top before | top after | Stack (bottom to top) |
|---|---|---|---|
| start | | -1 | empty |
| push (1, 1) | -1 | 0 | (1, 1) |
| push (1, 2) | 0 | 1 | (1, 1) (1, 2) |
| push (1, 3) | 1 | 2 | (1, 1) (1, 2) (1, 3) full |
| push (1, 4) | 2 | 2 | refused: overflow |
| pop | 2 | 1 | returns (1, 3) |

**In the wheelchair:** the old position is pushed just before a successful move. A move that is blocked by a wall or obstacle
is refused before anything is pushed, so it never enters the history. If the stack is full the move is refused too,
because moving without saving would make BACK jump over cells that were never saved.

## Circular queue (pending requests)

First in, first out. `front` is the oldest request (the next to leave), `rear` the newest.
`%` makes the index wrap from the last slot back to slot 0, so space freed at the front is reused without shifting anything.

```
enqueue(x): if (rear + 1) % MAX == front -> full, stop
            if front == -1  { front = 0; rear = 0 }      first item
            else            rear = (rear + 1) % MAX
            queue[rear] = x

dequeue():  if front == -1 -> empty, stop
            x = queue[front]
            if front == rear { front = -1; rear = -1 }    that was the last item
            else             front = (front + 1) % MAX
            return x
```

Size is not stored. It is worked out when needed: `(rear - front + MAX) % MAX + 1`, or 0 when `front == -1`.

Example with MAX 5 (this is the "wraparound" test):

| Operation | front | rear | Slots 0 1 2 3 4 |
|---|---|---|---|
| start | -1 | -1 | . . . . . |
| enqueue N, E, S, W, N | 0 | 4 | N E S W N (full) |
| enqueue one more | 0 | 4 | refused: (4 + 1) % 5 = 0 = front |
| dequeue, dequeue | 2 | 4 | . . S W N |
| enqueue E | 2 | 0 | E . S W N  (rear wrapped 4 to 0) |
| enqueue S | 2 | 1 | E S S W N  (full again) |
| order out | | | S W N E S |

## Time and space

Push, pop, peek, enqueue, dequeue, empty and full checks are all **O(1)**: they change one index and one slot.
Displaying everything is O(n). Memory is fixed: one array per structure.

## Where the two versions differ (on purpose)

- **Clearing slots.** C leaves the old value in a slot after pop or dequeue (it is simply outside the used range).
  JavaScript sets it to `null` so the picture on screen shows the slot as empty. The indices behave the same.
- **Messages.** The C functions print their own messages, lab-sheet style. The JavaScript structures never touch the page;
  they return a result and the simulation writes the log.
- **Extra features in the browser only.** Battery, sensor failure, obstacle editing, the recovery checklist and the
  scenario commands exist only in the website. The C program 3 has the same stack, queue, obstacle and boundary rules,
  sensor distance and emergency stop.
- **The earlier `c-core/` version** used a different queue convention (`front = 0`, `rear = -1` and a separate `count`).
  It is kept for reference only. The submitted programs and the website both use the lab convention above.

## Checks that prove it

See [test-plan.md](test-plan.md). In short: the queue and stack tests cover empty, one element, full, overflow, underflow,
wraparound and removing the last element in both languages, 8000 random actions check that size, indices and filled slots
always agree, and the parity test shows the C program and the JavaScript reach the same front, rear, top, position and mode
after every command in five scenarios.
