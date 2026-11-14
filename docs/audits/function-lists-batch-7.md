# Function list audit, batch 7 (22 sets + 3 without a booklet), 2026-11-14

The last 22 sets with scanned booklets only, 1989 to 1977: 8835, 8854, 8832, 8862, 8855, 8865, 8849, 1972, 8020, 8851, 8841, 8845, 8848, 8859, 856, 950, 854, 855, 956, 850, 851, 852. Method as before: blind reading first, then the comparison; doubtful functions worked through; review searches recorded as "video lead: Erik to look", never settled from a summary alone. No function list and nothing in the repository was changed. Readers: 7 agents, 2-5 sets each, at most 4 at once. None of these booklets has a functions page; readers used build steps, covers and back covers (arrows only at 1972 p.8, 8848 step 7, 8865 cover blueprint and scan 017, 8851 cover diagram).

## Not auditable from a booklet

| Set | Name | Functions | Model file | Why |
|---|---|---|---|---|
| 952 | Tractor | 7 | models/952-Tractor.mpd | No booklet recorded (neither LEGO nor the scans site) |
| 858 | Auto Engines | 9 | models/858-Auto Engines-2-Cycle Engine.mpd | No booklet recorded |
| 8024 | Universal Set | 3 | models/8024-Universal Set.mpd | No booklet recorded |

Their lists rest on the model files and earlier sessions' reading only; video leads would be the only outside source.

## Counts

| Set | Agree | Differ | Not on page | Missing |
|---|---|---|---|---|
| 8835 | 3 | 0 | 1 | 0 |
| 8854 | 7 | 0 | 4 | 0 |
| 8832 | 4 | 0 | 0 | 1 |
| 8862 | 0 | 0 | 12 | 0 |
| 8855 | 0 | 0 | 4 | 0 |
| 8865 | 11 | 0 | 0 | 0 |
| 8849 | 6 | 0 | 1 | 0 |
| 1972 | 2 | 0 | 0 | 0 |
| 8020 | 2 | 0 | 0 | 0 |
| 8851 | 5 | 0 | 1 | 0 |
| 8841 | 2 | 0 | 3 | 0 |
| 8845 | 4 | 0 | 1 | 0 |
| 8848 | 3 | 0 | 4 | 0 |
| 8859 | 6 | 1 | 0 | 0 |
| 856 | 3 | 0 | 1 | 0 |
| 950 | 4 | 0 | 0 | 0 |
| 854 | 3 | 0 | 1 | 0 |
| 855 | 8 | 0 | 2 | 0 |
| 956 | 5 | 0 | 2 | 0 |
| 850 | 1 | 1 | 2 | 0 |
| 851 | 2 | 0 | 2 | 0 |
| 852 | 1 | 0 | 2 | 0 |
| **All 22** | **82** | **2** | **43** | **1** |

