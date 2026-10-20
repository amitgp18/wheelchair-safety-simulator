/* structures.js
   The two data structures. They copy the C lab programs:

     Stack          top = -1 means empty.   push: top++ then store.   pop: read then top--.
     CircularQueue  front = -1 and rear = -1 mean empty.
                    full when (rear + 1) % MAX == front.
                    enqueue: rear = (rear + 1) % MAX.
                    dequeue: if front == rear both go back to -1, else front = (front + 1) % MAX.

   Nothing here touches the page. Every method returns a result object, so the
   caller decides what to show. Overflow and underflow never change the data. */
(function () {
  'use strict';
  var WC = (globalThis.WC = globalThis.WC || {});

  /* ---------- Stack ---------- */

  function Stack(capacity) {
    this.capacity = capacity;
    this.items = new Array(capacity).fill(null);
    this.top = -1;
  }

  Stack.prototype.isEmpty = function () { return this.top === -1; };
  Stack.prototype.isFull = function () { return this.top === this.capacity - 1; };
  Stack.prototype.size = function () { return this.top + 1; };

  Stack.prototype.push = function (item) {
    if (this.isFull()) { return { ok: false, code: 'SOVERFLOW' }; }
    this.top++;
    this.items[this.top] = item;
    return { ok: true, index: this.top };
  };

  Stack.prototype.pop = function () {
    if (this.isEmpty()) { return { ok: false, code: 'SUNDERFLOW' }; }
    var item = this.items[this.top];
    var index = this.top;
    this.items[this.top] = null; // the C code leaves the old value; we clear it so the picture stays clean
    this.top--;
    return { ok: true, item: item, index: index };
  };

  Stack.prototype.peek = function () {
    if (this.isEmpty()) { return { ok: false, code: 'SUNDERFLOW' }; }
    return { ok: true, item: this.items[this.top], index: this.top };
  };

  /* ---------- Circular queue ---------- */

  function CircularQueue(capacity) {
    this.capacity = capacity;
    this.items = new Array(capacity).fill(null);
    this.front = -1;
    this.rear = -1;
  }

  CircularQueue.prototype.isEmpty = function () { return this.front === -1; };
  CircularQueue.prototype.isFull = function () {
    return (this.rear + 1) % this.capacity === this.front;
  };
  CircularQueue.prototype.size = function () {
    if (this.front === -1) { return 0; }
    return ((this.rear - this.front + this.capacity) % this.capacity) + 1;
  };
  // Slot the next enqueue will use (for the explanation panel). null when full.
  CircularQueue.prototype.nextRearSlot = function () {
    if (this.isFull()) { return null; }
    return this.front === -1 ? 0 : (this.rear + 1) % this.capacity;
  };

  CircularQueue.prototype.enqueue = function (item) {
    if (this.isFull()) { return { ok: false, code: 'QOVERFLOW' }; }
    if (this.front === -1) {
      this.front = 0;
      this.rear = 0;
    } else {
      this.rear = (this.rear + 1) % this.capacity;
    }
    this.items[this.rear] = item;
    return { ok: true, index: this.rear };
  };

  CircularQueue.prototype.dequeue = function () {
    if (this.front === -1) { return { ok: false, code: 'QUNDERFLOW' }; }
    var item = this.items[this.front];
    var index = this.front;
    this.items[this.front] = null; // cleared for the picture only
    if (this.front === this.rear) {
      this.front = -1;             // that was the last item: back to empty
      this.rear = -1;
    } else {
      this.front = (this.front + 1) % this.capacity;
    }
    return { ok: true, item: item, index: index };
  };

  CircularQueue.prototype.peek = function () {
    if (this.front === -1) { return { ok: false, code: 'QUNDERFLOW' }; }
    return { ok: true, item: this.items[this.front], index: this.front };
  };

  // Items from front to rear, with their slot numbers (read only helper for drawing).
  CircularQueue.prototype.toArray = function () {
    // walks size() slots starting at front, wrapping with % (a fixed count, so it can never loop forever)
    var out = [];
    var i = this.front;
    for (var n = 0; n < this.size(); n++) {
      out.push({ slot: i, item: this.items[i] });
      i = (i + 1) % this.capacity;
    }
    return out;
  };

  WC.Stack = Stack;
  WC.CircularQueue = CircularQueue;
})();
