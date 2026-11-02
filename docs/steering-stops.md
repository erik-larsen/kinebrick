# Steering's stops

How far a model's wheels steer before something stops them, as the function check measures it with `npm run functions -- --lock` (see LOCK in scripts/check-functions.ts). Each steering control is turned each way, a tenth of a radian at a time, up to two turns, until parts meet (the viewer's collision check), a limit stops it, or the solver can't take the step. The most any steered part turned (a wheel's heading seen from above, or a knuckle against the frame) is written to the set's results as `lock`. It's only reported for now: nothing passes or fails on it.

## The survey

Over the 119 sets with a steering mechanism, at 53759b9 (one problem on), 101 functions were measured, 204 ways in all. The 8110 Unimog took longer than the 30-minute limit and was left out.

| function's result | functions | ways that meet | stuck | free | meets: median | meets: 15° to 50° | meets: under 5° |
|---|---|---|---|---|---|---|---|
| works | 59 | 115 | 5 | 0 | 27° | 106 | 4 |
| partly | 30 | 27 | 3 | 30 | 0° | 9 | 17 |
| no | 12 | 0 | 24 | 0 | | | |

- **Works:** almost all stop where parts meet, between 15° and 50°, as real Technic steering does. The 854 Go-Kart's 33° matches its test, and the 956's is about 35°.
- **Partly:** most don't steer at all. They go the whole way with the wheels not turning ('free': 41999, 42049, 42070, 42076, 42080, 42093, 42109, 8081, 8464, 8466, 8838, 8840, 8859), or meet in the first tenth of a radian. That is the partly result itself, not the stops.
- **No:** the control doesn't turn ('stuck'), as the result says.
- **Stuck at a fair angle:** the 42112, 42123 and 9395 (one way) stop at 37° with nothing met. The solver can't take the next step there; that may be a linkage at the end of its travel, which is a stop too.

So a believable range is 15° to 50° each way. Outside it, a working function's stop says something is wrong: the model, the collision check, or the solver.

## Outliers among the working functions

For each, the pair of parts that met, from a probe that turns the control as the check does:

| set | stop each way | parts that meet |
|---|---|---|
| 42124 Off-Road Buggy | 0°, 0° | two 32524 beams, one on the frame and one on the steering (meets at the first step both ways) |
| 8272 Snowmobile | 1°, 1° | the 32526 L-beam on the steering against the frame's 32250 (meets at the first step) |
| 8285 Tow Truck | 10°, 11° | a 48989 on the steering against the frame's 32019 |
| 42069 Extreme Adventure | 95°, 32° | a 32184 against a 32062 (both off the frame); 95° is too far |
| 42037 Formula Off-Roader (partly) | 24°, 3° | the 2739a on the steering against the frame's 14720 |
| 8283 Telehandler (partly) | 20°, 12° | the frame's 6558 against a 32068 on the steering |
| 8810 Cafe Racer (partly) | 2° stuck, 41° | nothing met one way: the solver couldn't step |

Parts already touching, or within NEAR of it, when the model loads are never watched (see collisions.ts). So a pair that meets at the first step started just outside NEAR: two beams lying face to face, a hair apart, that the turn presses together. Whether that's the model's placement, the shrink of the parts' shapes, or a part that shouldn't move is still to be looked at, set by set.
