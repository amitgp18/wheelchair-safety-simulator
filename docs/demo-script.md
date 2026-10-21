# Teacher demonstration (about 4 minutes)

Every step below was run for real before it was written down. The C steps were typed into the compiled `wheelchair-simulator`.
The website steps are performed, click for click, by `web/tests/demo-rehearsal.js` (23 checks, all passed).
The times are a suggested pace for talking, not measured; the clicks themselves take seconds.

**What to say first (10 seconds):**
"This is a software simulation of a wheelchair controller. Move requests wait in a circular queue and are carried out in order.
Every place the chair leaves is saved on a stack, so BACK can retrace the path. Nothing is connected to hardware and there is no AI."

## Before you start (do this once, 1 minute)

- [ ] Compile: `cd c-programs` then `gcc -Wall -Wextra -std=c99 -o wheelchair-simulator wheelchair-simulator.c`
- [ ] Open `web/index.html` in Chrome or Edge. Leave the page on the Dashboard.
- [ ] Have `c-programs/sample-output/` open in a folder window in case the live C run fails.

## Part A: the C program (about 1 minute 45 seconds)

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

## Part B: the website (about 2 minutes 15 seconds)

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

## If something goes wrong

| Problem | What to do |
|---|---|
| The C program does not compile on the lab machine | Show `c-programs/sample-output/simulator-output-a.txt`, which is a real session, and say so |
| You pressed the wrong button on the website | Press **Reset** on the Simulator tab. Reload the page if needed: it always starts clean |
| A fixed scenario is running and you want to stop | Press **Stop** on its card, or **Reset** |
| The page looks wrong | Use Chrome or Edge. Very old browsers are not supported |
| You are asked "does the website run your C code?" | "No. It is a separate JavaScript version of the same algorithms. A test feeds both the same commands and compares front, rear, top, position and mode after every command: 65 states, no differences." |
| You are asked "is this a real wheelchair controller?" | "No. It is an educational simulation, not a safety-certified controller." |

## Extra short demonstrations, if asked

- **Stack overflow (C stack program):** push 5 positions (SIZE is 5), push a 6th: `STACK OVERFLOW`. Pop six times: five positions come back last in first out, then `STACK UNDERFLOW. No position to pop`.
- **Wraparound in C (queue program):** `c-programs/sample-output/queue-output-b.txt` shows `Queue is Full`. The test `P2 wraparound` shows rear going 4 to 0 to 1 with order S W N E S.
- **Scenario lab:** each of the six scenarios replays a fixed command list and gives the same result every time. They take 8 to 14 seconds each, so use them only if there is time.
