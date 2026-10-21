"""Scripted tests for the three C programs. Feeds keystrokes through stdin and
checks the printed output. Prints one PASS/FAIL line per test.

Usage:  python3 tests/c-program-tests.py          (compiles the programs with gcc first)
        python3 tests/c-program-tests.py BINDIR   (uses programs already compiled in BINDIR)"""
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if len(sys.argv) > 1:
    B = sys.argv[1]
else:
    B = tempfile.mkdtemp()
    for name in ("wheelchair-history-stack", "request-circular-queue", "wheelchair-simulator"):
        subprocess.check_call(["gcc", "-Wall", "-Wextra", "-std=c99", "-o", os.path.join(B, name), os.path.join(HERE, name + ".c")])
results = []


def run(prog, keys):
    out = subprocess.run([f"{B}/{prog}"], input="\n".join(keys) + "\n", capture_output=True, text=True, timeout=10)
    return out.stdout


def check(name, cond):
    results.append((name, bool(cond)))
    print(("PASS  " if cond else "FAIL  ") + name)


S = "wheelchair-history-stack"
Q = "request-circular-queue"
W = "wheelchair-simulator"

# ---------------- program 1: stack ----------------
o = run(S, ["4", "2", "3", "5"])
check("P1 empty stack: display, pop and peek all report empty or underflow",
      "Stack is empty (top = -1)" in o and "STACK UNDERFLOW" in o and o.count("Stack is empty") == 2)

o = run(S, ["1", "2 3", "3", "4", "2", "4", "5"])
check("P1 one element: push, peek, display, pop, then empty again",
      "Pushed (2, 3)" in o and "Top position is (2, 3)" in o and "Popped (2, 3)" in o and "Stack is empty (top = -1)" in o)

o = run(S, ["1", "1 1", "1", "2 2", "1", "3 3", "1", "4 4", "1", "5 5", "1", "4", "5"])
check("P1 stack overflow: the 6th push prints STACK OVERFLOW and the top stays (5, 5)",
      o.count("Pushed") == 5 and "STACK OVERFLOW" in o and "(top = 4)" in o)

o = run(S, ["1", "1 1", "1", "2 2", "2", "2", "2", "5"])
check("P1 stack underflow: third pop on a stack of two prints STACK UNDERFLOW",
      o.index("Popped (2, 2)") < o.index("Popped (1, 1)") < o.index("STACK UNDERFLOW"))

o = run(S, ["1", "1 1", "1", "1 2", "1", "1 3", "2", "2", "2", "5"])
check("P1 last in, first out: pops come back (1,3), (1,2), (1,1)",
      o.index("Popped (1, 3)") < o.index("Popped (1, 2)") < o.index("Popped (1, 1)"))

keys = []
for i in range(20):
    keys += ["1", f"{i} {i}", "2"]
keys += ["4", "5"]
o = run(S, keys)
check("P1 repeated push and pop: 20 rounds, stack empty at the end",
      o.count("Pushed") == 20 and o.count("Popped") == 20 and "STACK UNDERFLOW" not in o and "STACK OVERFLOW" not in o and "Stack is empty (top = -1)" in o)

# ---------------- program 2: circular queue ----------------
o = run(Q, ["2", "3", "4", "5"])
check("P2 empty queue: dequeue, peek and display all say Queue is Empty",
      o.count("Queue is Empty") == 3 and "front = -1, rear = -1" in o)

o = run(Q, ["1", "E", "3", "4", "2", "4", "5"])
check("P2 one element: front = 0 and rear = 0, then removed and empty again",
      "E inserted successfully" in o and "Front move is E" in o and "front = 0, rear = 0" in o and "E deleted successfully" in o and "front = -1, rear = -1" in o)

o = run(Q, ["1", "N", "1", "E", "1", "S", "1", "W", "1", "N", "1", "4", "5"])
check("P2 queue overflow: 6th enqueue prints Queue is Full, front = 0, rear = 4",
      o.count("inserted successfully") == 5 and "Queue is Full" in o and "front = 0, rear = 4" in o)

o = run(Q, ["2", "5"])
check("P2 queue underflow: dequeue on an empty queue prints Queue is Empty", "Queue is Empty" in o)

o = run(Q, ["1", "N", "1", "E", "1", "S", "1", "W", "1", "N", "2", "2", "1", "E", "1", "S", "4", "5"])
check("P2 wraparound: rear wraps from 4 to 0 then 1, front = 2, order S W N E S",
      "S W N E S" in o and "front = 2, rear = 1" in o)

o = run(Q, ["1", "N", "2", "1", "E", "4", "5"])
check("P2 removing the final element resets front and rear to -1, next enqueue restarts at 0",
      "N deleted successfully" in o and "front = 0, rear = 0" in o)

keys = []
for i in range(20):
    keys += ["1", "NESW"[i % 4], "2"]
keys += ["4", "5"]
o = run(Q, keys)
check("P2 repeated insertion and removal: 20 rounds, no Full, no Empty message, queue empty at the end",
      o.count("inserted successfully") == 20 and o.count("deleted successfully") == 20 and "Queue is Full" not in o and o.count("Queue is Empty") == 1)