127 list functions. "Agree" means agrees with what the booklet draws. 8865 counts fn 10 and 11 as agree although part of each (headrest tilt, the lever's way of working) is not drawn; 855 counts fn 9 as agree in part. Missing: 8832 a tilting steering column (reviews; medium). Possible: 8859 a lifting bonnet and a rear power take-off stub.

850 and 851 are different models (Fork Lift, Tractor), not duplicates. 950 (Fork Lift, 1979) and 850 have the same fault: see the model table.

## Model file findings

| Set | Fn | Finding | Page | Confidence |
|---|---|---|---|---|
| 850 | 1 | Step 13 has a lower axle 10 with an 8-tooth gear meshing the 24-tooth gear, and the handwheel on that lower axle (a slow 1:3 crank). The file leaves out that axle and gear and puts the handwheel p188 on the pinion axle. | 850-1 scans, step 13 | Medium |
| 950 | 1 | The same: step 13's parts box has 2 axles 10 and three 8-tooth gears; the file lacks the lower axle 10 and the 8-tooth gear meshing the 24-tooth gear. | 950-1 scans, step 13 | High |
| 854 | 4 | Steps 4-5 hold the nose at a fixed slant against the chassis front; in Kinebrick the nose p50 swings freely on p24. | 854-1 scans, steps 4-5 | Medium |
| 856 | 4 | Step 11 pins each angled front-guard beam top and bottom, so it is rigid; check whether the bottom pins p24/p25 meet the beams' holes. | 856-1 scans, step 11 | Medium |
| 8845 | 1 | The steering column p95 crosses plate p94 at a hole, but about 3° out of line (plate ~37°, column ~34°); step 8 shows the column straight through the hole, so it may not seat. | 8845-1 scans, step 8 | Low-medium |
| 852 | 3 | The skids are meant to be rigid; their swinging in Kinebrick is a solver fault, not the set's design. | 852-1 scans | Medium |

## Model file check asked after batch 5: 42082 house and roller ring

| Set | Fn | The question | The booklet shows | Page | Confidence |
|---|---|---|---|---|---|
| 42082 | — | The house (house.ldr with wall1 and wall2, 120 parts) is attached to nothing. | The house is not the crane's superstructure. It is a separate accessory: a building of grey panels (two walls joined at a corner, steps 1138-1159), built at the end of book 2 after the crane is finished. A third wall with lifting slings (wall3, steps 1160-1169) is the load: the last picture hangs it on the hook beside the building. In the file the house stands 1,431 LDU from the crane's centre (main.ldr line 1007), on the ground. Attached to nothing is right; it should be left as a loose object, not joined. | 42082-1-1.pdf (book 2) p.290-321 | High |
| 42082 | — | The roller ring (rollerring.ldr, 88 parts) is attached to nothing; its 27940 holes lie one stud beside two 2780 pins. | Book 1 steps 486-495: two quarter gear-racks complete the big base ring (p.264), 4 red parts go on the base ring at four points (step 487, p.265), the 8 roller units are built and joined into a loose ring (steps 488-494, p.266-267), and the ring is laid into the base ring with no arrow into any hole (step 495, p.268). Steps 496-506 build the top ring, which is laid on the rollers (step 507, p.276) and then held down by 4 red parts and 4 blue pins at its edge (steps 508-509, p.277-278). So the roller ring is a bearing that rests and rolls between the base ring and the top ring, kept in place by the rings around it; it is not pinned. The two 2780 pins one stud beside its holes are no sign of a misplacement. This is a join a pin-and-hole reading cannot see: the ring should be treated as captured between the two rings (or tied to the slewing at half its speed), not as fixed. | 42082-1-2.pdf (book 1) p.264-278 | High (the build), medium (that steps 508-509 pin the top ring down, not the rollers) |

## Proposed changes for Erik


### Changes to what a function is or which part works it

| Set | Fn | The list says | The booklet shows | Page | Confidence |
|---|---|---|---|---|---|
| 8865 Test Car | 11 | red lever turns the long shaft | lever built like the gear lever (knob, UJ, shaft through a beam); most likely slides the shaft fore/aft to work a crank at the front (Technicopedia agrees) | scan 004 (step 5 inset 2), scan 001 blueprint | medium |
| 8859 Tractor | 3 | the second bevel p21 only steadies the differential (inferred) | a short axle 4 with a bevel pointing back, maybe a rear power take-off | p.3 step 2 | low |
| 850 Fork Lift | 1 | control = handwheel on the top axle | control = handwheel on the lower axle, driving the pinion axle 1:3 (after the model fix) | 008, 001 | medium |

### Lever and knob directions

| Set | Fn | The list says | The booklet shows | Page | Confidence |
|---|---|---|---|---|---|
| 8865 Test Car | 3 | positions unknown | 1 furthest forward, 2 ≈40 LDU back, 3 ≈20 LDU further back; maybe neutral between 1 and 2 | scan 017 | medium (neutral low) |
| 855 Mobile Crane | 9 | lifting the lever lets the boom be lowered | the finger presses down on the lever's top | 006 (cab step 17) | low |

### Model file findings

| Set | Fn | The list says | The booklet shows | Page | Confidence |
|---|---|---|---|---|---|
| 8845 Dune Buggy | 1 | steering wheel p100 works the rack (generated: "no", control-fixed) | step 8: column goes straight through the 2x8 plate's hole. In the file, plate p94 3738 and column p95 3705 are about 3° out of line, so the column may not seat in the hole | p.4 step 8 | low-medium |
| 856 Bulldozer | 4 | Kinebrick lets it swing on its pins | it should be held at two points; check whether the bottom pins p24 and p25 meet the beams' holes | p.4 | medium |
| 950 Fork Lift | 1 | the model file leaves out the lower axle and gear | step 13 adds 2 axles 10 and 3 small 8-tooth gears; the model lacks one axle 10 and one 8-tooth gear meshing the 24-tooth gear | p.8 | high |
| 854 Go-Kart | 4 | Kinebrick lets the nose (p50) swing freely on p24 | the nose should stay fixed (rigid) | 003-004 | medium |
| 850 Fork Lift | 1 | handwheel p188 on the pinion axle; the lower axle and its 8-tooth gear are left out | add the lower axle 10 with an 8-tooth gear meshing the 24-tooth gear; move the handwheel to the lower axle | 008 (step 13), 001 cover | medium |

### Video leads for Erik ("video lead: Erik to look"; never settled from a summary alone)

| Set | Fn | The list says | The booklet shows | Page | Confidence |
|---|---|---|---|---|---|
| 8835 Forklift | 2 | tilt wheel: full or part turn unsure | crank pin + link (steps 13-14); range not shown | p.7-8 | low |
| 8854 Power Crane | 4, 6 | inferred | not shown | — | low |
| 8832 Roadster | new | — | tilt steering column (from Technicopedia/Brickset, not the booklet) | — | medium |
| 8832 Roadster | 2 | shock top on roll bar's top axle or seat: unclear | inset too coarse | p.4 | low |
| 8862 Backhoe Grader | 5 | feet tilt on toggles (inferred) | feet built on toggles; no tilt shown | 025 | low |
| 8862 Backhoe Grader | 10 | valve-to-cylinder mapping inferred | hoses not traceable in scans | 020-027 | low |
| 8862 Backhoe Grader | 11 | bonnet lifts (inferred) | axle along the bonnet edge; the pump knob passes through the bonnet; not shown opening | 022, 029 | low |
| 8855 Prop Plane | 2 | elevator direction inferred | the linkage is built but its direction is not shown | 005-006, 011 | low |
| 8865 Test Car | 3 | three speeds | reviews say three speeds plus neutral | — | low |
| 8865 Test Car | 11 | lever turns shaft | Technicopedia: lever pushes axle fore/aft, crank lifts lights ~45° | — | medium |
| 8849 Tractor | 3 | pendular front axle (inferred) | step 12 separate front-axle assembly; Technicopedia lists a pendular front axle | scan 005 | medium |
| 8849 Tractor | 2 | stack turns with steering (inferred as feature) | stack geared to the steering by bevels; whether a knob or a detail is not shown | scans 005-007 | low |
| 8848 Power Truck | 4, 5 | right lever tips the body, left lever lifts the bucket arms (inferred) | two yellow levers in the cab, no arrows; reviews confirm cab levers work the bucket and the tipper | p.9 step 21, p.12 | low (side) |
| 8848 Power Truck | 6 | front 24-tooth gear tips the bucket (inferred) | gear, toggle joint and stick in step 21; "dumping scoop" in Technicopedia | p.9 | medium |
| 8859 Tractor | 7 | the bonnet stays rigid | the product text says "lifting bonnet"; step 19 inset adds toggle-joint pieces at the cab front | p.12 | medium |
| 950 Fork Lift | 1 | the pinions are on the top axle with the handwheel | the handwheel is on the upper axle (medium); which axle carries the pinions is unclear | p.8 | low |
| 855 Mobile Crane | 5 | outriggers slide out on tiles | no arrow; BrickEconomy says "telescoping outriggers" | 011 (chassis step 7), 013 | medium |
| 956 Auto Chassis | 4 | two-speed sliding gearbox, inferred | lever fixed across the input shaft; reviews say 2-speed, unsynchronised | 004 (engine steps 10, 12) | medium |
| 956 Auto Chassis | 7 | armrest folds up, "unsure it is meant to move" | pinned bricks and a gap, no arrow; reviews say the armrest stows | 011 (rear seat steps 2-4) | medium |
| 850 Fork Lift | 1 | — | Technicopedia: wheel on the right, drive into a parallel axle to the racks | technicopedia.com/850.html | medium |
| 851 Tractor | 4 | lever lifts the hitch (inferred, unsure) | linkage fits a lift, no arrow; web: over-centre lift lever beside the seat | 005 (step 18), 009-010 (steps 29-31); thelegocarblog link | medium |
| 852 Helicopter | 2 | sticks set collective pitch (inferred, unsure) | the linkage fits collective; web: collective, no cyclic, sticks move fore and aft only | 002-004, 008 (steps 16-17); technicopedia.com/852.html | medium |

### Source wording only

| Set | Fn | The list says | The booklet shows | Page | Confidence |
|---|---|---|---|---|---|
| 8835 Forklift | 2 | "steps 13 ... 14 (arrow ...)" | fine; could add Technicopedia lead "raise, lower and tilt" | — | — |
| 8854 Power Crane | 1 | "the book draws no knob" | step 20 shows the yellow stack put on the shaft top | p.25 | medium-high |
| 8854 Power Crane | 6 | "inferred: what it's for" | step 15 inset shows the pawl and its swing on the gear | p.16 | medium |
| 8855 Prop Plane | 3 | "inferred: that the two ailerons move opposite ways" | the step 18 inset shows the links on opposite sides of the rotor; it could say "book: step 18 inset" | 017 | medium |
| 8865 Test Car | 11 | inferred from parts | add: blueprint front arrow at headlights (scan 001) | scan 001 | high |
| 8865 Test Car | 10 | headrest tilts (book) | no arrow for the headrest; backrest only | scan 001 | medium |
| 8849 Tractor | 2 | "inferred" | gearing is in steps 13, 15, 17 (book); only the purpose is inferred | scans 005-007 | high |
| 8020 Building Set (Universal) | 2 | note "inferred: nothing is driven from the wheels" | steps 2 and 14 show it: wheels on pins, no gear | p.2, p.5 | high |
| 8851 Excavator (Pneumatic) | 5 | "that it slews by hand is inferred" | turntable built free, held only by the threaded axle and nut | p.8-9 steps 7, 13 | medium-high |
| 8841 Dune Buggy / Desert Racer | 2 | "that rolling drives it is inferred" | crank gear fixed on the left rear axle (steps 2-4) | p.3 | medium-high |
| 8841 Dune Buggy / Desert Racer | 4 | "inferred: the right rear axle ... drives nothing" | two separate axles, gear only on the left (step 2) | p.3 | medium-high |
| 8859 Tractor | 4 | "step 18 inset (the 24-tooth gear and the lever)" | the inset belongs to step 17 | p.11 | high |
| 856 Bulldozer | 4 | "inferred: unsure whether it is meant to be fixed" | step 11: each angled beam is pinned at top and bottom, so it is rigid | p.4 | medium |
| 854 Go-Kart | 4 | "inferred: unsure whether the nose is meant to stay put or to tip" | the nose rests at a fixed slant on the chassis front; no arrow | 003 (step 4), 004 (step 5) | medium |
| 855 Mobile Crane | 9 | "what it does from the user" | the hand-worked lever and rubber band are drawn in cab step 17 | 006 | high |
| 956 Auto Chassis | 4 | "engine step 12 shows the lever's axle" | the lever on the input shaft is drawn in engine step 10; step 12 adds the plates around it | 004 | medium |
| 850 Fork Lift | 1 | handwheel "on the mast's left side" | the cover shows it on the truck's right side (24-tooth gear on the left) | 001 | medium |
| 850 Fork Lift | 1 | note: lower axle "unsure, perhaps a slower crank or a brake" | it is the slower crank | 008, 001 | medium |
| 851 Tractor | 4 | "unsure that the lever is meant to lift" | can say: the linkage geometry plus the web leads support a lift; still no arrow | 009-010 | medium |
| 852 Helicopter | 1 | handwheel "on the cabin's right side" | the cover (nose left) shows it on the side facing the camera, the helicopter's left | 001 | medium |
| 852 Helicopter | 2 | "unsure that the sticks are meant to work the blade pitch" | can drop the doubt: collective; one cross shaft, no sideways input | 002-004, 008 | medium |

---

# The sets

## 8835 Forklift
Booklets: omr/instructions/8835-1/001-016.jpg, one booklet of 16 pages. p.1 is the cover. p.2-9 are the main model (steps 1-17, with mast sub-steps 1-8 on p.3-4). p.10-14 are the B model (a sweeper). p.15-16 are the 8700 motor add-on, which is not in the set. Functions pages: none. I used the cover p.1 (arrows), the build steps p.2-9 and the motor add-on p.15-16. Pages read: 12 closely + 0 as contact sheets. Time: about 10 min.
### Functions page (blind reading)
There is no functions page. This reading comes from the cover and the build steps.
1. Yellow round knob on the cab roof → the rear wheels steer. The knob sits on a vertical axle 10 (p.5 step 8) with a gear at its foot, and that gear works the rack under the rear (p.2 step 4). On the cover (p.1) the blueprint draws a rotation arrow at the knob.
2. Big grey handwheel on the cab's side, turned → the forks rise and fall on the chain mast. The drive goes through a worm (p.7 step 12) and gears to the chain sprocket (p.3-5). The cover shows a red up arrow at the forks. The 8700 add-on (p.16) puts a motor and belt on the same side wheel, which supports this reading.
3. The wheels roll freely, pushed by hand (p.9 step 17). Nothing drives them.
4. Possible mast tilt: the black link from the mast is swung up onto a pin at the cab front (p.8 step 14, yellow curved arrow). I first read this arrow as a build action only. I did not identify it as a function.
### Comparison
- fn 1 "crank wheel raises forks": AGREES.
- fn 2 "wedge-belt wheel tilts mast": NOT ON PAGE (book steps 13-14). In step 13 (inset 3) a short liftarm is pinned to the wheel. In step 14 the arrow puts the black mast link onto that liftarm's pin. This fits a crank-and-link tilt.
- fn 3 "roof knob steers rear wheels": AGREES (cover arrow at the knob, steps 4, 8 and 14).
- fn 4 "wheels roll freely": AGREES.
- Missing from list: none.
### Doubts settled
- fn 2: is the tilt real, and is the wheel turned through a full turn or only part of one? The tilt is real: step 13 inset 3 and step 14 show the link on a crank pin, and Technicopedia lists the forks as able to "raise, lower, and tilt". Confidence: medium. The book does not show how far the wheel turns. With a crank pin on a wheel and a link to the mast, a full turn would rock the mast back and forth, but only if the geometry has room. Not settled from the booklet; confidence low.
### Video leads
- fn 2: Technicopedia lists forks that raise, lower and tilt, and says the lift is a worm-driven chain. It does not say how the tilt is worked. https://technicopedia.com/8835.html. video lead: Erik to look (how far the tilt wheel turns), confidence low.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| video | 2 | tilt wheel: full or part turn unsure | crank pin + link (steps 13-14); range not shown | p.7-8 | low |
| source | 2 | "steps 13 ... 14 (arrow ...)" | fine; could add Technicopedia lead "raise, lower and tilt" | — | — |

## 8854 Power Crane
Booklets: omr/instructions/8854-1/001-048.jpg, one booklet of 48 pages. p.1 is the cover. p.2-3 are pneumatic tips. p.4-27 are the main model: steps 1-18, then boom sub-steps 1-11, then steps 19-22. p.28-46 are the B model. p.47 is the 8700 motor add-on (not in the set). p.48 is the back cover. Functions pages: none. I used the cover p.1 (arrows and the pneumatic inset), the build steps and p.2. Pages read: 22 closely + 3 contact sheets (p.2-46). Time: about 20 min.
### Functions page (blind reading)
There is no functions page. On the cover (p.1), red arrows show: the boom-tip swing (luffing), a dashed "170" line for the telescope, a hook drop (165), an arrow at the rear stabiliser leg ("70"), rotation arrows at the rear, and an inset with pump → valve → cylinder.
1. Yellow round piece on top of the vertical shaft behind the cab, turned → the front wheels steer. The shaft is axle 10 with a U-joint (p.15 step 14), and the round yellow stack goes on its top in p.25 step 20.
2. Black spring pump on the chassis, pushed down, together with a valve on the superstructure → the two yellow cylinders raise or lower the boom. Evidence: p.12 step 11 (pump), p.18 step 17 (cylinders), the cover inset and p.2.
3. Handwheel at the boom pivot → the boom extends or retracts. The drive is a worm at the boom root (boom step 4), gears (boom step 7), a shaft with a U-joint (boom step 10) and a pinion on the rack of the grey inner section (boom steps 8-9, yellow arrow on p.22). The cover shows "170".
4. Rear handwheel on the winch axle → the hook winds up or down. The drum is axle 10 with the string tied on (p.14 step 13), and the string runs over the boom tip (steps 19-21).
5. A handwheel low on the chassis → the superstructure slews on its turntable (p.13 step 12, pink inset with a rotation arrow on the post gear).
6. A handwheel low on the chassis → the two rear stabiliser legs go down or up (gears on p.6 step 5, legs on p.10 step 9, cover "70" arrow).
7. The wheels roll freely.

In my blind reading I guessed that the worm on p.12 step 11 drives the slewing. I did not settle which of the two low handwheels does what. The list says: the left wheel works an 8-tooth gear and a crown train to the turntable, and the right wheel works the worm to the legs. The part positions agree with this (p137 at x=+130, p491 at x=-130). In step 13 the wheel on the near (right) side sits right in front of the worm. I accept the list here, with confidence medium.
### Comparison
- fn 1 "roof beacon steers front wheels": AGREES. It is NOT ON PAGE as a control: no arrow shows it, but step 20 puts the yellow stack on the steering shaft's top.
- fn 2 "left low handwheel slews": AGREES in what it does. Which wheel works it comes from the list and the part positions, not from my blind reading (see above).
- fn 3 "right low handwheel lowers stabiliser legs": AGREES in what it does, with the same caveat as fn 2.
- fn 4 "stabiliser feet tilt": NOT ON PAGE (inferred). Step 9 insets 1-5 show only how the foot is built.
- fn 5 "rear handwheels wind the winch": AGREES (steps 13, 16, 21). A wheel is added in step 16 and two more in step 21.
- fn 6 "ratchet pawl holds hook": NOT ON PAGE (inferred purpose). The p.16 step 15 inset shows a striped part on a toggle joint against a 24-tooth gear, with a shaded swing range. That fits a pawl.
- fn 7 "handwheel at boom pivot extends boom": AGREES.
- fn 8 "cylinders raise/lower boom": AGREES.
- fn 9 "pump + valve lever": AGREES (cover inset, p.2).
- fn 10 "wheels roll freely": AGREES.
- fn 11 "hook hangs free": NOT ON PAGE (physics, steps 20-21 draw it hanging).
- Missing from list: none.
### Doubts settled
- fn 1: the book draws no knob → step 20 (p.25) puts the yellow round stack on the top of the steering shaft from step 14, and it is the only thing on that shaft. It is the control. Confidence: medium-high.
- fn 4: whether the feet tilt → not shown in the book. Confidence: low. This is harmless as it stands.
- fn 6: whether it is a ratchet → the step 15 inset (p.16) shows a pawl-like toggle on the 24-tooth gear with its swing range shaded. Ratchet: medium. Its purpose (holding the hook) is still inferred.
### Video leads
- fn 4, 6: Technicopedia lists "Luffing and telescoping boom, Hoist, Slewing, Outriggers, Steering, Pneumatics". It does not mention a ratchet or the foot tilt. https://technicopedia.com/8854.html. Brickset reviews (https://brickset.com/reviews/set-8854-1) give no detail. video lead: Erik to look, confidence low.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| source | 1 | "the book draws no knob" | step 20 shows the yellow stack put on the shaft top | p.25 | medium-high |
| source | 6 | "inferred: what it's for" | step 15 inset shows the pawl and its swing on the gear | p.16 | medium |
| video | 4, 6 | inferred | not shown | — | low |

## 8832 Roadster
Booklets: omr/instructions/8832-1/001-008.jpg, landscape spreads. p.1 is the cover. p.2-4 are the main model (steps 1-13). p.5-6 are the B model (a three-wheeler). p.7 is the B model with the 8700 motor, and p.8 is the back cover. Functions pages: none. There are no motion arrows on the main model's pages either. I used the cover photos and the build steps. Pages read: 6 closely + 1 contact sheet (p.5-8). Time: about 8 min.
### Functions page (blind reading)
There is no functions page, and the steps have no motion arrows.
1. Steering wheel → the front wheels steer. It works through a slanted column (axle 4, p.3 step 9), a gear on the rack (p.3 step 8) and the steering arms (p.2 step 5).
2. The rear wheels are sprung: a rear swing frame with a shock absorber behind the seat (p.3 step 7 parts; p.4 step 13 inset).
3. The wheels roll freely.
Step 12 (p.4) adds two axle-6 links with ball cups that run diagonally from the roll bar's top. I read them as braces, not as a function.
### Comparison
- fn 1 "steering wheel steers front wheels": AGREES.
- fn 2 "rear swing arm": AGREES. The step 13 inset shows the shock rising from the rear axle up behind the seat.
- fn 3 "shock spring pushes wheels down": AGREES (step 13 inset).
- fn 4 "wheels roll freely": AGREES.
- Missing from list: possibly a tilting steering column. Technicopedia says the column's angle can be changed, which gives "tilt steering". The booklet does not show this. It would be the column holder (2790a/2792) pivoting. This is a video lead only.
### Doubts settled
- fn 2: is the shock's top held on the roll bar's top axle or on the seat? In the step 13 inset (p.4) the shock's upper end goes into the black upright behind the seat, below the top cross axle with its grey bushes. The model puts the shock (p31) at y=22 and the top axle (p32) at y=-88, which is 110 LDU apart. The scan is too poor to settle it. Confidence: low.
### Video leads
- Missing (tilt steering column): Technicopedia says the angle of the steering column "can be changed" (tilt). A Brickset reviewer mentions "functional tilt steering and rear suspension". https://technicopedia.com/8832.html, https://brickset.com/reviews/set-8832-1. video lead: Erik to look, confidence medium that the tilt exists. It is not in the booklet.
- fn 2: no source on where the shock is mounted. video lead: Erik to look, confidence low.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| video | new | — | tilt steering column (from Technicopedia/Brickset, not the booklet) | — | medium |
| video | 2 | shock top on roll bar's top axle or seat: unclear | inset too coarse | p.4 | low |

## 8862 Backhoe Grader
Booklets: one scanned booklet, omr/instructions/8862-1/001-056.jpg (56 scans). Main model (backhoe loader) is 004-030, steps 1-28. B model (tractor with rake) is 031-051, steps 1-21. 052-055 add the 8720 motor set, to the B model only. 056 is the back cover (building tips). Functions pages: none. There are no motion arrows in the main model's steps. I used the build steps and the cover (001). Pages read: 27 closely + 6 contact sheets. Time: about 25 minutes.
### Functions page (blind reading)
No functions page. From the build steps and the cover, before I opened the list:
1. Steering: a shaft with a universal joint runs to the steering rack at the front (steps 5, 13, 19; 006, 013, 019). An axle comes up through the cab roof (step 23, 024) with a round cap (step 25, 026). I did not name the control with certainty.
2. and 3. Two worms at the front (step 10, 010), driven from the handwheels low on the cab sides (step 25, 026). I guessed they work the loader arms and the loader bucket (low).
4. Two worms at the rear (step 3, 005). I took them to drive the rear outriggers. The 24-tooth gears on the outrigger arms (steps 9 and 25) I misread as knobs (medium, but wrong on the detail).
5. A turntable at the rear (step 11, 011) carries the backhoe, so the backhoe slews. I did not find the control.
6. to 8. Three pneumatic cylinders: one lies low at the rear (step 15, 015), one is on the boom (step 24, 025), and the bucket cylinder is in the dipper arm (step 26, 027). The pump stands at the front (step 14, 014). Three valves sit in the grey tower (step 20, 020-021).
9. The wheels roll (step 28, 030).
### Comparison
- fn 1 "roof knob steers front wheels": NOT ON PAGE (book steps 5-6, 13, 18, 25). It matches the build steps: an axle up through the roof (step 23), a round cap (step 25) and the rack (step 13). Agrees with my reading.
- fn 2 "low right handwheel raises loader arms": NOT ON PAGE (book steps). Agrees with my guess about the front worms.
- fn 3 "low left handwheel tips loader bucket": NOT ON PAGE (book steps). Agrees with my guess about the front worms.
- fn 4 "high right handwheel swings both outriggers": NOT ON PAGE (book steps). The list has one worm for both outriggers, and the other rear worm for the slew. My "two worms, one per outrigger" was a guess. Steps 3, 9 and 25 fit the list: one worm, a crown gear and 8-tooth gears on the 24-tooth gears that sit on the outrigger arms.
- fn 5 "outrigger feet tilt": NOT ON PAGE (inferred).
- fn 6 "high left handwheel slews backhoe": NOT ON PAGE (book steps). I saw the turntable but not the control. It fits the list.
- fn 7 "cylinder on turntable raises boom": NOT ON PAGE (book steps 24-26). This is the low rear cylinder of step 15.
- fn 8 "cylinder on top of boom swings dipper": NOT ON PAGE (book steps). Agrees.
- fn 9 "cylinder on dipper curls bucket": NOT ON PAGE (book step 26). Agrees.
- fn 10 "pump plus three valves work the cylinders": NOT ON PAGE (book steps 14, 20-21, 25; inferred which valve works which cylinder).
- fn 11 "bonnet lifts on its back-edge axle": NOT ON PAGE (inferred).
- fn 12 "four wheels roll freely": NOT ON PAGE (book step 28). Agrees.
- Missing from list: none.
### Doubts settled
- fn 5 (feet tilt): step 24 insets 1-5 (025) build each foot on toggle joints. No page shows a foot tilting. Not settled. Low.
- fn 10 (which valve works which cylinder): the hoses cannot be traced on the 750-px scans of 020-027. Not settled. Low.
- fn 11 (bonnet lifts): step 21 inset 4 (022) builds the bonnet with a 12-long axle along one edge. No step shows it opening. The pump's knob stands up through the bonnet (022, 029), so a lift may be blocked or short. Not settled. Low.
- No other function has an "inferred" source or a note of doubt.
### Video leads
- Search "lego technic 8862 backhoe grader review functions". The summaries count "four different functions plus three pneumatic ones". They say nothing on the feet, the valve-to-cylinder mapping or the bonnet. Pictorial review with photos: https://www.eurobricks.com/forum/forums/topic/16345-pictorial-review-8862-backhoe-grader. Brickset review: https://brickset.com/reviews/45087. Also https://technicopedia.com/8862.html. These cover fn 5, 10 and 11: video lead: Erik to look, confidence low. No time-stamped video was found.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| video | 5 | feet tilt on toggles (inferred) | feet built on toggles; no tilt shown | 025 | low |
| video | 10 | valve-to-cylinder mapping inferred | hoses not traceable in scans | 020-027 | low |
| video | 11 | bonnet lifts (inferred) | axle along the bonnet edge; the pump knob passes through the bonnet; not shown opening | 022, 029 | low |

## 8855 Prop Plane
Booklets: one scanned booklet, omr/instructions/8855-1/001-036.jpg (36 scans). Main model (floatplane) is 002-017, main steps 1-18, with sub-builds for the pontoons (007-008), the tail (011) and the wings (014-016). B model (jet) is 018-032. 033-035 add the 8700 motor set. 036 is the back cover. Functions pages: none. One step inset has arrows (step 13 inset, 009), but on second look it is an assembly arrow, not a function. I used the build steps, the cover (001) and the 8700 page (035). Pages read: 16 closely + 4 contact sheets. Time: about 15 minutes.
### Functions page (blind reading)
No functions page. From the build steps, before I opened the list:
1. A control stick on a gimbal (step 10, 005) works rods back to the tail and out to the wings (steps 11-12, 005-006; tail steps 3-5, 011; wing steps 5-6, 016; step 18 inset, 017). I took these to be the elevators and ailerons (medium-low).
2. I read the step 13 inset (009) as the pontoon struts swinging from a gear and rack, worked by the three-armed rotor of step 14 (009). I now think this was wrong: the arrows show the strut tops being spread to fit on during assembly. The three-armed rotor is the aileron rocker.
3. The propeller turns (step 17, 013). There is a 24-tooth gear in the nose engine block (step 6, 003). I did not see the crank, rod and piston at first.
4. Four small wheels with tyres in the pontoons (step 8, 008).
5. The 8700 add-on (033-035) drives the propeller with a motor. It is not part of the set as sold.
### Comparison
- fn 1 "propeller works the engine's piston via a crank gear and rod": NOT ON PAGE (book steps 5-6 and 17). Step 6 inset (003) shows a 24-tooth gear, an off-centre axle, a rod and a block below, which fits the list. I had only "the propeller turns". Agrees, medium.
- fn 2 "stick forward and back tilts the elevators": NOT ON PAGE (book steps; the direction is inferred). Agrees with my reading.
- fn 3 "stick side to side works the ailerons in opposite ways": NOT ON PAGE (book steps; "opposite" is inferred). Agrees with my reading after the step 13 correction.
- fn 4 "pontoon wheels roll freely": NOT ON PAGE (book step 8). Agrees.
- Missing from list: none. No rudder control is built: the fin is fixed (tail steps 4-5, 011).
### Doubts settled
- fn 3 (ailerons move opposite ways): the step 18 inset (017, zoomed) shows two links from the rotor's two lower arms to a toggle on each wing's inner shaft, one on each side of the rotor's pivot. Rocking the rotor lifts one link and lowers the other, so the ailerons move opposite ways. Technicopedia's text agrees (a lead only). Settled, medium.
- fn 2 (which way the elevators tilt for which way the stick goes): no step shows it. Not settled. Low.
### Video leads
- Search "lego technic 8855 prop plane review functions ailerons elevator". Technicopedia (https://technicopedia.com/8855.html) says: a one-cylinder engine driven by the propeller; ailerons and elevators worked from the cockpit stick; a pair of 8-tooth gears reverses the turn so the ailerons match the stick. This supports fn 1 and fn 3, and says nothing about the elevator direction. Review with photos: https://www.eurobricks.com/forum/forums/topic/62403-set-review-8855-prop-plane-22-pics. For fn 2's direction: video lead: Erik to look, confidence low. No time-stamped video was found.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| video | 2 | elevator direction inferred | the linkage is built but its direction is not shown | 005-006, 011 | low |
| source | 3 | "inferred: that the two ailerons move opposite ways" | the step 18 inset shows the links on opposite sides of the rotor; it could say "book: step 18 inset" | 017 | medium |

## 8865 Test Car
Booklets: one scanned booklet, omr/instructions/8865-1/001-038.jpg. Main model (the Test Car) is scans 001-024 (steps 1-24); scans 025-033 build the B model (a red jeep), 034-037 are the 8700/8720 motor add-on pages for the jeep, 038 is the back cover (how to use pins). The model file models/8865-Test Car.mpd is the main model (wheels at z -10 and 700, seats, V4 engine, pop-up headlights). Functions pages: none. Used the cover blueprint (scan 001), which has red motion arrows, and the build steps; the only build-step motion diagram is the gear-lever diagram on scan 017 (step 18). Pages read: 17 closely (001 with 3 zoomed crops, 004, 005, 008, 009, 010, 012-019, 022-024) + 38 as 2 contact sheets. Time: about 15 minutes.

### Functions page (blind reading)
No functions page. From the cover blueprint (scan 001) and build steps:
1. Steering wheel (step 23; column with two universal joints, step 5) → front wheels steer.
2. Front wheels move up and down (blueprint: up arrow on front wheel) → independent front suspension with shock absorbers (steps 2, 9, 15).
3. Rear wheels move up and down (blueprint: up arrow on rear wheel) → independent rear suspension (steps 11-13).
4. Rolling the car (rear wheels) → through the differential (step 6) and gearbox, the engine's crankshaft and pistons (steps 18, scans 016-017); blueprint has a curved arrow at the very back (the flywheel end).
5. Gear lever with blue knob, slid fore and aft → three speeds. Scan 017 shows three side views labelled "1. – 2. 3."; the lever is drawn furthest forward in 1, about 2 studs further back in 2, about 1 stud further back again in 3 (taking the gearbox end of the drawing as the rear).
6. Seat slide: gear knob beside each seat (blueprint: gear with curved arrow, and a long fore-aft arrow at the seat base; step 12 adds two pinion blocks, "2x").
7. Seat backrest reclines (blueprint: curved arrow at the backrest).
8. Headlights at the front tip (blueprint: curved arrow at the front end, at the headlight unit; headlights on axles in step 17).
9. A second lever with a red knob (step 5 inset 2: red cone on a 3-long axle, universal joint, 12-long axle through a beam) — its shaft runs forward; no arrow in the book says what it works.

### Comparison
- fn 1 "steering wheel steers front wheels": AGREES (build steps 5, 10, 23; blueprint draws the wheel but no arrow on it).
- fn 2 "pushing the car turns the V4 engine": AGREES (blueprint rear arrow; steps 6, 14, 18).
- fn 3 "gear lever picks one of three speeds": AGREES (scan 017 diagrams).
- fn 4 "differential": AGREES (step 6; purpose inferred, standard).
- fn 5 "front independent suspension": AGREES (blueprint arrow on front wheel).
- fn 6 "rear independent suspension": AGREES (blueprint arrow on rear wheel).
- fn 7 "springs" (skip): AGREES.
- fn 8 "left seat slides by gear": AGREES (blueprint gear + fore-aft arrow; step 12 "2x").
- fn 9 "right seat slides": AGREES (step 12 "2x").
- fn 10 "backrests recline, headrests tilt": backrest AGREES (blueprint curved arrow); headrest tilt NOT ON PAGE (rests on step 23's hinges only).
- fn 11 "red lever raises pop-up headlights": headlights flipping AGREES (blueprint front arrow); that the red lever works them is NOT ON PAGE (inferred from parts). How the lever works DIFFERS in likelihood, see below.
- Missing from list: none certain. Possibly a neutral position on the gearbox (see fn 3 below).

### Doubts settled
- fn 3: "Which position is first gear, and how far apart?" → Scan 017 (step 18 diagrams): position 1 is with the lever furthest forward; 2 is about 2 studs (≈40 LDU) further back; 3 about 1 stud (≈20 LDU) further back again. Forward/back read from the drawing having the gearbox gears at its right-hand (rear) end. The label "1. – 2. 3." has a dash between 1 and 2 and the 1→2 travel is twice the 2→3 travel, which may mean a neutral between 1 and 2 (Brickset reviews say "3 speed transmission with neutral"). Confidence: positions and order medium; neutral low.
- fn 11: "Is this really what the red lever does?" → The blueprint's front curved arrow sits on the headlight unit, so the headlights do move (high). The red lever is the only control whose shaft runs to the front (step 5 inset 2), so it working the headlights is likely (medium). But it is built exactly like the gear lever (knob on a short axle, universal joint, long shaft through a beam), and the gear lever works by sliding its shaft fore and aft. Technicopedia's summary says the cabin lever pushes an axle forward and back, which turns a crank that raises the lights about 45°. So the red lever most likely slides the shaft (push-pull), not turns it. Book alone: medium-low; with the lead: medium. Erik to look.
- fn 10 headrest tilt: not settled by the book (no arrow); low.

### Video leads
- fn 11: Technicopedia (https://technicopedia.com/8865.html) per the search summary: a lever in the cabin pushes an axle forward and back; the axle turns a crank that raises the retractable headlights about 45°. Not a video; summary only. video lead: Erik to look, confidence medium.
- fn 3: Brickset reviews (https://brickset.com/reviews/set-8865-1) per the search summary: "3 speed transmission with neutral", four working pistons, double-wishbone suspension front and rear, pop-up headlights, adjustable seats. video lead: Erik to look (neutral position), confidence low.

### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| what | 11 | red lever turns the long shaft | lever built like the gear lever (knob, UJ, shaft through a beam); most likely slides the shaft fore/aft to work a crank at the front (Technicopedia agrees) | scan 004 (step 5 inset 2), scan 001 blueprint | medium |
| source | 11 | inferred from parts | add: blueprint front arrow at headlights (scan 001) | scan 001 | high |
| direction | 3 | positions unknown | 1 furthest forward, 2 ≈40 LDU back, 3 ≈20 LDU further back; maybe neutral between 1 and 2 | scan 017 | medium (neutral low) |
| video | 3 | three speeds | reviews say three speeds plus neutral | — | low |
| video | 11 | lever turns shaft | Technicopedia: lever pushes axle fore/aft, crank lifts lights ~45° | — | medium |
| source | 10 | headrest tilts (book) | no arrow for the headrest; backrest only | scan 001 | medium |

## 8849 Tractor
Booklets: one scanned booklet, omr/instructions/8849-1/001-028.jpg. Main model (tractor with sprayer) is scans 001-014 (steps 1-26, finished model on 014); scans 015-022 build the B model; 023-027 are 8700 motor add-on pages; 028 the back cover (pins). The model file models/8849-Tractor.mpd is the main model (submodels front, tractor, irrigation; sprayer p269 red at the rear). Functions pages: none; no motion arrows anywhere in the main model's steps. Used the cover photos and the build steps. Pages read: 13 closely (002-014, with 4 zoomed crops) + 28 as 1 contact sheet. Time: about 12 minutes.

### Functions page (blind reading)
No functions page and no motion arrows. From the build steps:
1. Steering wheel (step 8, column and universal joint) → through the shaft under the bonnet (circle in step 17, scan 007) → rack on the front axle (step 12) → front wheels steer.
2. Exhaust stack (step 15: 12-long axle, 2x2 round brick on top, bevel gear at the foot) meshes a bevel gear on the steering line (step 13): the stack turns with the steering, and its round top could act as a steering knob.
3. Front axle is a separate beam assembly (step 12), possibly rocking.
4. Rear wheels on half-axles with a 24-tooth gear (step 4) → gear train (steps 6-7) → something at the rear (output shaft).
5. Belt wheel with bevel and upright 6-long shaft with 8-tooth gear (step 22, on the cab side) → worm (step 7) → rear cross axle and lift arms (steps 5-6, 10-11) → raises the three-point hitch carrying the sprayer (steps 22-23 top link, 26 boom, finished on scan 014).
6. Sprayer boom: fixed bricks, hoses, tank (steps 25-26, scan 013); nothing moves on it by itself.

### Comparison
- fn 1 "steering wheel steers front wheels": AGREES (steps 8, 11, 12, 17).
- fn 2 "exhaust stack turns with steering": AGREES (steps 13, 15, 17; bevel gears confirmed as 14-tooth bevels in the step 13 and 15 parts lists). Not on any arrow (inferred as a feature).
- fn 3 "front axle rocks": NOT ON PAGE (inferred from step 12).
- fn 4 "rolling turns the PTO": AGREES in substance (steps 4, 6-7); no arrow.
- fn 5 "handwheel raises the hitch and sprayer": AGREES (steps 7, 9-11, 22); lower links locking to the cross axle is inferred from parts.
- fn 6 "sprayer stays upright as hitch rises": AGREES (steps 11, 22-23, 26, scan 014).
- fn 7 "wheels roll": AGREES.
- Missing from list: none.

### Doubts settled
- fn 2: "the book doesn't say whether the turning stack is meant as a feature" → Not settled by the book (no arrows anywhere). The step 15 parts show the stack is a 12-long axle with a 2x2 round brick as a knob on top and a 14-tooth bevel at its foot meshing the steering line's bevel (step 13, circle in step 17): the gearing is certain (high); that it is meant as a hand-of-god steering knob or a turning-exhaust detail is not shown (low).
- fn 3: pendular front axle → step 12 builds the front axle as its own assembly hung on the shaft; Technicopedia's feature list names "pendular front axle". Book alone: medium; with the lead: medium-high.
- fn 5: lower links turn with the cross axle → steps 10-11 show the toothed toggle joints and half bushes on the cross axle, consistent with the list; medium.

### Video leads
- fn 3: Technicopedia (https://technicopedia.com/8849.html) per the search summary lists features "Steering, Lifting sprayer, PTO, pendular front axle". Not a video; summary only. video lead: Erik to look, confidence medium.
- fn 2: no source found that mentions the exhaust stack. Brickset's 1980s tractor comparison (https://brickset.com/reviews/40947) calls the 8849 "in some ways ingenious - badly flawed" without detail in the summary. video lead: Erik to look, confidence low.

### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| video | 3 | pendular front axle (inferred) | step 12 separate front-axle assembly; Technicopedia lists a pendular front axle | scan 005 | medium |
| video | 2 | stack turns with steering (inferred as feature) | stack geared to the steering by bevels; whether a knob or a detail is not shown | scans 005-007 | low |
| source | 2 | "inferred" | gearing is in steps 13, 15, 17 (book); only the purpose is inferred | scans 005-007 | high |

## 1972 Go-Kart
Booklets: omr/instructions/1972-1/ (8 scans, one booklet; p.1 cover, p.2-7 steps 1-13, p.8 back cover). Functions page: none. The back cover p.8 has a top-view photo with blue arrows: the front wheels swing about their pivots. Pages read: 8 closely. Time: 5 min.
### Functions page (blind reading)
No functions page. From the back cover p.8 arrows and steps 4-13:
1. Steering wheel (on the slanted column, steps 4-6 and 12-13) → the gear meshes the rack (step 10), and the front wheels steer left and right (p.8 arrows).
2. The four wheels roll freely. No drive is shown.
### Comparison
- fn 1 "steering wheel steers the front wheels": AGREES (back-cover arrows and build steps).
- fn 2 "four wheels roll freely": AGREES (build steps 4-5, 7, 13).
- Missing from list: none.
### Doubts settled
- None. No source says "inferred". The list's question "Anything moving besides steering and wheels?" gets the answer no. No other part has an arrow, and no other moving mechanism is built. Confidence: high.
### Video leads
- None needed.
### Proposed changes
None.

## 8020 Building Set (Universal)
Booklets: omr/instructions/8020-1/ (21 scans of 2-page spreads, one booklet). The model file builds the yellow truck: p.2-5, steps 1-14. The file's 13 STEPs match the booklet's steps part for part. The other models start on p.5 right (a van), with the windmill, helicopter, bulldozer and others after. Back cover p.21: photos of alternate models only. Functions page: none. Pages read: 5 closely (p.1-5) + 1 (p.21).
Time: 6 min.
### Functions page (blind reading)
No functions page and no motion arrows. From the build steps:
1. Tyre on the cab roof (step 13: on a 4-long axle with an 8-tooth gear at its foot) → crown gear (step 6) → 8-tooth gear and rack (steps 4-5) → the front steering arms (step 2). The front wheels steer.
2. The four wheels roll freely on pins in the steering arms and the chassis. Nothing is driven.
### Comparison
- fn 1 "roof wheel steers the front wheels": AGREES (book steps 2, 4-6, 13).
- fn 2 "four wheels roll freely": AGREES (book steps 2, 14).
- Missing from list: none.
### Doubts settled
- fn 2: note "inferred: nothing is driven from the wheels" → correct. The wheels sit on pins in the steering arms and the chassis, and no gear is on a wheel axle (steps 2, 13-14). Settled by build steps 2 and 14, confidence high.
### Video leads
- None needed.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| source | 2 | note "inferred: nothing is driven from the wheels" | steps 2 and 14 show it: wheels on pins, no gear | p.2, p.5 | high |

## 8851 Excavator (Pneumatic)
Booklets: omr/instructions/8851-1/ (28 scans, one booklet; p.1 cover, p.2 pneumatics intro, p.3-15 excavator steps 1-19, p.16-25 bulldozer B model, p.26-27 tips, p.28 back cover = bulldozer photos). The model file is the excavator.

Functions "page": the cover p.1 lower half is a diagram of the finished excavator. It shows the pump pushed down (white arrows) and three valve levers with colour dots: magenta → boom up and down, green → stick in and out, cyan → bucket curl. The step 19 inset on p.15 is a 3-row photo strip: pump pushed, one valve lever pushed either way (white double arrow), and the arm part moving.

Pages read: 12 closely (p.1, 2, 3, 6, 8, 9, 10, 11, 12, 14, 15, 26-28 partly) + 0 contact sheets. Time: 12 min.
### Functions page (blind reading)
1. Pump plunger pushed down (cover white arrows; p.2; step 10). Air goes to the valves.
2. Magenta valve (the one farthest from the pump) → boom cylinder raises and lowers the boom (cover magenta arrow; p.15 inset row 1, bottom valve).
3. Green valve (middle) → stick cylinder on top of the boom swings the stick in and out (cover green arrow; p.15 inset row 2).
4. Cyan valve (the one nearest the pump; the pump hose enters it) → bucket cylinder on the stick curls the bucket through links (cover cyan arrow; p.15 inset row 3).
5. The superstructure sits on a turntable held by a threaded axle (steps 7-8, 13). No arrow, but it is built to slew.
6. Tracks roll on 40-tooth sprockets and small idlers (steps 7-8). Nothing drives them.

Lever direction: each inset shows the lever pushed both ways (double arrow). Which way gives which motion is not shown.
### Comparison
- fn 1 "left valve → boom": AGREES. The left valve p17 (x=-100) is farthest from the pump p580 (x=110), which matches the inset's valve with no pump hose.
- fn 2 "middle valve → stick": AGREES.
- fn 3 "right valve → bucket": AGREES. p542 (x=60) is nearest the pump, as in inset row 3.
- fn 4 "hand pump": AGREES (p.2, step 10, cover).
- fn 5 "cab slews on the turntable": NOT ON PAGE (book steps 7-8, 13; slewing inferred).
- fn 6 "tracks roll freely": AGREES with the build steps (steps 7-8). No arrow.
- Missing from list: none.
### Doubts settled
- fn 5: "that it slews by hand is inferred" → it does slew. Step 7 shows a turntable plate (round top on a square base) with the 10-long threaded axle through its centre, and step 13 seats the superstructure on it. The nut only holds the two halves together. Nothing locks the turntable. Settled by build steps 7 and 13 (p.8-9), confidence medium-high. The list's question "free or clamped by the nut?": the book shows no clamp. Treat it as free.
### Video leads
- fn 5: one search ("lego technic 8851 excavator review turntable") found no review that talks about the turntable. Only general history came up (thelegocarblog.com/2013/06/14/youve-come-a-long-way-baby/ calls the 8851 LEGO's first real excavator, from the 1984 pneumatics). No video lead to give.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| source | 5 | "that it slews by hand is inferred" | turntable built free, held only by the threaded axle and nut | p.8-9 steps 7, 13 | medium-high |

## 8841 Dune Buggy / Desert Racer
Booklets: omr/instructions/8841-1/ (17 scans of spreads, one booklet; p.1 cover, p.2 text, p.3-6 left buggy steps 1-15, p.6 right onward a tractor B model, p.17 back cover = tractor photos with an arrow on its plough). The model file is the buggy: submodels Desert Racer, Piston, Engine, Seat, Steering wheel. Functions page: none, and no motion arrows on the buggy. The yellow dashed arrows in step 13 (p.5) show where the long red beams go when they are fitted; they are not motion arrows. Pages read: 7 closely (p.1-7, with zooms of steps 3-4, 6-7, 13) + 1 (p.17).
Time: 12 min.
### Functions page (blind reading)
No functions page. From the build steps:
1. Steering wheel (step 13: a wheel on a column through universal joints and an 8-tooth gear) → rack (step 12) → the front steering arms (step 5). The front wheels steer.
2. Engine: step 3 builds a 24-tooth gear with an off-centre pin (a crank). Step 4's inset shows the pin driving a connecting-rod assembly up to the engine block behind the seat (steps 6-7, 9). The book shows no arrow, but rolling the rear wheel should drive the piston.
3. All wheels roll freely.
### Comparison
- fn 1 "steering wheel steers the front wheels": AGREES (steps 5, 12, 13).
- fn 2 "rolling works the piston via a crank pin in the 24-tooth gear on the left rear axle": NOT ON PAGE (book steps 3-5; drive inferred). It agrees with my reading of the steps.
- fn 3 "front wheels roll freely": AGREES (steps 5, 15).
- fn 4 "rear wheels on separate axles; only the left turns the engine": NOT ON PAGE (steps 2, 15; inferred). It agrees with the steps.
- fn 5 "cage, seat and column mount rigid": NOT ON PAGE (inferred from steps 10-14).
- Missing from list: none.
### Doubts settled
- fn 2: the drive from rolling is inferred → correct. Step 2 fits two separate 8-long rear axles. Steps 3-4 put the crank gear on the left one, and the model has gear p20 at x=-30 on axle p15 (x -180 to -20). Rolling the left rear wheel turns the crank. Settled by steps 2-4 (p.3), confidence medium-high. The scan is small, and the gear's axle is hard to see in step 3.
- fn 4: "the right rear axle turns on its own and drives nothing" → correct. Step 2 uses two separate axles, and no gear is on the right one. Settled by step 2 (p.3), confidence medium-high.
- fn 5 / question "Is the seat back meant to fold?": the book shows no arrow on the seat. Steps 10-11 build the seat on its hinge axle, and the cage joints in steps 12-14 lock it. No folding function. Confidence medium.
### Video leads
- None searched. The book settles every function to medium or better.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| source | 2 | "that rolling drives it is inferred" | crank gear fixed on the left rear axle (steps 2-4) | p.3 | medium-high |
| source | 4 | "inferred: the right rear axle ... drives nothing" | two separate axles, gear only on the left (step 2) | p.3 | medium-high |

## 8845 Dune Buggy
Booklets: omr/instructions/8845-1/ (13 scans of spreads, one booklet; p.1 cover, p.2 text, p.3-5 buggy steps 1-14, p.6 onward alternate models, p.13 back cover). The back cover p.13 has three photos: a close-up of the steering wheel, gears and shock absorbers; a close-up of rack-and-pinion steering; and a child pushing the buggy, with a rear shock visible. The model file is the buggy. Functions page: none, and no arrows. Pages read: 5 closely (p.1-5, with zooms of steps 8-10) + 1 (p.13).
Time: 14 min.
### Functions page (blind reading)
No functions page. From the build steps and back-cover photos:
1. Steering wheel (step 8: wheel, column, universal joint, 16-tooth gear) → gears → 8-tooth pinion → rack on the tie bar (steps 5-6) → the front wheels steer (back-cover close-up).
2. Rear suspension: the rear wheels' axles are carried on swinging arms (steps 1-3). Two shock absorbers (step 9) spring them (back-cover photo).
3. All wheels roll freely.
### Comparison
- fn 1 "steering wheel steers the front wheels": AGREES (steps 4-8, back cover).
- fn 2 "rear trailing arms swing, shocks shorten": AGREES (steps 1-2, 9, back cover).
- fn 3 "springs hold the arms down" (skip): AGREES (step 9, back cover).
- fn 4 "four wheels roll freely": AGREES (steps 1, 14).
- fn 5 "roll cage rigid": NOT ON PAGE (steps 12-14; a stays-only check).
- Missing from list: none.
### Doubts settled
- No function says inferred or unsure.
- The generated result for fn 1 is "no" ("p100 4185 has no joint to work", cause control-fixed), so I checked the column. The model has: steering wheel p100 at (90,-113,-152); column axle p95 3705 at (90,-84,-171); bush p99 3713 between them; and the Technic plate 2x8 p94 3738 that step 8 threads the column through, at (50,-79,-175). By geometry the column crosses the plate's plane at x=90. That is a hole position (offset +40 from the plate centre), so the hole is there. But the plate is tilted about 37° and the column about 34°, which leaves them about 3° out of line. That may be why no joint forms. Step 8 shows the column square through the plate's hole. This is a lead for the model file or the joint tolerance, not a settled fault. Confidence low-medium.
### Video leads
- None needed for function content.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| model | 1 | steering wheel p100 works the rack (generated: "no", control-fixed) | step 8: column goes straight through the 2x8 plate's hole. In the file, plate p94 3738 and column p95 3705 are about 3° out of line, so the column may not seat in the hole | p.4 step 8 | low-medium |

## 8848 Power Truck
Booklets: omr/instructions/8848-1/001-032.jpg, one scanned book. Main model is on p.1-12 (steps 1-28). p.13-20 hold alternative models. p.21-32 hold the motor add-on (870/960, 872) and 8710 ideas. Functions pages: none. Pages read: 8 closely (1, 5-10, 12) + 32 as contact sheets. Time: about 15 min.
### Functions page (blind reading)
No functions page. This reading comes from the build steps and the cover photo (p.1).
1. Steering wheel on the cab → front wheels steer. The wheel's column (step 19) has a small gear at its foot, and it meets the rack on the tie plate (steps 9-11).
2. Rear differential (step 7). The arrows on the two rear axle ends (p.5) show them turning, so the rear wheels can turn at different speeds.
3. A drive shaft runs forward from the differential through a universal joint (steps 7-8, 16). Its purpose is not shown.
4. Tipping body: the cover shows it raised on struts. The mechanism is the racks and struts (steps 12-13), the 24-tooth gear pair (step 17) and the crank and link (steps 20-22). The control is most likely a yellow lever beside the steering wheel (step 21). No arrow shows this.
5. Front bucket on arms. The cover shows it raised, with rods from the cab front. Step 21 shows a 24-tooth gear on the front with a toggle joint and a stick, and the yellow levers in the cab. No arrows.
6. The wheels roll freely.
### Comparison
- fn 1 "steering wheel turns the front wheels": AGREES.
- fn 2 "rear differential": AGREES (step 7, arrows on p.5).
- fn 3 "differential also turns the forward shaft and the rear stub": NOT ON PAGE (book steps 7-8; what the shafts are for is inferred). The model's forward shaft ends under the cab at a bush (power_train_front, z about -359). It meets nothing.
- fn 4 "right yellow lever tips the body": NOT ON PAGE (inferred). The book shows the parts but no arrows.
- fn 5 "left yellow lever raises the bucket arms": NOT ON PAGE (inferred).
- fn 6 "front 24-tooth gear tips the bucket": NOT ON PAGE (inferred from step 21).
- fn 7 "front wheels roll freely": AGREES.
- Missing from list: none.
### Doubts settled
- fn 3: what the forward shaft drives → in the unmotorised truck, nothing. It ends under the cab (steps 16 and 21; model file). On p.21-23 a motor drives the truck through this shaft. The list's note stands. Confidence medium.
- fn 4, fn 5: which lever works which → the book gives no arrows. Not settled. Reviews say that levers in the cab work the bucket and the tipper (see the video leads). Confidence low that left and right are right.
- fn 6: is the gear a knob → step 21 shows the 24-tooth gear, a toggle joint and a stick. Technicopedia lists a "lifting and dumping scoop", which supports a separate tip control. Confidence medium.
### Video leads
- fn 4, 5, 6: Technicopedia lists steering, a lifting and dumping scoop, a differential and a dumping bed. A Brickset review praises "the levers in the cab for the bucket on the front and the tipper bed". https://technicopedia.com/8848.html , https://brickset.com/reviews/set-8848-1 (no video found). Video lead: Erik to look. Confidence medium that there are two cab levers (bucket arms, body); low for which side works which.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| video | 4, 5 | right lever tips the body, left lever lifts the bucket arms (inferred) | two yellow levers in the cab, no arrows; reviews confirm cab levers work the bucket and the tipper | p.9 step 21, p.12 | low (side) |
| video | 6 | front 24-tooth gear tips the bucket (inferred) | gear, toggle joint and stick in step 21; "dumping scoop" in Technicopedia | p.9 | medium |

## 8859 Tractor
Booklets: omr/instructions/8859-1/001-040.jpg, one scanned book. Main model is on p.1-13 (steps 1-20), with the cultivator on p.14-16 (steps 21-25). The model file's equipmentA submodels are this cultivator. p.16 bottom-17 holds a second implement. p.18-29 hold a B model (truck). p.30-40 hold the motor add-on and other models. Functions pages: none. Pages read: 10 closely (1, 3, 4, 6, 8-14, 16) + 40 as contact sheets. Time: about 15 min.
### Functions page (blind reading)
No functions page. This reading comes from the build steps and the cover photo.
1. Steering wheel → front wheels steer. The rack and steering arms are in step 6, the column and universal joints in steps 13-14, and the wheel in step 16.
2. Rear differential (step 1), with a drive shaft forward through a universal joint.
3. Engine: two pistons under the bonnet (step 15) are driven from the drive shaft by a gear train (step 14). So rolling works the pistons.
4. Lever on the left side of the cab (the inset at step 17, p.11): an axle handle and a toggle joint turn a 24-tooth gear with an 8-tooth gear. This works the toothed beams (step 11) that lift the three-point hitch. No arrow.
5. The cultivator's tines are held by rubber bands (steps 24-25).
6. Bonnet: the inset at step 19 adds toggle-joint pieces on the cab's front legs. This may be a hinge for the bonnet. No arrow.
7. A short axle with a bevel gear points back from the differential (step 2, inset 1). It may be a rear power take-off.
### Comparison
- fn 1 "steering wheel steers the front wheels": AGREES.
- fn 2 "rolling runs the engine": AGREES. The book's gearing (steps 1-3, 14-15) supports the inference.
- fn 3 "differential": AGREES.
- fn 4 "lever by the seat raises the hitch": AGREES, but the lifting is still inferred. The lever and its 24-tooth gear are in the inset on p.11, which belongs to step 17, not step 18 (source wording).
- fn 5 "front wheels free": AGREES.
- fn 6 "tines on rubber bands": AGREES.
- fn 7 "cab, legs, bonnet, exhaust rigid": DIFFERS in part. LEGO's own set text calls it a "piston-engine under lifting bonnet", and step 19's inset adds toggle-joint pieces at the cab's front legs. The bonnet may be meant to lift.
- Missing from list: possibly "bonnet lifts to show the engine" (see fn 7). Possibly "rear power take-off stub turns as the tractor rolls" (fn 3's note calls it a steadying bevel).
### Doubts settled
- fn 2: that rolling drives the engine → the gear train from the drive shaft to the crankshaft is drawn in steps 14-15, and there is no other input. Confidence high that it is meant to work. The model's mesh fault is a separate question.
- fn 3: the second bevel p21 on a short axle → step 2 inset 1 shows it on an axle 4 that points back. It could be a power take-off stub, not only a steady. Not settled. Confidence low.
- fn 4: that the lever lifts the hitch → the lever, 24-tooth and 8-tooth gears (p.11 inset) and the toothed beams (step 11) form one train to the hitch links. Confidence medium. No direction is given.
- fn 7: is the bonnet fixed → LEGO's product text says "lifting bonnet". The book shows toggle-joint pieces but no arrow. Not settled. Confidence medium that it lifts.
### Video leads
- fn 7: BrickEconomy quotes LEGO's description: "piston-engine under lifting bonnet". https://www.brickeconomy.com/set/8859-1/lego-technic-tractor . Reviews: https://brickset.com/reviews/set-8859-1 , https://technicopedia.com/8859.html (no video found). Video lead: Erik to look. Confidence medium.
- fn 4: no source found that shows the hitch lift working. Video lead: Erik to look. Confidence medium.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| video | 7 | the bonnet stays rigid | the product text says "lifting bonnet"; step 19 inset adds toggle-joint pieces at the cab front | p.12 | medium |
| what | 3 | the second bevel p21 only steadies the differential (inferred) | a short axle 4 with a bevel pointing back, maybe a rear power take-off | p.3 step 2 | low |
| source | 4 | "step 18 inset (the 24-tooth gear and the lever)" | the inset belongs to step 17 | p.11 | high |

## 856 Bulldozer
Booklets: omr/instructions/856-1/001-016.jpg, one scanned book. Main model is on p.1-8 (steps 1-20). p.9 is the motor add-on and p.10-16 hold alternative models. The book builds a tracked loader with a bucket (step 20). The cover photo shows a bulldozer blade instead, and no build of the blade is in these pages. The model file (Bucket and Track submodels) builds the book's loader. Functions pages: none. Pages read: 8 closely (1-8) + 16 as contact sheets. Time: about 10 min.
### Functions page (blind reading)
No functions page. This reading comes from the build steps.
1. One rear handwheel (step 6) drives, through gears (step 7), a sled of racks under the cab. Rods (steps 13-14, 17) push the loader arms up.
2. The other rear handwheel turns the 24-tooth gear on the axle across the cab top (step 10). That gear slides two racks (step 12), which work levers and rods (steps 13-18) to tip the bucket.
3. The tracks run on 40-tooth gears used as sprockets (steps 3-5, 20).
### Comparison
- fn 1 "left handwheel raises the arms": AGREES. Left versus right was not checked.
- fn 2 "right handwheel tips the bucket": AGREES. The rod routing is drawn in steps 13-18.
- fn 3 "tracks run freely": AGREES.
- fn 4 "angled front guard stays put": NOT ON PAGE (inferred). The book settles it: see below.
- Missing from list: none.
### Doubts settled
- fn 4: is the front guard fixed → step 11 (p.4) shows each angled beam held by a pin near its top and a pin at its lower end. Pinned at two points, it cannot swing, so it is rigid. If Kinebrick lets it swing, the model's pin and hole positions may not line up. The pins are p123 and p125 at the top and p24 and p25 at the bottom, near the beams p126 and p127. Confidence medium.
### Video leads
- None needed.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| source | 4 | "inferred: unsure whether it is meant to be fixed" | step 11: each angled beam is pinned at top and bottom, so it is rigid | p.4 | medium |
| model | 4 | Kinebrick lets it swing on its pins | it should be held at two points; check whether the bottom pins p24 and p25 meet the beams' holes | p.4 | medium |

## 950 Fork Lift
Booklets: omr/instructions/950-1/001-032.jpg, one scanned book. Main model is on p.1-8: forks steps 1-3, steering steps 1-5, main steps 5-13. p.9-16 hold alternative models and p.17-32 hold adverts and ideas. Functions pages: none. Pages read: 7 closely (1-3, 5-8), with zooms of step 13 + 32 as contact sheets. Time: about 12 min.
### Functions page (blind reading)
No functions page. This reading comes from the build steps and the cover photo.
1. The handwheel on the mast's left side raises and lowers the forks. A 24-tooth gear sits on the mast's right side, and 8-tooth gears run on the carriage's two long racks (forks steps 2-3, main step 13).
2. The steering wheel on top (step 12) steers the back wheels. Its upright axle turns a crown gear (step 9), which turns a 24-tooth gear on a lengthwise axle (step 6). That axle's 8-tooth gear slides the rack sled (steering steps 3-5).
3. The wheels roll freely.
4. There are two levers beside the seat (step 11: an axle 4 in a pin connector on each side). Nothing is drawn moving them.
### Comparison
- fn 1 "handwheel raises the forks": AGREES, with a gearing doubt (below).
- fn 2 "steering wheel steers the back wheels": AGREES.
- fn 3 "wheels roll freely": AGREES.
- fn 4 "two levers for show": AGREES. This is NOT ON PAGE as a motion, but no gear meets the levers.
- Missing from list: none.
### Doubts settled
- fn 1: the second axle 10 in step 13 → step 13's parts box lists 1 24-tooth gear, 3 of the small 8-tooth gear and 2 axles 10. So the lower axle carries an 8-tooth gear that meshes the 24-tooth gear, and the model file leaves out one axle 10 and one 8-tooth gear. It has only three 8-tooth gears in all.
  - The handwheel's hub lines up with the upper axle (the one with the 24-tooth gear), judged from the drawing's perspective. Confidence medium.
  - Which axle carries the two rack pinions is not clear from the scan. If they are on the lower axle, the 24-tooth gear to 8-tooth gear step gears the lift up 3:1; if they are on the upper axle, the lower gear is idle. Confidence low.
### Video leads
- fn 1: Brickset's "Vintage set of the week" and the set texts say the forks work by a "flywheel" (handwheel) control. A commenter on the 850 (the same model) asks whether the forks are held only by friction. https://brickset.com/article/70964/vintage-set-of-the-week-fork-lift-truck . No video found. Video lead: Erik to look at how the step-13 gearing is meant to work. Confidence low.
- fn 4: the set text speaks of "twin gear levers". This supports the levers being for show.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| model | 1 | the model file leaves out the lower axle and gear | step 13 adds 2 axles 10 and 3 small 8-tooth gears; the model lacks one axle 10 and one 8-tooth gear meshing the 24-tooth gear | p.8 | high |
| video | 1 | the pinions are on the top axle with the handwheel | the handwheel is on the upper axle (medium); which axle carries the pinions is unclear | p.8 | low |

## 854 Go-Kart
Booklets: omr/instructions/854-1/001-016.jpg, one booklet. Main model (the go-kart) is 001 (cover) and 002-008 (steps 1-13). 009-015 are the B models (an engine-on-stand and a trike, shown on the cover). 016 is the back cover: photos of the kart driven by the 870 motor add-on (not in the set). Functions pages: none. Pages read: 10 closely + 0 as contact sheets. Time: about 6 minutes.
### Functions page (blind reading)
No functions page and no motion arrows. From the build steps:
1. Steering wheel (step 10) → column with a universal joint (step 9) → small gear on the rack (step 7) → front wheels steer on their turntables (steps 4-5).
2. Rolling the kart → 24-tooth gear on the rear axle → gears in step 3 (inset: two 24-tooth gears with a crank between them and a short rod going up) → a piston moves up and down in the engine block behind the seat (steps 5, 10-11).
3. Front and rear wheels roll.
4. The white nose at the front is a tilted block on an axle 6 with bushes (steps 4-5, 8). No arrow on it.
### Comparison
- fn 1 "steering wheel steers the front wheels": AGREES (book steps 3-10).
- fn 2 "rear wheels work the engine": AGREES (book step 3 inset, steps 5, 10-11).
- fn 3 "front wheels roll freely": AGREES.
- fn 4 "nose hangs on the front axle": NOT ON PAGE (book steps 4-5 and 8 plus inference).
- Missing from list: none.
### Doubts settled
- fn 4: should the nose stay put or tip? → It stays put. In steps 4-5 the nose is two 1x2 Technic bricks on the front axle 6, held at a fixed slant against the sloped front of the chassis (the model file has them at the same slant, p50 and the brick next to it). No arrow shows it moving; it is styling, not a function. Settled by steps 4-5, confidence medium. Kinebrick letting the nose swing freely on p24 is wrong for the set as built; it should be held (rigid), as the list says.
### Video leads
- None searched: the booklet settles every function.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| source | 4 | "inferred: unsure whether the nose is meant to stay put or to tip" | the nose rests at a fixed slant on the chassis front; no arrow | 003 (step 4), 004 (step 5) | medium |
| model | 4 | Kinebrick lets the nose (p50) swing freely on p24 | the nose should stay fixed (rigid) | 003-004 | medium |

## 855 Mobile Crane
Booklets: omr/instructions/855-1/001-020.jpg, one booklet. Main model: cab and superstructure on 001-006 (steps 1-17), boom on 006-009 (steps 1-14), chassis and final assembly on 010-013 (steps 1-10). 014-019 are the B model (a dump truck). 020 is the back cover: photos of the crane, some with the 870 motor add-on. Functions pages: none. Pages read: 14 closely + 0 as contact sheets. Time: about 10 minutes.
### Functions page (blind reading)
No functions page. The one motion sign is the finger pressing the yellow lever in cab step 17 (006). From the build steps:
1. The cab turns on the turntable (chassis step 9, 012), carrying the boom.
2. A hand wheel turns an 8-tooth gear in two racks on sliders (cab steps 7-8); the racks push two struts (axles with end pieces) that raise and lower the boom (boom step 14, 009).
3. A hand wheel turns the winch drum with the string (cab step 8, string drum on axle 12); the hook goes up and down over the boom tip pulley (chassis step 10, 013).
4. A hand wheel on the boom pivot axle (boom step 13 inset, axle 12) drives gears and a shaft with couplings inside the boom (boom steps 5, 10) to a 24-tooth gear at the boom tip, which moves the rack on the blue inner boom (boom steps 7-9, 13): the boom extends and retracts.
5. Cab step 17: a finger presses a yellow 1x4 Technic brick (lever) by the two hand wheels; a rubber band is added in that step. This is a hand-worked lever on the gears (a pawl/brake).
6. Four wheels roll (chassis step 10). No steering.
7. Four outrigger beams with legs at the corners (chassis steps 7-8, 10); feet added under them. No arrow shows them moving.
8. The hook hangs on its string with a pulley block (chassis step 10).
### Comparison
- fn 1 "cab slews on its turntable": AGREES.
- fn 2 "front-left crank raises and lowers the boom through two racks and struts": AGREES (I could not read which hand wheel is which from the small scans; the mechanism agrees).
- fn 3 "back-left crank winds the winch": AGREES (same note on position).
- fn 4 "right-side crank on the boom pivot axle extends the blue inner boom": AGREES.
- fn 5 "four outriggers slide out on tiles": NOT ON PAGE (book chassis steps 7 and 10 show the beams laid on, no arrow).
- fn 6 "four road wheels roll freely, no steering": AGREES.
- fn 7 "four black window shutters swing open": NOT ON PAGE (book chassis step 8 shows the parts placed; no arrow).
- fn 8 "hook hangs straight down": AGREES.
- fn 9 "ratchet holds the boom up; lifting the lever lets it be lowered": partly AGREES. The book shows the lever worked by hand (step 17), but the finger presses DOWN on the lever's top, not lifts it.
- fn 10 "rubber band pulls the ratchet lever onto the gears": AGREES (rubber band in step 17's parts).
- Missing from list: none.
### Doubts settled
- fn 9 (source says "what it does from the user"): the lever is a hand-worked pawl, settled by cab step 17 (006), confidence high. Which way you push it to release: the drawing shows a finger pressing down on top of the lever. The model file has the lever p294 3701 pivoting on two pins (p293, p295), so pressing one end lifts the other. "Lifting the lever" in the list may describe the pawl end, not what the hand does. Confidence low; the scan is too small to see the pivot.
- fn 5: not settled by the book (no arrow). See video leads.
### Video leads
- fn 5 and fn 9: one search ("lego technic 855 mobile crane 1978 review outriggers ratchet"). BrickEconomy (https://www.brickeconomy.com/set/855-1/) calls them "telescoping outriggers" and lists a slewing turntable and a boom that luffs and telescopes. Technicopedia (https://technicopedia.com/855.html) says this set uses the first rubber band, to work a ratchet and pawl. Brickset user review: https://brickset.com/reviews/47521. These are written pages, not videos; no time stamps. video lead: Erik to look, confidence medium (outriggers move outward; supports fn 5) and high (ratchet with rubber band; supports fn 9 and 10).
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| video | 5 | outriggers slide out on tiles | no arrow; BrickEconomy says "telescoping outriggers" | 011 (chassis step 7), 013 | medium |
| direction | 9 | lifting the lever lets the boom be lowered | the finger presses down on the lever's top | 006 (cab step 17) | low |
| source | 9 | "what it does from the user" | the hand-worked lever and rubber band are drawn in cab step 17 | 006 | high |

## 956 Auto Chassis
Booklets: omr/instructions/956-1/001-013.jpg, one booklet. Main model throughout: engine 001-005 (steps 1-13, green dot), steering 005-007 (steps 1-10, yellow dot), chassis 007-010 (steps 1-14, blue dot), seats 011, final 012 (step 15), 013 (step 16, with photos of the 960 Power Pack add-on). The photo at the foot of 011 is a B model (scissor lift). Functions pages: none. Pages read: 13 closely + 0 as contact sheets. Time: about 10 minutes.
### Functions page (blind reading)
No functions page and no motion arrows. From the build steps:
1. Steering wheel (step 15) → column with universal joints → 8-tooth gear on the steering rack (steering steps 6-9, inset on 006) → front wheels steer.
2. Rolling the car → rear axle → crown gear and long drive shaft with universal joint (chassis steps 12-13 and their insets) → engine crankshaft (engine steps 10-11) → four pistons up and down; the 40-tooth gear at the engine's front turns.
3. Engine step 10: the input shaft (axle 10) carries a perpendicular connector with an axle standing up from it, beside a side shaft with 8- and 24-tooth gears. That looks like a gear lever that slides the input shaft. No arrow.
4. Two 24-tooth gears on short axles at the chassis sides (chassis step 12) with 8-tooth gears in racks under the two yellow front seat bases (chassis steps 10-11) → the front seats slide forward and back.
5. Wheels roll.
6. Seats page (011): the rear seat has Technic bricks pinned in its middle (steps 2-4) and a gap in its back; the front seat backs are built on hinge plates (seat steps 1 and 3). No arrows.
### Comparison
- fn 1 "steering wheel turns the front wheels": AGREES.
- fn 2 "rear axle runs the four-cylinder engine": AGREES.
- fn 3 "front wheels roll freely": AGREES.
- fn 4 "gear lever behind the engine slides the input shaft between two speeds": NOT ON PAGE (book engine steps 10 and 12 show the lever on the shaft; what it does is inferred).
- fn 5 "right-side gear slides the right front seat": AGREES.
- fn 6 "left-side gear slides the left front seat": AGREES.
- fn 7 "rear seat's armrest folds up into the slot": NOT ON PAGE (inferred from seats page).
- Missing from list: none certain. The front seat backs sit on hinge plates (seats page steps 1 and 3); I cannot tell from the scan whether they are meant to tilt. Low confidence; not proposed.
### Doubts settled
- fn 4 (inferred): engine step 10 (004) draws the upright axle in a connector fixed across the input shaft, next to the side shaft's gears, so a lever that slides the shaft is what the drawing shows. Confidence medium. A review (below) confirms a 2-speed gearbox behind the engine.
- fn 7 (inferred, "unsure it is meant to move"): the book shows the pinned bricks and the gap in the seat back but no arrow. Not settled by the book. Review below says the armrest can be stowed. Confidence medium (from the review only).
### Video leads
- fn 4 and fn 7: one search ("lego 956 auto chassis 1978 review gearbox seats armrest functions"). The Lego Car Blog review (https://thelegocarblog.com/2011/11/08/lego-technic-853-956-car-chassis-set-review) says the 2-speed gearbox is not synchronised, so gears often do not line up when you shift; the rear bench does not adjust but its armrest can be stowed; the front seats adjust; the rear "shock absorber" links cannot change length. BrickEconomy (https://www.brickeconomy.com/set/956-1/) lists a 2-speed transmission, rack-and-pinion steering, adjustable seats and a stowable rear armrest. One other source calls the transmission forward/reverse; the booklet's gears (8- and 24-tooth on a side shaft) fit two speeds better. Written pages, not videos; no time stamps. video lead: Erik to look, confidence medium.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| video | 4 | two-speed sliding gearbox, inferred | lever fixed across the input shaft; reviews say 2-speed, unsynchronised | 004 (engine steps 10, 12) | medium |
| video | 7 | armrest folds up, "unsure it is meant to move" | pinned bricks and a gap, no arrow; reviews say the armrest stows | 011 (rear seat steps 2-4) | medium |
| source | 4 | "engine step 12 shows the lever's axle" | the lever on the input shaft is drawn in engine step 10; step 12 adds the plates around it | 004 | medium |

Sources searched: [BrickEconomy 855](https://www.brickeconomy.com/set/855-1/), [Technicopedia 855](https://technicopedia.com/855.html), [Brickset review 855](https://brickset.com/reviews/47521), [Lego Car Blog 853/956](https://thelegocarblog.com/2011/11/08/lego-technic-853-956-car-chassis-set-review), [BrickEconomy 956](https://www.brickeconomy.com/set/956-1/).

## 850 Fork Lift
Booklets: `omr/instructions/850-1/001-018.jpg` (one folded sheet, 18 scans). The fork lift is on scans 1-8 (cover, then steps 1-13). Scans 9-18 are alternate models (a road grader, a lifting tower, a dumper and others). Functions pages: none. I used the build steps and the cover photo (scan 001). Pages read: 9 closely (001-008, 018) + 4 at small size (010, 012, 016, 017). Time: about 8 minutes.
### Build-step reading (blind)
1. Handwheel on the mast's side → the forks go up and down. The forks and the two long racks are one carriage (steps 1-3, red dot). Step 13 puts two axles 10 across the mast, one above the other. The upper axle has a 24-tooth gear outside the mast, and its 8-tooth pinions run on the racks. The lower axle has an 8-tooth gear that meshes with the 24-tooth gear. In the cover photo, the handwheel hub sits level with the lower axle, not the pinions. The projection in step 13 also puts the handwheel on the lower axle. So the handwheel turns the lower axle, which drives the pinion axle at 1:3 (a slow crank). The handwheel is on the side nearer the camera in the cover photo, which I read as the truck's right side. The 24-tooth gear is on the other side.
2. Steering wheel → the back wheels steer. The steering wheel's upright axle 8 has a gear under it (step 9). This drives a lengthwise axle (step 6) to an 8-tooth gear on the rack of the back-axle block (steering sub-steps 1-5, blue dot, step 7). The back-axle block sits on two round 2x2 pivots.
3. The four wheels roll (steps 7-8).
4. There is an axle-4 lever in a pin connector beside the seat (step 11, cover). Nothing links it to anything. It is decoration.
### Comparison
- fn 1 "handwheel raises/lowers forks": DIFFERS in which axle the handwheel is on. The list (and the model file) puts the handwheel p188 on the pinion axle. The book puts it on a lower axle 10 with an 8-tooth gear driving the 24-tooth gear. The list's note already says the model leaves out the lower axle and gear. The list also says the handwheel is on the "left" side. My reading of the cover is the truck's right side (wording only).
- fn 2 "steering wheel steers back wheels": AGREES.
- fn 3 "wheels roll": NOT ON PAGE (book steps 7-8). Agrees with the steps.
- fn 4 "levers beside seat, for show": NOT ON PAGE (inferred). Agrees with my reading. Steps 10-11 show nothing linked to them.
- Missing from list: none.
### Doubts settled
- fn 1 (and the set's question): what is the lower axle in step 13 for? → It is the crank axle. The handwheel sits on it, and its 8-tooth gear drives the 24-tooth gear on the pinion axle (1:3 reduction). Settled by the cover photo (handwheel hub level with the lower axle; a grey gear shows behind the 24-tooth gear at that height) and the step 13 projection. Confidence medium (the scans are small and there is no arrow).
- fn 4: are the levers decoration? → Yes. Step 11 puts an axle 4 in a pin connector on a pin, and no later step links it to anything. Confidence medium-high.
### Video leads
- fn 1: The Technicopedia search summary (https://technicopedia.com/850.html) says the forks are raised by a wheel on the right side. It also says the wheel's axle crosses to the other side, where it passes into a parallel axle that feeds the lift racks. This matches the book reading (right side, lower crank axle, 8:24 onto the pinion axle). The summary is garbled in places (it calls this the steering wheel). The booklet stands. Video lead: Erik to look, confidence medium.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| model | 1 | handwheel p188 on the pinion axle; the lower axle and its 8-tooth gear are left out | add the lower axle 10 with an 8-tooth gear meshing the 24-tooth gear; move the handwheel to the lower axle | 008 (step 13), 001 cover | medium |
| what | 1 | control = handwheel on the top axle | control = handwheel on the lower axle, driving the pinion axle 1:3 (after the model fix) | 008, 001 | medium |
| source | 1 | handwheel "on the mast's left side" | the cover shows it on the truck's right side (24-tooth gear on the left) | 001 | medium |
| source | 1 | note: lower axle "unsure, perhaps a slower crank or a brake" | it is the slower crank | 008, 001 | medium |
| video | 1 | — | Technicopedia: wheel on the right, drive into a parallel axle to the racks | technicopedia.com/850.html | medium |

## 851 Tractor
Booklets: `omr/instructions/851-1/001-018.jpg` (18 scans). The tractor is on scans 1-10 (steps 1-32, with the front axle as step 22 sub-steps 1-10). Its rotary harrow is step 33 on scan 11, and the finished tractor with harrow is pictured at top right of scan 11 and on scan 12. Scans 12-16 are alternate implements and a motorised version (870 motor). Scan 17 is a text sheet: when heavy tools are fitted, build a stronger hitch ("suspension system for tools") from picture steps 26-31 on scan 18. Functions pages: none. I used the build steps and the photos. Pages read: 13 closely (001-013, 018) + 4 at small size (014-017). Time: about 9 minutes.
### Build-step reading (blind)
1. 24-tooth gear on top of the steering column (used as the steering wheel, cover) → the front wheels steer. Step 12: column axle 6 → universal joint → front axle 6 with 8-tooth gears. These drive the rack on the front-axle unit (step 22, sub-steps 1-10). The unit has round 2x2 pivot plates.
2. Pushing the tractor → the rotary harrow's tines spin. The rear axle 8 carries a 24-tooth crown gear (steps 2-5). A crown gear on axle 4 takes off drive at the rear (step 5). The harrow (step 33) has a 40-tooth gear on axle 4 driven by an 8-tooth gear, and three upright axles 6 with 40-tooth gears turn the yellow tines.
3. The front wheels roll. The rear wheels roll and drive item 2.
4. Lever behind the seat → the three-point hitch (probably raises and lowers it). Step 18 puts a bent beam lever on an axle 6 at the top rear. Steps 29-31 add the hitch frame, an inclined beam, and a short rod with pin-connector ends (step 31) between the lever arm and the hitch. No motion is drawn. Scan 17's text treats this as the implement's "suspension".
### Comparison
- fn 1 "gear-wheel steers front wheels": AGREES.
- fn 2 "rear wheels drive rotary harrow": AGREES (steps 2-5, step 33 sub-steps 4-7 and inset).
- fn 3 "front wheels roll": NOT ON PAGE (book step 22, step 32). Agrees with the steps.
- fn 4 "lever raises/lowers three-point hitch": NOT ON PAGE (book steps 18, 29-31 plus inference). Agrees with my reading of the linkage.
- Missing from list: none.
### Doubts settled
- fn 4: does the lever lift the hitch, or only hold it? → Not settled by the booklet alone. The linkage (lever arm on axle 6 → short rod → hitch arms) only makes sense as a lift. The web summaries (below) describe an over-centre lever next to the seat that lifts the hitch. Confidence medium that it lifts. It is not fully settled because no motion is drawn.
- Note: the booklet has a second, stronger hitch build (scan 18, steps 26-31, chosen per scan 17's text). The model file follows the standard build, as far as the list's parts show. This is not a fault.
### Video leads
- fn 4: The Lego Car Blog (https://thelegocarblog.com/2012/09/07/technic-tractors-ancient-and-modern) says, per the search summary, that the 851's hitch has "a smooth over-centre action via the control lever next to the seat". Technicopedia (https://technicopedia.com/851.html) is summarised as putting the lever at the driver's position on the right side. A BrickLink thread (https://www.bricklink.com/messageThread.asp?ID=217642) mentions a later inventory change: a stronger hitch and a pin added as a stop for the hitch lever. Video lead: Erik to look, confidence medium.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| video | 4 | lever lifts the hitch (inferred, unsure) | linkage fits a lift, no arrow; web: over-centre lift lever beside the seat | 005 (step 18), 009-010 (steps 29-31); thelegocarblog link | medium |
| source | 4 | "unsure that the lever is meant to lift" | can say: the linkage geometry plus the web leads support a lift; still no arrow | 009-010 | medium |

## 852 Helicopter
Booklets: `omr/instructions/852-1/001-016.jpg` (16 scans). The helicopter is on scans 1-10 (steps 1-20). Scans 11-15 are the alternate plane, and scan 16 is the motorised photos (870 motor). Functions pages: none. I used the build steps and the cover photo. Pages read: 13 closely (001-012, 015, 016) + crops. Time: about 8 minutes.
### Build-step reading (blind)
1. Handwheel on the cabin side (steps 13-14, cover) → the main rotor and the tail rotor turn. The handwheel's axle 10 has a 24-tooth gear. A crown gear (step 9) drives the upright mast, and a lengthwise shaft with universal joints runs back along the boom to a crown gear and 8-tooth gear at the tail (step 15). In the cover photo (nose to the left), the handwheel is on the side facing the camera, which I read as the helicopter's left side.
2. The rotor head (steps 16-19) is a lower blue collar on the mast with pin-connector links up to the blue hub. The blade holders sit on side pins. Two rods with ball cups come up from inside the cabin (steps 3-10) to the collar. There are two sticks in front of the seats (steps 3-10). My guess was that they move the collar and so tilt or pitch the blades. No motion is drawn, so this was unsure at this point.
3. The skids hang on a frame of axles and pin-connector struts (step 20 inset, cover). It looks meant to be rigid.
### Comparison
- fn 1 "handwheel turns both rotors": AGREES on what it does. The list says the handwheel is on the "right side". My reading of the cover is the helicopter's left side (wording only).
- fn 2 "sticks raise the collar, collective pitch": NOT ON PAGE (book steps 2-5, 9-10, 16-17 plus inference). It fits the parts: one cross shaft for both sticks, two rods to one collar, and a link to each blade, so both blades change pitch together.
- fn 3 "skids fixed": NOT ON PAGE (book step 20 plus inference). Agrees.
- Missing from list: none.
### Doubts settled
- fn 2: collective pitch or tilting the rotor? → Collective. Both sticks sit on one cross shaft and push the collar straight up, and there is no sideways input. Technicopedia's summary describes exactly this (the blue plate rises and the links reverse the blades' pitch) and says the 852 has no cyclic. Settled from the booklet's linkage plus that summary. Confidence medium (no arrow in the book).
- fn 3: should the skids be rigid? → Yes. The step 20 inset builds a braced frame, and the cover photo shows it standing square. Confidence medium. The swinging that Kinebrick allows today is a model-solving fault, not the set's design. I propose no change to the list.
### Video leads
- fn 2: Technicopedia (https://technicopedia.com/852.html), per the search summary: raising the drive block lifts the blue plate (like a swashplate), and a pair of links reverse the blades' pitch; there is no cyclic. A fan review summary (Brickset, https://brickset.com/reviews/61387) says the joysticks move only back and forth and change the rotor pitch. Video lead: Erik to look, confidence medium.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| video | 2 | sticks set collective pitch (inferred, unsure) | the linkage fits collective; web: collective, no cyclic, sticks move fore and aft only | 002-004, 008 (steps 16-17); technicopedia.com/852.html | medium |
| source | 1 | handwheel "on the cabin's right side" | the cover (nose left) shows it on the side facing the camera, the helicopter's left | 001 | medium |
| source | 2 | "unsure that the sticks are meant to work the blade pitch" | can drop the doubt: collective; one cross shaft, no sideways input | 002-004, 008 | medium |
