# Errors found in LDraw models of LEGO Technic sets

[Kinebrick Play](https://github.com/erik-larsen/kinebrick) is a web LDraw viewer that works out a Technic model's mechanism from where its parts are placed, then lets you turn its gears and levers. To do that it has to decide, for every pin and axle, which hole it sits in, and for every pair of gears, whether they mesh. A part a few LDU out of place shows up as a part that attaches to nothing, or a gear train that doesn't turn.

This page lists the errors Kinebrick has found that way in the LDraw models it uses, so they can be corrected where the models are published. For each one it gives the exact lines, and the correction Kinebrick uses where it has one. Coordinates are in LDU (1 stud = 20 LDU).

| Set | Model | Author | Published on | Errors | Status |
| --- | --- | --- | --- | --- | --- |
| [852-1](#852-1-helicopter) | Helicopter (1977) | Allard van Efferen | LDraw OMR | 1 | Not corrected |
| [858-1](#858-1-auto-engines-inline-and-v-6-engines) | Auto Engines (1980), Inline and V-6 Engines | Takeshi Takahashi | LDraw forum | 2 | Corrected in Kinebrick |
| [8844-1](#8844-1-helicopter) | Helicopter (1981) | Allard van Efferen | LDraw OMR | 1 | Not corrected |
| [8848-1](#8848-1-power-truck) | Power Truck (1981) | Allard van Efferen | LDraw OMR | 1 | Not corrected |
| [8849-1](#8849-1-tractor) | Tractor (1986) | Stefan Frenz | LDraw OMR | 1 | Corrected in Kinebrick |
| [8854-1](#8854-1-power-crane) | Power Crane (1989) | Stefan Frenz | LDraw OMR | 1 | Not corrected |
| [8880-1](#8880-1-super-car) | Super Car (1994) | Orion Pobursky | LDraw OMR | 4 | Corrected in Kinebrick |
| [42093-1](#42093-1-chevrolet-corvette-zr1) | Chevrolet Corvette ZR1 (2019) | Philippe Hurbain | LDraw OMR | 1 | Not corrected |
| [10001-1](#10001-1-metroliner) | Metroliner (2001) | Zoltán Kéri | LDraw OMR | 3 | Corrected in Kinebrick |
| [950-1](#950-1-fork-lift) | Fork Lift (1979) | Merlijn Wissink | LDraw OMR | 1 | Corrected in Kinebrick |

## 852-1 Helicopter

| | |
| --- | --- |
| Set | 852 Helicopter, 1977 (954 Sky Copter in the US) |
| Model | Reconnaisance Helicopter, `852-1.mpd` (an Official Model) |
| Author | Allard van Efferen (rabbitdesign.nl) |
| Licence | CCAL 2.0 (CC BY 2.0) |
| Original | [LDraw Official Model Repository, set 1181](https://library.ldraw.org/omr/sets/1181) |
| In Kinebrick | Used as published, not corrected: [`models/852-Helicopter.mpd`](../models/852-Helicopter.mpd) |

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
| In Kinebrick | Both corrected: [`models/858-Auto Engines-Inline Engine.mpd`](../models/858-Auto%20Engines-Inline%20Engine.mpd) and [`models/858-Auto Engines-V-6 Engine.mpd`](../models/858-Auto%20Engines-V-6%20Engine.mpd) |

### Inline engine: the camshaft is 2 LDU from its hole (corrected in Kinebrick)

The camshaft is placed 62 LDU from the crankshaft instead of 60, 2 LDU off the hole it runs in. The 24 tooth gears (3648a) that drive it from the crankshaft mesh at 60 LDU, the sum of their pitch radii, so at 62 they miss and the camshaft doesn't turn. Kinebrick found this because the engine's gear train wouldn't mesh. Moving the camshaft back 2 LDU puts it in its hole, and its gears mesh.

In `858-1 - Engine housing.ldr`, the line placing `858-1 - Camshaft.ldr`, just after the crankshaft's:

```diff
  1 1 -100 -38 20 1 0 0 0 0 1 0 -1 0 858-1 - Crankshaft.ldr
- 1 1 20 -38 -42 1 0 0 0 0 1 0 -1 0 858-1 - Camshaft.ldr
+ 1 1 20 -38 -40 1 0 0 0 0 1 0 -1 0 858-1 - Camshaft.ldr
```

### V-6 engine: the cylinder banks hang a stud too far in (corrected in Kinebrick)

Each bank of three cylinders (`858-1 - Cylinder block 1.ldr` and `2`) hangs from 1 x 4 Technic bricks (3701), but is placed a stud too far in on them, flush with them. So the banks lean 102° apart instead of about 86°, the crankshaft's gears are built into both banks, and the pistons run into the taps at the cylinders' ends. Kinebrick found this because the crank wouldn't turn: about a sixteenth of a turn either way, parts ran into each other. With each bank a stud further out on those bricks (and the feet under them), nothing overlaps.

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
| In Kinebrick | Used as published, not corrected: [`models/8844-Helicopter.mpd`](../models/8844-Helicopter.mpd) |

### The landing gear chain goes round a second copy of each of its gears (not corrected)

The chain that turns the rear leg from the front axle is placed link by link in `8844 - model.ldr`, and with it a 16 tooth gear (4019) and a 24 tooth gear (3648a) for it to go round. But those two gears are already in the model, on their axles: the 16 tooth gear on the front axle in `8844 - frame-1.ldr` (line 143), and the 24 tooth gear on the rear leg's axle in `8844 - landinggear-1.ldr` (line 180). Each pair overlaps: the second 16 tooth gear is 0.9 LDU from the first, and the second 24 tooth gear 5 LDU from the first, off the rear leg's axle and fixed to a beam instead. The chain goes round these second copies, so at its rear end it misses the gear that should turn the rear leg. Kinebrick found this because it reads the chain round the front axle's gear but finds no wheel at its other end.

Lines 41 and 42, in `8844 - model.ldr`:

```
1 7 0 -46 60 0 0 1 0 1 0 -1 0 0 4019.dat
1 7 0 -66 175 0 0 1 0 1 0 -1 0 0 3648a.dat
```

A correction would take out both lines and lay the chain's rear end round the rear leg's own 24 tooth gear, 5 LDU from where it goes round now. Kinebrick hasn't, since taking out two parts would renumber the parts its notes on the set's functions name. It doesn't need to: a chain placed link by link may be off its gear's axis by a tooth's whole depth (5.6 LDU, see CHAIN_REACH in src/inference/loops.ts), so Kinebrick reads the chain's rear end on the rear leg's own gear, and the landing gear works.

## 8848-1 Power Truck

| | |
| --- | --- |
| Set | 8848 Power Truck, 1981 |
| Model | Power Truck, `8848-1.mpd` |
| Author | Allard van Efferen (rabbitdesign.nl) |
| Licence | CCAL 2.0 (CC BY 2.0) |
| Original | [LDraw Official Model Repository, set 1197](https://library.ldraw.org/omr/sets/1197) |
| In Kinebrick | Used as published, not corrected: [`models/8848-Power Truck.mpd`](../models/8848-Power%20Truck.mpd) |

### One of the tipper body's struts is placed 0.36 LDU off the other (not corrected)

The two struts that lift the tipper body, each a rack pushed by an 8 tooth gear with a toothed toggle joint (4273a) at its top, are the same subfile built twice, `8848 - tipper4-l.ldr` and `8848 - tipper4-r.ldr`, and placed side by side, 100 LDU apart, at the same angle. But they aren't quite in line: the right one is 0.31 LDU off the left in y and 0.18 LDU off in z. So where the left strut's toggle joint fits on the axle under the body, 0.95 LDU from its line, the right one's is 1.30 LDU from it, too far to be on it. Kinebrick found this because the right strut's toggle joint was attached to nothing at its top, while the left one's turned on the axle. Kinebrick now reads both toggle joints as locked to the toothed half bushes beside them on that axle, as in the real set, so it moves the same either way, and the file is used as published.

Lines 78 and 79, in `8848 - main.ldr`. A correction would place the right strut as the left one is, 100 LDU along:

```diff
  1 71 49 -61.049 -62.023 1 0 0 0 0.848048 -0.529919 0 0.529919 0.848048 8848 - tipper4-l.ldr
- 1 71 -51 -61.358 -62.202 1 0 0 0 0.848048 -0.529919 0 0.529919 0.848048 8848 - tipper4-r.ldr
+ 1 71 -51 -61.049 -62.023 1 0 0 0 0.848048 -0.529919 0 0.529919 0.848048 8848 - tipper4-r.ldr
```

## 8849-1 Tractor

| | |
| --- | --- |
| Set | 8849 Tractor, 1986 |
| Model | Tractor, `8849-1.mpd` |
| Author | Stefan Frenz [smf] |
| Licence | CCAL 2.0 (CC BY 2.0) |
| Original | [LDraw Official Model Repository, set 1108](https://library.ldraw.org/omr/sets/1108) |
| In Kinebrick | Corrected, with a comment saying how: [`models/8849-Tractor.mpd`](../models/8849-Tractor.mpd) |

### The hitch's 24 tooth gear is off its shaft (corrected in Kinebrick)

The 24 tooth gear (3648a) the worm turns, to raise the three-point hitch, is placed 2 LDU off the long shaft under the tractor that it should be on. It's turned 15 degrees, as the bevel gear at the shaft's other end is, but about a point 2 LDU from its middle rather than about its middle. So its hole misses the shaft, and it misses the worm too: they mesh at 40 LDU apart, their two pitch radii, and the gear is 42 LDU from the worm. Kinebrick found this because the gear was attached to nothing and the worm didn't mesh. On the shaft, under the worm, it meshes, and the worm turns the shaft.

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
| In Kinebrick | Used as published, not corrected: [`models/8854-Power Crane.mpd`](../models/8854-Power%20Crane.mpd) |

### The winch's string is drawn with nothing (not corrected)

The winch's string is an LDCad path, `8854 - Rope.ldr`, from the drum along the boom, over the pulley at its tip, round the hook's pulley and back up. But it names the part to draw it with as `8854 - ldcLQRopeSeg.dat`, as if it were one of the model's own subfiles, and there's no such part, in the file or in LDCad. So when LDCad generated the path it drew none of its 274 segments, and says so in the file:

```
0 // The path is approx 541.14 mm (1352.85) and exists out of 274 segments.
0 // warning: 274 of 274 segments are 'empty' please check your (path_skin) configuration.
```

So no viewer draws the string, and the hook hangs on nothing. Its 18 points are all bezier points, too, none a circle round the drum or a pulley, so even drawn it wouldn't say what it's wound on. Kinebrick found this because it finds no string for the winch. Other files in the OMR (the 855 Mobile Crane's) name LDCad's own rope segment, `ldcLQRopeSeg.dat`, which LDCad draws into the file itself. A correction would name that and generate the path again in LDCad, with circles round the drum and the pulleys.

## 8880-1 Super Car

| | |
| --- | --- |
| Set | 8880 Super Car, 1994 |
| Model | Super Car, `8880-1.mpd` |
| Author | Orion Pobursky [OrionP] |
| Licence | CCAL 2.0 (CC BY 2.0) |
| Original | [LDraw Official Model Repository, set 908](https://library.ldraw.org/omr/sets/908) |
| In Kinebrick | Corrected, each change with a comment saying how: [`models/8880-Super Car.mpd`](../models/8880-Super%20Car.mpd) |

Kinebrick found all four because parts wouldn't attach or gears wouldn't mesh. The rear steering rack is corrected as the Technicopedia reconstruction of the set builds it (by Koyan, edited by Eric Albrecht, 2015, published on [Bricksafe](https://bricksafe.com)).

### An axle through no holes (corrected in Kinebrick)

A Technic Axle 10 (3737) is placed where it passes through no holes. Kinebrick moves it to where it carries the 8 tooth gear below it and fills the axle joiner.

Line 38, in `8880 - main.ldr`:

```diff
- 1 0 130 -64 30 0 0 -1 0 1 0 1 0 0 3737.dat
+ 1 0 -60 -14 -20 0 0 -1 0 1 0 1 0 0 3737.dat
```

### An assembly a stud too far along its slope (corrected in Kinebrick)

The assembly `8880 - step17sub1.ldr` is placed one stud further along its slope than its mirror twin, `8880 - step17sub2.ldr` on the line before, so its pin is in no hole. Placed to mirror its twin, it fits.

Line 249, in `8880 - main.ldr`:

```diff
  1 0 220 -54 200 0 0 -1 0.168 0.986 0 0.986 -0.168 0 8880 - step17sub2.ldr
- 1 0 -220 -50.633 219.715 0 0 -1 0.168 0.986 0 0.986 -0.168 0 8880 - step17sub1.ldr
+ 1 0 -220 -54 200 0 0 -1 0.168 0.986 0 0.986 -0.168 0 8880 - step17sub1.ldr
```

### A long pin in no hole (corrected in Kinebrick)

A Technic Pin Long with Friction and Slot (6558) is placed in no hole. Moved to mirror its twin on the line before, it fits; its orientation is kept.

Line 8170, in `8880 - step33.ldr`:

```diff
  1 0 90 0 365 -1 0 0 0 0.711 -0.703 0 -0.703 -0.711 6558.dat
- 1 0 -90 6.286 367.222 1 0 0 0 -0.111 0.994 0 -0.994 -0.111 6558.dat
+ 1 0 -90 0 365 1 0 0 0 -0.111 0.994 0 -0.994 -0.111 6558.dat
```

### The rear steering rack is a copy of the front one (corrected in Kinebrick)

The rear steering rack is built by placing the front one's assembly, `8880 - step19.ldr`, again. But in the set the rear racks sit on a 1 x 8 plate (3460), which raises them a plate so the 8 tooth gears above them mesh; without it they don't, and the rear wheels don't steer. Kinebrick's correction places a new assembly, `8880 - step19r.ldr`: the front one with the plate under the racks, the racks (3743) a plate higher, and the steering links (2739a) leaning down to the rear wheels' towballs. The rear wheels then steer the opposite way to the front ones, about half as far.

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

## 42093-1 Chevrolet Corvette ZR1

| | |
| --- | --- |
| Set | 42093 Chevrolet Corvette ZR1, 2019 |
| Model | Chevrolet Corvette ZR1, `42093-1.mpd` |
| Author | Philippe Hurbain [Philo] |
| Licence | CCAL 2.0 (CC BY 2.0) |
| Original | [LDraw Official Model Repository, set 927](https://library.ldraw.org/omr/sets/927) |
| In Kinebrick | Used as published, not corrected, read from the OMR's file |

### The shaft that drives the engine has a 12 tooth gear where the set has an 8 tooth one (not corrected)

Pushed along, the car turns its V8: the differential turns a shaft forward, and an 8 tooth gear (10928) at the shaft's front end turns the 8 tooth gear on the crankshaft, a stud above it. In the model the shaft's gear is a 12 tooth double bevel gear (32270) instead. Two 8 tooth gears mesh 20 LDU apart, the sum of their pitch radii, but a 12 tooth gear and an 8 tooth one need 25, so at 20 the 12 tooth gear overlaps the crankshaft's gear by 5 LDU rather than meshing with it. The instructions put an 8 tooth gear on that shaft (step 2), and their parts list has two 8 tooth gears (element 6012451) and three 12 tooth double bevel gears (element 4177431), where the model has one and four. Kinebrick found this because pushing the car turned the differential and the shaft, but not the engine. With the 8 tooth gear in its place, the shaft turns the crankshaft.

Line 3115, in `42093 - corvette.ldr`. A correction would put the 8 tooth gear in its place, in dark bluish grey like the crankshaft's:

```diff
- 1 0 0 0 -80 0 1 0 1 0 0 0 0 -1 32270.dat
+ 1 72 0 0 -80 0 1 0 1 0 0 0 0 -1 10928.dat
```

---

Line numbers are those of the OMR files as downloaded on 20 October 2026. Kinebrick's copies name their subfiles without the spaces around the dash (`8880-step19.ldr`), but are otherwise line for line the same.

Written from the `errors` and `corrected_model` columns of [`models/technic-sets.csv`](../models/technic-sets.csv), as of 31 October 2026.

## 10001-1 Metroliner

| | |
| --- | --- |
| Set | 10001 Metroliner, 2001 (a re-release of the 4558 Metroliner of 1991) |
| Model | `10001-1.mpd` (an Official Model): an oval of 9V track, a platform and the three cars |
| Author | Zoltán Kéri [Zoltank82]; OMR version by Robert Paciorek [bercik] |
| Licence | CCAL 2.0 |
| Original | [LDraw Official Model Repository](https://library.ldraw.org/omr) |
| In Kinebrick | Corrected: [`models/10001-Metroliner.mpd`](../models/10001-Metroliner.mpd) |

### Rotations with their cosines rounded to 1 (corrected)

The main file turns the trains and the eight curved track pieces at 11.25 degrees by matrices whose cosine is written as 1 while the sine is exact, such as train 1's:

```
1 16 560 0 44 1 0 0.259 0 1 0 -0.259 0 1 10001 - TRAIN 1.LDR
```

A matrix like that isn't a rotation: it stretches what it places by 3.4% (2% for the curves). Within the stretched trains, parts a stud or more apart no longer meet: a bogie plate's pin misses its hole in the train base by 1 LDU, and the couplings' pins by more. Kinebrick writes these lines again with the nearest rotation on import (`0 !KINEBRICK SQUARE`, see [ARCHITECTURE.md](../ARCHITECTURE.md#trains)): `0.968058 0 0.250727 0 1 0 -0.250727 0 0.968058` for train 1.

### The couplings sit off their pins and hinges (corrected)

In every car the coupling holder (2920) stands 1 to 3 LDU from the hole in its buffer beam (4022) that its pin turns in, and the magnet casing (2959) 1 to 3 LDU from the holder's hinge fingers, for instance train 1's:

```
1 0 570 -54 0 0 0 -1 0 1 0 1 0 0 2920.DAT
1 0 604 -50 0 0 0 -1 0 1 0 1 0 0 2959.DAT
1 0 604 -50 0 0 0 -1 0 1 0 1 0 0 70023.DAT
```

where the casing and magnet belong at x = 602, 32 LDU from the holder. Kinebrick's copy moves each holder onto its pin and each casing and magnet onto its holder's fingers (by up to 5 LDU), so the couplings connect.

### The dining car's tap stands in its slope (corrected)

The tap in the second car (a 3496 base with a 3278 spout) is placed with its base 8 LDU down inside the inverted slope it stands on, so its anti-studs miss the slope's studs:

```
1 15 110 -134 20 0 0 -1 0 1 0 1 0 0 3496.DAT
1 7 110 -134 20 0 0 -1 0 1 0 1 0 0 3278.DAT
```

Kinebrick's copy has both at y = -142, the base on the studs.

## 950-1 Fork Lift

| | |
| --- | --- |
| Set | 950 Fork Lift, 1979 |
| Model | Fork-Lift Truck, `950-1.mpd` |
| Author | Merlijn Wissink [legolijntje] |
| Licence | CCAL 2.0 (CC BY 2.0) |
| Original | [LDraw Official Model Repository, set 92](https://library.ldraw.org/omr/sets/92) |
| In Kinebrick | Corrected, the change with a comment saying how: [`models/950-Fork Lift.mpd`](../models/950-Fork%20Lift.mpd) |

### The lower axle and its gear are missing (corrected in Kinebrick)

Step 13 of the instructions adds a second Technic Axle 10 (3737) through the mast's upright beams, two holes below the axle at the top of the mast, with an 8 tooth gear (3647) that meshes the 24 tooth gear on the top axle, and puts the handwheel on its other end. The file leaves out the lower axle and its gear, and has the handwheel (3736) and its pin (3673) on the top axle, so its 24 tooth gear meshes with nothing:

```
1 7 -90 -238 -100 0 0 1 0 -1 0 1 0 0 3736.dat
1 7 -100 -238 -130 -1 0 0 0 1 0 0 0 -1 3673.dat
```

Kinebrick's copy moves the handwheel and its pin down 40 LDU onto the lower axle, and adds the axle and its gear at the end of the main model:

```
1 7 -90 -198 -100 0 0 1 0 -1 0 1 0 0 3736.dat
1 7 -100 -198 -130 -1 0 0 0 1 0 0 0 -1 3673.dat
1 0 0 -198 -100 -1 0 0 0 1 0 0 0 -1 3737.dat
1 7 90 -198 -100 0 0 1 0 1 0 -1 0 0 3647.dat
```

The handwheel then turns the top axle a third as fast, through the 8 and 24 tooth gears. The 850 Fork Lift's model has the same lines and the same omission.

<!-- errata: from data/errata/*.json by npm run errata, not by hand -->

## Corrections Kinebrick applies to the OMR files

The OMR's model files aren't Kinebrick's to edit, so Kinebrick reads a set's file with these corrections (data/errata/<set>.json), in the viewer, the function check and every script alike. A file you open yourself is never corrected. An entry is applied once Erik has signed it off; a proposed one only when asked for (the check's `--proposed`, the viewer's `option=proposed`), to see the set before and after. No part number moves: a moved part keeps its number, a removed part keeps its number too, and an added part is numbered after the model's last part.

| Set | Entry | What it does | Status |
| --- | --- | --- | --- |
| [850-1](#850-1-handwheel-down) | handwheel-down | moves `3736.dat` to -90 -198 -100 | Signed off by Erik, 2026-11-14 |
| [850-1](#850-1-handwheel-pin-down) | handwheel-pin-down | moves `3673.dat` to -100 -198 -130 | Signed off by Erik, 2026-11-14 |
| [850-1](#850-1-lower-axle-and-gear) | lower-axle-and-gear | adds 2 lines to the main model | Signed off by Erik, 2026-11-14 |
| [8110-1](#8110-1-crane-shaft-universal-joint-whole) | crane-shaft-universal-joint-whole | adds 2 lines to the main model | Signed off by Erik, 2026-11-19 |
| [8110-1](#8110-1-crane-shaft-ball-in-its-cup) | crane-shaft-ball-in-its-cup | moves `32494.dat` to 20 -60 -460 | Signed off by Erik, 2026-11-19 |
| [8258-1](#8258-1-front-drive-gear-4-high) | front-drive-gear-4-high | moves `8258 - m-1k'ka.ldr` (in `8258 - m-1k'k.ldr`) to 20 -20 0 | Signed off by Erik, 2026-11-14 |
| [8258-1](#8258-1-boom-actuator-u-joint-on-the-turntable-axle) | boom-actuator-u-joint-on-the-turntable-axle | moves `62520.dat` (in `8258 - m-1g''''.ldr`) to 0 0 -50, turned | Signed off by Erik, 2026-11-17 |
| [8832-1](#8832-1-roll-bar-brace-right-axle-through-its-toggles) | roll-bar-brace-right-axle-through-its-toggles | moves `3706.dat` to 70 -51.125 105.603, turned | Signed off by Erik, 2026-11-16 |
| [8832-1](#8832-1-roll-bar-brace-left-axle-through-its-toggles) | roll-bar-brace-left-axle-through-its-toggles | moves `3706.dat` to -70 -51.125 105.603, turned | Signed off by Erik, 2026-11-16 |
| [8838-1](#8838-1-axle-with-gears) | axle-with-gears | adds 1 line to the main model | Signed off by Erik, 2026-11-14 |
| [8840-1](#8840-1-v2-rod-p118-to-its-piston) | v2-rod-p118-to-its-piston | moves `2852.dat` (in `8840 - step4b.ldr`) to 0 10 0, turned | Signed off by Erik, 2026-11-17 |
| [8840-1](#8840-1-v2-piston-p120-on-its-rod) | v2-piston-p120-on-its-rod | moves `2851.dat` (in `8840 - step4b.ldr`) to 0 -7.586 35.907, turned | Signed off by Erik, 2026-11-17 |
| [8840-1](#8840-1-v2-rod-p117-to-its-piston) | v2-rod-p117-to-its-piston | moves `2852.dat` (in `8840 - step4b.ldr`) to 0 10 0, turned | Signed off by Erik, 2026-11-17 |
| [8840-1](#8840-1-v2-piston-p121-on-its-rod) | v2-piston-p121-on-its-rod | moves `2851.dat` (in `8840 - step4b.ldr`) to 0 -8.044 -35.711, turned | Signed off by Erik, 2026-11-17 |
| [8868-1](#8868-1-rod-line-1368-on-its-piston) | rod-line-1368-on-its-piston | moves `2852.dat` (in `8868-1 - Motorblock.ldr`) to 10 10 30, turned | Signed off by Erik, 2026-11-18 |
| [8868-1](#8868-1-piston-line-1384-on-its-rod) | piston-line-1384-on-its-rod | moves `2851.dat` (in `8868-1 - Motorblock.ldr`) to -25.908 -7.624 30 | Signed off by Erik, 2026-11-18 |
| [8868-1](#8868-1-rod-line-1372-on-its-piston) | rod-line-1372-on-its-piston | moves `2852.dat` (in `8868-1 - Motorblock.ldr`) to -10 10 70, turned | Signed off by Erik, 2026-11-18 |
| [8868-1](#8868-1-piston-line-1382-on-its-rod) | piston-line-1382-on-its-rod | moves `2851.dat` (in `8868-1 - Motorblock.ldr`) to 25.908 -7.624 70 | Signed off by Erik, 2026-11-18 |
| [8868-1](#8868-1-rod-line-1373-on-its-piston) | rod-line-1373-on-its-piston | moves `2852.dat` (in `8868-1 - Motorblock.ldr`) to -10 10 70, turned | Signed off by Erik, 2026-11-18 |
| [8868-1](#8868-1-piston-line-1385-on-its-rod) | piston-line-1385-on-its-rod | moves `2851.dat` (in `8868-1 - Motorblock.ldr`) to -37.413 -19.129 70 | Signed off by Erik, 2026-11-18 |
| [8868-1](#8868-1-rod-line-1378-on-its-piston) | rod-line-1378-on-its-piston | moves `2852.dat` (in `8868-1 - Motorblock.ldr`) to 10 10 110, turned | Signed off by Erik, 2026-11-18 |
| [8868-1](#8868-1-piston-line-1386-on-its-rod) | piston-line-1386-on-its-rod | moves `2851.dat` (in `8868-1 - Motorblock.ldr`) to -25.908 -7.624 110 | Signed off by Erik, 2026-11-18 |
| [9396-1](#9396-1-left-inner-main-wheel) | left-inner-main-wheel | adds 3 lines to the main model | Signed off by Erik, 2026-11-14 |
| [9397-1](#9397-1-plough-link-beam-level) | plough-link-beam-level | moves `32316.dat` (in `9397 - 9397B.ldr`) to 0 -83.3547 -529.8725, turned | Signed off by Erik, 2026-11-18 |
| [9397-1](#9397-1-plough-link-pin-in-its-hole) | plough-link-pin-in-its-hole | moves `32556.dat` (in `9397 - 9397B.ldr`) to 0 -43.3514 -529.886 | Signed off by Erik, 2026-11-18 |
| [41999-1](#41999-1-shock-absorbers-the-file-lacks) | shock-absorbers-the-file-lacks | adds 16 lines to the main model | Signed off by Erik, 2026-11-15 |
| [42000-1](#42000-1-right-rear-driver-in-its-hub) | right-rear-driver-in-its-hub | moves `32494.dat` (in `42000 - 42000.L3B.ldr`) to 220 -60 640 | Signed off by Erik, 2026-11-18 |
| [42000-1](#42000-1-left-rear-driver-in-its-hub) | left-rear-driver-in-its-hub | moves `32494.dat` (in `42000 - 42000.L3B.ldr`) to -220 -60 640 | Signed off by Erik, 2026-11-18 |
| [42000-1](#42000-1-left-front-rocker-p559) | left-front-rocker-p559 | moves `32056.dat` (in `42000 - 42000.L3B.ldr`) to -60 -85 -260, turned | Signed off by Erik, 2026-11-18 |
| [42000-1](#42000-1-left-front-rocker-p560) | left-front-rocker-p560 | moves `2736.dat` (in `42000 - 42000.L3B.ldr`) to -53.8116 -90 -299.5184, turned | Signed off by Erik, 2026-11-18 |
| [42000-1](#42000-1-left-front-rocker-p561) | left-front-rocker-p561 | moves `32056.dat` (in `42000 - 42000.L3B.ldr`) to -60 -75 -260, turned | Signed off by Erik, 2026-11-18 |
| [42000-1](#42000-1-left-front-rocker-p562) | left-front-rocker-p562 | moves `2780.dat` (in `42000 - 42000.L3B.ldr`) to -40.2408 -90 -256.9058, turned | Signed off by Erik, 2026-11-18 |
| [42000-1](#42000-1-left-front-rocker-p563) | left-front-rocker-p563 | moves `32523.dat` (in `42000 - 42000.L3B.ldr`) to -40.2408 -100 -256.9058, turned | Signed off by Erik, 2026-11-18 |
| [42000-1](#42000-1-left-front-rocker-p564) | left-front-rocker-p564 | moves `87083.dat` (in `42000 - 42000.L3B.ldr`) to -20.4816 -90 -253.8116, turned | Signed off by Erik, 2026-11-18 |
| [42000-1](#42000-1-left-front-rocker-p568) | left-front-rocker-p568 | moves `3713.dat` (in `42000 - 42000.L3B.ldr`) to -20.4816 -60 -253.8116, turned | Signed off by Erik, 2026-11-18 |
| [42000-1](#42000-1-left-front-rocker-p569) | left-front-rocker-p569 | moves `87083.dat` (in `42000 - 42000.L3B.ldr`) to -60 -90 -260, turned | Signed off by Erik, 2026-11-18 |
| [42000-1](#42000-1-left-front-pushrod-p571) | left-front-pushrod-p571 | moves `32293.dat` (in `42000 - 42000.L3B.ldr`) to -53.8116 -102 -299.5184, turned | Signed off by Erik, 2026-11-18 |
| [42000-1](#42000-1-left-front-shock-cylinder-p566) | left-front-shock-cylinder-p566 | moves `4255.dat` (in `42000 - 42000.L3B.ldr`) to -20.4816 -120 -253.8116, turned | Signed off by Erik, 2026-11-18 |
| [42000-1](#42000-1-right-front-rocker-p573) | right-front-rocker-p573 | moves `32056.dat` (in `42000 - 42000.L3B.ldr`) to 60 -85 -260, turned | Signed off by Erik, 2026-11-18 |
| [42000-1](#42000-1-right-front-rocker-p574) | right-front-rocker-p574 | moves `2736.dat` (in `42000 - 42000.L3B.ldr`) to 53.8116 -90 -299.5184, turned | Signed off by Erik, 2026-11-18 |
| [42000-1](#42000-1-right-front-rocker-p575) | right-front-rocker-p575 | moves `32056.dat` (in `42000 - 42000.L3B.ldr`) to 60 -75 -260, turned | Signed off by Erik, 2026-11-18 |
| [42000-1](#42000-1-right-front-rocker-p576) | right-front-rocker-p576 | moves `2780.dat` (in `42000 - 42000.L3B.ldr`) to 40.2408 -90 -256.9058, turned | Signed off by Erik, 2026-11-18 |
| [42000-1](#42000-1-right-front-rocker-p577) | right-front-rocker-p577 | moves `3713.dat` (in `42000 - 42000.L3B.ldr`) to 20.4816 -60 -253.8116, turned | Signed off by Erik, 2026-11-18 |
| [42000-1](#42000-1-right-front-rocker-p578) | right-front-rocker-p578 | moves `87083.dat` (in `42000 - 42000.L3B.ldr`) to 20.4816 -90 -253.8116, turned | Signed off by Erik, 2026-11-18 |
| [42000-1](#42000-1-right-front-rocker-p579) | right-front-rocker-p579 | moves `87083.dat` (in `42000 - 42000.L3B.ldr`) to 60 -90 -260, turned | Signed off by Erik, 2026-11-18 |
| [42000-1](#42000-1-right-front-rocker-p581) | right-front-rocker-p581 | moves `32523.dat` (in `42000 - 42000.L3B.ldr`) to 40.2408 -100 -256.9058, turned | Signed off by Erik, 2026-11-18 |
| [42000-1](#42000-1-right-front-pushrod-p580) | right-front-pushrod-p580 | moves `32293.dat` (in `42000 - 42000.L3B.ldr`) to 53.8116 -102 -299.5184, turned | Signed off by Erik, 2026-11-18 |
| [42000-1](#42000-1-right-front-shock-cylinder-p582) | right-front-shock-cylinder-p582 | moves `4255.dat` (in `42000 - 42000.L3B.ldr`) to 20.4816 -120 -253.8116, turned | Signed off by Erik, 2026-11-18 |
| [42038-1](#42038-1-rear-left-tread-on-its-unit) | rear-left-tread-on-its-unit | moves `42038 - technicChainTread38Closed-1.ldr` to -165 161.666 300.4165 | Signed off by Erik, 2026-11-18 |
| [42038-1](#42038-1-rear-right-tread-on-its-unit) | rear-right-tread-on-its-unit | moves `42038 - technicChainTread38Closed-1.ldr` to 165 161.666 300.4155 | Signed off by Erik, 2026-11-18 |
| [42040-1](#42040-1-seats-on-their-pins) | seats-on-their-pins | moves `42040 - seats.ldr` to -160 -211.6552 -70.6371 | Signed off by Erik, 2026-11-15 |
| [42042-1](#42042-1-left-tread-on-its-wheels) | left-tread-on-its-wheels | moves `42042 - technicChainTread38Closed-1.ldr` to -210 -70 60 | Signed off by Erik, 2026-11-18 |
| [42050-1](#42050-1-wheelie-actuator-bevel-on-its-axis) | wheelie-actuator-bevel-on-its-axis | moves `32270.dat` (in `42050 - linact.ldr`) to -280.431 -6.163 0, turned | Signed off by Erik, 2026-11-17 |
| [42052-1](#42052-1-no-third-link-pin-p586) | no-third-link-pin-p586 | removes `3673.dat` | Signed off by Erik, 2026-11-15 |
| [42064-1](#42064-1-hatch-20-high) | hatch-20-high | moves `42064 - hatch.ldr` (in `42064 - ship.ldr`) to 0 -110 -380 | Signed off by Erik, 2026-11-14 |
| [42070-1](#42070-1-rear-differential-ring-faces-back) | rear-differential-ring-faces-back | moves `62821.dat` (in `42070 - axle3.ldr`) to 0 0 0, turned | Signed off by Erik, 2026-11-16 |
| [42070-1](#42070-1-rear-differential-spider-gear-with-its-casing) | rear-differential-spider-gear-with-its-casing | moves `6589.dat` (in `42070 - axle3.ldr`) to 0 0 -17, turned | Signed off by Erik, 2026-11-16 |
| [42077-1](#42077-1-rear-half-shaft-inner-ball-level) | rear-half-shaft-inner-ball-level | moves `32494.dat` (in `42077 - rearaxle.ldr`) to -60 0 0, turned | Signed off by Erik, 2026-11-17 |
| [42078-1](#42078-1-rear-crane-actuator-axle-to-its-connectors) | rear-crane-actuator-axle-to-its-connectors | moves `60485.dat` (in `42078 - craneactu.ldr` as placed in `42078 - crane1.ldr` only) to -0.012 -20 49.983 | Signed off by Erik, 2026-11-17 |
| [42078-1](#42078-1-door-2-has-no-13L-beam) | door-2-has-no-13L-beam | removes `41239.dat` (in `42078 - containerdoor2.ldr`) | Signed off by Erik, 2026-11-19 |
| [42078-1](#42078-1-door-2-has-no-blue-pin-at-y-minus-280) | door-2-has-no-blue-pin-at-y-minus-280 | removes `6558.dat` (in `42078 - containerdoor2.ldr`) | Signed off by Erik, 2026-11-19 |
| [42078-1](#42078-1-door-2-has-no-blue-pin-at-y-minus-400) | door-2-has-no-blue-pin-at-y-minus-400 | removes `6558.dat` (in `42078 - containerdoor2.ldr`) | Signed off by Erik, 2026-11-19 |
| [42078-1](#42078-1-door-2-black-pins-for-its-11L-beam) | door-2-black-pins-for-its-11L-beam | adds 2 lines to the main model | Signed off by Erik, 2026-11-19 |
| [42083-1](#42083-1-speed-key-in-its-hole) | speed-key-in-its-hole | moves `42083 - startkey.ldr` to 250 -123 420, turned | Proposed, not applied until signed off |
| [42093-1](#42093-1-no-12-tooth-on-the-engine-shaft) | no-12-tooth-on-the-engine-shaft | removes `32270.dat` (in `42093 - corvette.ldr`) | Signed off by Erik, 2026-11-15 |
| [42093-1](#42093-1-8-tooth-on-the-engine-shaft) | 8-tooth-on-the-engine-shaft | adds 1 line to the main model | Signed off by Erik, 2026-11-15 |
| [42096-1](#42096-1-rear-half-shafts-outer-balls-in-their-hubs-left) | rear-half-shafts-outer-balls-in-their-hubs-left | moves `32494.dat` (in `42096 - porsche.ldr`) to -155.112 30.881 0 | Signed off by Erik, 2026-11-17 |
| [42096-1](#42096-1-rear-half-shafts-outer-balls-in-their-hubs-right) | rear-half-shafts-outer-balls-in-their-hubs-right | moves `32494.dat` (in `42096 - porsche.ldr`) to 155.112 30.881 0 | Signed off by Erik, 2026-11-17 |
| [42099-1](#42099-1-rear-side-gear-p45-in-line) | rear-side-gear-p45-in-line | moves `6589.dat` (in `42099 - rearaxle.ldr`) to 17 -40 0 | Signed off by Erik, 2026-11-15 |
| [42099-1](#42099-1-rear-side-gear-p46-in-line) | rear-side-gear-p46-in-line | moves `6589.dat` (in `42099 - rearaxle.ldr`) to -17 -40 0 | Signed off by Erik, 2026-11-15 |
| [42109-1](#42109-1-no-pin-p381) | no-pin-p381 | removes `2780.dat` (in `42109 - car.ldr`) | Signed off by Erik, 2026-11-14 |
| [42109-1](#42109-1-no-pin-p382) | no-pin-p382 | removes `2780.dat` (in `42109 - car.ldr`) | Signed off by Erik, 2026-11-14 |
| [42109-1](#42109-1-no-beam-p383) | no-beam-p383 | removes `32526.dat` (in `42109 - car.ldr`) | Signed off by Erik, 2026-11-14 |
| [42110-1](#42110-1-front-driver-at-z-minus-177-on-its-hub-axis) | front-driver-at-z-minus-177-on-its-hub-axis | moves `32494.dat` (in `42110 - frontaxle.ldr`) to -40 -17.188 -177.81 | Signed off by Erik, 2026-11-18 |
| [42110-1](#42110-1-front-driver-at-z-plus-177-on-its-hub-axis) | front-driver-at-z-plus-177-on-its-hub-axis | moves `32494.dat` (in `42110 - frontaxle.ldr`) to -40 -17.188 177.81 | Signed off by Erik, 2026-11-18 |
| [42111-1](#42111-1-rear-shock-cylinder-on-the-rods-axis) | rear-shock-cylinder-on-the-rods-axis | moves `4255.dat` (in `42111 - rear-shock-assy.ldr`) to 0 9.819 0 | Signed off by Erik, 2026-11-15 |
| [42112-1](#42112-1-drive-shaft-bevel-on-the-shaft) | drive-shaft-bevel-on-the-shaft | moves `18575.dat` to 20 0 184 | Signed off by Erik, 2026-11-17 |

### 850-1: handwheel-down

Signed off by Erik, 2026-11-14.

The instructions' step 13 (850-1 scans, 008) add a second axle 10 through the mast's upright beams, two holes below the top axle, with an 8 tooth gear meshing the 24 tooth gear p185, and the handwheel on its other end (docs/audits, the build-step answers: high for the axle and gear, medium for the handwheel's end). The file leaves out the axle and gear and has the handwheel on the top axle, as the 950's file does; Kinebrick's copy of the 950 is corrected the same way (docs/ldraw-errata.md).

In the main model (p188 3736), the line

```
1 7 -90 -238 -100 0 0 1 0 -1 0 1 0 0 3736.dat
```

is read with its part at -90 -198 -100.

### 850-1: handwheel-pin-down

Signed off by Erik, 2026-11-14.

The instructions' step 13 (850-1 scans, 008) add a second axle 10 through the mast's upright beams, two holes below the top axle, with an 8 tooth gear meshing the 24 tooth gear p185, and the handwheel on its other end (docs/audits, the build-step answers: high for the axle and gear, medium for the handwheel's end). The file leaves out the axle and gear and has the handwheel on the top axle, as the 950's file does; Kinebrick's copy of the 950 is corrected the same way (docs/ldraw-errata.md).

In the main model (p189 3673), the line

```
1 7 -100 -238 -130 -1 0 0 0 1 0 0 0 -1 3673.dat
```

is read with its part at -100 -198 -130.

### 850-1: lower-axle-and-gear

Signed off by Erik, 2026-11-14.

The instructions' step 13 (850-1 scans, 008) add a second axle 10 through the mast's upright beams, two holes below the top axle, with an 8 tooth gear meshing the 24 tooth gear p185, and the handwheel on its other end (docs/audits, the build-step answers: high for the axle and gear, medium for the handwheel's end). The file leaves out the axle and gear and has the handwheel on the top axle, as the 950's file does; Kinebrick's copy of the 950 is corrected the same way (docs/ldraw-errata.md).

Added to the main model:

```
1 0 0 -198 -100 -1 0 0 0 1 0 0 0 -1 3737.dat
1 7 90 -198 -100 0 0 1 0 1 0 -1 0 0 3647.dat
```

### 8110-1: crane-shaft-universal-joint-whole

Signed off by Erik, 2026-11-19.

Book 2, step 65 (page 3, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6013912.pdf#page=3) puts an axle 8 into a whole universal joint, both ends and the cross, and the joint onto the gearbox's output at the back, the shaft that runs to the crane base and slews the crane (function 8; the crane base is book 4, pages 43 to 48). The main model's line 349 has one end only, 62520 p706, its fork centre at 100 -60 -270, on the output axle's line (the axle 8 with stop p365, along z at x 100), and its axle hole along the shaft, holding the axle 8 p707. There is no cross and no second end, so the shaft (body 162) is joined to nothing at the gearbox, and turning the output leaves it still: function 8 is not driven at p767 94925. The file's five other universal joints each have their two ends and the cross at one point (lines 27 to 29, 40 to 42, 328 to 330, and two in submodels): 11 ends and 5 crosses in all. Added at that point: the cross 62519, and a second end 62520 reaching back along the output axle, its fork turned a quarter turn from p706's, as the file's other joints have them, in p706's colour.

Added to the main model:

```
1 71 100 -60 -270 1 0 0 0 1 0 0 0 1 62519.dat
1 71 100 -60 -270 1 0 0 0 1 0 0 0 1 62520.dat
```

### 8110-1: crane-shaft-ball-in-its-cup

Signed off by Erik, 2026-11-19.

With crane-shaft-universal-joint-whole: the shaft's far end is the ball driver p756 32494 in the cup p754 92906, which turns the crane base's input (the joiner p755 and the 16 tooth gear p767), put on in book 2, step 77 (page 24, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6013912.pdf#page=24). The ball's middle is the driver's origin and the socket's is the cup's, and the file has the ball 6.2 LDU short of the socket, along the shaft, so the two are not joined and the crane base is not driven (function 8, not driven at p767 94925). The file's two other balls in such cups sit at the cup's middle (axleFront.ldr lines 11002 and 11003; line 14687, 0.6 LDU off). Moved to the cup's middle, with its turn as drawn (0.2 degrees off the line from the universal joint's middle), the axle 8 p707 is 16 LDU in the driver's hole, against 10 as drawn.

In the main model (p756 32494), the line

```
1 71 21.854 -60 -454.101 0 0.921 0.391 -1 0 0 0 -0.391 0.921 32494.dat
```

is read with its part at 20 -60 -460.

### 8258-1: front-drive-gear-4-high

Signed off by Erik, 2026-11-14.

The front outriggers' drive gear p586 4019, on its axle pin p587 3749 (submodel m-1k'ka), is drawn 4 LDU off its hole's axis in the beam p583, so it is loose and nothing drives the front outriggers' pinion. Book 2 page 42 step 78.21 shows the gear meshing the next one (8258-1-5.pdf; docs/audits/function-lists-batch-2.md, "Model file checks the orchestrator asked for"). Confidence high (the audit). Moved 4 LDU, y -24 to -20.

In `8258 - m-1k'k.ldr`, the line

```
1 71 20 -24 0 1 0 0 0 1 0 0 0 1 8258 - m-1k'ka.ldr
```

is read with its part at 20 -20 0.

### 8258-1: boom-actuator-u-joint-on-the-turntable-axle

Signed off by Erik, 2026-11-17.

The lower boom's linear actuator (p2096 62271c01, submodel m-1g'''') takes its drive from the turntable's upright axle 10 (p244 3737) through a universal joint at its foot. Book 2 page 82 (https://www.lego.com/cdn/product-assets/product.bi.core.pdf/4561899.pdf#page=82) builds the actuator with the joint on an axle 3; page 83, step 156 (https://www.lego.com/cdn/product-assets/product.bi.core.pdf/4561899.pdf#page=83), sets it upright and drops the joint's free end straight onto the axle that stands up from the turntable. The boom tilts the actuator later, and the joint bends, its free end staying on that axle. The file draws the joint straight in its submodel, both ends on the actuator's line, and places the submodel tilted 25° with the actuator, so the free end p2103 points 25° off p244, whose tip stops 10 LDU from the joint's centre, where the end's axle hole begins. Nothing is in the end's hole, and the actuator isn't driven (function 3). Turned 25.0° on the cross's arm it pins on, the end lines up with p244; the cross and the actuator's side don't move.

In `8258 - m-1g''''.ldr` (p2103 62520), the line

```
1 71 0 0 -50 -1 0 0 0 1 0 0 0 -1 62520.dat
```

is read with its part at 0 0 -50, turned to -1 0 0 0 0.906106 0.42305 0 0.42305 -0.906106.

### 8832-1: roll-bar-brace-right-axle-through-its-toggles

Signed off by Erik, 2026-11-16.

The roll bar (the suspension arm p9 2738) hangs on the axle p8 at its foot and holds the roll bar's top axle p32 3707 at its head; two slanted axles 6, p64 and p67, brace that top axle from the frame, each through a toggle joint at its foot (p66, p69) and one at its head (p62, p68, on p32). The file draws each slanted axle 1 LDU off the axis of its head toggle's axle hole (it reaches 14 LDU into it), so the bracing is read as not there: the roll bar swings back on p8 as the swinging arm pushes the shock absorber up against its top axle, and both move, where the function lists them to stay (function 2). Turned half a degree about its foot toggle's hole, each slanted axle runs through both its toggles' holes, as a real axle must, and the roll bar is braced. The shock absorber's top stays on the roll bar's top axle, as drawn; held so, the arm swings and the shock absorber gives through its travel. Booklet: step 12 adds the two slanted axles, step 13's inset shows the shock absorber behind the seat (scans 004, https://lego.brickinstructions.com/en/lego_instructions/set/8832).

In the main model (p64 3706), the line

```
1 0 70 -50.691 105.846 0 0 -1 -0.485 0.875 0 0.875 0.485 0 3706.dat
```

is read with its part at 70 -51.125 105.603, turned to 0 0 -1 -0.4927 0.8702 0 0.8702 0.4927 0.

### 8832-1: roll-bar-brace-left-axle-through-its-toggles

Signed off by Erik, 2026-11-16.

The roll bar (the suspension arm p9 2738) hangs on the axle p8 at its foot and holds the roll bar's top axle p32 3707 at its head; two slanted axles 6, p64 and p67, brace that top axle from the frame, each through a toggle joint at its foot (p66, p69) and one at its head (p62, p68, on p32). The file draws each slanted axle 1 LDU off the axis of its head toggle's axle hole (it reaches 14 LDU into it), so the bracing is read as not there: the roll bar swings back on p8 as the swinging arm pushes the shock absorber up against its top axle, and both move, where the function lists them to stay (function 2). Turned half a degree about its foot toggle's hole, each slanted axle runs through both its toggles' holes, as a real axle must, and the roll bar is braced. The shock absorber's top stays on the roll bar's top axle, as drawn; held so, the arm swings and the shock absorber gives through its travel. Booklet: step 12 adds the two slanted axles, step 13's inset shows the shock absorber behind the seat (scans 004, https://lego.brickinstructions.com/en/lego_instructions/set/8832).

In the main model (p67 3706), the line

```
1 0 -70 -50.691 105.846 0 0 -1 -0.485 0.875 0 0.875 0.485 0 3706.dat
```

is read with its part at -70 -51.125 105.603, turned to 0 0 -1 -0.4927 0.8702 0 0.8702 0.4927 0.

### 8838-1: axle-with-gears

Signed off by Erik, 2026-11-14.

The file defines the submodel Axle-with-Gears (a 6L axle with a 14 tooth bevel gear and an 8 tooth gear) but never places it; step 20 (scan 011) places it (docs/audits/for-erik.md, Model-file findings, high as a fact, medium for the line). The audit's line, `1 0 0 10 -60 -1 0 0 0 1 0 0 0 -1 8838 - Axle-with-Gears.ldr` in "8838 - Shock Cycle.ldr", put into the main model's coordinates (it places Shock Cycle turned): worked out, not yet seen in place.

Added to the main model:

```
1 0 0 17.19 58.37 1 0 0 0 0.993 0.121 0 -0.121 0.993 8838 - Axle-with-Gears.ldr
```

### 8840-1: v2-rod-p118-to-its-piston

Signed off by Erik, 2026-11-17.

The V2 engine (sub-model 8840 - step4b.ldr, built at the book's step 9) has two connecting rods p117 and p118 2852 on the crankshaft's pin, and two pistons p120 and p121 2851 in their cylinders. The file draws each rod's ball 2.0 and 2.2 LDU off its cylinder's axis and each piston 3.4 and 3.7 LDU above its rod's ball, 4.3 and 4.6 LDU apart in all, so no rod is read as holding its piston: the crank and rods turn, and the pistons stay still (function 2). A rod's ball sits in its piston, as built: turned a few degrees on the crankshaft's pin, in its own plane, each rod's ball lies on its cylinder's axis, and each piston, slid down its cylinder, seats on it.

In `8840 - step4b.ldr` (p118 2852), the line

```
1 7 0 10 0 0 0 1 -0.875 0.485 0 -0.485 -0.875 0 2852.dat
```

is read with its part at 0 10 0, turned to 0 0 1 -0.898 0.44 0 -0.44 -0.898 0.

### 8840-1: v2-piston-p120-on-its-rod

Signed off by Erik, 2026-11-17.

The V2 engine (sub-model 8840 - step4b.ldr, built at the book's step 9) has two connecting rods p117 and p118 2852 on the crankshaft's pin, and two pistons p120 and p121 2851 in their cylinders. The file draws each rod's ball 2.0 and 2.2 LDU off its cylinder's axis and each piston 3.4 and 3.7 LDU above its rod's ball, 4.3 and 4.6 LDU apart in all, so no rod is read as holding its piston: the crank and rods turn, and the pistons stay still (function 2). A rod's ball sits in its piston, as built: turned a few degrees on the crankshaft's pin, in its own plane, each rod's ball lies on its cylinder's axis, and each piston, slid down its cylinder, seats on it.

In `8840 - step4b.ldr` (p120 2851), the line

```
1 8 0 -5.434 33.248 0 0 1 -0.777 0.629 0 -0.629 -0.777 0 2851.dat
```

is read with its part at 0 -7.586 35.907, turned to 0 0 1 -0.777 0.629 0 -0.629 -0.777 0.

### 8840-1: v2-rod-p117-to-its-piston

Signed off by Erik, 2026-11-17.

The V2 engine (sub-model 8840 - step4b.ldr, built at the book's step 9) has two connecting rods p117 and p118 2852 on the crankshaft's pin, and two pistons p120 and p121 2851 in their cylinders. The file draws each rod's ball 2.0 and 2.2 LDU off its cylinder's axis and each piston 3.4 and 3.7 LDU above its rod's ball, 4.3 and 4.6 LDU apart in all, so no rod is read as holding its piston: the crank and rods turn, and the pistons stay still (function 2). A rod's ball sits in its piston, as built: turned a few degrees on the crankshaft's pin, in its own plane, each rod's ball lies on its cylinder's axis, and each piston, slid down its cylinder, seats on it.

In `8840 - step4b.ldr` (p117 2852), the line

```
1 7 0 10 0 0 0 -1 -0.866 0.5 0 0.5 0.866 0 2852.dat
```

is read with its part at 0 10 0, turned to 0 0 -1 -0.892 0.451 0 0.451 0.893 0.

### 8840-1: v2-piston-p121-on-its-rod

Signed off by Erik, 2026-11-17.

The V2 engine (sub-model 8840 - step4b.ldr, built at the book's step 9) has two connecting rods p117 and p118 2852 on the crankshaft's pin, and two pistons p120 and p121 2851 in their cylinders. The file draws each rod's ball 2.0 and 2.2 LDU off its cylinder's axis and each piston 3.4 and 3.7 LDU above its rod's ball, 4.3 and 4.6 LDU apart in all, so no rod is read as holding its piston: the crank and rods turn, and the pistons stay still (function 2). A rod's ball sits in its piston, as built: turned a few degrees on the crankshaft's pin, in its own plane, each rod's ball lies on its cylinder's axis, and each piston, slid down its cylinder, seats on it.

In `8840 - step4b.ldr` (p121 2851), the line

```
1 8 0 -5.719 -32.839 0 0 -1 -0.777 0.629 0 0.629 0.777 0 2851.dat
```

is read with its part at 0 -8.044 -35.711, turned to 0 0 -1 -0.777 0.629 0 0.629 0.777 0.

### 8868-1: rod-line-1368-on-its-piston

Signed off by Erik, 2026-11-18.

The engine's six connecting rods 2852 turn on the crankshaft's pins and each ends in a ball, 40 LDU from its pin (the shape's 8-8sphe at 0 -40 0, as the shadow library has it), that sits in a piston 2851's socket, the piston's middle; each piston slides in its cylinder 2850a along the cylinder's axis. In the file two rods have their ball within 2.04 LDU of the piston's middle and are read in it; the other four miss by 3.0 (lines 1368 and 1378, the rods at z 30 and z 110 on the left bank), 4.6 (line 1372) and 4.5 LDU (line 1373), not along the cylinders' axes, so they aren't read in their pistons, the four pistons are driven by nothing, and each rod swings into its cylinder's wall at the first step: function 4 stops at once. Each crank pin is 1.21 LDU from its cylinder's axis, so a rod 40 long reaches it: this rod turned 1.12 degrees about its crank pin, with the piston at line 1384 moved 2.64 LDU along its cylinder, to -25.908 -7.624 30, so that its ball sits at the piston's middle and the crank's angle stays as drawn. The booklet's step 27 (its 28th scanned page, omr/instructions/8868-1/028.jpg, from https://lego.brickinstructions.com/en/lego_instructions/set/8868) puts the six rods on the crank pins (sub-steps 1 to 3), presses a piston onto each rod's ball (4), and puts the cylinders over the pistons (5 and 6).

In `8868-1 - Motorblock.ldr`, the line

```
1 7 10 10 30 -0.423 0.906 0 0.906 0.423 0 0 0 -1 2852.dat
```

is read with its part at 10 10 30, turned to -0.4406 0.8977 0 0.8977 0.4406 0 0 0 -1.

### 8868-1: piston-line-1384-on-its-rod

Signed off by Erik, 2026-11-18.

With rod-line-1368-on-its-piston: the piston moved along its cylinder's axis to where that rod's ball now is.

In `8868-1 - Motorblock.ldr`, the line

```
1 8 -27.778 -9.494 30 0.707 0.707 0 -0.707 0.707 0 0 0 1 2851.dat
```

is read with its part at -25.908 -7.624 30.

### 8868-1: rod-line-1372-on-its-piston

Signed off by Erik, 2026-11-18.

The engine's six connecting rods 2852 turn on the crankshaft's pins and each ends in a ball, 40 LDU from its pin (the shape's 8-8sphe at 0 -40 0, as the shadow library has it), that sits in a piston 2851's socket, the piston's middle; each piston slides in its cylinder 2850a along the cylinder's axis. In the file two rods have their ball within 2.04 LDU of the piston's middle and are read in it; the other four miss by 3.0 (lines 1368 and 1378, the rods at z 30 and z 110 on the left bank), 4.6 (line 1372) and 4.5 LDU (line 1373), not along the cylinders' axes, so they aren't read in their pistons, the four pistons are driven by nothing, and each rod swings into its cylinder's wall at the first step: function 4 stops at once. Each crank pin is 1.21 LDU from its cylinder's axis, so a rod 40 long reaches it: this rod turned 3.86 degrees about its crank pin, with the piston at line 1382 moved 4.64 LDU along its cylinder, to 25.908 -7.624 70, so that its ball sits at the piston's middle and the crank's angle stays as drawn. The booklet's step 27 (its 28th scanned page, omr/instructions/8868-1/028.jpg, from https://lego.brickinstructions.com/en/lego_instructions/set/8868) puts the six rods on the crank pins (sub-steps 1 to 3), presses a piston onto each rod's ball (4), and puts the cylinders over the pistons (5 and 6).

In `8868-1 - Motorblock.ldr`, the line

```
1 7 -10 10 70 0.5 -0.866 0 0.866 0.5 0 0 0 1 2852.dat
```

is read with its part at -10 10 70, turned to 0.4406 -0.8977 0 0.8977 0.4406 0 0 0 1.

### 8868-1: piston-line-1382-on-its-rod

Signed off by Erik, 2026-11-18.

With rod-line-1372-on-its-piston: the piston moved along its cylinder's axis to where that rod's ball now is.

In `8868-1 - Motorblock.ldr`, the line

```
1 8 29.192 -10.908 70 0.707 -0.707 0 0.707 0.707 0 0 0 1 2851.dat
```

is read with its part at 25.908 -7.624 70.

### 8868-1: rod-line-1373-on-its-piston

Signed off by Erik, 2026-11-18.

The engine's six connecting rods 2852 turn on the crankshaft's pins and each ends in a ball, 40 LDU from its pin (the shape's 8-8sphe at 0 -40 0, as the shadow library has it), that sits in a piston 2851's socket, the piston's middle; each piston slides in its cylinder 2850a along the cylinder's axis. In the file two rods have their ball within 2.04 LDU of the piston's middle and are read in it; the other four miss by 3.0 (lines 1368 and 1378, the rods at z 30 and z 110 on the left bank), 4.6 (line 1372) and 4.5 LDU (line 1373), not along the cylinders' axes, so they aren't read in their pistons, the four pistons are driven by nothing, and each rod swings into its cylinder's wall at the first step: function 4 stops at once. Each crank pin is 1.21 LDU from its cylinder's axis, so a rod 40 long reaches it: this rod turned 1.74 degrees about its crank pin, with the piston at line 1385 moved 4.37 LDU along its cylinder, to -37.413 -19.129 70, so that its ball sits at the piston's middle and the crank's angle stays as drawn. The booklet's step 27 (its 28th scanned page, omr/instructions/8868-1/028.jpg, from https://lego.brickinstructions.com/en/lego_instructions/set/8868) puts the six rods on the crank pins (sub-steps 1 to 3), presses a piston onto each rod's ball (4), and puts the cylinders over the pistons (5 and 6).

In `8868-1 - Motorblock.ldr`, the line

```
1 7 -10 10 70 -0.707 0.707 0 0.707 0.707 0 0 0 -1 2852.dat
```

is read with its part at -10 10 70, turned to -0.7282 0.6853 0 0.6853 0.7282 0 0 0 -1.

### 8868-1: piston-line-1385-on-its-rod

Signed off by Erik, 2026-11-18.

With rod-line-1373-on-its-piston: the piston moved along its cylinder's axis to where that rod's ball now is.

In `8868-1 - Motorblock.ldr`, the line

```
1 8 -40.506 -22.222 70 0.707 0.707 0 -0.707 0.707 0 0 0 1 2851.dat
```

is read with its part at -37.413 -19.129 70.

### 8868-1: rod-line-1378-on-its-piston

Signed off by Erik, 2026-11-18.

The engine's six connecting rods 2852 turn on the crankshaft's pins and each ends in a ball, 40 LDU from its pin (the shape's 8-8sphe at 0 -40 0, as the shadow library has it), that sits in a piston 2851's socket, the piston's middle; each piston slides in its cylinder 2850a along the cylinder's axis. In the file two rods have their ball within 2.04 LDU of the piston's middle and are read in it; the other four miss by 3.0 (lines 1368 and 1378, the rods at z 30 and z 110 on the left bank), 4.6 (line 1372) and 4.5 LDU (line 1373), not along the cylinders' axes, so they aren't read in their pistons, the four pistons are driven by nothing, and each rod swings into its cylinder's wall at the first step: function 4 stops at once. Each crank pin is 1.21 LDU from its cylinder's axis, so a rod 40 long reaches it: this rod turned 1.12 degrees about its crank pin, with the piston at line 1386 moved 2.64 LDU along its cylinder, to -25.908 -7.624 110, so that its ball sits at the piston's middle and the crank's angle stays as drawn. The booklet's step 27 (its 28th scanned page, omr/instructions/8868-1/028.jpg, from https://lego.brickinstructions.com/en/lego_instructions/set/8868) puts the six rods on the crank pins (sub-steps 1 to 3), presses a piston onto each rod's ball (4), and puts the cylinders over the pistons (5 and 6).

In `8868-1 - Motorblock.ldr`, the line

```
1 7 10 10 110 -0.423 0.906 0 0.906 0.423 0 0 0 -1 2852.dat
```

is read with its part at 10 10 110, turned to -0.4406 0.8977 0 0.8977 0.4406 0 0 0 -1.

### 8868-1: piston-line-1386-on-its-rod

Signed off by Erik, 2026-11-18.

With rod-line-1378-on-its-piston: the piston moved along its cylinder's axis to where that rod's ball now is.

In `8868-1 - Motorblock.ldr`, the line

```
1 8 -27.778 -9.494 110 0.707 0.707 0 -0.707 0.707 0 0 0 1 2851.dat
```

is read with its part at -25.908 -7.624 110.

### 9396-1: left-inner-main-wheel

Signed off by Erik, 2026-11-14.

The file has the left main wheel's outer rim and tyre (p1200 42610, p1201 51011, at x -180) on nothing, but not its inner wheel or the tan long pin 32556 that carries both, which the right side has (p1197 at x 160, wheels p1198 and p1224 at x 180 and 140). The parts list on book 3 page 59 has 6 tyres, the file 5 (docs/audits/function-lists-batch-2.md, "Model file checks the orchestrator asked for"). Confidence medium-high (the audit). Added as the right side's mirror: the pin at x -160, as the right pin is placed; the inner rim and tyre at x -140, turned as the left outer ones are.

Added to the main model:

```
1 19 -160 18.2505 398.793 -1 0 0 0 0.896649 0.44326 0 0.44326 -0.896649 32556.dat
1 71 -140 18.2504 398.793 0 0 1 0.0214272 1 0 -1 0.0214272 0 42610.dat
1 256 -140 18.2504 398.793 0 0 1 0.0214272 1 0 -1 0.0214272 0 51011.dat
```

### 9397-1: plough-link-beam-level

Signed off by Erik, 2026-11-18.

Book #1 builds the plough lift as a double parallelogram, steps 36 to 40 (pages 73 to 77; step 37, page 74, https://www.lego.com/cdn/product-assets/product.bi.additional.extra.pdf/9397_X_9397%20Container%20Truck%20with%20Snowplow%20%231.pdf#page=74): two yellow L-beams (p486, p496 32526) turn on a pin (p487) in the frame beam p493 32524, two yellow 5L beams (p491, p495 32316) turn on the axle p461 in the same frame beam two holes away (80 LDU), and in step 37 a grey 5L beam (p489 32316) joins the middle hole of each, with a blue pin at each end (p490, p492). The plough hangs from the L-beams’ corners and the 5L beams’ ends (p488 and p716). With every pin in a hole the frame beam, the two arms and the grey link are a parallelogram, so the link lies parallel to the frame beam. In the file the grey link is tipped 0.09 degrees and its pin p490 is drawn 0.10 LDU from the L-beam’s middle hole, so the L-beam reads 40.1 LDU from its pivot to the link and the 5L beam 40.0: the two loops disagree and lock each other, the small actuator’s rod and the plough’s drive shaft (body 52) with them. The motor reaches the plough only on play, and play’s cheapest motion slides the drive shaft p134 3705 and the axle p95 3708 a hair along their axes, each at the end of its slide as built, so the control stops at 0.07 radians on that limit (function 3, control-jammed). Placed in the hole, with the link parallel, the drive shaft turns exactly: function 3 works, the control turns 1.5 radians each way.

In `9397 - 9397B.ldr` (p489 32316), the line

```
1 71 0 -83.3579 -529.921 0 -1 0 -0.00154135 0 1 -1 0 -0.00154135 32316.dat
```

is read with its part at 0 -83.3547 -529.8725, turned to 0 -1 0 -0.000337 0 1 -1 0 -0.000337.

### 9397-1: plough-link-pin-in-its-hole

Signed off by Erik, 2026-11-18.

With plough-link-beam-level: the pin p490 placed in the L-beam p486’s middle hole, 40 LDU from its pivot p487 along the beam (page 74, https://www.lego.com/cdn/product-assets/product.bi.additional.extra.pdf/9397_X_9397%20Container%20Truck%20with%20Snowplow%20%231.pdf#page=74), where the grey link’s end then is.

In `9397 - 9397B.ldr` (p490 32556), the line

```
1 1 0 -43.3579 -529.982 -1 0 0 0 0.497122 0.867869 0 0.867869 -0.497122 32556.dat
```

is read with its part at 0 -43.3514 -529.886.

### 41999-1: shock-absorbers-the-file-lacks

Signed off by Erik, 2026-11-15.

The four shock absorbers are LDCad springs in the OMR file (41999 - step70-9-shock.ldr and 41999 - step70-9-shock2.ldr, each placed twice, in 41999 - step70.ldr and 41999 - step72.ldr) with no part lines: only !LDCAD SPRING_CAP metas, which name the cylinder 2909 at y 50, the rod 2910 at y 170, and the pins 43093 and 2780 at their ends. LDCad draws those parts; no other reader sees them, so the model has no shock absorbers, and each axle hangs on its links alone. The booklet fits them at step 70 (book 2, page 25, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6064367.pdf#page=25), whose inset shows the two shock absorbers on the sub-assembly. Added: the four caps of each spring, placed as the metas say, in the main model's coordinates (colour 16 takes the spring's 14). Decision 30.

Added to the main model:

```
1 14 -60 -120.155 -260.322 1 0 0 0 1 0.008 0 -0.008 1 2909.dat
1 1 -80 -160.075 -250.002 0 0 1 -0.008 1 0 -1 -0.008 0 43093.dat
1 0 -60 -0.155 -261.282 1 0 0 0 1 0.008 0 -0.008 1 2910.dat
1 0 -60 -0.235 -271.282 0 0 -1 0.008 1 0 1 -0.008 0 2780.dat
1 14 60 -120.155 -260.322 -1 0 0 0 1 -0.008 0 -0.008 -1 2909.dat
1 1 80 -160.075 -250.002 0 0 1 -0.008 1 0 -1 -0.008 0 43093.dat
1 0 60 -0.155 -261.282 -1 0 0 0 1 -0.008 0 -0.008 -1 2910.dat
1 0 60 -0.235 -271.282 0 0 -1 0.008 1 0 1 -0.008 0 2780.dat
1 14 60 -120.155 260.322 -1 0 0 0 1 0.008 0 0.008 -1 2909.dat
1 1 80 -160.075 250.002 0 0 -1 -0.008 1 0 1 0.008 0 43093.dat
1 0 60 -0.155 261.282 -1 0 0 0 1 0.008 0 0.008 -1 2910.dat
1 0 60 -0.235 271.282 0 0 1 0.008 1 0 -1 0.008 0 2780.dat
1 14 -60 -120.155 260.322 1 0 0 0 1 -0.008 0 0.008 1 2909.dat
1 1 -80 -160.075 250.002 0 0 -1 -0.008 1 0 1 0.008 0 43093.dat
1 0 -60 -0.155 261.282 1 0 0 0 1 -0.008 0 0.008 1 2910.dat
1 0 -60 -0.235 271.282 0 0 1 0.008 1 0 -1 0.008 0 2780.dat
```

### 42000-1: right-rear-driver-in-its-hub

Signed off by Erik, 2026-11-18.

The right rear hub: the booklet clicks the steering wheel bearing 11950 onto the portal hub 92909 and puts the wheel spindle axle driver 32494 into the hub's middle, its ball in the hub's socket, and an axle 6 into the driver, for both rear wheels (book 1, page 64, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6037210.pdf#page=64). The socket's middle is 30 LDU in along the hub's axis (the shadow library's 92909); in the seven other sets with this pair (42029, 42037, 42039, 42056, 42077, 42096, 42125) every driver's ball is there, and here both are 5 LDU short of it, so the ball isn't read in its socket: the driver and its half shaft are joined to nothing at the wheel, the wheel isn't driven by them, and they meet the bearing at the first step of a turn (functions 4 and 5). Moved 5 LDU along the hub's axis into the socket, with its turn as drawn.

In `42000 - 42000.L3B.ldr` (p351 32494), the line

```
1 72 225 -60 640 0 0 -1 -1 0 0 0 1 0 32494.dat
```

is read with its part at 220 -60 640.

### 42000-1: left-rear-driver-in-its-hub

Signed off by Erik, 2026-11-18.

The left rear hub: the booklet clicks the steering wheel bearing 11950 onto the portal hub 92909 and puts the wheel spindle axle driver 32494 into the hub's middle, its ball in the hub's socket, and an axle 6 into the driver, for both rear wheels (book 1, page 64, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6037210.pdf#page=64). The socket's middle is 30 LDU in along the hub's axis (the shadow library's 92909); in the seven other sets with this pair (42029, 42037, 42039, 42056, 42077, 42096, 42125) every driver's ball is there, and here both are 5 LDU short of it, so the ball isn't read in its socket: the driver and its half shaft are joined to nothing at the wheel, the wheel isn't driven by them, and they meet the bearing at the first step of a turn (functions 4 and 5). Moved 5 LDU along the hub's axis into the socket, with its turn as drawn; with right-rear-driver-in-its-hub.

In `42000 - 42000.L3B.ldr` (p356 32494), the line

```
1 72 -225 -60 640 0 0 1 -1 0 0 0 -1 0 32494.dat
```

is read with its part at -220 -60 640.

### 42000-1: left-front-rocker-p559

Signed off by Erik, 2026-11-18.

The file draws each front pushrod in a pose its parts cannot take. The pushrod is a 9L steering link 32293, rigid, 160 LDU between its two ball sockets. Its first socket is on the rocker's axle towball 2736, and its other should be on the towball pin 6628 in the wishbone's cross block. Those two balls are drawn 154.4 LDU apart, so the far socket lies 6.8 LDU off its ball, nothing joins it, and the rod swings into the parts beside it at once (function 4). The wishbone and its towball sit on the grid, as built. The rocker, which turns on its upright axle and carries the shock absorber's cylinder, is drawn at a chosen angle. Turned 8.9 degrees about that axle, its ball lies 160 LDU from the towball, and the shock (rod 4254 in cylinder 4255, travel 90 to 110 LDU by its part data) shortens from 100 to 93.8, inside its travel. The rear shocks are drawn at 100. Book 2, steps 17 and 18 (pages 15 and 16, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6037212.pdf#page=15) show the pushrods on both balls. Moved: the rocker's eight parts turned about its axle, the pushrod set on the turned ball and aimed at the towball, and the shock's cylinder set on its eye on the rocker and aimed at the rod's eye.

In `42000 - 42000.L3B.ldr` (p559 32056.dat), the line

```
1 0 -60 -85 -260 0 0 1 0 1 0 -1 0 0 32056.dat
```

is read with its part at -60 -85 -260, turned to 0.1547 0 0.988 0 1 0 -0.988 0 0.1547.

### 42000-1: left-front-rocker-p560

Signed off by Erik, 2026-11-18.

With left-front-rocker-p559: another of the left rocker's parts, turned with it.

In `42000 - 42000.L3B.ldr` (p560 2736.dat), the line

```
1 71 -60 -90 -300 0 0 1 1 0 0 0 1 0 2736.dat
```

is read with its part at -53.8116 -90 -299.5184, turned to 0 -0.1547 0.988 1 0 0 0 0.988 0.1547.

### 42000-1: left-front-rocker-p561

Signed off by Erik, 2026-11-18.

With left-front-rocker-p559: another of the left rocker's parts, turned with it.

In `42000 - 42000.L3B.ldr` (p561 32056.dat), the line

```
1 0 -60 -75 -260 0 0 1 0 1 0 -1 0 0 32056.dat
```

is read with its part at -60 -75 -260, turned to 0.1547 0 0.988 0 1 0 -0.988 0 0.1547.

### 42000-1: left-front-rocker-p562

Signed off by Erik, 2026-11-18.

With left-front-rocker-p559: another of the left rocker's parts, turned with it.

In `42000 - 42000.L3B.ldr` (p562 2780.dat), the line

```
1 0 -40 -90 -260 0 0 1 -1 0 0 0 -1 0 2780.dat
```

is read with its part at -40.2408 -90 -256.9058, turned to 0 0.1547 0.988 -1 0 0 0 -0.988 0.1547.

### 42000-1: left-front-rocker-p563

Signed off by Erik, 2026-11-18.

With left-front-rocker-p559: another of the left rocker's parts, turned with it.

In `42000 - 42000.L3B.ldr` (p563 32523.dat), the line

```
1 15 -40 -100 -260 0 0 1 0 1 0 -1 0 0 32523.dat
```

is read with its part at -40.2408 -100 -256.9058, turned to 0.1547 0 0.988 0 1 0 -0.988 0 0.1547.

### 42000-1: left-front-rocker-p564

Signed off by Erik, 2026-11-18.

With left-front-rocker-p559: another of the left rocker's parts, turned with it.

In `42000 - 42000.L3B.ldr` (p564 87083.dat), the line

```
1 72 -20 -90 -260 0 0 1 -1 0 0 0 -1 0 87083.dat
```

is read with its part at -20.4816 -90 -253.8116, turned to 0 0.1547 0.988 -1 0 0 0 -0.988 0.1547.

### 42000-1: left-front-rocker-p568

Signed off by Erik, 2026-11-18.

With left-front-rocker-p559: another of the left rocker's parts, turned with it.

In `42000 - 42000.L3B.ldr` (p568 3713.dat), the line

```
1 71 -20 -60 -260 -1 0 0 0 0 -1 0 -1 0 3713.dat
```

is read with its part at -20.4816 -60 -253.8116, turned to -0.988 0.1547 0 0 0 -1 -0.1547 -0.988 0.

### 42000-1: left-front-rocker-p569

Signed off by Erik, 2026-11-18.

With left-front-rocker-p559: another of the left rocker's parts, turned with it.

In `42000 - 42000.L3B.ldr` (p569 87083.dat), the line

```
1 72 -60 -90 -260 0 0 -1 1 0 0 0 -1 0 87083.dat
```

is read with its part at -60 -90 -260, turned to 0 0.1547 -0.988 1 0 0 0 -0.988 -0.1547.

### 42000-1: left-front-pushrod-p571

Signed off by Erik, 2026-11-18.

With left-front-rocker-p559: the left pushrod, its first socket on the turned rocker's ball, aimed at the towball 160 LDU away.

In `42000 - 42000.L3B.ldr` (p571 32293.dat), the line

```
1 0 -60 -102 -300 0.112646 0.382683 -0.916993 -0.0466595 0.923878 0.379831 0.993152 0 0.121869 32293.dat
```

is read with its part at -53.8116 -102 -299.5184, turned to 0.1127 0.3903 -0.9137 -0.0467 0.9207 0.3875 0.9925 -0.001 0.122.

### 42000-1: left-front-shock-cylinder-p566

Signed off by Erik, 2026-11-18.

With left-front-rocker-p559: the left shock's cylinder, its eye on the turned rocker, aimed at its rod's eye, 93.8 LDU away.

In `42000 - 42000.L3B.ldr` (p566 4255.dat), the line

```
1 14 -20 -120 -260 1 0 0 0 0 -1 0 1 0 4255.dat
```

is read with its part at -20.4816 -120 -253.8116, turned to 1 0.0051 0 0 0 -1 -0.0051 1 0.

### 42000-1: right-front-rocker-p573

Signed off by Erik, 2026-11-18.

The file draws each front pushrod in a pose its parts cannot take. The pushrod is a 9L steering link 32293, rigid, 160 LDU between its two ball sockets. Its first socket is on the rocker's axle towball 2736, and its other should be on the towball pin 6628 in the wishbone's cross block. Those two balls are drawn 154.4 LDU apart, so the far socket lies 6.8 LDU off its ball, nothing joins it, and the rod swings into the parts beside it at once (function 4). The wishbone and its towball sit on the grid, as built. The rocker, which turns on its upright axle and carries the shock absorber's cylinder, is drawn at a chosen angle. Turned 8.9 degrees about that axle, its ball lies 160 LDU from the towball, and the shock (rod 4254 in cylinder 4255, travel 90 to 110 LDU by its part data) shortens from 100 to 93.8, inside its travel. The rear shocks are drawn at 100. Book 2, steps 17 and 18 (pages 15 and 16, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6037212.pdf#page=15) show the pushrods on both balls. Moved: the rocker's eight parts turned about its axle, the pushrod set on the turned ball and aimed at the towball, and the shock's cylinder set on its eye on the rocker and aimed at the rod's eye.

In `42000 - 42000.L3B.ldr` (p573 32056.dat), the line

```
1 0 60 -85 -260 0 0 -1 0 -1 0 -1 0 0 32056.dat
```

is read with its part at 60 -85 -260, turned to -0.1547 0 -0.988 0 -1 0 -0.988 0 0.1547.

### 42000-1: right-front-rocker-p574

Signed off by Erik, 2026-11-18.

With right-front-rocker-p573: another of the right rocker's parts, turned with it.

In `42000 - 42000.L3B.ldr` (p574 2736.dat), the line

```
1 71 60 -90 -300 0 0 1 1 0 0 0 1 0 2736.dat
```

is read with its part at 53.8116 -90 -299.5184, turned to 0 0.1547 0.988 1 0 0 0 0.988 -0.1547.

### 42000-1: right-front-rocker-p575

Signed off by Erik, 2026-11-18.

With right-front-rocker-p573: another of the right rocker's parts, turned with it.

In `42000 - 42000.L3B.ldr` (p575 32056.dat), the line

```
1 0 60 -75 -260 0 0 -1 0 -1 0 -1 0 0 32056.dat
```

is read with its part at 60 -75 -260, turned to -0.1547 0 -0.988 0 -1 0 -0.988 0 0.1547.

### 42000-1: right-front-rocker-p576

Signed off by Erik, 2026-11-18.

With right-front-rocker-p573: another of the right rocker's parts, turned with it.

In `42000 - 42000.L3B.ldr` (p576 2780.dat), the line

```
1 0 40 -90 -260 0 1 0 -1 0 0 0 0 1 2780.dat
```

is read with its part at 40.2408 -90 -256.9058, turned to 0 0.988 0.1547 -1 0 0 0 -0.1547 0.988.

### 42000-1: right-front-rocker-p577

Signed off by Erik, 2026-11-18.

With right-front-rocker-p573: another of the right rocker's parts, turned with it.

In `42000 - 42000.L3B.ldr` (p577 3713.dat), the line

```
1 71 20 -60 -260 -1 0 0 0 0 -1 0 -1 0 3713.dat
```

is read with its part at 20.4816 -60 -253.8116, turned to -0.988 -0.1547 0 0 0 -1 0.1547 -0.988 0.

### 42000-1: right-front-rocker-p578

Signed off by Erik, 2026-11-18.

With right-front-rocker-p573: another of the right rocker's parts, turned with it.

In `42000 - 42000.L3B.ldr` (p578 87083.dat), the line

```
1 72 20 -90 -260 0 0 1 -1 0 0 0 -1 0 87083.dat
```

is read with its part at 20.4816 -90 -253.8116, turned to 0 -0.1547 0.988 -1 0 0 0 -0.988 -0.1547.

### 42000-1: right-front-rocker-p579

Signed off by Erik, 2026-11-18.

With right-front-rocker-p573: another of the right rocker's parts, turned with it.

In `42000 - 42000.L3B.ldr` (p579 87083.dat), the line

```
1 72 60 -90 -260 0 0 -1 1 0 0 0 -1 0 87083.dat
```

is read with its part at 60 -90 -260, turned to 0 -0.1547 -0.988 1 0 0 0 -0.988 0.1547.

### 42000-1: right-front-rocker-p581

Signed off by Erik, 2026-11-18.

With right-front-rocker-p573: another of the right rocker's parts, turned with it.

In `42000 - 42000.L3B.ldr` (p581 32523.dat), the line

```
1 15 40 -100 -260 0 0 -1 0 1 0 1 0 0 32523.dat
```

is read with its part at 40.2408 -100 -256.9058, turned to 0.1547 0 -0.988 0 1 0 0.988 0 0.1547.

### 42000-1: right-front-pushrod-p580

Signed off by Erik, 2026-11-18.

With right-front-rocker-p573: the right pushrod, its first socket on the turned rocker's ball, aimed at the towball 160 LDU away.

In `42000 - 42000.L3B.ldr` (p580 32293.dat), the line

```
1 0 60 -102 -300 0.104635 -0.382683 0.917941 0.0433411 0.923879 0.380223 -0.994178 0 0.113203 32293.dat
```

is read with its part at 53.8116 -102 -299.5184, turned to 0.1127 -0.3903 0.9137 0.0467 0.9207 0.3875 -0.9925 -0.001 0.122.

### 42000-1: right-front-shock-cylinder-p582

Signed off by Erik, 2026-11-18.

With right-front-rocker-p573: the right shock's cylinder, its eye on the turned rocker, aimed at its rod's eye, 93.8 LDU away.

In `42000 - 42000.L3B.ldr` (p582 4255.dat), the line

```
1 14 20 -120 -260 1 0 0 0 0 -1 0 1 0 4255.dat
```

is read with its part at 20.4816 -120 -253.8116, turned to 1 -0.0051 0 0 0 -1 0.0051 1 0.

### 42038-1: rear-left-tread-on-its-unit

Signed off by Erik, 2026-11-18.

Each of the four track units (42038 - track1.ldr on the left, track2.ldr on the right) has a tread of 24 links of 57518 (42038 - technicChainTread38Closed-1.ldr) round its three wheels. The front treads are placed where their units are, in y and z (163.772, -259.3185), at x 165 and -165, and each circle is on its wheel's axle. The rear units are at y 161.666, z 300.4165 (left, x -165) and z 300.4155 (right, x 175), but their treads are at y 163.772, z 290.6815 and x -175 and 155: every circle lies 9.96 LDU from its axle, the treads are read round no wheel, and function 9 fails as track-not-read. Book 2, step 101 (page 47, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6112278.pdf#page=47) wraps each 24-link tread round its unit's wheels, the rear ones as the front. Placed as the front treads are against their units, at the unit's y and z and x -165, its circles are on their axles.

In the main model, the line

```
1 0 -175 163.772 290.6815 0 0 1 0 1 0 -1 0 0 42038 - technicChainTread38Closed-1.ldr
```

is read with its part at -165 161.666 300.4165.

### 42038-1: rear-right-tread-on-its-unit

Signed off by Erik, 2026-11-18.

With rear-left-tread-on-its-unit: the right rear tread, placed as the right front tread is against its unit (track2.ldr at x 175, its tread at x 165), at the unit's y and z (161.666, 300.4155). Book 2, step 101 (page 47, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6112278.pdf#page=47).

In the main model, the line

```
1 0 155 163.772 290.6815 0 0 1 0 1 0 -1 0 0 42038 - technicChainTread38Closed-1.ldr
```

is read with its part at 165 161.666 300.4155.

### 42040-1: seats-on-their-pins

Signed off by Erik, 2026-11-15.

The hatch behind the engine and its lever group (seats.ldr: the 42003s p249 and p259, the 32140s, the 32054s and the 32316) are loose in the file: each 42003's pin hole lies 2.00 LDU off its pin, the 6558s p165 and p164 of motor.ldr, both off by the same amount (0, -0.10, -2.00), along the holes' line. The booklet has the lever group and the hatch move together on those pins (42040-1-1.pdf pages 48 to 52, 89 and 115; docs/audits/for-erik.md, Model-file findings, medium). Moved by that amount, with its turn as built, both 42003s sit on their pins.

In the main model, the line

```
1 1 -160 -211.5552 -68.6371 0 0 -1 0.0523 0.9986 0 0.9986 -0.0523 0 42040 - seats.ldr
```

is read with its part at -160 -211.6552 -70.6371.

### 42042-1: left-tread-on-its-wheels

Signed off by Erik, 2026-11-18.

The two treads are one submodel (42042 - technicChainTread38Closed-1.ldr, 45 links of 57518 round six circles), placed twice in the main model, at x 210 and x -210. The one at x 210 is at z 60, and each of its six circles is on its wheel's axle (the two sprockets 57519 and the four rollers). The one at x -210 is at z 70, so each of its circles lies 10 LDU along the crawler from its axle, and it is read round no wheel (functions 2 and 9 fail as track-not-read). The booklet fits both treads the same way, each centred on its sprockets (page 54, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6151636.pdf#page=54: 90 links, 2 × 45). Placed at z 60, as the other one is, its six circles are on their axles.

In the main model, the line

```
1 72 -210 -70 70 0 0 -1 0 1 0 1 0 0 42042 - technicChainTread38Closed-1.ldr
```

is read with its part at -210 -70 60.

### 42050-1: wheelie-actuator-bevel-on-its-axis

Signed off by Erik, 2026-11-17.

Step 64 (page 35, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6153719.pdf#page=35) builds the wheelie actuator (92693c01): its input (92695) takes a 12 tooth double bevel (32270, sub-step 1), and the yellow axle 7 (44294) through the actuator’s top eye takes a 12 tooth bevel (6589, sub-step 2), so the two bevels mesh at the actuator’s end, on its own axis, and stay in mesh as it swings on that axle. Step 69 (page 38, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6153719.pdf#page=38) shows the pair from below, and the functions page (page 119, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6153719.pdf#page=119, function B) the knob working it. In the submodel 42050 - linact.ldr the double bevel (p244) is drawn 0.7 LDU off the actuator’s axis and turned 15.0 degrees where the actuator is at 14.6, so its axis passes the knob’s axle 0.84 LDU off, and it is read as meshing nothing: the knob doesn’t drive the actuator (function 4). Placed on the actuator’s axis, 20 LDU from the axle, turned as the actuator is, it meshes the knob’s bevel; nothing else moves.

In `42050 - linact.ldr` (p244 32270), the line

```
1 0 -280.258 -6.837 0 0 0.259 0.966 0 -0.966 0.259 1 0 0 32270.dat
```

is read with its part at -280.431 -6.163 0, turned to 0 0.252 0.968 0 -0.968 0.252 1 0 0.

### 42052-1: no-third-link-pin-p586

Signed off by Erik, 2026-11-15.

Step 155 (page 84, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6182578.pdf#page=84) builds the two door links: four 6L thin liftarms, two black friction pins at the slider ends and two light grey pins (3673) at the outer ends, where the doors hang at step 156 (page 86). The file places that step as its main model's step 19 with three light grey pins: p587 and p592 at the links' outer ends (x 140 and -140), and p586 at x -100, in the left links' fourth hole, where it pins them to the fuselage panel p40. The right side has no such pin. As read, p586 holds the left links to the frame, so the slider they hang from cannot slide. Removed: the booklet has two grey pins, not three.

In the main model (p586 3673), the line

```
1 71 -100 -370 -130 0 1 0 0 0 -1 -1 0 0 3673.dat
```

is read as not there. The part keeps its number.

### 42064-1: hatch-20-high

Signed off by Erik, 2026-11-14.

The foredeck hatch (hatch.ldr, 17 parts) is drawn 20 LDU above where it belongs: its panel's holes lie on the axes of its two pins 15100 (p457, p458), 20 LDU past their ends, so it is loose. The booklet presses it down onto those two pins (42064-1 book, pages 185 to 187; docs/audits/function-lists-batch-3.md). Confidence high (the audit). Moved 20 LDU down.

In `42064 - ship.ldr`, the line

```
1 0 0 -130 -380 -1 0 0 0 1 0 0 0 -1 42064 - hatch.ldr
```

is read with its part at 0 -110 -380.

In the real set the hatch is fixed on its two pins, not hinged; what that means for fn 9 is the audit's table for Erik.

### 42070-1: rear-differential-ring-faces-back

Signed off by Erik, 2026-11-16.

The two tandem axles are built as two modules: the middle one at steps 121 to 128 (pages 78 and 79, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6208469.pdf#page=78), fitted next to the gearbox at step 139 (page 87), and the rear one at steps 143 to 151 (page 92, #page=92), fitted at the end at step 166 (page 101). The 1:1 pictures of their differentials are mirror images: in step 123 the ring is on the right of the casing, in step 147 on the left, both drawn from the same side. The file draws both alike: its two sub-models, 42070 - axle2.ldr and 42070 - axle3.ldr, hold the casing (62821) turned the same way, its ring facing +x, on the side of their red connectors. One shaft drives both, its pinions meeting the middle ring from behind and the rear ring from in front, so with both rings facing one way the two rear axles turn against each other, and the truck can't roll (function 1). Turned half a turn about the vertical, the rear casing's ring faces -x, as in step 147.

In `42070 - axle3.ldr` (p845 62821), the line

```
1 72 0 0 0 0 0 1 -1 0 0 0 -1 0 62821.dat
```

is read with its part at 0 0 0, turned to 0 0 -1 -1 0 0 0 1 0.

### 42070-1: rear-differential-spider-gear-with-its-casing

Signed off by Erik, 2026-11-16.

Follows from the signed entry rear-differential-ring-faces-back, which turns the rear differential's casing p845 half a turn about the vertical: the casing's small bevel gear p848 sits on the casing's own pin, inside it, and turns with it, from 17 LDU behind the casing's centre to 17 in front, as the middle differential's p758 sits in its casing p755. Left where it was, it is joined to the axle housing instead of the casing (the reading has no joint between p845 and p848), so the two side gears must turn against each other and the rear axle's wheels can't roll together: the truck can't roll straight, and the XL motor can't turn on the floor (function 1). The side gears p846 and p847 change places under the same half turn, as drawn already.

In `42070 - axle3.ldr` (p848 6589), the line

```
1 19 0 0 17 0.259 -0.966 0 -0.966 -0.259 0 0 0 -1 6589.dat
```

is read with its part at 0 0 -17, turned to -0.259 0.966 0 -0.966 -0.259 0 0 0 1.

### 42077-1: rear-half-shaft-inner-ball-level

Signed off by Erik, 2026-11-17.

The rear differential takes a half shaft on each side: a constant velocity ball (32494) in each of its CV sockets (step 18, page 11, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6261603.pdf#page=11), an axle 4 into it and a ball at the wheel's end (step 19). In the file's submodel 42077 - rearaxle.ldr both half shafts slope down 13.6 degrees to the sprung wheels: on one side the inner ball, the axle 4 and the outer ball all slope (its lines at x 60, 118.3 and 176.6); on the other the axle 4 and the outer ball slope (x -118.3 and -176.6) but the inner ball p78 at x -60 is drawn level, so the axle misses its hole and the half shaft is joined to nothing at the differential. Turned 13.6 degrees about its own centre, in its socket, the ball takes the axle as on the other side; nothing else moves.

In `42077 - rearaxle.ldr` (p78 32494), the line

```
1 71 -60 0 0 0 0 -1 0 1 0 1 0 0 32494.dat
```

is read with its part at -60 0 0, turned to 0 0.235 -0.972 0 0.972 0.235 1 0 0.

### 42078-1: rear-crane-actuator-axle-to-its-connectors

Signed off by Erik, 2026-11-17.

The two cranes are mirror images, and both place one actuator submodel (42078 - craneactu.ldr), unmirrored. Its axle 9 runs from the actuator's bevel gear to the crane's back, where a connector holds each end and a red axle 6 plugs the crane onto the trailer's shaft (steps 142 and 143, page 336, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6230125.pdf#page=336; step 154, page 341, #page=341; step 155, page 342, #page=342). In the front crane the axle 9 (p2196) has its connectors p2206 and p2320 over its two ends, 20 LDU of it in each. In the rear crane the same axle (p1968) lies 40 LDU too far back: it stops 20 LDU short of the connector p2108 that should hold it, and runs into the second half of the connector p1986, where the red axle p2078 is. So the front crane's drive stops at the rear crane, and its actuator isn't driven (function 9). Moved 40 LDU along itself toward the trailer, in the rear crane only, it fills both connectors' halves as in the front crane.

Only where `42078 - crane1.ldr` places `42078 - craneactu.ldr` by the line

```
1 19 0 -24.131 116.209 0 -1 0 0.876 0 0.483 -0.483 0 0.876 42078 - craneactu.ldr
```

which is pointed at a copy of the submodel with the change; its other uses are as the file has them.

In `42078 - craneactu.ldr` (p1968 60485), the line

```
1 14 -0.012 20 49.983 0 0.483 0.876 -1 0 0 0 -0.876 0.482 60485.dat
```

is read with its part at -0.012 -20 49.983.

### 42078-1: door-2-has-no-13L-beam

Signed off by Erik, 2026-11-19.

The container's two end doors are built differently. Door 1 (step 43, page 409, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6230125.pdf#page=409), ends in an 11L beam and a 13L beam held to the panel by two blue 3L pins; door 2 (steps 58 and 59, page 415, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6230125.pdf#page=415) ends in an 11L beam only, on two of the six black pins, and has no 13L beam and no blue pins. The file's door 2 (42078 - containerdoor2.ldr) is door 1 mirrored, so it has door 1's 13L beam and blue pins too: its 13L beam p2672 lies in the same place as door 1's 13L beam p2638 (80, -340, 800), and its blue pins p2669 and p2670 run on into door 1's 13L. As read, the two doors are one body with the trailer, and neither swings on its hinge (function 12). Removed: door 2's 13L beam and blue pins; added: two black pins 2780 in their place, each through door 2's 11L beam and 20 LDU into its panel, as door 1's blue pins go into its panel.

In `42078 - containerdoor2.ldr` (p2672 41239), the line

```
1 15 140 0 -20 0 -1 0 0 0 1 -1 0 0 41239.dat
```

is read as not there. The part keeps its number.

### 42078-1: door-2-has-no-blue-pin-at-y-minus-280

Signed off by Erik, 2026-11-19.

With door-2-has-no-13L-beam: one of door 2's two blue 3L pins, which the booklet doesn't give it (step 58, page 415, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6230125.pdf#page=415).

In `42078 - containerdoor2.ldr` (p2669 6558), the line

```
1 1 120 60 -20 -1 0 0 0 -1 0 0 0 1 6558.dat
```

is read as not there. The part keeps its number.

### 42078-1: door-2-has-no-blue-pin-at-y-minus-400

Signed off by Erik, 2026-11-19.

With door-2-has-no-13L-beam: the other blue 3L pin.

In `42078 - containerdoor2.ldr` (p2670 6558), the line

```
1 1 120 -60 -20 -1 0 0 0 -1 0 0 0 1 6558.dat
```

is read as not there. The part keeps its number.

### 42078-1: door-2-black-pins-for-its-11L-beam

Signed off by Erik, 2026-11-19.

With door-2-has-no-13L-beam: the two black pins 2780 that hold door 2's 11L beam p2671 to its panel p2665 (step 58, page 415, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6230125.pdf#page=415, where two of the six black pins go into the panel's end; step 59 puts the 11L beam on them), in the main model's coordinates, 10 LDU nearer the panel than the blue pins they replace, so they don't reach door 1.

Added to the main model:

```
1 0 50 -280 800 -1 0 0 0 -1 0 0 0 1 2780.dat
1 0 50 -400 800 -1 0 0 0 -1 0 0 0 1 2780.dat
```

### 42083-1: speed-key-in-its-hole

Proposed, not applied until signed off.

The speed key (startkey.ldr, its 11L axle p3540 23948) lies on the ground in the file. Book 2 page 310 (42083-1-2.pdf) shows it in place: the axle goes 3 to 4 studs into a hole above and behind the left rear hub, likely the 59443 p2099, into the shaft under the wing (docs/audits, the build-step answers; medium, measured on a perspective picture). Placed with the axle along that hole's line (x, at y -143, z 440), 3.5 studs (70 LDU) in from its outer face at x 210, its tip at x 140; the key's turn about the axle is as built.

In the main model, the line

```
1 272 426 -10 365 0.866 0 -0.5 0 1 0 0.5 0 0.866 42083 - startkey.ldr
```

is read with its part at 250 -123 420, turned to 0 0 -1 0 1 0 1 0 0.

### 42093-1: no-12-tooth-on-the-engine-shaft

Signed off by Erik, 2026-11-15.

The shaft that drives the engine has a 12 tooth double bevel gear (32270) where the set has an 8 tooth gear (10928): step 2 (42093-1-1.pdf page 4) puts an 8 tooth gear on that shaft, and the parts list has two 8 tooth gears (element 6012451) and three 12 tooth double bevel gears (element 4177431) where the file has one and four. A 12 tooth and an 8 tooth gear need 25 LDU between their axes; at 20 the 12 tooth gear overlaps the crankshaft's 8 tooth gear rather than meshing. Line 3115 of 42093 - corvette.ldr (docs/ldraw-errata.md, the 42093's section, written before the errata were applied; docs/audits/for-erik.md, Model-file findings, high).

In `42093 - corvette.ldr` (p7 32270), the line

```
1 0 0 0 -80 0 1 0 1 0 0 0 0 -1 32270.dat
```

is read as not there. The part keeps its number.

### 42093-1: 8-tooth-on-the-engine-shaft

Signed off by Erik, 2026-11-15.

The 8 tooth gear the set has in place of the removed 12 tooth gear: the same place and turn, in the main model's coordinates (corvette.ldr is placed unturned at 0 -55 160), in dark bluish grey like the crankshaft's gear.

Added to the main model:

```
1 72 0 -55 80 0 1 0 1 0 0 0 0 -1 10928.dat
```

### 42096-1: rear-half-shafts-outer-balls-in-their-hubs-left

Signed off by Erik, 2026-11-17.

Each rear half shaft is two constant velocity balls (32494) on an axle 3, between a ball socket on the differential's side and the portal hub's socket (step 11, page 7, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6314566.pdf#page=7; the hubs at step 8, page 6, #page=6). A ball's axle hole runs from 20 to 50 LDU behind its centre, so with the axle 3 seated in both the two centres are 100 LDU apart: exactly the distance from the inner ball to the hub's socket (the 92909's, 30 LDU inside it), along the shaft's slope. The file draws each outer ball 120 LDU from the inner one, the axle half out of it, so the ball sits 20 LDU short of the hub's socket and turns nothing: the rear wheels don't drive the differential or the engine (function 1). Moved 20 LDU along the shaft into the socket, the ball takes the axle fully; the inner ball and the axle stay as drawn. This entry is the left shaft's; the next, the right's.

In `42096 - porsche.ldr` (p46 32494), the line

```
1 71 -174.135 37.057 0 0 -0.309 0.951 0 -0.951 -0.309 1 0 0 32494.dat
```

is read with its part at -155.112 30.881 0.

### 42096-1: rear-half-shafts-outer-balls-in-their-hubs-right

Signed off by Erik, 2026-11-17.

The right rear half shaft's outer ball, as the left's (the entry before).

In `42096 - porsche.ldr` (p47 32494), the line

```
1 71 174.135 37.057 0 0 -0.309 -0.951 0 0.951 -0.309 1 0 0 32494.dat
```

is read with its part at 155.112 30.881 0.

### 42099-1: rear-side-gear-p45-in-line

Signed off by Erik, 2026-11-15.

The rear differential's two side gears (p45 and p46, 6589, lines 1132 and 1133 of the OMR file, in 42099 - rearaxle.ldr, its sixth step) lie 3 LDU off the line of the casing (p43 62821, line 1130): at z -3, where the casing's line, and its half shafts', is at z 0. So neither turns on its half shaft, and the differential is read as locked. The booklet builds this differential at step 140 (42099-1-1.pdf page 86, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6314520.pdf#page=86): its 1:1 inset has the two side gears facing each other on the casing's line. The front differential, laid out the same way (lines 95 to 98), has them at z 0. Of the differentials in all the models Kinebrick checks, this is the only one with a side gear off its casing's line. Moved 3 LDU onto the line.

In `42099 - rearaxle.ldr` (p45 6589), the line

```
1 19 17 -40 -3 0 0 -1 1 0 0 0 -1 0 6589.dat
```

is read with its part at 17 -40 0.

### 42099-1: rear-side-gear-p46-in-line

Signed off by Erik, 2026-11-15.

As p45: the rear differential's other side gear, 3 LDU off the casing's line (line 1133; booklet step 140, page 86, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6314520.pdf#page=86). Moved 3 LDU onto the line.

In `42099 - rearaxle.ldr` (p46 6589), the line

```
1 19 -17 -40 -3 0 0 1 -1 0 0 0 -1 0 6589.dat
```

is read with its part at -17 -40 0.

### 42109-1: no-pin-p381

Signed off by Erik, 2026-11-14.

Three parts the set doesn't have: the parts list confirms they are not in the set (42109-1-1.pdf p.17-18, 39-40, 113; docs/audits/for-erik.md, Model-file findings, high). In the file they are lines 1002 to 1004, in 42109 - car.ldr.

In `42109 - car.ldr` (p381 2780), the line

```
1 0 0 0 0 0 0 -1 0 1 0 1 0 0 2780.dat
```

is read as not there. The part keeps its number.

### 42109-1: no-pin-p382

Signed off by Erik, 2026-11-14.

Three parts the set doesn't have: the parts list confirms they are not in the set (42109-1-1.pdf p.17-18, 39-40, 113; docs/audits/for-erik.md, Model-file findings, high). In the file they are lines 1002 to 1004, in 42109 - car.ldr.

In `42109 - car.ldr` (p382 2780), the line

```
1 0 0 40 0 0 0 -1 0 1 0 1 0 0 2780.dat
```

is read as not there. The part keeps its number.

### 42109-1: no-beam-p383

Signed off by Erik, 2026-11-14.

Three parts the set doesn't have: the parts list confirms they are not in the set (42109-1-1.pdf p.17-18, 39-40, 113; docs/audits/for-erik.md, Model-file findings, high). In the file they are lines 1002 to 1004, in 42109 - car.ldr.

In `42109 - car.ldr` (p383 32526), the line

```
1 0 80 40 -10 0 0 -1 -1 0 0 0 1 0 32526.dat
```

is read as not there. The part keeps its number.

### 42110-1: front-driver-at-z-minus-177-on-its-hub-axis

Signed off by Erik, 2026-11-18.

One front hub: step 149 (page 93, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6323003.pdf#page=93) puts the portal hub 92909 into the steering bearing 23801 and pushes the wheel spindle axle driver 32494 into the hub's middle along its axis, its ball in the hub's socket. The file draws the driver's ball 2 LDU below the hub's axis (at the socket's depth, 30 LDU in), its shaft tilted 12 degrees down to the differential as built. Turning the wheel then carries the off-centre driver round into the bearing, which stops function 4 at 0.43 radians. Moved 2 LDU up onto the hub's axis, its tilt as drawn.

In `42110 - frontaxle.ldr`, the line

```
1 71 -40 -19.188 -177.81 1 0 0 0 0.978 -0.208 0 0.208 0.978 32494.dat
```

is read with its part at -40 -17.188 -177.81.

### 42110-1: front-driver-at-z-plus-177-on-its-hub-axis

Signed off by Erik, 2026-11-18.

The other front hub: step 150 (page 94, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6323003.pdf#page=94) puts the portal hub 92909 into the steering bearing 23801 and pushes the wheel spindle axle driver 32494 into the hub's middle along its axis, its ball in the hub's socket. The file draws the driver's ball 2 LDU below the hub's axis (at the socket's depth, 30 LDU in), its shaft tilted 12 degrees down to the differential as built. Turning the wheel then carries the off-centre driver round into the bearing, which stops function 4 at 0.43 radians. Moved 2 LDU up onto the hub's axis, its tilt as drawn; with front-driver-at-z-minus-177-on-its-hub-axis.

In `42110 - frontaxle.ldr`, the line

```
1 71 -40 -19.188 177.81 -1 0 0 0 0.978 -0.208 0 -0.208 -0.978 32494.dat
```

is read with its part at -40 -17.188 177.81.

### 42111-1: rear-shock-cylinder-on-the-rods-axis

Signed off by Erik, 2026-11-15.

In the rear shock absorber sub-assembly (42111 - rear-shock-assy.ldr, placed twice), the cylinder 4255 is drawn at z -1.309 and the rod 4254 at z 0, so the rod lies 1.31 LDU off the cylinder's axis, beyond the 1 LDU a rod is found in its cylinder with, and the two halves are read as unjoined. The offset is along the cylinder's own pin hole (its local z), so moving it to z 0 keeps it on its pin and puts it on the rod's axis. The booklet fits the two shock absorbers whole, rod in cylinder, between the frame and the rear axle at step 34 (page 22, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6324428.pdf#page=22). Moved 1.309 LDU along its pin.

In `42111 - rear-shock-assy.ldr` (p101 4255 and p105 4255), the line

```
1 16 0 9.819 -1.309 1 0 0 0 1 0 0 0 1 4255.dat
```

is read with its part at 0 9.819 0.

### 42112-1: drive-shaft-bevel-on-the-shaft

Signed off by Erik, 2026-11-17.

The drive shaft along the chassis ends in a tan 20 tooth double bevel gear that meshes the front rear axle's differential ring, so rolling the truck turns the shaft and, through the selector, the drum (function 5). Step 81 (book 1 page 56, https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6356979.pdf#page=56) puts the gear into the rear axles' frame and shows the shaft's red axle going through a beam into it. The file places the gear (p326, in the main model) at z 204, while the shaft's axle 6 (p15) ends at z 194, so the gear is on no axle and meshes nothing. The gear that links the two differentials (p246, at z 264) meshes the same ring from its other side; mirrored about the ring's axis (z 224), the drive gear belongs at z 184, where the axle's last 20 LDU fill its hole and it meshes the ring. Moved 20 LDU, nothing else moves.

In the main model (p326 18575), the line

```
1 19 20 0 204 1 0 0 0 1 0 0 0 1 18575.dat
```

is read with its part at 20 0 184.

<!-- errata: end -->
