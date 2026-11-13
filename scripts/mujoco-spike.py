"""The spike's measurements in native MuJoCo (see docs/mujoco-spike.md), on the files that
scripts/export-mjcf.ts writes to mjcf-out/.

  .venv-mujoco/bin/python scripts/mujoco-spike.py stand 8880 [--dt 0.0005] [--seconds 10]
  .venv-mujoco/bin/python scripts/mujoco-spike.py gear 42049 --fn 2 [--torque 0.05]
  .venv-mujoco/bin/python scripts/mujoco-spike.py seat 8880 --body b125 --joint fpj174

stand: the model on its wheels under gravity: step time, and how far the loops and ties drift.
gear:  the frame held still, a torque on the function's control(s): how far each listed part
       turns for each radian the control turns, against the check's stored rates.
seat:  a force on the seat back, for a range of friction on every friction pin: whether the seat
       back tilts and the rest of the car holds still.
"""

import json
import math
import sys
import time

import mujoco
import numpy as np

LDU = 0.0004  # metres


def arg(name, default, kind=float):
    return kind(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default


def load(set_name, fixed=False, dt=None):
    xml = open(f"mjcf-out/{set_name}.xml").read()
    if fixed:
        xml = xml.replace('<freejoint name="root"/>', "")
    m = mujoco.MjModel.from_xml_string(xml)
    if dt:
        m.opt.timestep = dt
    # Dry friction as stiff as MuJoCo allows at this time step (its time constant can't be under
    # two steps): softer, a friction pin under a steady load creeps round.
    m.dof_solref[:] = [arg("--friction-solref", 2 * m.opt.timestep), 1]
    m.dof_solimp[:] = [0.99, 0.999, 0.0001, 0.5, 2]
    if "--frictionloss" in sys.argv:
        for i in range(m.njnt):
            if mujoco.mj_id2name(m, mujoco.mjtObj.mjOBJ_JOINT, i).startswith("fp"):
                m.dof_frictionloss[m.jnt_dofadr[i]] = arg("--frictionloss", 0.005)
    side = json.load(open(f"mjcf-out/{set_name}.json"))
    return m, mujoco.MjData(m), side


def drift(m, d):
    """Largest error of the loops (how far apart the two sides of a weld or connect are, LDU; and
    how far a weld has turned, degrees) and of the ties (gear meshes, chains, screws: joint and
    tendon equalities, in their own units, radians or normalised), from MuJoCo's constraint rows."""
    rows = {}
    for i in range(d.nefc):
        if d.efc_type[i] == mujoco.mjtConstraint.mjCNSTR_EQUALITY:
            rows.setdefault(int(d.efc_id[i]), []).append(d.efc_pos[i])
    out = {"loops LDU": 0.0, "welds deg": 0.0, "ties": 0.0}
    for eq, pos in rows.items():
        kind = int(m.eq_type[eq])
        if kind in (int(mujoco.mjtEq.mjEQ_WELD), int(mujoco.mjtEq.mjEQ_CONNECT)):
            out["loops LDU"] = max(out["loops LDU"], float(np.linalg.norm(pos[:3])) / LDU)
            if len(pos) == 6:
                out["welds deg"] = max(out["welds deg"], math.degrees(float(np.linalg.norm(pos[3:]))))
        else:
            out["ties"] = max(out["ties"], float(np.max(np.abs(pos))))
    return out


def worst(a, b):
    return {k: max(a[k], b[k]) for k in a}


def counts(m, side):
    eq = {}
    for i in range(m.neq):
        name = mujoco.mjtEq(m.eq_type[i]).name.replace("mjEQ_", "").lower()
        eq[name] = eq.get(name, 0) + 1
    return {"bodies": m.nbody - 1, "joints": m.njnt, "dofs": m.nv, "equalities": m.neq, "by kind": eq, "tendons": m.ntendon, "friction hinges": side["counts"]["frictionHinges"]}


def body_id(m, name):
    return mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_BODY, name)


def in_frame(d, frame):
    """Every body's origin in the frame's coordinates (metres)."""
    R = d.xmat[frame].reshape(3, 3)
    return (d.xpos - d.xpos[frame]) @ R


