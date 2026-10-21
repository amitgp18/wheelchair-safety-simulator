# Earlier version, kept for reference

This folder is the first multi-file C version (stack.c, cqueue.c, sim.c, display.c, main.c, tests.c).
It still compiles and its own 126 tests pass, but it is **not** the version to submit and the website does not follow it.

Differences from the submitted programs in `../c-programs/`:

- The queue uses `front = 0`, `rear = -1` and a separate `count`. The submitted programs and the website use the
  lab convention: `front = -1`, `rear = -1`, full when `(rear + 1) % MAX == front`.
- The stack and queue functions never print; a separate display file does. The C programs print inside the
  functions, as in the course lab sheets.

Use `../c-programs/` for submission and the viva.
