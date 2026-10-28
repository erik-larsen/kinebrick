# Errors found in LDraw models of LEGO Technic sets

[KineBrick Viewer](https://github.com/erik-larsen/kinebrick) is a web LDraw viewer that works out a Technic model's mechanism from where its parts are placed, then lets you turn its gears and levers. To do that it has to decide, for every pin and axle, which hole it sits in, and for every pair of gears, whether they mesh. A part a few LDU out of place shows up as a part that attaches to nothing, or a gear train that doesn't turn.

This page lists the errors KineBrick has found that way in the LDraw models it uses, so they can be corrected where the models are published. For each one it gives the exact lines, and the correction KineBrick uses where it has one. Coordinates are in LDU (1 stud = 20 LDU).

| Set | Model | Author | Published on | Errors | Status |
| --- | --- | --- | --- | --- | --- |
| [852-1](#852-1-helicopter) | Helicopter (1977) | Allard van Efferen | LDraw OMR | 1 | Not corrected |
| [858-1](#858-1-auto-engines-inline-and-v-6-engines) | Auto Engines (1980), Inline and V-6 Engines | Takeshi Takahashi | LDraw forum | 2 | Corrected in KineBrick |
| [8844-1](#8844-1-helicopter) | Helicopter (1981) | Allard van Efferen | LDraw OMR | 1 | Not corrected |
| [8849-1](#8849-1-tractor) | Tractor (1986) | Stefan Frenz | LDraw OMR | 1 | Corrected in KineBrick |
| [8854-1](#8854-1-power-crane) | Power Crane (1989) | Stefan Frenz | LDraw OMR | 1 | Not corrected |
| [8880-1](#8880-1-super-car) | Super Car (1994) | Orion Pobursky | LDraw OMR | 4 | Corrected in KineBrick |

## 852-1 Helicopter

| | |
| --- | --- |
| Set | 852 Helicopter, 1977 (954 Sky Copter in the US) |
| Model | Reconnaisance Helicopter, `852-1.mpd` (an Official Model) |
| Author | Allard van Efferen (rabbitdesign.nl) |
| Licence | CCAL 2.0 (CC BY 2.0) |
| Original | [LDraw Official Model Repository, set 1181](https://library.ldraw.org/omr/sets/1181) |
| In KineBrick | Used as published, not corrected: [`models/852-Helicopter.mpd`](../models/852-Helicopter.mpd) |

### The model's name is misspelt (not corrected)

The OMR lists the model as "Reconnaisance Helicopter". "Reconnaissance" has a double s, and the name on the set's box is just Helicopter.

## 858-1 Auto Engines: Inline and V-6 Engines

| | |
| --- | --- |
| Set | 858 Auto Engines, 1980. The set builds four engines, each a model of its own; two of the four files have errors. |
| Models | `858-1 - Auto Engines - Inline Engine.mpd` (the A-model) and `858-1 - Auto Engines - V-6 Engine.mpd` |
| Author | Takeshi Takahashi [RainbowDolphin] |
| Licence | CCAL 2.0 (CC BY 2.0) |
| Original | Posted to the LDraw forum thread [Lego Technic 1980](https://forums.ldraw.org/thread-26887.html): the inline engine on 18 February 2024, the V-6 on 23 February 2024. Not on the OMR. |
| In KineBrick | Both corrected: [`models/858-Auto Engines-Inline Engine.mpd`](../models/858-Auto%20Engines-Inline%20Engine.mpd) and [`models/858-Auto Engines-V-6 Engine.mpd`](../models/858-Auto%20Engines-V-6%20Engine.mpd) |

### Inline engine: the camshaft is 2 LDU from its hole (corrected in KineBrick)

The camshaft is placed 62 LDU from the crankshaft instead of 60, 2 LDU off the hole it runs in. The 24 tooth gears (3648a) that drive it from the crankshaft mesh at 60 LDU, the sum of their pitch radii, so at 62 they miss and the camshaft doesn't turn. KineBrick found this because the engine's gear train wouldn't mesh. Moving the camshaft back 2 LDU puts it in its hole, and its gears mesh.

In `858-1 - Engine housing.ldr`, the line placing `858-1 - Camshaft.ldr`, just after the crankshaft's:

```diff
  1 1 -100 -38 20 1 0 0 0 0 1 0 -1 0 858-1 - Crankshaft.ldr
- 1 1 20 -38 -42 1 0 0 0 0 1 0 -1 0 858-1 - Camshaft.ldr
+ 1 1 20 -38 -40 1 0 0 0 0 1 0 -1 0 858-1 - Camshaft.ldr
```

### V-6 engine: the cylinder banks hang a stud too far in (corrected in KineBrick)

Each bank of three cylinders (`858-1 - Cylinder block 1.ldr` and `2`) hangs from 1 x 4 Technic bricks (3701), but is placed a stud too far in on them, flush with them. So the banks lean 102° apart instead of about 86°, the crankshaft's gears are built into both banks, and the pistons run into the taps at the cylinders' ends. KineBrick found this because the crank wouldn't turn: about a sixteenth of a turn either way, parts ran into each other. With each bank a stud further out on those bricks (and the feet under them), nothing overlaps.

That stud is inferred. The instructions' scans (Peeron, 8858-2) and photos of the real engine show how the banks hang, but are too coarse to show it. It's the placement where everything fits, its V is about 90°, as Technicopedia describes the engine, and the crankshaft sits as far from each bank as on the boxer engine.

In `858-1 - Engine housing.ldr`, the banks, each moved and tilted:

```diff
- 1 0 20 0 -60 1 0 0 0 0.777146 0.62932 0 -0.62932 0.777146 858-1 - Cylinder block 1.ldr
- 1 0 220 0 60 1 0 0 0 0.777146 -0.62932 0 0.62932 0.777146 858-1 - Cylinder block 2.ldr
+ 1 0 20 -14.567764 -73.703293 1 0 0 0 0.685165 0.728388 0 -0.728388 0.685165 858-1 - Cylinder block 1.ldr
+ 1 0 220 -14.567764 73.703293 1 0 0 0 0.685165 -0.728388 0 0.728388 0.685165 858-1 - Cylinder block 2.ldr
```

In `858-1 - Cylinder block 1.ldr`, the bricks it hangs from, and its feet, a stud along:

```diff
- 1 1 0 -10 -20 0 0 1 0 1 0 -1 0 0 3701.dat
- 1 1 60 -10 -20 0 0 1 0 1 0 -1 0 0 3701.dat
- 1 1 120 -10 -20 0 0 1 0 1 0 -1 0 0 3701.dat
- 1 1 180 -10 -20 0 0 1 0 1 0 -1 0 0 3701.dat
+ 1 1 0 -10 0 0 0 1 0 1 0 -1 0 0 3701.dat
+ 1 1 60 -10 0 0 0 1 0 1 0 -1 0 0 3701.dat
+ 1 1 120 -10 0 0 0 1 0 1 0 -1 0 0 3701.dat
+ 1 1 180 -10 0 0 0 1 0 1 0 -1 0 0 3701.dat
  ...
- 1 14 60 14 -50 1 0 0 0 1 0 0 0 1 3005.dat
- 1 14 120 14 -50 1 0 0 0 1 0 0 0 1 3005.dat
- 1 14 180 14 -50 1 0 0 0 1 0 0 0 1 3005.dat
- 1 14 110 38 -50 1 0 0 0 1 0 0 0 1 3008.dat
+ 1 14 60 14 -30 1 0 0 0 1 0 0 0 1 3005.dat
+ 1 14 120 14 -30 1 0 0 0 1 0 0 0 1 3005.dat
+ 1 14 180 14 -30 1 0 0 0 1 0 0 0 1 3005.dat
+ 1 14 110 38 -30 1 0 0 0 1 0 0 0 1 3008.dat
```

In `858-1 - Cylinder block 2.ldr`, the same, the other way:

```diff
- 1 1 0 -10 20 0 0 1 0 1 0 -1 0 0 3701.dat
+ 1 1 0 -10 0 0 0 1 0 1 0 -1 0 0 3701.dat
  0 STEP
- 1 1 -60 -10 20 0 0 1 0 1 0 -1 0 0 3701.dat
- 1 4 -120 -10 0 0 0 1 0 1 0 -1 0 0 3700.dat
- 1 4 -180 -10 0 0 0 1 0 1 0 -1 0 0 3700.dat
- 1 4 -150 14 0 1 0 0 0 1 0 0 0 1 3020.dat
+ 1 1 -60 -10 0 0 0 1 0 1 0 -1 0 0 3701.dat
+ 1 4 -120 -10 -20 0 0 1 0 1 0 -1 0 0 3700.dat
+ 1 4 -180 -10 -20 0 0 1 0 1 0 -1 0 0 3700.dat
+ 1 4 -150 14 -20 1 0 0 0 1 0 0 0 1 3020.dat
  ...
- 1 1 -120 -10 40 0 0 1 0 1 0 -1 0 0 3023b.dat
- 1 1 -120 -2 40 0 0 1 0 1 0 -1 0 0 3023b.dat
- 1 1 -120 6 40 0 0 1 0 1 0 -1 0 0 3023b.dat
- 1 14 -120 14 50 1 0 0 0 1 0 0 0 1 3005.dat
- 1 14 -60 14 50 1 0 0 0 1 0 0 0 1 3005.dat
- 1 14 0 14 50 1 0 0 0 1 0 0 0 1 3005.dat
- 1 14 -70 38 50 1 0 0 0 1 0 0 0 1 3008.dat
+ 1 1 -120 -10 20 0 0 1 0 1 0 -1 0 0 3023b.dat
+ 1 1 -120 -2 20 0 0 1 0 1 0 -1 0 0 3023b.dat
+ 1 1 -120 6 20 0 0 1 0 1 0 -1 0 0 3023b.dat
+ 1 14 -120 14 30 1 0 0 0 1 0 0 0 1 3005.dat
+ 1 14 -60 14 30 1 0 0 0 1 0 0 0 1 3005.dat
+ 1 14 0 14 30 1 0 0 0 1 0 0 0 1 3005.dat
+ 1 14 -70 38 30 1 0 0 0 1 0 0 0 1 3008.dat
```

And to follow the banks: in `858-1 - Engine housing.ldr`, the axle through both banks' tops (3708) and its bushes (3713), raised; in `858-1 - Crankshaft.ldr`, the pistons, turned to their cylinders; and in `858-1 - Piston 1.ldr` and `Piston 2.ldr`, the connecting rods (3652), turned to their pistons:

```diff
  858-1 - Engine housing.ldr
- 1 0 130 -106 0 1 0 0 0 1 0 0 0 1 3708.dat
- 1 7 30 -106 0 0 0 -1 0 1 0 1 0 0 3713.dat
- 1 7 230 -106 0 0 0 1 0 1 0 -1 0 0 3713.dat
+ 1 0 130 -111.355287 0 1 0 0 0 1 0 0 0 1 3708.dat
+ 1 7 30 -111.355287 0 0 0 -1 0 1 0 1 0 0 3713.dat
+ 1 7 230 -111.355287 0 0 0 1 0 1 0 -1 0 0 3713.dat
  858-1 - Crankshaft.ldr
- 1 0 50 0 -16 1 0 0 0 -0.544639 -0.838671 0 0.838671 -0.544639 858-1 - Piston 1.ldr
- 1 0 70 0 -16 1 0 0 0 0.793353 -0.608761 0 0.608761 0.793353 858-1 - Piston 2.ldr
- 1 0 110 0 16 -1 0 0 0 0.793353 -0.608761 0 -0.608761 -0.793353 858-1 - Piston 2.ldr
- 1 0 130 0 16 -1 0 0 0 -0.544639 -0.838671 0 -0.838671 0.544639 858-1 - Piston 1.ldr
- 1 0 170 0 -16 1 0 0 0 -0.544639 -0.838671 0 0.838671 -0.544639 858-1 - Piston 1.ldr
- 1 0 190 0 -16 1 0 0 0 0.793353 -0.608761 0 0.608761 0.793353 858-1 - Piston 2.ldr
+ 1 0 50 0 -16 1 0 0 0 -0.497025 -0.867736 0 0.867736 -0.497025 858-1 - Piston 1.ldr
+ 1 0 70 0 -16 1 0 0 0 0.790379 -0.612618 0 0.612618 0.790379 858-1 - Piston 2.ldr
+ 1 0 110 0 16 -1 0 0 0 0.790379 -0.612618 0 -0.612618 -0.790379 858-1 - Piston 2.ldr
+ 1 0 130 0 16 -1 0 0 0 -0.497025 -0.867736 0 -0.867736 0.497025 858-1 - Piston 1.ldr
+ 1 0 170 0 -16 1 0 0 0 -0.497025 -0.867736 0 0.867736 -0.497025 858-1 - Piston 1.ldr
+ 1 0 190 0 -16 1 0 0 0 0.790379 -0.612618 0 0.612618 0.790379 858-1 - Piston 2.ldr
  858-1 - Piston 1.ldr
- 1 7 0 0 60 0 0 1 -0.956305 0.292372 0 -0.292372 -0.956305 0 3652.dat
+ 1 7 0 0 60 0 0 1 -0.972593 0.232515 0 -0.232515 -0.972593 0 3652.dat
  858-1 - Piston 2.ldr
- 1 7 0 0 60 0 0 1 -0.999657 0.0261769 0 -0.0261769 -0.999657 0 3652.dat
+ 1 7 0 0 60 0 0 1 -0.987764 0.155958 0 -0.155958 -0.987764 0 3652.dat
```

## 8844-1 Helicopter

| | |
| --- | --- |
| Set | 8844 Helicopter, 1981 |
| Model | Helicopter, `8844-1.mpd` |
| Author | Allard van Efferen (rabbitdesign.nl) |
| Licence | CCAL 2.0 (CC BY 2.0) |
| Original | [LDraw Official Model Repository, set 1231](https://library.ldraw.org/omr/sets/1231) |
| In KineBrick | Used as published, not corrected: [`models/8844-Helicopter.mpd`](../models/8844-Helicopter.mpd) |

### The landing gear chain goes round a second copy of each of its gears (not corrected)

The chain that turns the rear leg from the front axle is placed link by link in `8844 - model.ldr`, and with it a 16 tooth gear (4019) and a 24 tooth gear (3648a) for it to go round. But those two gears are already in the model, on their axles: the 16 tooth gear on the front axle in `8844 - frame-1.ldr` (line 143), and the 24 tooth gear on the rear leg's axle in `8844 - landinggear-1.ldr` (line 180). Each pair overlaps: the second 16 tooth gear is 0.9 LDU from the first, and the second 24 tooth gear 5 LDU from the first, off the rear leg's axle and fixed to a beam instead. The chain goes round these second copies, so at its rear end it misses the gear that should turn the rear leg. KineBrick found this because it reads the chain round the front axle's gear but finds no wheel at its other end.

Lines 41 and 42, in `8844 - model.ldr`:

```
1 7 0 -46 60 0 0 1 0 1 0 -1 0 0 4019.dat
1 7 0 -66 175 0 0 1 0 1 0 -1 0 0 3648a.dat
```

A correction would take out both lines and lay the chain's rear end round the rear leg's own 24 tooth gear, 5 LDU from where it goes round now. KineBrick hasn't, since taking out two parts would renumber the parts its notes on the set's functions name.

## 8849-1 Tractor

| | |
| --- | --- |
| Set | 8849 Tractor, 1986 |
| Model | Tractor, `8849-1.mpd` |
| Author | Stefan Frenz [smf] |
| Licence | CCAL 2.0 (CC BY 2.0) |
| Original | [LDraw Official Model Repository, set 1108](https://library.ldraw.org/omr/sets/1108) |
| In KineBrick | Corrected, with a comment saying how: [`models/8849-Tractor.mpd`](../models/8849-Tractor.mpd) |

### The hitch's 24 tooth gear is off its shaft (corrected in KineBrick)

The 24 tooth gear (3648a) the worm turns, to raise the three-point hitch, is placed 2 LDU off the long shaft under the tractor that it should be on. It's turned 15 degrees, as the bevel gear at the shaft's other end is, but about a point 2 LDU from its middle rather than about its middle. So its hole misses the shaft, and it misses the worm too: they mesh at 40 LDU apart, their two pitch radii, and the gear is 42 LDU from the worm. KineBrick found this because the gear was attached to nothing and the worm didn't mesh. On the shaft, under the worm, it meshes, and the worm turns the shaft.

Line 103, in `8849 - Tractor.ldr`:

```diff
- 1 7 0.518 -12.068 60 0.966 -0.259 0 -0.259 -0.966 0 0 0 -1 3648a.dat
+ 1 7 0 -14 60 0.966 -0.259 0 -0.259 -0.966 0 0 0 -1 3648a.dat
```

## 8854-1 Power Crane

| | |
| --- | --- |
| Set | 8854 Power Crane, 1989 |
| Model | Power Crane, `8854-1.mpd` |
| Author | Stefan Frenz [smf] |
| Licence | CCAL 2.0 (CC BY 2.0) |
| Original | [LDraw Official Model Repository, set 1144](https://library.ldraw.org/omr/sets/1144) |
| In KineBrick | Used as published, not corrected: [`models/8854-Power Crane.mpd`](../models/8854-Power%20Crane.mpd) |

### The winch's string is drawn with nothing (not corrected)

The winch's string is an LDCad path, `8854 - Rope.ldr`, from the drum along the boom, over the pulley at its tip, round the hook's pulley and back up. But it names the part to draw it with as `8854 - ldcLQRopeSeg.dat`, as if it were one of the model's own subfiles, and there's no such part, in the file or in LDCad. So when LDCad generated the path it drew none of its 274 segments, and says so in the file:

```
0 // The path is approx 541.14 mm (1352.85) and exists out of 274 segments.
0 // warning: 274 of 274 segments are 'empty' please check your (path_skin) configuration.
```

So no viewer draws the string, and the hook hangs on nothing. Its 18 points are all bezier points, too, none a circle round the drum or a pulley, so even drawn it wouldn't say what it's wound on. KineBrick found this because it finds no string for the winch. Other files in the OMR (the 855 Mobile Crane's) name LDCad's own rope segment, `ldcLQRopeSeg.dat`, which LDCad draws into the file itself. A correction would name that and generate the path again in LDCad, with circles round the drum and the pulleys.

## 8880-1 Super Car

| | |
| --- | --- |
| Set | 8880 Super Car, 1994 |
| Model | Super Car, `8880-1.mpd` |
| Author | Orion Pobursky [OrionP] |
| Licence | CCAL 2.0 (CC BY 2.0) |
| Original | [LDraw Official Model Repository, set 908](https://library.ldraw.org/omr/sets/908) |
| In KineBrick | Corrected, each change with a comment saying how: [`models/8880-Super Car.mpd`](../models/8880-Super%20Car.mpd) |

KineBrick found all four because parts wouldn't attach or gears wouldn't mesh. The rear steering rack is corrected as the Technicopedia reconstruction of the set builds it (by Koyan, edited by Eric Albrecht, 2015, published on [Bricksafe](https://bricksafe.com)).

### An axle through no holes (corrected in KineBrick)

A Technic Axle 10 (3737) is placed where it passes through no holes. KineBrick moves it to where it carries the 8 tooth gear below it and fills the axle joiner.

Line 38, in `8880 - main.ldr`:

```diff
- 1 0 130 -64 30 0 0 -1 0 1 0 1 0 0 3737.dat
+ 1 0 -60 -14 -20 0 0 -1 0 1 0 1 0 0 3737.dat
```

### An assembly a stud too far along its slope (corrected in KineBrick)

The assembly `8880 - step17sub1.ldr` is placed one stud further along its slope than its mirror twin, `8880 - step17sub2.ldr` on the line before, so its pin is in no hole. Placed to mirror its twin, it fits.

Line 249, in `8880 - main.ldr`:

```diff
  1 0 220 -54 200 0 0 -1 0.168 0.986 0 0.986 -0.168 0 8880 - step17sub2.ldr
- 1 0 -220 -50.633 219.715 0 0 -1 0.168 0.986 0 0.986 -0.168 0 8880 - step17sub1.ldr
+ 1 0 -220 -54 200 0 0 -1 0.168 0.986 0 0.986 -0.168 0 8880 - step17sub1.ldr
```

### A long pin in no hole (corrected in KineBrick)

A Technic Pin Long with Friction and Slot (6558) is placed in no hole. Moved to mirror its twin on the line before, it fits; its orientation is kept.

Line 8170, in `8880 - step33.ldr`:

```diff
  1 0 90 0 365 -1 0 0 0 0.711 -0.703 0 -0.703 -0.711 6558.dat
- 1 0 -90 6.286 367.222 1 0 0 0 -0.111 0.994 0 -0.994 -0.111 6558.dat
+ 1 0 -90 0 365 1 0 0 0 -0.111 0.994 0 -0.994 -0.111 6558.dat
```

### The rear steering rack is a copy of the front one (corrected in KineBrick)

The rear steering rack is built by placing the front one's assembly, `8880 - step19.ldr`, again. But in the set the rear racks sit on a 1 x 8 plate (3460), which raises them a plate so the 8 tooth gears above them mesh; without it they don't, and the rear wheels don't steer. KineBrick's correction places a new assembly, `8880 - step19r.ldr`: the front one with the plate under the racks, the racks (3743) a plate higher, and the steering links (2739a) leaning down to the rear wheels' towballs. The rear wheels then steer the opposite way to the front ones, about half as far.

Line 297, in `8880 - main.ldr`:

```diff
- 1 8 0 -64 430 1 0 0 0 1 0 0 0 1 8880 - step19.ldr
+ 1 8 0 -64 430 1 0 0 0 1 0 0 0 1 8880 - step19r.ldr
```

The new assembly, against `8880 - step19.ldr` (line 912 on):

```diff
- 0 FILE 8880 - step19.ldr
- 0 step19
+ 0 FILE 8880 - step19r.ldr
+ 0 step19r
  0 Author: Orion Pobursky [OrionP]
  0 !LDRAW_ORG Model
  0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt
  0 !THEME Technic
- 0 Name: 8880 - step19.ldr
+ 0 Name: 8880 - step19r.ldr
  1 7 0 0 0 1 0 0 0 1 0 0 0 1 2719.dat
  1 7 90 0 0 0 -1 0 1 0 0 0 0 1 2736.dat
  1 7 -90 0 0 0 -1 0 1 0 0 0 0 1 2736.dat
  1 7 90 11 0 0 -1 0 0 0 -1 1 0 0 4265b.dat
  1 7 -90 11 0 0 -1 0 0 0 -1 1 0 0 4265b.dat
  0 STEP
+ 1 0 0 -8 0 1 0 0 0 1 0 0 0 1 3460.dat
- 1 7 -40 -8 0 1 0 0 0 1 0 0 0 1 3743.dat
- 1 7 40 -8 0 1 0 0 0 1 0 0 0 1 3743.dat
- 0 // Angle: 1.169
- 1 8 90 -12 0 0 0.02 1 0 1 -0.02 -1 0 0 2739a.dat
- 1 8 -90 -12 0 0 -0.02 -1 0 1 -0.02 1 0 0 2739a.dat
+ 1 7 -40 -16 0 1 0 0 0 1 0 0 0 1 3743.dat
+ 1 7 40 -16 0 1 0 0 0 1 0 0 0 1 3743.dat
+ 0 // Angle: -1.169
+ 1 8 90 -12 0 0 -0.0204 1 0 1 0.0204 -1 0 0 2739a.dat
+ 1 8 -90 -12 0 0 0.0204 -1 0 1 0.0204 1 0 0 2739a.dat
```

---

Line numbers are those of the OMR files as downloaded on 20 October 2026. KineBrick's copies name their subfiles without the spaces around the dash (`8880-step19.ldr`), but are otherwise line for line the same.

Written from the `errors` and `corrected_model` columns of [`models/technic-sets.csv`](../models/technic-sets.csv), as of 28 October 2026.