o = run(Q, ["1", "X", "4", "5"])
check("P2 invalid move X is rejected", "Invalid move" in o and "front = -1" in o)

# ---------------- program 3: wheelchair simulator ----------------
o = run(W, ["4", "2", "4", "4", "12"])
check("P3 queue underflow and stack underflow are both reported",
      "QUEUE UNDERFLOW" in o and "STACK UNDERFLOW" in o)

o = run(W, ["1", "E", "1", "E", "4", "4", "9", "12"])
check("P3 normal movement: two moves East reach (1, 3)", "Moved to (1, 2)" in o and "Moved to (1, 3)" in o and "Wheelchair at (1, 3) facing E, mode READY" in o)

o = run(W, ["1", "E", "1", "E", "1", "S", "4", "4", "4", "9", "8", "12"])
check("P3 movement blocked by an obstacle at (2, 3): chair stays at (1, 3), mode BLOCKED, nothing pushed",
      "BLOCKED: wall, obstacle or edge ahead" in o and "Wheelchair at (1, 3) facing S, mode BLOCKED" in o and "Stack (top = 1):" in o)

o = run(W, ["1", "N", "4", "12"])
check("P3 wall boundary: moving North from the start is blocked, chair stays, nothing pushed",
      "BLOCKED: wall, obstacle or edge ahead" in o and "Moved to" not in o and "top=-1 mode=BLOCKED" in o)

keys = []
for i in range(9):
    keys += ["1", "E"]
keys += ["12"]
o = run(W, keys)
check("P3 queue overflow: the 9th request prints QUEUE OVERFLOW, rear = 7, front = 0",
      o.count("added") == 8 and "QUEUE OVERFLOW" in o and "front=0 rear=7" in o)

keys = []
for i in range(8):
    keys += ["1", "E"]
keys += ["4", "4", "4", "1", "E", "1", "E", "7", "12"]
o = run(W, keys)
check("P3 circular wraparound: after 3 removals and 2 more requests rear wraps to 1, front = 3",
      "front=3 rear=1" in o)

o = run(W, ["1", "E", "4", "12"])
check("P3 removing the final queue element: front and rear return to -1", "front=-1 rear=-1" in o)

keys = []
for i in range(11):
    keys += ["1", "E" if i % 2 == 0 else "W", "4"]
keys += ["12"]
o = run(W, keys)
check("P3 stack overflow: the 11th saved move is refused, chair stays put",
      "STACK OVERFLOW: history is full" in o and "Move refused. Use BACK to free a slot" in o and "top=9" in o)

keys = ["1", "S"] * 3
keys = ["1", "S", "1", "S", "1", "S"] + ["1", "E"] * 5
keys += ["4"] * 8
keys += ["1", "E", "4", "12"]
o = run(W, keys)
check("P3 reaching the goal after 9 moves prints Destination reached and mode ARRIVED",
      "Destination reached!" in o and "mode=ARRIVED" in o)

o = run(W, ["3", "4", "12"])
check("P3 sensor: clearance ahead from the start is 300 cm", "Clearance ahead: 300 cm" in o)

o = run(W, ["1", "E", "1", "E", "1", "E", "4", "10", "1", "N", "4", "7", "8", "11", "0", "11", "1", "2", "4", "9", "12"])
check("P3 emergency stop: 2 requests removed, new request refused, processing refused",
      "EMERGENCY STOP. 2 pending request(s) removed" in o and "REFUSED: emergency stop is on" in o and "EMERGENCY STOP is on. Nothing processed" in o)
check("P3 emergency stop: stack kept (top = 0) and queue empty while stopped",
      "top=0 mode=ESTOP" in o and "front=-1 rear=-1 top=0 mode=ESTOP" in o)
check("P3 release: answering 0 keeps ESTOP, answering 1 releases it, BACK then works",
      "Not released" in o and "Emergency stop released" in o and "Went back to (1, 1)" in o)

# ---------------- wrong input must never hang a program ----------------
for prog, keys, exitword in ((S, ["x", "5"], "Program terminated"), (Q, ["x", "5"], "Program terminated"), (W, ["x", "12"], "Program terminated")):
    o = run(prog, keys)
    check(prog + ": a letter at the menu prints Invalid choice and the program carries on", "Invalid choice" in o and exitword in o)
for prog in (S, Q, W):
    try:
        out = subprocess.run([f"{B}/{prog}"], input="", capture_output=True, text=True, timeout=5)
        check(prog + ": end of input stops the program instead of looping", True)
    except subprocess.TimeoutExpired:
        check(prog + ": end of input stops the program instead of looping", False)
o = run(S, ["1", "a b", "4", "5"])
check("P1: letters instead of a position are refused and nothing is pushed", "Invalid position" in o and "Stack is empty (top = -1)" in o)
o = run(W, ["10", "11", "yes", "4", "12"])
check("P3: answering yes instead of 1 does not release the emergency stop", "Not released" in o and "EMERGENCY STOP is on" in o)

failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)} passed, {len(failed)} failed")
sys.exit(1 if failed else 0)
