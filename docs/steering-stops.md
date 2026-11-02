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
| 42037 Formula Off-Roader (partly) | 24°, 3°; now 20°, 27° | the left steering link (2739a), hanging by one end, against the frame's 14720 (fixed: see below) |
| 8283 Telehandler (partly) | 20°, 12° | the frame's 6558 against a 32068 on the steering |
| 8810 Cafe Racer (partly) | 2° stuck, 41° | nothing met one way: the solver couldn't step |

Parts already touching, or within NEAR (1 LDU) of it, when the model loads are never watched (see collisions.ts). The pairs that meet at once started just outside that: the 8272's steering arm lies 2.2 LDU from the 32140 and 1.5 LDU from the 32250 (between their shapes, each pulled in by INSET), and the 42124's two beams 2.5 LDU apart. The 8272's arm turns cleanly about its steering column, which leans back 14°, so it's no fault of the solver's. The parts lie a little out of true in the model, and the turn closes the gap. The others met parts further off (8285: 6 LDU; 8283: 21; 42069: 26) and need looking at one by one.

Tried, and not kept: NEAR of 3 LDU. The 854 and 956 are unchanged, but the 8272 then stops at 17° one way and 4° the other, on other parts as close; the 42037 goes to 36° one way but still stops at 3° the other; and the 42124 and 8285 don't change. Loosening the rest tolerance just moves the stop to the next pair.

## Steering links hanging by one end

The 42037's 3° stop was its left steering link swinging free. The model builds the whole left front corner 3 LDU behind its mirror image, so the link's inner end sits 3.8 LDU from the rack's towball, beyond the 2.5 LDU a ball may be off its socket. Hanging by its hub end only, the link swung as the rack moved, into the frame, and the left wheel didn't steer. A steering link or connecting rod that would otherwise hang by one end now fits its balls within 4.5 LDU (LOOSE_BALL_TOLERANCE in mechanism.ts), and the 32005 and 32293 steering links have the role too. Across all 186 sets that joins 9 links, all dangling steering links: in the 42000 (2), 42037, 42069 (2), 42077 (2), 42129 and 8110.

- **42037:** its steering stops at 20° and 27°, both wheels steering. Functions 1 and 2 now come back where they started (function 1 was 48° off). But the steering's there-and-back leaves the drivetrain 0.7 radians round: both front hubs now steer, turning the drive through their constant velocity joints, and the free wheels and shafts don't come all the way back (the free-mode path dependence of [one-problem.md](one-problem.md)).
- **42000:** functions 4 and 5 come back within 5° (they were 20° off), the links no longer adrift.
- **42069:** the steering comes back exactly (2 parts were off).
- **42077, 42129:** unchanged.
- **8110:** function 14, the crane's stabiliser legs, now comes back where it started (one part was left out of place). Its results are otherwise the same.

All 329 tests pass. The function results (works, partly, no) of these sets don't change.
