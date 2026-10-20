# C programs (lab-sheet style)

| File | What it is |
|---|---|
| program1-stack.c | Array stack of wheelchair positions (SIZE 5): push, pop, peek, display |
| program2-circular-queue.c | Circular queue of move requests N, E, S, W (MAX 5): enqueue, dequeue, peek, display |
| program3-wheelchair-simulator.c | The project: 8 x 12 room, queue of requests (8), history stack (10), obstacles, sensor, emergency stop |
| sample-output/ | Real sessions of each program |
| tests/labtests.py | 35 scripted tests |

## Compile and run

```
gcc -Wall -Wextra -std=c99 -o program3 program3-wheelchair-simulator.c
./program3
```

On Windows: `program3.exe`. In CodeTantra, paste one file and run it.

## Test

```
python3 tests/labtests.py
```

It compiles the three programs with gcc, types menu choices into them and checks what they print.

## Input checking

Every menu reads its choice with `if (scanf("%d", &choice) != 1)`. `scanf` returns how many values it read, so
anything other than 1 means the user typed something that is not a number. `clearInput()` then throws that line away
with `getchar()`, and the choice becomes 0, which prints "Invalid choice". If the input has ended completely
(`feof(stdin)`), the program stops instead of looping forever. Without this, typing a letter made each program print its
menu millions of times.
