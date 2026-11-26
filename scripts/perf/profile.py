# Reads a profile of the check made by node (decision 377 of 2026-11-26) and names its functions by
# their lines in the source. tsx compiles each file to one line, so node's profile gives every
# function line 1; tsx's own cache keeps a source map for each file, which this reads.
#
#   node --cpu-prof --cpu-prof-interval 5000 --cpu-prof-dir <folder> --import tsx scripts/check-functions.ts --one data/sets/8110-1.json --only 3
#   python3 scripts/perf/profile.py <the .cpuprofile>              the time in each function itself, and with what it calls
#   python3 scripts/perf/profile.py <the .cpuprofile> 8 2.0        the tree from the top, 8 deep, parts under 2% left out
#   python3 scripts/perf/profile.py <the .cpuprofile> under closeLoops 6 1.5    the tree under every call of a function
#
import json, sys, collections, os
path = sys.argv[1]
under = sys.argv[3] if len(sys.argv) > 3 and sys.argv[2] == 'under' else None
rest = sys.argv[4:] if under else sys.argv[2:]
depth = int(rest[0]) if rest else (6 if under else 0)
minshare = float(rest[1]) if len(rest) > 1 else 1.5
p = json.load(open(path))
nodes = {n['id']: n for n in p['nodes']}
parent = {}
for n in p['nodes']:
    for c in n.get('children', []): parent[c] = n['id']
self_t = collections.Counter()
deltas = p['timeDeltas']; samples = p['samples']
for s, d in zip(samples, deltas): self_t[s] += d
total = sum(self_t.values())
# tsx compiles each file to one line; its cache keeps a source map. Map a column back to a line.
import glob, bisect, tempfile
B64 = {c: i for i, c in enumerate('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/')}
def decode(mappings):
    cols = []; lines = []; col = 0; src_line = 0
    for seg in mappings.split(';')[0].split(','):
        vals = []; shift = 0; val = 0
        for ch in seg:
            d = B64[ch]; val |= (d & 31) << shift
            if d & 32: shift += 5
            else:
                vals.append(-(val >> 1) if val & 1 else val >> 1); shift = 0; val = 0
        if not vals: continue
        col += vals[0]
        if len(vals) >= 4:
            src_line += vals[2]; cols.append(col); lines.append(src_line)
    return cols, lines
maps = {}
cache = glob.glob(os.path.join(tempfile.gettempdir(), 'tsx-*', '*'))
cache.sort(key=os.path.getmtime)
for f in cache:
    try:
        j = json.load(open(f)); m = j['map']; maps[m['sources'][0]] = decode(m['mappings'])
    except Exception: pass
memo = {}
def name(n):
    i = n['id']
    if i in memo: return memo[i]
    cf = n['callFrame']; f = cf['functionName'] or '(anon)'
    u = cf['url']; path = u.replace('file://', '')
    short = u.split('/preview/')[-1] if '/preview/' in u else os.path.basename(u)
    line = cf['lineNumber'] + 1
    if path in maps and cf['lineNumber'] == 0:
        cols, lines = maps[path]; k = bisect.bisect_right(cols, cf['columnNumber'] + 1) - 1
        if k >= 0: line = lines[k] + 1
    memo[i] = f"{f} {short}:{line}" if u else f
    return memo[i]
by_self = collections.Counter(); by_incl = collections.Counter()
# inclusive per node
kids = {n['id']: n.get('children', []) for n in p['nodes']}
incl = {}
order = []
root = p['nodes'][0]['id']
stack = [root]
while stack:
    i = stack.pop(); order.append(i); stack.extend(kids[i])
for i in reversed(order): incl[i] = self_t[i] + sum(incl[c] for c in kids[i])
for i in order:
    by_self[name(nodes[i])] += self_t[i]
    # inclusive: count only if no ancestor has the same name
    nm = name(nodes[i]); a = parent.get(i); dup = False
    while a is not None:
        if name(nodes[a]) == nm: dup = True; break
        a = parent.get(a)
    if not dup: by_incl[nm] += incl[i]
pc = lambda t: f"{100*t/total:5.1f}%"
print(f"total {total/1e6:.1f} s  samples {len(samples)}")
if under:
    # Every call of the function named (by the start of "name file:line"), merged into one tree.
    tops = []
    for i in order:
        if not name(nodes[i]).startswith(under): continue
        a = parent.get(i)
        while a is not None and not name(nodes[a]).startswith(under): a = parent.get(a)
        if a is None: tops.append(i)
    def merged(ids, d):
        t = sum(incl[i] for i in ids); s = sum(self_t[i] for i in ids)
        if not ids or t < total * minshare / 100: return
        print('  ' * d + pc(t) + ' ' + name(nodes[ids[0]]) + (f"  [self {pc(s).strip()}]" if s > total * 0.005 else ''))
        if d >= depth: return
        groups = collections.defaultdict(list)
        for i in ids:
            for c in kids[i]: groups[name(nodes[c])].append(c)
        for _, v in sorted(groups.items(), key=lambda kv: -sum(incl[i] for i in kv[1])): merged(v, d + 1)
    merged(tops, 0)
elif depth == 0:
    print("--- the time in each function itself")
    for k, v in by_self.most_common(28): print(pc(v), k)
    print("--- the time in each function with what it calls")
    for k, v in by_incl.most_common(45): print(pc(v), k)
else:
    def walk(i, d):
        if incl[i] < total * minshare / 100: return
        print('  ' * d + pc(incl[i]) + ' ' + name(nodes[i]) + (f"  [self {pc(self_t[i]).strip()}]" if self_t[i] > total*0.005 else ''))
        if d < depth:
            for c in sorted(kids[i], key=lambda c: -incl[c]): walk(c, d + 1)
    walk(root, 0)
