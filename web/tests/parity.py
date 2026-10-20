"""Parity check: run the same scenario in the C lab program and in the JavaScript simulation,
then compare queue, stack, position, heading and mode after every command.
Needs gcc and node. Usage: python3 tests/parity.py"""
import json, os, re, subprocess, sys, tempfile

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
csrc = os.path.join(root, '..', 'lab-sheet', 'program3-wheelchair-simulator.c')
tmp = tempfile.mkdtemp()
binary = os.path.join(tmp, 'prog3')
subprocess.check_call(['gcc', '-o', binary, csrc])

# JS side: replay a scenario, record the trace line plus the queue size before each command
js = r"""
var vm=require('vm'),fs=require('fs'),path=require('path');
var ctx=vm.createContext({console:console});
['js/config.js','js/structures.js','js/safety.js','js/simulation.js','js/scenarios.js'].forEach(function(f){vm.runInContext(fs.readFileSync(path.join(process.argv[1],f),'utf8'),ctx)});
var out=vm.runInContext("(function(){var all=[];WC.scenarios.forEach(function(sc){var s=WC.createSimulation();var rows=[];sc.script.forEach(function(l){var before=s.queue.size();var r=s.exec(l);if(r===null)return;var st=s.state;rows.push({cmd:l,qsize:before,front:s.queue.front,rear:s.queue.rear,top:s.stack.top,row:st.row,col:st.col,heading:st.heading,mode:st.mode});});all.push({id:sc.id,rows:rows});});return JSON.stringify(all);})()",ctx);
console.log(out);
"""
data = json.loads(subprocess.check_output(['node', '-e', js, root]).decode())

def keys_for(row):
    cmd = row['cmd'].split()
    c = cmd[0]
    if c == 'MAP': return []
    if c == 'MOVE': return ['1', cmd[1]]
    if c == 'BACK': return ['2']
    if c == 'SENSE': return ['3']
    if c == 'STEP': return ['4']
    if c == 'DRAIN': return ['4'] * row['qsize']
    if c == 'PEEKQ': return ['5']
    if c == 'PEEKS': return ['6']
    if c == 'ESTOP': return ['10']
    if c == 'RELEASE': return ['11', '1']
    raise SystemExit('no C equivalent for ' + c)

total = bad = 0
skipped = []
for sc in data:
    cmds = [r['cmd'].split()[0] for r in sc['rows']]
    if any(c in ('FAULT', 'RESTORE') for c in cmds):
        skipped.append(sc['id'] + ' (uses sensor failure, which the C program does not have)')
        continue
    keys = []
    marks = []
    for row in sc['rows']:
        keys += keys_for(row)
        keys += ['9']
        marks.append(row)
    keys += ['12']
    out = subprocess.run([binary], input='\n'.join(keys) + '\n', capture_output=True, text=True, timeout=20).stdout
    # after each key 9 the program prints "Wheelchair at (r, c) facing H, mode M" then "[front=.. rear=.. top=.. mode=..]"
    found = re.findall(r'Wheelchair at \((\d+), (\d+)\) facing (\w), mode (\w+)\n\[front=(-?\d+) rear=(-?\d+) top=(-?\d+) mode=(\w+)\]', out)
    if len(found) != len(marks):
        print('FAIL', sc['id'], 'expected', len(marks), 'status blocks, got', len(found)); bad += 1; continue
    for row, f in zip(marks, found):
        total += 1
        c = dict(row=int(f[0]), col=int(f[1]), heading=f[2], mode=f[3], front=int(f[4]), rear=int(f[5]), top=int(f[6]))
        j = {k: row[k] for k in c}
        if c != j:
            bad += 1
            print('MISMATCH', sc['id'], row['cmd'], '\n  C :', c, '\n  JS:', j)
    print('ok  ', sc['id'], len(marks), 'commands compared')
for s in skipped: print('skip', s)
print('%d state checks, %d mismatches' % (total, bad))
sys.exit(1 if bad else 0)
