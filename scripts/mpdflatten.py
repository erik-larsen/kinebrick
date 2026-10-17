#!/usr/bin/env python3
"""Flatten an LDraw MPD into a single parts-only .ldr.

python3 mpdflatten.py in.mpd out.ldr [root "submodel name"]

If you leave off the submodel name, it flattens the main model.

Root defaults to the first 0 FILE in the MPD. Submodels are inlined by
composing transforms; color 16 inherits the referencing line's color.
Raw geometry (types 2-5) inside submodels is transformed too, with
winding reversed under mirrored transforms so BFC stays correct.

How it handles the details:

Positions and rotations: each part gets the combined transform of every submodel above it.
Color: a part with color 16 takes the color of whatever line placed its submodel.
Hoses and springs: these submodels contain raw triangles and lines rather than parts.
The script moves those into place too, and flips triangle order in mirrored submodels so they don't render inside out.
What it drops: step lines and other comment lines. Only the root's header comments are kept.

"""
import sys

def load(path):
    files, order, cur = {}, [], None
    for line in open(path, encoding='utf-8', errors='replace'):
        line = line.rstrip('\r\n')
        if line.startswith('0 FILE '):
            cur = line[7:].strip()
            files[cur] = []
            order.append(cur)
        elif cur:
            files[cur].append(line)
    return files, order

def mul(A, B):  # 3x3 row-major
    return [sum(A[r*3+k]*B[k*3+c] for k in range(3)) for r in range(3) for c in range(3)]

def apply(M, t, p):
    return [M[r*3]*p[0] + M[r*3+1]*p[1] + M[r*3+2]*p[2] + t[r] for r in range(3)]

def det(M):
    return (M[0]*(M[4]*M[8]-M[5]*M[7]) - M[1]*(M[3]*M[8]-M[5]*M[6])
            + M[2]*(M[3]*M[7]-M[4]*M[6]))

def fmt(v):
    s = f'{v:.6f}'.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s

def color(c, inherited):
    return inherited if c == '16' and inherited is not None else c

def flatten(files, name, M, t, col, out, depth=0):
    if depth > 64:
        sys.exit(f'recursion too deep at {name}')
    mirrored = det(M) < 0
    for line in files[name]:
        tok = line.split()
        if not tok or tok[0] == '0':
            continue
        kind = tok[0]
        if kind == '1':
            c = color(tok[1], col)
            pos = apply(M, t, list(map(float, tok[2:5])))
            R = mul(M, list(map(float, tok[5:14])))
            ref = ' '.join(tok[14:])
            if ref in files:
                flatten(files, ref, R, pos, c, out, depth + 1)
            else:
                out.append(' '.join(['1', c] + [fmt(v) for v in pos + R] + [ref]))
        elif kind in '2345':
            c = color(tok[1], col)
            pts = [apply(M, t, list(map(float, tok[i:i+3])))
                   for i in range(2, len(tok), 3)]
            if mirrored and kind in '34':
                pts.reverse()
            out.append(' '.join([kind, c] + [fmt(v) for p in pts for v in p]))

def main():
    src, dst = sys.argv[1], sys.argv[2]
    files, order = load(src)
    root = sys.argv[3] if len(sys.argv) > 3 else order[0]
    header = []
    for line in files[root]:
        if line.startswith('0 ') and not line.startswith('0 STEP'):
            header.append(line)
        elif line.strip():
            break
    out = []
    flatten(files, root, [1, 0, 0, 0, 1, 0, 0, 0, 1], [0, 0, 0], None, out)
    with open(dst, 'w', newline='\r\n') as f:
        f.write('\n'.join(header + out) + '\n')
    n1 = sum(1 for l in out if l.startswith('1 '))
    print(f'{dst}: {n1} parts, {len(out) - n1} raw geometry lines')

if __name__ == '__main__':
    main()