def stand(set_name):
    dt = arg("--dt", 0.0005)
    seconds = arg("--seconds", 10.0)
    m, d, side = load(set_name, dt=dt)
    print(json.dumps(counts(m, side)))
    frame = body_id(m, "b0")
    real = [i for i in range(m.nbody) if (mujoco.mj_id2name(m, mujoco.mjtObj.mjOBJ_BODY, i) or "").startswith("b")]
    mujoco.mj_forward(m, d)
    z0 = d.xpos[frame].copy()
    up0 = d.xmat[frame].reshape(3, 3)[:, 2].copy()
    local0 = in_frame(d, frame)
    worst_seen = drift(m, d)
    steps = int(round(seconds / dt))
    start = time.perf_counter()
    report_every = max(1, steps // 10)
    status = "ran"
    for s in range(steps):
        mujoco.mj_step(m, d)
        if not np.all(np.isfinite(d.qacc)) or np.any(np.abs(d.qvel) > 1e4):
            status = f"blew up at {s * dt:.3f} s"
            break
        if s % 20 == 0:
            worst_seen = worst(worst_seen, drift(m, d))
        if s % report_every == 0:
            moved = np.linalg.norm(in_frame(d, frame)[real] - local0[real], axis=1).max() / LDU
            print(f"  t={s * dt:5.2f}s  frame dz={(d.xpos[frame][2] - z0[2]) / LDU:8.2f} LDU  a body moved {moved:7.1f} LDU in the frame  {json.dumps({k: round(v, 3) for k, v in drift(m, d).items()})}  contacts {d.ncon}", flush=True)
    wall = time.perf_counter() - start
    done = s + 1
    up = d.xmat[frame].reshape(3, 3)[:, 2]
    tilt = math.degrees(math.acos(max(-1, min(1, float(up @ up0)))))
    moved = np.linalg.norm(in_frame(d, frame)[real] - local0[real], axis=1) / LDU
    # How far each friction pin's hinge turned while it stood.
    fp = [i for i in range(m.njnt) if mujoco.mj_id2name(m, mujoco.mjtObj.mjOBJ_JOINT, i).startswith("fp")]
    fp_turn = sorted([abs(d.qpos[m.jnt_qposadr[i]]) for i in fp], reverse=True)
    out = {
        "set": set_name,
        "dt": dt,
        "status": status,
        "simulated s": round(done * dt, 3),
        "step ms": round(1000 * wall / done, 4),
        "real-time factor": round(dt / (wall / done), 3),
        "frame drop LDU": round(float((d.xpos[frame][2] - z0[2]) / LDU), 2),
        "frame moved LDU": round(float(np.linalg.norm(d.xpos[frame][:2] - z0[:2]) / LDU), 2),
        "frame tilt deg": round(tilt, 2),
        "wheel contacts": int(d.ncon),
        "bodies moved over 5 LDU in the frame": int((moved > 5).sum()),
        "most a body moved in the frame LDU": round(float(moved.max()), 1),
        "worst, any time": {k: round(v, 4) for k, v in worst_seen.items()},
        "friction pins turned over 1 deg": int(sum(1 for x in fp_turn if math.degrees(x) > 1)),
        "of friction pins": len(fp),
        "largest friction-pin turn deg": round(math.degrees(fp_turn[0]) if fp_turn else 0, 2),
        "efc rows": int(d.nefc),
    }
    print(json.dumps(out))
    return out


def relative_spin(d, body, frame):
    return np.linalg.norm(d.cvel[body][:3] - d.cvel[frame][:3])


def gear(set_name):
    fn_index = arg("--fn", 1, int)
    torque = arg("--torque", 0.05)
    seconds = arg("--seconds", 2.0)
    dt = arg("--dt", 0.0005)
    m, d, side = load(set_name, fixed=True, dt=dt)
    fn = side["functions"][fn_index - 1]
    controls = fn["control"] if isinstance(fn["control"], list) else [fn["control"]]
    rates = (fn["generated"] or {}).get("rates") or [{}]
    stored = rates[0]
    frame = body_id(m, "b0")
    info = side["parts"]
    ctrl = [info[c] for c in controls]
    listed = [r for r in stored if r.split(" against ")[0] in info]
    # Settle under gravity first, then turn.
    for _ in range(int(0.5 / dt)):
        mujoco.mj_step(m, d)
    turned = 0.0
    went = {r: 0.0 for r in listed}
    steps = int(seconds / dt)
    start = time.perf_counter()
    for _ in range(steps):
        d.xfrc_applied[:] = 0
        for c in ctrl:
            b = body_id(m, c["body"])
            axis = np.array(c["turn"]["axis"])
            # Controls turned together (a car's wheels) all turn the same way, as a push along
            # the ground turns them: each wheel's own axis points outwards, so is lined up first.
            if axis @ np.array(ctrl[0]["turn"]["axis"]) < 0:
                axis = -axis
            d.xfrc_applied[b][3:] = torque * axis
        mujoco.mj_step(m, d)
        # Controls turned together: their mean turn.
        turned += np.mean([relative_spin(d, body_id(m, c["body"]), frame) for c in ctrl]) * dt
        for r in listed:
            ref = r.split(" against ")[0]
            against = r.split(" against ")[1] if " against " in r else None
            base = body_id(m, info[against]["body"]) if against and against in info else frame
            went[r] += relative_spin(d, body_id(m, info[ref]["body"]), base) * dt
    wall = time.perf_counter() - start
    dr = drift(m, d)
    rows = []
    for r in listed:
        mine = went[r] / turned if turned > 1e-9 else 0.0
        rows.append({"part": r, "stored": stored[r][0], "mujoco": round(mine, 4)})
    out = {"set": set_name, "function": fn_index, "torque N m": torque, "control turned rad": round(turned, 3), "seconds": seconds, "step ms": round(1000 * wall / steps, 4), "drift": {k: round(v, 4) for k, v in dr.items()}, "rates": rows}
    print(json.dumps(out, indent=1))
    return out


def seat(set_name):
    body_name = arg("--body", "b125", str)
    joint_name = arg("--joint", "fpj174", str)
    force = arg("--force", 0.5)
    dt = arg("--dt", 0.0005)
    results = []
    for friction in [float(x) for x in arg("--frictions", "0.0005,0.002,0.005,0.01,0.02,0.05", str).split(",")]:
        m, d, side = load(set_name, fixed="--held" in sys.argv, dt=dt)
        fp = [i for i in range(m.njnt) if mujoco.mj_id2name(m, mujoco.mjtObj.mjOBJ_JOINT, i).startswith("fp")]
        for i in fp:
            m.dof_frictionloss[m.jnt_dofadr[i]] = friction
        frame = body_id(m, "b0")
        seat_body = body_id(m, body_name)
        seat_joint = mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_JOINT, joint_name)
        # Settle on the wheels, then push the seat back horizontally, across its hinge.
        for _ in range(int(1.0 / dt)):
            mujoco.mj_step(m, d)
        q0 = d.qpos.copy()
        frame0 = d.xpos[frame].copy()
        axis = d.xmat[seat_body].reshape(3, 3) @ np.array(m.jnt_axis[seat_joint])
        push = np.cross(axis, [0, 0, 1])
        push /= np.linalg.norm(push)
        # The torque that force makes about the hinge, at the seat back's centre of mass.
        lever = d.xipos[seat_body] - d.xanchor[seat_joint]
        hinge_torque = float(np.cross(lever, force * push) @ axis)
        for _ in range(int(1.0 / dt)):
            d.xfrc_applied[:] = 0
            d.xfrc_applied[seat_body][:3] = force * push
            mujoco.mj_step(m, d)
        d.xfrc_applied[:] = 0
        for _ in range(int(0.5 / dt)):
            mujoco.mj_step(m, d)
        seat_turn = abs(d.qpos[m.jnt_qposadr[seat_joint]] - q0[m.jnt_qposadr[seat_joint]])
        others = [abs(d.qpos[m.jnt_qposadr[i]] - q0[m.jnt_qposadr[i]]) for i in fp if i != seat_joint]
        worst = max(range(len(others)), key=lambda k: others[k]) if others else None
        dr = drift(m, d)
        row = {
            "frictionloss N m": friction,
            "push torque N m": round(abs(hinge_torque), 4),
            "seat back turned deg": round(math.degrees(seat_turn), 2),
            "largest other friction pin deg": round(math.degrees(max(others or [0])), 3),
            "which": mujoco.mj_id2name(m, mujoco.mjtObj.mjOBJ_JOINT, [i for i in fp if i != seat_joint][worst]) if worst is not None else None,
            "frame moved LDU": round(float(np.linalg.norm(d.xpos[frame] - frame0) / LDU), 2),
            "drift": {k: round(v, 4) for k, v in dr.items()},
        }
        print(json.dumps(row), flush=True)
        results.append(row)
    return results


if __name__ == "__main__":
    {"stand": stand, "gear": gear, "seat": seat}[sys.argv[1]](sys.argv[2])
