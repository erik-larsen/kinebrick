# Function list audit, first batch (28 sets), 2026-11-14

A second, independent reading of LEGO's functions pages for 28 sets, compared with `curated.functions` in `data/sets/<set>-1.json`. No function list was changed. Each set was read blind first (the functions pages, before the list was opened), then compared. The readers were 8 agents of the audit session, 3 to 4 sets each; I checked the 8258 leaflet myself.

Page numbers are PDF page numbers (the printed number on the page, where the two differ the section says so). "Book N" means the booklet's cover number unless the section says otherwise; the file numbers (`<set>-1-<n>.pdf`) often do not follow the cover numbers (8258, 8110, 9396, 42082).

## Proposed changes for Erik

### Changes to what a function is or which part works it

| Set | Fn | The list says | The booklet shows | Page | Confidence |
|---|---|---|---|---|---|
| 8258 | 2, 5 | Outriggers on the first yellow lever (p164/p167) down; upper boom on the second (p169/p172) down. | The two levers are paired the other way. One lever: lower boom (up) and upper boom (down). The other: slewing (up) and outriggers (down). Proposed: fn 2 control p169/p172 down, fn 5 p164/p167 down. | 8258-1-3.pdf (the Power Functions leaflet) p.4-7; sticker on the step plate, 8258-1-4.pdf p.53 | Pairing high (I checked p.4-6 myself). Which model lever is which: medium. |
| 8258 | 2 | (Erik's correction: outriggers pulled out by hand.) | The leaflet shows the outriggers slid out and in **by the motor**: right-hand yellow lever down, red polarity handle turned each way, arrows on all four beams. No hand is shown. | 8258-1-3.pdf p.4 | High. **Conflicts with Erik's correction; please look at this page.** The feet may still be set by hand. |
| 8110 | 6, 9, 10, 16 | The motor gearbox has four outputs; the red side knob picks the "fourth"; fn 16's valve p826 is unexplained. | Three motor outputs: front winch, crane slewing, compressor (yellow lever down). The red knob is an air valve (p826, 47223a), joined to its knob 59443 by an axle: knob out sends the air to the crane at the rear, knob in to the front connection (crane moved to the front). Merge fn 16 into fn 9/10. | 8110-1-4.pdf (book 5) p.43-44; p.39-42 | High (outputs, valve); medium-high (knob in/out). |
| 8110 | 2 | The steering wheel turns with the steering (unsure). | The wheel sits on an axle pin in the dashboard with nothing joining it to the steering. Booklet silent. | model file | Medium-high |
| 9396 | 5 | The blue lever releases the blades to fold back. | The blue lever changes the main rotor blades' pitch (arrow curls round the blade's long axis). | 9396-1-2.pdf (book 3) p.45 | Medium-high |
| 42066 | 3 | The motor opens and closes the canopy. | The motor raises an air-brake panel on top behind the cockpit (`roof.ldr`, p669) and drops the belly air brake p720. The canopy stays shut. | 42066-1-1.pdf p.247 | Medium-high |
| 42066 | new | (absent) | The canopy (`windscreen.ldr`) is lifted by hand. | p.246 | High |
| 42053 | 8 | Lock = p160/p175 6632 (black, at the leg's foot); control p182/p183 43857. | Leg = the black assembly of steps 49-56 (`42053 - outrigger.ldr`). Lock = the grey assembly of steps 58-59 (2× 32449, 2× 60483 on axle 4519, pin 18651), at x ±120 in the main model. Use a part of outrigger.ldr as the control. | 42053-1-1.pdf p.219 (E); p.24-29 | Medium-high |
| 8063 | 11 | Each trailer beam rocks as a bogie. | Each beam is pinned to the frame at two separate points: fixed. Agrees with Erik. | 8063-1-2.pdf p.38-39 step 25 | Medium |
| 8063 | new | (absent) | The bonnet opens by hand, hinged at its dashboard end (arrow in the step). | 8063-1-1.pdf p.49 step 35 | Medium |
| 8081 | 5 | Doors open (inferred). (Erik: they are fixed.) | No arrow on any page; the booklet has no functions page. LEGO's product text says the doors open (web lead only). | none | Medium. **Booklet does not settle it; the product text disagrees with Erik's correction.** |
| 8081 | 6 | Tailgate opens; source "book 3 step 5, arrows swing the rear panel up". | Book 3 step 5 swings the right rear side frame into place during the build (book 2 p.47 does the same on the left); step 6 locks both with a beam. No tailgate arrow anywhere. LEGO's text says the "trunk" opens. Re-mark as inferred from the product text. | 8081-1-3.pdf p.4-5 | High (wrong source); medium (function) |
| 8285 | 15 | Side lockers open (inferred, no arrows). | No arrow, but step 75 gives each panel pins at its top corners and a handle at the bottom, and the functions page shows the bay open with the crane knobs inside. Likely open, hinged at the top. | 8285-1-6.pdf p.45-47; 8285-1-1.pdf p.2 | Medium |
| 42068 | new | (absent) | A rear side panel (marked "5") swings up. | 42068-1-1.pdf p.184 | Medium |
| 42109 | new | (absent) | The bonnet lifts by hand (shown open, no arrow). | 42109-1-1.pdf p.115 | High |
| 42114 | 7 | The hood tilts forward. | The hood swings up and back toward the cab, hinged at its rear edge (the model's hinge axles p2926/p2927 are at that edge), after the bumper pin is pulled. | 42114-1-1.pdf p.438 | Medium |
| 42107 | 1 | Gear lever on the gearbox's right side. | On the chain side, the rider's left (+x in the model). | 42107-1-1.pdf p.121 | Medium |
| 42107 | 2 | No `first`: how far to turn the lever is not known. | From neutral (lever pointing back): down about 90° = first gear, up about 90° = second. | p.54-55, p.121 | Direction high, angle medium |
| 42107 | 5 | Handlebars p340/p351 (15462). | Grips are p355/p356 (black 32054) on p353/p354 (red 32062). All turn with the head, so the current control still works. | p.121 | Medium |
| 42113 | 1 | Button-to-function map "unsure". | Rotors p955 and landing gear p591 (left side, upper and lower); nacelle tilt p944 and ramp p594 (right side, upper and lower). Stickers on scan 335. Matches the list. | scans 334-335 | Medium (side-to-part step rests on LDraw axes) |
| 42113 | 2 | "Unsure whether the sticker means spinning or folding." | Spinning. | scan 335 | Medium |
| 41999 | 8 | Lights on "when the battery box is switched on". | Name the control: the battery box's orange slide switch, on the side under the cab. | 41999-1-4.pdf p.64 | High |

### Directions of levers and knobs (`first` steps; the sign of `by` in the data was not worked out)

| Set | Fn | Booklet shows | Page | Confidence |
|---|---|---|---|---|
| 8258 | 2 | Red handle turned clockwise (as drawn) = outriggers out. | 8258-1-3.pdf p.4 | Medium |
| 9395 | 4, 5 | Winch = red lever tipped toward the steering wheel; boom = toward the seats. Check the sign of p612's `by`. | 9395-1-3.pdf p.34 | Medium |
| 42052 | 2-5 | Knob toward the tail (+z) for A (rotors) and C (doors); toward the nose (-z) for B (ramp) and D (winch). | 42052-1-1.pdf p.190 | High (direction) |
| 42068 | 3 | Lever top toward the rear = boom up/down; toward the front = slewing. | 42068-1-1.pdf p.187, 189 | Medium-high |
| 42070 | 1, 3-9 | Drive/crane lever (left, +x): tip down = drive, up = crane. Crane lever (right): tip up = slewing + winch, tip down = outriggers + boom. The fn 5 handle is the white 41669 at (-200,-376,-260). | 42070-1-1.pdf p.394-397 | High (directions); medium (handle part) |
| 42082 | 4, 6, 8 | Outrigger lever to its "↓" sticker = legs down. Gate knob to the top row = boom up (fn 6), hook down (fn 8). | 42082-1-1.pdf p.323-326 | High / medium / high |
| 42112 | 4-6 | Lever toward the truck symbol = drive (ring toward p356, rearward +z); toward the drum = crank (toward p352). Check the `first` signs. | 42112-1-2.pdf p.89 | Medium |
| 42038 | 2, 3 | Position 1 = ball toward the tan bevel (front); the ring then moves rearward onto p67, as the list assumes. | 42038-1-2.pdf p.66; book 1 p.13 | Medium-low |

### Model file faults found (not list changes; for the model or the solver)

| Set | Fn | Finding | Page | Confidence |
|---|---|---|---|---|
| 8838 | 5 | The 6L axle is in the real set (step 20, with the rear wheel). The submodel holds one 14T bevel and one 8T gear (not two bevels), as step 20's parts box does. Its 8T meshes the 24T on the gear axle; its bevel drives the crankshaft. Suggested line in "8838 - Shock Cycle.ldr": `1 0 0 10 -60 -1 0 0 0 1 0 0 0 -1 8838 - Axle-with-Gears.ldr` (worked out, not tried in the viewer). | scan 011 | High (fact); medium (line) |
| 42109 | 3 | The model's 2780 friction pins p381/p382 and L-beam 32526 p383 (`42109 - car.ldr`, file lines 1002-1004) are not in the set. The real hole takes a yellow 3L axle (step 9) and the 8L half shaft from outside (step 10). The parts list counts (95 pins, 14 L-beams) are each lower than the model's (97, 15). Remove the three parts. | 42109-1-1.pdf p.17-18, 39-40, 113 | High |
| 8270 | 2 | The worm is not alone: the 8T gear on the lifting arms' 6L axle sits 1 stud above it at right angles in both the booklet and the model file ("Crane Sub05" worm at (0,-40,0) along z; "Crane Sub08" 8T at (0,-60,0) along x). Look at mesh detection, not the model file. | 8270-1-1.pdf p.20; 8270-1-2.pdf p.2-3 | Medium-high |
| 8094 | 2 | The missing rubber band is a drive belt: arm motor to a belt wheel on the 6L axle that carries the worm (step 23). | scan 042 | Medium-high |
| 8844 | 3 | The missing rubber band is a drive belt: belt wheel at the tail to a small pulley on the tail rotor's axle (pulley part not readable). | scan 008, step 11 | Medium-high |

### Source wording only (no change to what the function is)

- 8081 fn 7: one shock lies across the front axle; two rear shocks run frame to axle (book 1 p.36, p.23 step 19, p.25 step 21). Medium.
- 42006 fn 5: slewing is by hand; no gear meets the turntable teeth, and the PF option motorises only the other three (book 1 p.46-49, book 2 p.42). Medium.
- 42038 fn 6: the winch gear is confirmed by the functions page (book 2 p.67), high. fn 7: rocking is shown by the ball-joint mount, book 1 p.44 step 47, not step 53 (steering). Page refs "67-68 and 76" should be p.66-67.
- 42052 fn 2: counter-rotating rotors confirmed (p.191). fn 7: source p.188 is the cargo frame; the finished model is p.186/190.
- 42053 fn 6: function E on p.219 is the outrigger, not the steering; cite steps 28-29 and 62.
- 42060 fn 1: steering confirmed by steps 23, 26, 47 (p.23, 26, 41), high. fn 8: the bucket is set by hand, high; drop the doubt.
- 42112 fn 3: the four pistons are built in book 1 step 50 (p.38), medium-high.
- 42113 fn 3: scan 333 shows helicopter mode only; the tilt is on scan 334.
- 42131 fn 12: track tension is a listed function on book 1 p.15 (not inferred), high. fn 3, 11: p.15 is the full functions page.
- 41999 fn 2: p.64 shows the servo steering both axles, from the remote's second lever (a dial). The page does not show rear-opposite; the model's mirrored racks do. Medium.
- 8285 fn 6: the knob's worm turns a 24T gear (book 1 steps 5 and 7, p.43), high; that this is the outrigger drive, medium. fn 8: pawl-like parts at book 2 step 12 (p.53) support the ratchet, medium.
- 8270 fn 7: an 8T gear on a blue friction pin meets the winch gear: a brake (book 2 p.9), medium.

## Counts

| Set | Agree | Differ | Not on page | Missing |
|---|---|---|---|---|
| 8258 | 3 | 2 | 4 | 0 |
| 42107 | 6 | 0 | 3 | 0 |
| 42113 | 5 | 0 | 3 | 0 |
| 42131 | 8 | 0 | 5 | 0 |
| 42060 | 3 | 0 | 5 | 0 |
| 8285 | 11 | 0 | 4 | 0 |
| 42053 | 5 | 1 | 3 | 0 |
| 8270 | 5 | 0 | 3 | 0 |
| 8838 | 0 | 0 | 8 | 0 |
| 8094 | 0 | 0 | 6 | 0 |
| 8844 | 0 | 0 | 6 | 0 |
| 41999 | 4 | 0 | 4 | 1 |
| 42109 | 3 | 0 | 2 | 1 |
| 8081 | 1 | 1 | 7 | 0 |
| 8063 | 2 | 0 | 10 | 1 |
| 42006 | 4 | 0 | 2 | 0 |
| 42038 | 5 | 0 | 7 | 0 |
| 42052 | 5 | 0 | 2 | 0 |
| 42066 | 4 | 1 | 1 | 1 |
| 42068 | 4 | 0 | 4 | 1 |
| 42070 | 9 | 0 | 2 | 0 |
| 42082 | 9 | 0 | 1 | 0 |
| 42100 | 7 | 0 | 2 | 0 |
| 42112 | 6 | 0 | 2 | 0 |
| 42114 | 5 | 1 | 1 | 0 |
| 8110 | 5 | 3 | 8 | 0 |
| 9395 | 3 | 0 | 4 | 0 |
| 9396 | 4 | 1 | 1 | 0 |
| **All 28** | **126** | **10** | **110** | **5** |

246 list functions; 41999's missing one is the battery box switch (electrical set-up), so 4 real mechanical functions are missing.

## Open questions from the brief

- **42107 fn 2:** neutral = lever pointing back; first = down about 90°; second = up about 90° (p.54-55, p.121). Direction certain, angle read from drawings.
- **42113 fn 5:** the ramp button is the lower red push button 51149 on the right side behind the wing, p594 in main.ldr at (-100,-60,260), file line 297 (scan 335 sticker; scan 334 callout). Medium.
- **42131 fn 7 and 9:** the selector is the orange rotary shifter 35188 (p3295) with orange levers moving two driving rings (p3297, p3326) under the cab (book 1 steps 104, 110, 120; p.102, 108, 118). The booklet does not say which position drives which function; the app does it. Must be traced in the model.
- **42060 fn 8:** the bucket is set by hand; it hangs on a pin (step 95, p.73), nothing links it to a knob. High.
- **8285 fn 15:** probably opens, hinged at the top (see table). Medium. **fn 6:** the worm turns a 24T gear (book 1 p.43). High.
- **42053 fn 8:** leg = black outrigger.ldr (steps 49-56); lock = grey assembly (steps 58-59). Medium-high.
- **8270 fn 2:** the model file is right; check mesh detection.
- **8838 fn 5:** the axle and its gears belong in the model (step 20); one line to add.
- **8094 fn 2, 8844 fn 3:** both bands are drive belts.
- **41999 fn 2:** the servo steers both axles from the remote's dial lever (p.64); rear-opposite from the model geometry, medium.
- **42109 fn 3:** the model file is wrong; remove p381, p382, p383. High.

## Notes for the other 158 sets

- **The functions page is not always at the end of the last booklet.** 8285: at the front of book 1 (p.2-3). 42131: book 1 p.15. 8258: a separate 8-page Power Functions leaflet (8258-1-3), not p.53 of book 4 (that page is one half of the step-181 spread and shows only the outriggers' arrows). Sets 8081, 8063, 8838, 8094 and 8844 have no functions page; there the readers used build steps with arrows.
- **File order ≠ booklet order** in 8258, 42082, 8110, 9396. Some downloads include the B model's booklets (8285-1-3/-4/-5, 8270-1-3/-4, 42060-1-2) and PF add-on pages (42053 p.225-246, 42068 p.188-195, 42006, 42038, 9395, 9396).
- **8285-1-1.pdf p.3 is cut off at the bottom;** two small pictures (a boom base with a curved arrow, a yellow part) may hide one more function. A complete scan would settle it.
- **LEGO's site now lists different PDF ids** for 42052, 42131 and 8285 than the sets' files record; the download script rewrote `imported.instructions` for those three, and I restored the files.
- **Tooling:** the Read tool cannot open PDF pages here (pdftoppm is not installed). The readers wrote a small Swift/PDFKit renderer (in this session's scratchpad); a later batch should be given one from the start.
- **Cost:** 8 agents in parallel, 3-4 sets each; 7 to 13 minutes each, about 74 agent-minutes in all (about 2.6 minutes per set); about 1.6 million tokens (about 58,000 per set). A set took 2-25 pages read closely, plus 15-130 pages as contact sheets; sets without a functions page, or with doubts settled from the build steps, took the most (8081: all 132 pages as thumbnails; 42112: about 75).
- **Yield:** of the 246 functions, about 20 change in substance (table above), mostly where the note or source already said "inferred" or "unsure". Many lever directions are now known from the booklet but not yet matched to the sign of `by`.

---

# The sets

## 8258 Crane Truck
Booklets: 8258-1-1.pdf (cover "1", 84 pp), 8258-1-5.pdf (cover "2", 84 pp, ends step 107 p.83), 8258-1-2.pdf (cover "3", 84 pp), 8258-1-4.pdf (cover "4", 76 pp, last of the main model, ends step 187 p.68), 8258-1-3.pdf (8 pp, a separate Power Functions leaflet, LEGO no. 4561903). The file index is not the booklet order. The list's "book N" means the file index (book 3 = the leaflet 8258-1-3, book 5 = 8258-1-5, which is booklet 2). Functions pages: 8258-1-3 pp.2-7 (the real functions pages); also 8258-1-4 pp.52-53 (step 181: the outrigger function, the same picture as leaflet p.4). Pages read: about 60 as thumbnails, about 14 at full size or zoomed. Time: about 25 min.

Independence note: I read 8258-1-4 pp.50-68 blind (step 181 only shows the outriggers). I found the leaflet 8258-1-3 only after I opened the JSON, because the list cites "book 3 pages 2-7". So my reading of leaflet pp.2-7 is not blind. I read the pictures myself and did not take the list's words for them.

### Functions page (blind reading)
From 8258-1-4 pp.52-53 (step 181, a spread), read before I opened the JSON:
1. Battery box switch on (round inset). One yellow lever of a pair on the gearbox is pushed down (inset 1). The red handle on a white cam is turned clockwise (inset 2) → four outriggers slide out sideways: two arrows behind the cab and two at the rear, all across the truck.
2. The step plate under the levers has a sticker. Left lever: two boom-joint icons (up and down). Right lever: up = boom swinging sideways (slew), down = outriggers.
3. Pages 54-68 (steps 182-187) fit the four outrigger feet and show the finished model. They have no more arrows.

From the leaflet 8258-1-3 (read after I opened the JSON):
- p.2: the PF chain (battery box 1, polarity switch 2, XL motor 3) and where each sits in the model. No function arrows.
- p.3: the red switch handle is on one side of the truck. The two yellow levers are on the other side; each goes up and down from a middle position.
- p.4: battery box on. RIGHT yellow lever (in the insets) down. Red handle clockwise → all four outriggers out. Red handle anticlockwise → all four in.
- p.5: LEFT yellow lever up. Red handle either way → lower boom up or down (arrow at the lower boom's pivot).
- p.6: RIGHT yellow lever up → the crane slews both ways (circular arrow round the boom base).
- p.7: LEFT yellow lever down → upper (knuckle) boom folds up or down (arrow at the knuckle).
- p.8: advert.

Steering, the V8, wheels and hook: no arrows on any of these pages.

### Comparison
- fn 1 "PF XL motor drives four functions, red lever = direction, two yellow levers select": AGREES (leaflet pp.2-7).
- fn 2 "outriggers, first yellow lever (p164/p167) down": DIFFERS (lever). The leaflet puts outriggers on the same lever as slewing (p.4 and p.6: right-hand lever in the insets), not on the same lever as the lower boom. The step-plate sticker (8258-1-4 p.53) agrees. See the lever mapping under Doubts.
- fn 3 "lower boom, first lever up": AGREES (p.5: left lever up).
- fn 4 "slew, second lever (p169/p172) up": AGREES (p.6: right lever up).
- fn 5 "upper boom, second lever down": DIFFERS (lever). Leaflet p.7: the upper boom is on the LEFT lever pushed down, the same lever as the lower boom.
- fn 6 "knob on top behind the cab steers the front two axles": NOT ON PAGE (book steps 93/97 + inferred).
- fn 7 "V8 runs as the truck rolls, via the rear axles' differential": NOT ON PAGE (book steps + inferred).
- fn 8 "eight wheels roll; front four steer": NOT ON PAGE (book step 179).
- fn 9 "hook hangs on its string": NOT ON PAGE as a function (hook on its string in the p.2 photo; no winch function anywhere).
- Missing from list: none of the functions pages' functions. (Web lead only, not on the page: the cab tilts to show the engine.)

### Doubts settled
- fn 2 (note: "which of the two yellow levers, and which way, should be checked"): the leaflet shows the lever pairs are {lower boom up, upper boom down} on one lever and {slew up, outriggers down} on the other (pp.4-7; also the step-plate sticker on 8258-1-4 p.53). Pairing: confidence high. Which physical lever: in the insets the lever pair is seen from the gearbox side, with the cab to the left (p.3 right picture), so the inset's left lever is the forward one. From `_audit-parts.ts`, p164/p167 lie at z=-160 and p169/p172 at z=-80. The cab and steering are at more negative z (p418 -340, p1450 -460), so p164/p167 is the forward lever. So: forward lever p164/p167: up = lower boom, down = upper boom; rear lever p169/p172: up = slew, down = outriggers. Confidence medium (it rests on the insets' viewpoint and on reading -z as forward). Direction for outriggers: red handle clockwise as drawn = out, anticlockwise = in (p.4).
- fn 6 (inferred steering drive, no arrow): no functions page shows steering. 8258-1-5 p.65 (step 93) fits a tall vertical axle behind the cab and p.70 (step 97) puts a round black knob on its top. That fits a knob that steers from the top. Web lead: reviewers call it hand-of-god steering. I did not check the gears down to the racks. Confidence medium that the knob steers; which axles and the gear path are not settled by the booklet.
- fn 7 (V8 driven by the rear axles, inferred): the booklet draws no arrow for the V8. Web lead: one review says one axle drives the V8 (vague). Not settled by the booklet; confidence low.
- fn 9 (note: "whether the string can be wound in, and how, is still to find out"): no winch is shown. The four motor functions on pp.4-7 and the sticker do not include a winch, and no page shows a crank for the hook. Confidence high that the model has no powered winch; whether there is a manual one: not seen.

### Open questions
- None beyond step 3.

### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 2 | outriggers: first lever (p164/p167) pushed down | outriggers: the lever that also slews (p169/p172, the rear one) pushed down | 8258-1-3 p.4, p.6; 8258-1-4 p.53 sticker | pairing high; which lever medium |
| 5 | upper boom: second lever (p169/p172) pushed down | upper boom: the lever that also raises the lower boom (p164/p167, the forward one) pushed down | 8258-1-3 p.5, p.7 | pairing high; which lever medium |
| 2 | note: lever "should be checked" | settled as above; red handle clockwise as drawn = out | 8258-1-3 p.4 | medium |

## 42107 Ducati Panigale V4 R
Booklets: omr/instructions/42107-1-1.pdf (the only booklet, 128 pages). Functions pages: 42107-1-1.pdf p.120-121. Pages read: about 16 (118-128 as a contact sheet, 120-121 and 54-55 in detail). Time: about 15 minutes.

### Functions page (blind reading)
1. p.120 top: the side fairings (4 panels) come off, arrows outward.
2. p.120 bottom-left: arrow up at the front fork → front wheel rises (front suspension); curved arrow up behind the rear wheel → rear wheel and swing arm rise (rear suspension).
3. p.120 bottom-right: curved arrow under the front wheel → front wheel steers.
4. p.121 top inset: the red paddock stand, arrow up from the stand's upright pin into the swing arm; the main picture shows the rear wheel raised on the stand.
5. p.121 bottom inset: the gear lever (small light grey lever by the footpeg, on the chain side, the rider's left): from N, turned down → 1, turned up → 2 (curved arrows, labels 1, N, 2).
Not shown on the page: the engine's pistons running from the rear wheel.

### Comparison
- fn 1 "gear lever picks N, 1, 2": AGREES (p.121 bottom inset). Small wording difference: the list says the lever is on the gearbox's right side; the page shows it on the chain side, the rider's left. In the model the lever p129 (x=80) and the chain (x≈66-86) are both at +x, which in LDraw (front = -z) is the model's left. So "right side" is wrong wording only; the part is right. Confidence medium.
- fn 2 "rear wheel runs the V4 engine through the gearbox": NOT ON PAGE (book steps 40-60, 97, 125-130).
- fn 3 "rear swing arm and shock": AGREES (p.120 bottom-left).
- fn 4 "rear spring": AGREES (same picture; skip entry).
- fn 5 "handlebars steer": AGREES (p.120 bottom-right).
- fn 6 "front fork shocks": AGREES (p.120 bottom-left).
- fn 7 "front wheel rolls": NOT ON PAGE (book step 116).
- fn 8 "paddock stand lifts the rear": AGREES that the stand holds the rear wheel up (p.121 top inset and main picture); the rocking on its wheels by a handle is NOT ON PAGE (inferred).
- fn 9 "fairings come off": AGREES (p.120 top).
- Missing from list: none.

### Doubts settled
- fn 2: how far to turn the lever for 1 and 2 → about a quarter turn each way from N: in N the lever points back along the bike (p.54 inset, orange dashed line); for 1 it is turned down to point about straight down; for 2 it is turned up by about the same amount (p.55, the two views "1" and "2" with orange arrows; p.121 inset agrees on directions: down = 1, up = 2). Confidence: direction high, angle medium (about 90°, read from the drawings, no number given).
- fn 5: which parts are the handlebars → the black grips are the long pins with stop bush p355 and p356 (32054, colour 0, frontfork.ldr at -115/75,-371,-246) on the red axles p353 and p354 (32062); p.121 shows a black grip sticking out at the top of the fork. p340/p351 (15462, reddish brown axles) are the fork tubes' axles in the top yoke, not the grips. All of them turn with the steering head, so the list's control still works; only the name is off. Confidence medium.
- fn 6: which parts slide in the fork → the booklet functions page does not show it (only an arrow at the wheel). Not settled.
- fn 8: how the stand rocks → the booklet does not show a handle or rocking; p.121 top inset shows only the stand's pin going up into the swing arm. Not settled; keep "inferred".

### Open questions
- 42107 fn 2: from N (lever pointing back, p.54), turn the lever down about 90° for first gear, up about 90° for second gear (p.55 views 1 and 2; p.121 bottom inset: down = 1, up = 2). The pages give no angle number; 90° is read from the drawings.

### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 1 | lever on the gearbox's right side | lever on the chain side, the rider's left | p.121 bottom inset | medium |
| 2 | no `first`: how far to turn the lever is not known | first = lever down about 90° from N; second = up about 90° | p.54-55, p.121 | direction high, angle medium |
| 5 | handlebars = p340, p351 (15462) | grips are p355, p356 (black 32054) on p353, p354 (32062) | p.121 (black grip), model file | medium |

## 42113 Bell-Boeing V-22 Osprey
Booklets: omr/instructions/42113-1/ (one folder of 344 scans, 750x542 px; 344.jpg is the last). Functions pages: scans 333-335. Pages read: 15 as a contact sheet (330-344), 333-335 in detail. Time: about 15 minutes.

### Functions page (blind reading)
1. Scan 333: the finished model from both sides, both times in helicopter mode (nacelles upright). No arrows.
2. Scan 334 top (motor icon): front view, curved arrows at both nacelles → the nacelles tilt (helicopter ↔ aeroplane mode), faded blades show the other position.
3. Scan 334 middle (motor icon): curved arrows at the nose wheel and the main wheel → the landing gear folds up / down.
4. Scan 334 bottom (motor icon): two views of the rear: ramp down with the upper door up, then closed, with a curved arrow → the rear ramp opens and closes.
5. Scan 335: two insets of red push buttons with stickers. Upper inset (the side seen in the main picture, nose to the right, so the aircraft's left side): top button sticker = three-bladed rotor with rotation marks, callout line to the rotor; second button sticker = a wheel on a leg with fold marks, callout line to the nose landing gear. Lower inset (mirror view, the other side): top button sticker = orange nacelle with a curved arrow, callout line to the nacelle base; bottom button sticker = ramp wedge, callout line running into scan 334's picture of the tail and ramp.
So: one motor, four push buttons pick rotors spinning, landing gear, nacelle tilt, ramp.

### Comparison
- fn 1 "motor drives the function picked by four red push buttons": AGREES (scans 334-335). The button-to-function mapping in the note also AGREES (see Doubts).
- fn 2 "rotors spin": AGREES (scan 335 rotor sticker, line to the rotor). Spin direction NOT ON PAGE.
- fn 3 "nacelles tilt": AGREES (scan 334 top, scan 335 nacelle sticker). Small source fix: scan 333 shows both sides in helicopter mode, not both modes; the tilt is on scan 334 top.
- fn 4 "landing gear retracts": AGREES (scan 334 middle, scan 335 gear sticker).
- fn 5 "ramp opens and closes": AGREES (scan 334 bottom, scan 335 ramp sticker).
- fn 6 "landing gear wheels roll": NOT ON PAGE (book steps 12, 22).
- fn 7 "rotor blades fold by hand": NOT ON PAGE (inferred).
- fn 8 "flaps move with the nacelles": NOT ON PAGE (inferred).
- Missing from list: none.

### Doubts settled
- fn 1: which button is which → settled by the stickers on scan 335 (zoomed): aircraft's left side (the side in the main picture): upper = rotors, lower = landing gear; right side: upper = nacelle tilt, lower = ramp. This matches the list's note. Mapped to parts (LDraw front = -z, so +x = aircraft's left): p955 (wingbase, +100,-100,260) = rotors; p591 (main, +100,-60,260) = landing gear; p944 (wingbase, -100,-100,260) = nacelle tilt; p594 (main, -100,-60,260) = ramp. Confidence: sticker reading medium-high (low-res scan, but two stickers zoomed and the callout lines agree); part mapping medium (rests on the LDraw handedness convention).
- fn 2: rotor sticker means spinning or folding → spinning (three blades with rotation marks, line to the rotor hub; scan 335). Confidence medium. Opposite directions: the booklet does not show it.
- fn 4: which actuator works the gear and which the ramp → the booklet functions pages do not show it. Not settled.
- fn 7: blades fold → the booklet does not show it; the functions pages show no folding. Web search found no mention of folding blades. Confidence low that it is a function; suggest keeping it marked unsure or dropping it.
- fn 8: flaps linked to the nacelles → the booklet functions pages do not show it. Web lead (a review snippet from a gameofbricks.eu review of 42113, found in search results; page not opened): the flaps on both wings move up and down with the engines through a linkage. Supports the list. Confidence low-medium (lead only). In the model the flaps (flap1/flap2) are placed at main.ldr lines 354-355, held by black friction pins (2780); the link to the nacelle was not traced.

### Open questions
- 42113 fn 5 (ramp button): the lower of the two red push buttons on the aircraft's right side, behind the wing: 42113 - 51149 (red), p594, in main.ldr at -100,-60,260 (model file line 297). Settled by scan 335 (lower inset, bottom button, ramp-wedge sticker, callout line to the tail ramp on scan 334). Its partner above it on the same side, p944 (wingbase.ldr, -100,-100,260), is nacelle tilt. Confidence medium.

### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 1 | button mapping "unsure" | rotors p955, landing gear p591 (left side, upper/lower); nacelle tilt p944, ramp p594 (right side, upper/lower) | scan 335 | medium |
| 2 | "unsure whether the sticker means spinning or folding" | spinning | scan 335 | medium |
| 3 | source: page 333 "the two modes" | 333 shows helicopter mode only; tilt is on 334 top | scans 333-334 | high |
| 7 | blades fold by hand (inferred) | not shown | scans 333-335 | low |

## 42131 Cat D11 Bulldozer
Booklets: omr/instructions/42131-1-1.pdf (booklet 1, 464 pages) and 42131-1-2.pdf (booklet 2, 356 pages; last, by its cover number 2). Functions pages: the end of booklet 2 (p.336-356) has none; the functions page is booklet 1 p.15 (with the app pages p.13-14). Pages read: about 21 at the end of book 2 and 18 at the start/end of book 1 as contact sheets; p.15, 102, 108, 118, 169 in detail; plus contact sheets of p.60-120 and 165-200 to find steps. Time: about 25 minutes.

### Functions page (blind reading)
Book 1 p.15 (app-controlled; phone icon), with p.14 frame 4:
1. Drive: p.14 frame 4 shows the model driving forward and back from the phone; p.15 "main control" icon with two sliders (one per track).
2. Blade: a curved double arrow at the blade's lower edge → the blade moves (raise/lower; one arrow only).
3. Ladder: a curved double arrow at the ladder beside the cab → the ladder swings.
4. Ripper: a curved double arrow at the ripper → the ripper raises and lowers.
5. Track tension: an inset with a track-and-sprockets icon, its callout line on the black gear on the side of the track frame → the gear sets the track tension.
Also shown: "alternative control" and "challenges & achievements" app modes.

### Comparison
- fn 1 "right track motor": AGREES (driving shown; the motor side and gearing are not on the page).
- fn 2 "left track motor": AGREES (same).
- fn 3 "skid steering": AGREES (p.15 main control, two sliders; p.14 frame 4).
- fn 4 "V12 pistons pump while driving": NOT ON PAGE (book steps 241-262; drive inferred).
- fn 5 "gearbox selector motor": NOT ON PAGE (book steps 62-125; reviews; inferred).
- fn 6 "ripper": AGREES (p.15 arrow at ripper).
- fn 7 "blade lift": AGREES (p.15 arrow at blade).
- fn 8 "blade tilt": NOT ON PAGE as a separate function (p.15 has one blade arrow only); rests on book 2 steps 946-976 and reviews.
- fn 9 "ladder": AGREES (p.15 arrow at ladder).
- fn 10 "hub switch lever": NOT ON PAGE (book steps 168-174).
- fn 11 "Control+ app": AGREES (p.13-15).
- fn 12 "track tensioner worm": AGREES (p.15 track-tension inset, callout on the gear at the side of the track frame). The list's source says "inferred"; p.15 settles it.
- fn 13 "roller bogies rock": NOT ON PAGE (book steps 448-628).
- Missing from list: none.

### Doubts settled
- fn 1, 2: gearing inferred → the booklet does not show it. Not settled.
- fn 4: what drives the engine → the booklet does not say. Not settled.
- fn 5: which L motor shifts, and how → the booklet does not say which motor shifts. What it shows: step 66 (p.75) marks the two L motors' cables green and blue; steps 104 (p.102), 110 (p.108) and 120 (p.118) insets show the orange rotary wave shifter (35188) and orange 1x2 levers set against two driving rings, as alignment checks only; step 198 (p.169) shows the ports and an app "gearbox test" (gear icon with a check mark). Model lead (not traced): the wave shifter p3295 (35188, gearbox.ldr -40,-150,160) is on the x=-40 line, the output line of motor p3018; the driving rings p3297 (0,-150,150) and p3326 (-40,-190,160) sit next to and above it; orange levers p3317, p3331 (60483) at z=260 and p3250, p3272 in gearbox2/3. Confidence low; not settled.
- fn 6: which gearbox position is which function → the booklet does not show it. Web search found no source either (only general notes that a 35188 wave shifter steps in 90° turns, engaging the two driving rings alternately). Not settled.
- fn 8: tilt or pitch → the booklet functions page does not show blade tilt separately. Not settled.
- fn 12: "inferred" → settled: book 1 p.15 shows track tension by the gear on the track frame. Confidence high that it is a function; that it is a worm is not visible on p.15.

### Open questions
- 42131 fn 7 and fn 9 (the selector for blade lift and ladder): the booklet does not name the positions or say what each drives. The selector shown in the build is the orange rotary wave shifter 35188 with orange 1x2 levers, moving two driving rings in the gearbox under the cab (book 1 steps 104, 110, 120, p.102, 108, 118); one of the two L motors (green- and blue-marked, step 66 p.75) turns it, and the app sets it (step 198 p.169, gearbox test). Model parts: shifter p3295 (35188), rings p3297 and p3326 (18947). Positions → functions: not seen in the booklet; a 35188 typically has four 90° positions, one per function, each engaging one side of one ring, but which position is blade lift, ladder, ripper or blade tilt would have to be traced in the model or checked in the app. Confidence: parts medium, position map not settled.

### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 12 | source "inferred" | track tension by the gear on the track frame is a listed function | book 1 p.15 | high |
| 11/3 | source "book 1 page 15 (the track drawing)" | p.15 is the full functions page: drive, blade, ladder, ripper, track tension | book 1 p.15 | high |

Sources (web leads only):
- [Game of Bricks: LEGO Technic 42113 review](https://gameofbricks.eu/blogs/news/lego-technic-42113-bell-boeing-v-22-osprey-review-1)
- [Brickset: Review 42113](https://brickset.com/article/52876/review-42113-v-22-osprey)
- [Eurobricks: understanding 4-speed sequential gearboxes](https://www.eurobricks.com/forum/forums/topic/174240-understanding-lego-4-speed-sequential-gearboxes)
- [BrickArchitect: part 35188](https://brickarchitect.com/parts/35188?retired=1)

## 42060 Roadwork Crew
Booklets: 42060-1-1.pdf (main model: truck, trailer and excavator, 84 p., the last booklet of the main model); 42060-1-2.pdf is the B model (road plough), not used. Functions page: 42060-1-1.pdf p.83. Pages read: about 55 (pp.2-49 and 62-84 as small thumbnails, plus 73 and 83 large). Time: about 15 min.
### Functions page (blind reading)
1. Round knob on top of the excavator's rear (engine cover), turned by hand → boom lowers/raises.
2. Axle end at the boom's elbow, turned → arm (stick) with bucket swings in/out.
3. Axle end on the truck's side under the tipper, turned → tipper tips up.
(The roof gear on the truck cab is visible but has no arrow. The trailer, wheels, tracks and bucket hinge have no arrows.)
### Comparison
- fn 1 "roof gear steers the front wheels": NOT ON PAGE (the page shows the roof gear with no arrow). Rests on inference from parts plus book steps (see Doubts).
- fn 2 "axle end tips the tipper": AGREES.
- fn 3 "truck wheels roll": NOT ON PAGE (book steps).
- fn 4 "trailer hitch swings, wheels roll": NOT ON PAGE (book: p.82 picture).
- fn 5 "knob on engine cover raises boom": AGREES.
- fn 6 "axle at elbow swings arm": AGREES.
- fn 7 "tracks roll": NOT ON PAGE (book steps 99-105).
- fn 8 "bucket set at an angle by hand": NOT ON PAGE (book step 95).
- Missing from list: none.
### Doubts settled
- fn 1 (steering inferred from parts): the build steps support it. Step 23 (p.23) has yellow curved arrows at the two steering knuckles. Step 26 (p.26) puts a 20-tooth gear and an upright shaft with a small gear on the chassis. Step 47 (p.41) fits the black roof gear (with a 1:1 gear scale). Confidence high that the roof gear steers, though the functions page does not show it.
- fn 8 (bucket, "unsure whether it's meant as a function"): step 95 (p.73) hangs the bucket on a pin at the foot of the 7-long arm beam. No knob, gear or link drives it. On p.83 the bucket keeps the same angle to the arm in both positions. So it is a hand-set hinge, not a driven function. Confidence high for "not driven". Whether the pin is a friction pin: the sub-step pin looks like a friction pin but I could not be sure at this size (medium).
### Open questions
- fn 8: is the bucket set by hand or driven by a knob? → Set by hand. It hangs on a pin (step 95, p.73), and nothing in steps 95-97 (pp.73-75) links it to a knob. The functions page p.83 gives it no arrow. Confidence high.
### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 1 | source "book: page 83 ... steering inferred" | steering shown in the build steps: step 23 arrows at the knuckles, step 26 gears, step 47 roof gear | pp.23, 26, 41 | high |
| 8 | note "unsure whether it's meant as a function" | a hand-set hinge, no drive; keep it as posable, drop the doubt | p.73 (step 95), p.83 | high |

## 8285 Tow Truck
Booklets: main model is 8285-1-1.pdf (1/3, 64 p.), 8285-1-2.pdf (2/3, 64 p.), 8285-1-6.pdf (3/3, 56 p., the last booklet). 8285-1-3/-4/-5 are the B model (8285-2), not used. Functions pages: 8285-1-1.pdf pp.2-3 (a spread at the front of book 1). The last booklet has no functions page (it ends with the parts list and a B-model advert, pp.54-56). The bottom edge of p.3 is cropped in the PDF, so two small pictures at the bottom middle are cut off. Pages read: about 45. Time: about 25 min.
### Functions page (blind reading)
1. Pushing the truck along (arrows along the truck) turns the engine; the bonnet with the grille tilts forward to show the engine (photo with the bonnet open and an engine close-up).
2. Knob on the cab roof, turned both ways → front wheels steer (top view with curved arrows at the front wheels).
3. Black knob on top of the box behind the cab (sleeper box), turned both ways → the yellow/black striped rear outrigger legs go up/down (white arrows at the legs, bottom right of p.3). One more picture linked to it is cut off at the page bottom.
4. Yellow lever beside the winch, moved by hand (curved arrow).
5. Black knob on the crane base side → the hook goes up/down (vertical double arrow).
6. Black knob on the crane base side → the boom (drawing of the raised boom).
7. Diagonal double arrow along the boom → the boom's inner section extends/retracts.
8. Grey lever on the crane base's side, pushed left/right → linked to two photos of the rear wheel lift: one with a down arrow, one with an up arrow.
9. Yellow pneumatic pump with a black top (on the deck, under a black knob on a spring) pushed in.
10. Rear wheel lift / grey wheel forks (white up arrows at the rear frames).
On p.2 the side bay of the crane base is shown open, with knobs 5 and 6, lever 8 and the gear at 7 visible. On p.3 the same side is closed by the "ROAD SERVICE" panel.
### Comparison
- fn 1 "pushing turns the engine": AGREES (function 1).
- fn 2 "second rear axle and front wheels roll": NOT ON PAGE (inferred).
- fn 3 "roof knob steers": AGREES (function 2).
- fn 4 "steering wheel turns on its own": NOT ON PAGE (inferred).
- fn 5 "bonnet tilts": AGREES (function 1 photo).
- fn 6 "sleeper-box knob → outriggers": AGREES (function 3; also book 2 p.47 step 53 has a red turn arrow on that knob and a red curved arrow at a leg).
- fn 7 "front left knob → winch": AGREES (function 5).
- fn 8 "yellow lever is a ratchet": AGREES that the yellow lever is worked by hand (function 4). What it does is not on the page.
- fn 9 "rear left knob raises boom": AGREES (function 6).
- fn 10 "right-side knob extends boom": AGREES (function 7). Which side the knob is on is not seen on the page.
- fn 11 "hand pump": AGREES (function 9).
- fn 12 "valve lever → wheel-lift cylinder": AGREES (functions 8 and 10).
- fn 13 "wheel-lift arm hinges": AGREES (function 10).
- fn 14 "forks tilt on a sprung hinge": NOT ON PAGE (book steps; tilt inferred).
- fn 15 "side lockers open": NOT ON PAGE (inferred; see Open questions).
- Missing from list: possibly one function, but I cannot read it. Two small pictures at the bottom middle of p.3 (a boom with a curved arrow at its base, and a yellow part with a curved arrow) are cut off in this PDF. I cannot tell what they show. Not seen.
### Doubts settled
- fn 2 (inferred free wheels): not checked in the steps. Low stakes. The book does not show it.
- fn 4 (steering wheel for show): not checked. The book does not show it.
- fn 8 (ratchet inferred from parts): book 2 step 12 (p.53) builds the yellow L-lever on an axle with a black block, a black 1x2 block and a red cross block holding a pin that points down. The unit sits over a gear beside the winch. This fits a pawl on the winch gear. Confidence medium. The book does not show the "lift to lower" action.
- fn 9 (strut as the link from the gear arms to the boom): book 6 step 56 (p.10) fits the long black strut from under the raised boom down to the base. A green circle marks an axle at its lower end. This fits the list. Confidence medium.
- fn 14 (forks tilt): book 6 steps 9-16 (pp.17-22) show the shock absorber between the arm and the fork frame. A tilting hinge is likely. Confidence medium. The book shows no arrow.
- fn 15 (lockers): see Open questions. Confidence medium.
### Open questions
- fn 15: do the side panels (side lockers) open? → Probably yes, as a hinge at the top edge, but no page shows an arrow. Evidence: book 3/3 step 75 (8285-1-6.pdf pp.45-46) builds each panel on a beam frame with pins at the top corners and a handle at the bottom middle. Step 75 on p.47 fits it to the crane base side. The functions page (8285-1-1.pdf p.2) shows that side bay open, with knobs 5 and 6 and lever 8 inside it. The photo on p.3 shows the panel closed. Confidence medium.
- fn 6: which gear does the knob's worm turn? → A 24-tooth gear. Book 1 step 5 (8285-1-1.pdf p.43) puts the worm on an upright axle in a red bracket. Step 7 (same page) puts a 24-tooth gear on a 4-long axle, meshed with the worm. Steps 8-13 (pp.44-45) finish the unit, and step 24 (p.46) fits it in the chassis. The list's "24-tooth gear" agrees. Confidence high for the gear. That this unit is the outrigger drive is medium: it fits the knob's position and book 2 p.47.
### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 15 | source "inferred ... the book shows no arrows" | add the evidence: panel with a top-edge hinge and a handle (step 75), and the bay shown open on the functions page | 8285-1-6 pp.45-47; 8285-1-1 p.2 | medium |
| 8 | ratchet "inferred" | pawl-like parts confirmed at step 12 | 8285-1-2 p.53 | medium |
| — | — | p.3 is cut off at the bottom; check a complete scan for a possible extra function (boom base with a curved arrow) | 8285-1-1 p.3 | low |

## 42053 Volvo EW160E
Booklets: 42053-1-1.pdf, one PDF of 252 pages (the last and only booklet). Functions pages: pp.218-219 for the set as sold. pp.225-245 are an optional Power Functions add-on (with the "+power functions" logo; it needs a separate PF kit). It has its own functions page at p.246: a slide switch and lights, as well as valves A-C. Pages read: about 35. Time: about 20 min.
### Functions page (blind reading)
1. Three valve levers A, B, C along the back of the upper body, each pushed left/right.
2. Pneumatic pump: push its black top down (beside the cab).
A. Boom raises/lowers. B. Stick swings out/in. C. Grab's two halves open/close.
D. Black knob on an upright shaft on the upper body, turned both ways → cab rises/lowers (vertical double arrow).
E. Rear outrigger: (1) the black leg swings down to the ground and a grey liftarm swings down over it; (2) the grey liftarm sits folded down against the leg, with a padlock symbol (locked).
(No steering, slewing or wheel function is shown. The PF page p.246 adds lights and an on/off slide switch, which are not part of the base set.)
### Comparison
- fn 1 "hand pump": AGREES (2).
- fn 2 "valve A → boom": AGREES (1, A).
- fn 3 "valve B → stick": AGREES (1, B).
- fn 4 "valve C → grab": AGREES (1, C).
- fn 5 "knob raises cab": AGREES (D).
- fn 6 "rear gear steers": NOT ON PAGE (book steps 28-29, 62). Its source says "page 219, function E shows the gear at the back". That is wrong: E is the outrigger. A large gear is only visible in the background of E's photos.
- fn 7 "upper body slews by hand": NOT ON PAGE (inferred).
- fn 8 "outriggers swing down, grey liftarm locks": AGREES on the function. DIFFERS on the parts (see Open questions).
- fn 9 "wheels roll": NOT ON PAGE (book steps).
- Missing from list: none for the base set (the PF lights and switch are optional).
### Doubts settled
- fn 2-4 (valve-to-cylinder mapping read from hoses): the page confirms A = boom, B = stick, C = grab. Confidence high.
- fn 5 (p2207 is the knob): page D shows a black knob on an upright shaft with a turn arrow, cab going up/down. Confidence high.
- fn 6: the steps cited agree. Step 28 (p.13) shows a gear with a 1:1 gear scale and the long red shaft; step 62 (p.32) adds the gear at the back. Only the source text needs fixing.
- fn 7 (slews by hand): the book does not show slewing. Step 90 (p.46) shows the turntable. I saw nothing driving it, but I did not check every later step. Confidence low-medium.
- fn 8 (which parts are leg and lock, inferred): see Open questions.
### Open questions
- fn 8: which assembly is the rear outrigger leg, and which is its lock? → The leg is the black assembly built ×2 in steps 49-55 (pp.24-25) and fitted in step 56 (p.26). It is the model file's "42053 - outrigger.ldr": black L-liftarm 32140, black 5-long 32316, tan long pin, dark grey 60483, and at the foot two red axles with two black thin 1x3 liftarms 6632 (step 54). The lock is the separate grey assembly from steps 58 and 59 (pp.28-29): a black axle-pin 18651, two dark grey thin liftarms 32449, a grey 3-long axle 4519 and two dark grey 60483. In the main model these are at x ±120, y -92 to -152, z 130-170 (lines 75-86 of the mpd). The list's lock parts p160/p175 6632 are black and inside outrigger.ldr. They are the leg's foot pieces, not the lock. The page's lock is grey. The control p182/p183 43857 is a black 2-long beam on long pins at x ±140, fitted in step 57 (p.27) at the leg's pivot end. Whether it turns with the leg I could not tell from the picture. Confirmed by p.219 (E1/E2, grey lock vs black leg) and pp.24-29. Confidence medium-high.
### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 8 | lock = p160/p175 6632 (black, in outrigger.ldr) | lock = grey assembly of steps 58-59 (32449 ×2 + 60483 ×2 on axle 4519, pin 18651), at x ±120 in main | p.219 E; pp.28-29 | medium-high |
| 8 | control p182/p183 43857 | better control: a part of outrigger.ldr (e.g. its 32140 or 32316), the leg itself (steps 49-56) | pp.24-26 | medium |
| 6 | source "page 219, function E shows the gear at the back" | E is the outrigger; steering is not on the functions page; cite steps 28-29 and 62 only | p.219 | high |

## 8270 Rough Terrain Crane
Booklets: main model is 8270-1-1.pdf (1/2, 24 p.) and 8270-1-2.pdf (2/2, 24 p., the last booklet). 8270-1-3/-4 are the B model (8270-2). Functions page: 8270-1-1.pdf p.2 (the inside cover, one photo spread with arrows). Book 2 has no functions page at the end (steps end at p.17, then adverts). Pages read: about 50 (both booklets as thumbnails, plus 9 pages large). Time: about 15 min.
### Functions page (blind reading)
1. Inset: the upper works slew round on the chassis (curved arrows round the top). The outrigger legs at both ends swing (curved arrows at the legs).
2. Boom raises/lowers (large curved arrow). A line goes from it to the grey gear knob on the long axle at the back of the upper works.
3. Hook goes up/down (vertical double arrow). A line goes from it to the grey gear knob high on the side of the boom base (winch).
(The boom is drawn extended, with no arrow along it. The wheels have no arrows.)
### Comparison
- fn 1 "upper works slew": AGREES (inset).
- fn 2 "back knob raises boom via worm": AGREES (line to the back knob). Book 2 step 12 (p.7) also has a red turn arrow on that knob.
- fn 3 "winch knob raises hook": AGREES.
- fn 4 "inner boom slides by hand": NOT ON PAGE (inferred).
- fn 5 "outrigger legs fold": AGREES (inset).
- fn 6 "wheels roll, no steering": NOT ON PAGE (book step 15).
- fn 7 "8-tooth gear on a friction pin is a winch brake": NOT ON PAGE (inferred).
- fn 8 "hook hangs": AGREES (photo).
- Missing from list: none.
### Doubts settled
- fn 4 (inner boom slides; "not sure"): book 2 step 16 (pp.11-12) slides the black 15-long beam with its yellow tip into the yellow channel. I saw nothing that pins it. The red arrows in step 17 (p.13) show the string laid along the boom and over the tip, not a slide. On p.2 the black section looks longer in the left photo than in the right one, but the two views differ, so this proves nothing. Answer: a hand slide is plausible but unconfirmed. Confidence low.
- fn 7 (friction brake "a guess"): book 2 step 14 (p.9) fits an 8-tooth gear on a blue axle-pin beside the winch gear. In the model file that is the blue 43093 at (40,-92,56) with gear p44 at (50,-92,56), 20 LDU from the winch axle's 8-tooth gear at (50,-104,72), so they mesh. The blue pin is the friction kind, so a drag brake is the likely purpose. Confidence medium.
### Open questions
- fn 2: the model file has a worm with no gear near it. Does the real set have a gear meshing with it? → Yes, and the model file has it in the right place. Book 1 (crane part) step 5 (p.20) builds the worm on a 7-long axle between two yellow parts. Book 2 step 8 (pp.2-3) puts an 8-tooth gear in the middle of a 6-long axle between two grey thin liftarms (the boom's lifting arms), and sets the unit directly over the worm. The model file matches: submodel "8270 - Crane Sub05.ldr" has the worm 4716 with its axis along z at (0,-40,0) in the crane. "8270 - Crane Sub08.ldr" has the 8-tooth gear 3647 on axle 3706 with its axis along x at (0,-60,0), with the arms 2825 at ±10. That is 20 LDU (1 stud) straight above the worm, at right angles, the standard worm and 8-tooth spacing (axes checked against ldraw/parts/4716.dat and 3647.dat, both along local z). Sub08 is turned 4.4° about x (its matrix has 0.997/0.076 terms), and the worm is turned 7° about its own axis. Both are clocking only. So the worm does not stand alone. If the code finds no gear near it, the cause is probably in the mesh detection (worm-to-8T distance, or a tolerance with these small rotations), not a missing or misplaced part. Confidence medium-high (pictures p.2-3 and p.20, mpd lines 89-100 and 158-190).
### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 2 | (question: worm without gear) | the 8-tooth gear on the lifting-arm axle sits 1 stud above the worm in both the book and the model file; check the mesh detection, not the model | 8270-1-2 pp.2-3; 8270-1-1 p.20 | medium-high |
| 7 | "what they are for is a guess" | 8-tooth gear on a blue friction axle-pin meshing the winch gear: a brake | 8270-1-2 p.9 | medium |
| 4 | "not sure it is meant to slide" | no arrow; nothing seen fixing it; leave it as unsure | 8270-1-2 pp.11-13 | low |

## 8838 Shock Cycle
Booklets: omr/instructions/8838-1/ (one booklet, 24 scanned JPGs). Main model is steps 1-24 on scans 003-015 (scan 015 = finished bike); scans 016-021 are the alternate chopper/trike; scans 022-024 are the 8838+8720 motor add-on. Functions pages: NONE. No page shows a function with an arrow or hand. The cover (001) is a dimensioned blueprint with no motion arrows. I used the build steps instead. Pages read: 18 scans. Time: ~25 min.
### Functions page (blind reading)
No functions page. From the build steps:
1. Handlebars → fork, number board, front shocks and front wheel turn on the steering head (steps 12-15, 22; scans 007-008, 013).
2. Front wheel hangs between two shock absorbers (step 22 insets 1-2, scan 013) → telescopic front suspension.
3. Rear swinging arm with a shock absorber each side (steps 19, 23 insets; scans 010, 014) → rear suspension.
4. Rear wheel → chain → gears → two-cylinder engine. Step 20 (scan 011) adds a 24-tooth gear on the rear wheel, and a 6-long axle carrying an 8-tooth gear and a bevel gear; its 1:1 inset shows the gear train (see open question). Step 21 (scan 012) adds the 30-link chain.
5. Centre stand: two light grey levers on an axle (step 16, scan 009). Two K3 rubber bands (step 18, scan 010) run from the tops of the levers to an axle on the frame. Step 19 adds two dark 1x3 levers with pins at the levers' tops.
### Comparison
- fn 1 "handlebars steer the front wheel": NOT ON PAGE (book steps 12, 14-15, 22). Matches the build steps.
- fn 2 "telescopic front suspension": NOT ON PAGE (book step 22). Matches the build steps.
- fn 3 "rear swinging arm": NOT ON PAGE (book steps 19-21, 23). Matches the build steps.
- fn 4 "springs hold the bike up": NOT ON PAGE (book steps); skip.
- fn 5 "rear wheel works the engine": NOT ON PAGE (book steps 1-10, 20-21; partly inferred). Matches the step 20 inset. See the open question: the model file leaves out the axle that carries the 8-tooth and bevel gears.
- fn 6 "front wheel rolls freely": NOT ON PAGE (book step 22).
- fn 7 "centre stand swings": NOT ON PAGE (book steps 16, 22; the swing range is inferred).
- fn 8 "rubber bands hold the stand": NOT ON PAGE (book step 18; that they hold the stand both ways is inferred).
- Missing from list: nothing.
### Doubts settled
- fn 5: which small gear is the 8-tooth and which the bevel → Step 20's parts box (scan 011) lists one 8-tooth gear, one 14-tooth bevel gear (the third gear; a small scan, but it does not look like a 16-tooth gear), one 24-tooth gear, an 8-long axle (the rear wheel's) and a 6-long axle. The 1:1 inset shows the 6-long axle beside the 8-long axle that carries the 24- and 16-tooth gears (placed in step 10, scan 006). The 6-long axle's 8-tooth gear meshes with the 24-tooth gear. Its bevel gear sits at the 16-tooth end and meshes with the crankshaft's bevel gear (placed in step 7, scan 005). The list's reading is right. Confidence medium-high.
- fn 7: how far the stand swings → the booklet does not show it. Confidence: n/a.
- fn 8: whether the bands hold the stand up and down (over-centre) → the booklet does not show it. Step 18 (scan 010) shows each band from the top of a grey lever back to an axle on the frame. From the drawing I cannot tell whether the band's line crosses the lever's pivot. Confidence low.
### Open questions
- fn 5, the 6L axle with its gears (submodel "8838 - Axle-with-Gears.ldr": 6L axle 3706, bush 3713, 14-tooth bevel 4143, 8-tooth 3647; that is one bevel and one 8-tooth gear, not two bevels): it IS in the real set. Step 20 (scan 011, booklet page 11) puts it in, in the same step as the rear wheel. Its 1:1 inset shows where it goes: parallel to the 8L gear axle (3707 at 0,10,-100 in "Shock Cycle.ldr", which carries the 16T 4019 at x=-30 and the 24T 3648a at x=+30), 2 studs from it towards the crankshaft. The 8-tooth gear is on the 24-tooth side and meshes with that 24T. The bevel is at the other end and meshes with the crankshaft's bevel 4143 at (0,10,-43). What it drives: rear wheel 24T → chain → 16T; the 24T on the same axle → 8T; the 6L axle's 14T bevel → the crankshaft's 14T bevel → the pistons (about 4.5 crank turns for each wheel turn). The model file's numbers suggest this placement in "8838 - Shock Cycle.ldr": `1 0 0 10 -60 -1 0 0 0 1 0 0 0 -1 8838 - Axle-with-Gears.ldr`. That puts the axle 40 LDU from the 8L axle (right for 8T+24T), the 8T at x=+30 and the bevel at x=-17, 17 LDU from the crankshaft's bevel. I have not tested this line in the viewer. Confidence: that the axle is in the set and what it drives, high; the exact line, medium.
### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 5 | the 6L axle with its gears is defined but never placed | it is placed in step 20; add the Axle-with-Gears submodel to the model file (suggested line above), then the engine can be driven | scan 011 (booklet p.11), step 20 inset | high (fact) / medium (exact line) |
| 5 note | "two bevel gears" (wording in the brief) | the submodel has one 14T bevel and one 8T gear, which matches step 20's parts box | scan 011 | medium-high |

## 8094 Control Center
Booklets: omr/instructions/8094-1/ (one booklet, 72 scanned JPGs; several scans show only half a page). The booklet has three models: the plotter (scans 001-029), the robot arm (030-049) and the crane (050-071); 072 is the back cover with photos. The model file is the robot arm with the chute and box. Functions pages: NONE. The robot arm's last step 30 (scans 048-049) shows the finished arm wired to the Control Center. The Control Center's joystick has turn arrows (left and right) and arm-like up/down arrow icons marked 1 and 2, but the model has no motion arrows. Pages read: 9 full scans plus two contact sheets of all 72. Time: ~20 min.
### Functions page (blind reading)
No functions page. From step 30 (scans 048-049), the build steps and the back-cover photo (072):
1. Two motor leads go to the Control Center (step 29, scan 047): one from the motor in the robot base (it turns the turntable through gears; steps 11-17, scans 037-040), and one from the motor at the back of the arm (step 20, scan 041).
2. Arm motor: step 23 (scan 042) adds one rubber band (1:1 circle) with a worm. The 1:1 circle's arrow points at an inset of a belt wheel on a 6L axle next to the motor, so the band is the drive belt from the motor to that wheel. The gears then run along the arm (steps 22-26) to the elbow's 40-tooth gear and the forearm shaft.
3. Gripper: step 27 (scans 044-045) has inset arrows: a curved arrow at a claw lever (sub 4) and a push arrow along the shaft (sub 5). These are build arrows, not a function picture.
4. Chute and box beside the baseplate (steps 1-6, scans 030-035; photo 072 shows a yellow piece on the chute).
### Comparison
- fn 1 "base motor slews the turntable": NOT ON PAGE (book steps 9-17). Not checked in detail. The rubber band in the base was not looked for.
- fn 2 "arm motor opens/closes gripper": NOT ON PAGE (book steps 19-27). Step 23 confirms the belt drive (see open question).
- fn 3 "same motor raises/lowers arm": NOT ON PAGE (inferred). Step 29 shows only two motor leads, so no third motor lifts the arm.
- fn 4 "links keep the gripper level": NOT ON PAGE (inferred from steps 25-29; step 25, scan 043, shows the grey link beams).
- fn 5 "pieces slide down chute": NOT ON PAGE (book steps 3-6; its purpose is inferred from photo 072). Fits photo 072.
- fn 6 "chute is fixed": NOT ON PAGE (book steps 5-6). The booklet draws no motion there.
- Missing from list: nothing mechanical.
### Doubts settled
- fn 2 / fn 1 note "the rubber band isn't in the model file": for the arm, settled by step 23 (scan 042): one rubber band, a drive belt from the motor to the belt wheel on a 6L axle that carries the worm. Confidence medium-high. For the base: not checked.
- fn 3 (how one motor both grips and lifts): settled only in part. Step 29 shows two motors, base and arm, so the arm motor must do both. How the drive changes from gripping to lifting is not shown. The booklet does not show it. A web search (Brickset, Technicopedia listings) gave nothing on it. Confidence that one motor does both: medium. The mechanism itself: unsettled.
- fn 4: the booklet does not show it; the grey links in steps 25-26 fit a parallel link. Confidence low-medium.
- fn 6: whether the chute is meant to tip → the booklet does not show it; nothing hints that it moves. Confidence low.
### Open questions
- fn 2, the rubber band: yes, the booklet shows one. Step 23 (scan 042, page 42 of the scans) lists 1x rubber band, drawn 1:1 next to the step. Its arrow points at an inset of a belt wheel on a 6L axle (dark beams), which sits in front of the arm motor placed in step 20. It is a DRIVE BELT from the motor's output to that belt wheel, whose axle carries the worm (also in step 23's parts box). It is not a return spring. Confidence medium-high (the scans are small).
### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 2 | band not in model file (note only) | add a note: the band is a drive belt, motor → belt wheel on the worm's 6L axle, step 23 | scan 042 | medium-high |
| 3 | "unsure how the book means the one motor to share" | still unsure; the book shows two motors only (base, arm) | scan 047 | medium |

## 8844 Helicopter
Booklets: omr/instructions/8844-1/ (one booklet, 32 scanned JPGs). Main model steps 1-19 on scans 004-014; scans 015-021 are the B model; scans 022-023 are the 8844+870/960 motor add-on; 024-031 are extra small models; 032 is the back cover. Functions pages: NONE. No arrows or hands for functions on the cover (001), step 19 (014) or the back cover (032). The back cover has a photo and a drawing of the rotor drive: belt wheel/handwheel, crown gear, mast with 24T at its foot. Pages read: 5 full scans plus a contact sheet of all 32. Time: ~15 min.
### Functions page (blind reading)
No functions page. From the build steps and the back cover:
1. Handwheel on the left side → crown gear → 24T at the mast foot → main rotor (step 13, scan 009; back cover drawing, scan 032).
2. Tail rotor: a 10L shaft with universal joints runs along the boom. At the tail, an 8T on that shaft drives a crown gear; a belt wheel and a rubber band take the drive on to the tail rotor's axle (step 11, scan 008; step 12, scan 009).
3. Landing gear: a 24T on a crank axle (step 7, scan 006) and a chain (step 5) to the rear leg's gear; legs and wheels in step 19 (scan 014). No arrow shows retracting.
4. Yellow engines on axles beside the mast (step 14, scan 010).
### Comparison
- fn 1 "crank retracts landing gear": NOT ON PAGE (book steps 1-7, 19; what it does is inferred).
- fn 2 "handwheel turns main rotor": NOT ON PAGE (book steps 10, 13, 17-19). The back cover drawing (scan 032) shows the same drive.
- fn 3 "handwheel turns tail rotor via rubber band": NOT ON PAGE (book steps 10-12). Matches step 11 (see open question).
- fn 4 "wheels roll": NOT ON PAGE (book step 19).
- fn 5 "engines turn freely": NOT ON PAGE (inferred).
- fn 6 "airframe rigid": NOT ON PAGE (book steps).
- Missing from list: nothing.
### Doubts settled
- fn 1 (that the crank retracts the legs): the booklet draws no arrow. Steps 6-7 (scan 006) show the 24T on its axle meshing at the front axle, and step 5 the chain. This fits the list. Confidence medium.
- fn 5 (engines turn freely): the booklet does not show it. Confidence low.
### Open questions
- fn 3, the rubber band: yes, the booklet shows one. Step 11's parts box (scan 008, booklet p.8) lists 1x rubber band. In sub-steps 2-3 a thin line runs from the rim of the belt wheel (on the side of the boom at the tail) to a small pulley/bush on the axle end next to it. That axle carries the tail rotor in step 12 (scan 009). It is a DRIVE BELT that turns the tail rotor from the crown-gear/belt-wheel axle, not a spring. What the small pulley on the rotor axle is: a bush, or the round plates the list names; the scan is too small to tell. Confidence: a drive belt to the tail rotor, medium-high; the exact pulley part, low.
### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 3 | belt to "the tail rotor's pulley, two round plates" | belt from the belt wheel to a small pulley on the tail-rotor axle (part not readable); drive belt confirmed | scan 008, step 11 sub 2-3 | medium-high / low for part |

## 41999 4x4 Crawler Exclusive Edition
Booklets: omr/instructions/41999-1-1.pdf (84 p.), -2 (80), -3 (76), -4 (68). The covers' numbers match the file numbers; booklet 4 is the last. Functions pages: 41999-1-4.pdf p.64-65. Also step 104 on p.62 has arrows. Pages read: 4 covers + 11 pages of booklet 4 (58-68), 3 of them at full size. (The Read tool could not render PDFs because pdftoppm is missing; I split pages with pypdf and rendered them with sips.) Time: ~15 min.
### Functions page (blind reading)
p.64:
1. Set-up: the remote's channel switch to 1 and its two direction switches shown (left inset). The IR receiver's orange channel slider is pushed to 1 (inset "1", under the body).
2. Battery box: an orange slide switch on the side of the chassis under the cab is moved left/right (double arrow, top-right inset) → headlights light (the lights inset hangs off it).
3. Remote, left lever (red handle) pushed forward/back → the crawler drives forward/back (bottom-left car, straight arrow).
4. Remote, right lever turned by a black wheel fixed to it with a red axle → steering: curved arrows at BOTH the front-left and rear-left wheels (bottom-right car), so both axles steer.
p.65:
5. (1) A light grey switch with an orange lever and a red knob, in the cab behind the seats, turned (curved arrow) → (2) the front winch hook goes out and in (double arrow).
p.62 step 104: arrows close the two doors, and a big arrow lowers the raised body shell (p.61 step 103 shows the shell tipped up).
### Comparison
- fn 1 "drive, one stick, 2 XL motors": AGREES (p.64, left lever → drive).
- fn 2 "servo steering, both axles": AGREES (p.64, wheel on the right lever → both axles' wheels turn). The page arrows do not show whether the rear steers opposite to the front.
- fn 3 "live axles articulate": NOT ON PAGE (book 2 steps 68-72; inferred).
- fn 4 "springs": NOT ON PAGE (book steps); skip.
- fn 5 "winch by pole-reverser": AGREES (p.65, 1 → 2).
- fn 6 "doors open": NOT ON function PAGE; rests on book step 104 (p.62), which has door arrows. Agrees with that step.
- fn 7 "body shell tilts": NOT ON function PAGE; rests on book steps 103-104 (p.61-62), which agree.
- fn 8 "headlights": AGREES (p.64 lights inset; switched on at the battery box slide).
- Missing from list: the battery box switch (p.64 top-right, orange slide, left/right) and the IR channel set-up (p.64 insets). Both are electrical set-up, not mechanisms; fn 8 could name the battery box switch as its control.
### Doubts settled
- fn 2 "whether the rear wheels steer opposite to the front is inferred from the photo": p.64 draws curved arrows at both left wheels. The arrows are generic and do not settle the direction. Model file: the steering gears p299/p316 sit at z=∓177, inboard of both axles (hubs at z=∓289), so the racks mirror each other. One shaft turning both racks the same way steers the rear opposite to the front (real 4-wheel steering, not crab). Settled by geometry, not by the booklet; confidence medium.
- fn 3 "inferred: no motion arrows": the booklet does not show articulation. Not checked further. Confidence: n/a.
### Open questions
- fn 2, the servo: p.64 shows the servo steering both axles: front-left and rear-left wheels each get a curved "turn" arrow. It is worked from the IR remote's second lever, which has a black wheel fitted on a red axle so the user turns the wheel like a dial to push the lever. The first lever (red handle) drives. Both the remote and the receiver are on channel 1. Confidence high (that the servo steers both axles and how it is worked); medium (opposite rear steering, from model geometry).
### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 2 note | rear-opposite steering "inferred from the photo" | the page does not settle the direction; the model geometry (racks mirrored, inboard of both axles) gives opposite steering | p.64 + model file | medium |
| 8 | lights on "when the battery box is switched on" | add the control: the battery box's orange slide switch on the side under the cab | p.64 | high |

## 42109 App-Controlled Top Gear Rally Car
Booklets: `omr/instructions/42109-1-1.pdf`, the only booklet (120 pages). Functions pages: 42109-1-1.pdf p.114-115. Pages read: about 30 (113-120, 4-19, 20-43 as contact sheets, parts list p.113 zoomed). Time: about 25 minutes.
### Functions page (blind reading)
1. p.114 step 4 and p.115 left panel: the Control+ app → the car drives forward and back (arrows along the ground).
2. p.115 second panel: the app → the front wheels steer left and right (curved arrow at a front wheel).
3. p.115 lower-left photo: the bonnet is shown lifted, so the engine bay can be seen. No arrow and no control shown: by hand.
4. p.115 app screens: multi-function control, gyro control, challenges and achievements. These are not mechanisms.
### Comparison
- fn 1 "XL motor drives the rear wheels through the differential": AGREES (p.114-115, driving from the app).
- fn 2 "with the motor still, one rear wheel turns the other the opposite way": NOT ON PAGE (book step 7, the differential).
- fn 3 "L motor steers through the rack": AGREES (p.115 steering panel).
- fn 4 "front wheels roll freely": NOT ON PAGE (book steps).
- fn 5 "hub runs both motors from the app": AGREES (p.114-115). Not a mechanism.
- Missing from list: the bonnet opens by hand (p.115, lower-left photo, lifted; no arrow).
### Doubts settled
- No function has an "inferred" source or a doubting note.
### Open questions
- fn 3 (2L friction pin and 3L axle in the same hole at the half shaft): **the model file is wrong; the real set has no pin there.** The half shaft is built in book steps 9-10. Step 9 (p.17): a yellow 3L axle (4519) goes into one end of the grey 180° angle connector 32034 (marked "2"). That unit goes across the frame, and the axle goes through the red 32184 into the differential. Step 10 (p.18): a black 8L axle (3707) with a red half bush (3713) goes into the other end of the 32034 from outside. The other half shaft is the 5.5L axle with stop (59426) in step 6 (p.15). No friction pin goes into this line in any of these steps.
  - The extra parts are p381 2780 at (0,-63,0), p382 2780 at (0,-23,1) and p383 32526 (black L-beam 3x5) at (-10,-21,-79). All three are in `42109 - car.ldr`, at model step 17 (file lines 1002-1004).
  - Model step 17 matches book steps 36-37 (p.39-40). The book's part boxes for those steps hold 2 + 2 black friction pins, 1 + 1 black L-beams 3x5 and 1 yellow 15100. In the model these are the front-frame pins at (400/360, 0, ±50), the two 32526 at (400,-80,±40) and the 15100. The model's step 17 also holds the 2 pins and 1 L-beam above, which the book does not show.
  - Parts list p.113: 95 black friction pins 4121715 (the model has 97 2780) and 14 black L-beams 3x5 4142823 (the model has 15 32526). The 1 grey 32034 (4211567) matches.
  - Confidence: high. Proposed fix: remove p381, p382 and p383 from the model (or let the model loader skip them).
### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| new | — | bonnet lifts by hand (no arrow) | p.115 | high |
| (model) | pins p381, p382 and L-beam p383 at the rear centre | not in steps 9-10 or 36-37; parts list counts are each 1-2 lower | p.17-18, 39-40, 113 | high |

## 8081 Extreme Cruiser
Booklets: 8081-1-1.pdf (book 1, 48 p.), 8081-1-2.pdf (book 2, 48 p.), 8081-1-3.pdf (book 3, last, 36 p.); cover numbers match file order. Functions pages: none (book 3 ends with step 19, parts list p.35, advert p.36; book 1 and 2 have none either). Used instead: every step with a motion arrow, found by scanning all three booklets as contact sheets. Pages read: all 132 as thumbnails, about 14 close up. Time: about 15 min.
### Functions page (blind reading)
No functions page. Motion arrows in the build steps:
1. Book 3 p.33 step 18: red arrow lifts the bonnet (hinged at its windscreen end), showing the engine.
2. Book 2 p.47 step 4 (left side) and book 3 p.4 step 5 (right side): red arrows swing an L-shaped rear side frame (dark liftarm with a red tail light) down and round into place at the back; book 3 p.5 step 6 then locks both with a 13-long beam across the back (number plate and tail lights now at the rear). These are build moves, not a working function.
3. Book 1 p.13 step 13: a hand holds the knob gear (inset) as it goes on the long axle — no arrow for turning.
4. Book 2 p.39 step 30: the roof gear goes on its upright axle; green circles mark the axle's path; no turning arrow.
### Comparison
- fn 1 "roof gear steers the front wheels": NOT ON PAGE (book steps 11-13 and book 2 step 30; how it is worked is inferred). Web lead (LEGO product copy, Eurobricks review) says rooftop / HOG steering.
- fn 2 "rolling turns the V4 engine": NOT ON PAGE (book steps).
- fn 3 "rear differential": NOT ON PAGE (book steps).
- fn 4 "bonnet tilts up": AGREES (book 3 p.33 step 18).
- fn 5 "two front doors open": NOT ON PAGE (book steps for fitting; "inferred" that they open). No door-opening arrow found in any booklet.
- fn 6 "tailgate swings up on a hinge at the roof": DIFFERS — its source misreads book 3 step 5: those red arrows swing the right rear side frame into place during the build (same move as book 2 step 4 on the left), and step 6 fixes both with a beam. The book shows no tailgate opening.
- fn 7 "front independent suspension, rear axle on two shocks": NOT ON PAGE (book steps; inferred that it moves).
- fn 8 "springs" (skip): NOT ON PAGE (book).
- fn 9 "steering wheel for show": NOT ON PAGE (inferred).
- Missing from list: nothing the booklets show as a function.
### Doubts settled
- fn 1: how it is worked → the roof gear steers; the book draws no arrow (book 1 p.13 shows a hand holding the gear, not turning it). Settled by web lead (LEGO copy "rooftop steering"), confidence high that the roof gear steers; the book itself does not show it.
- fn 5: that the doors are meant to open → LEGO's product copy says "Open the doors and trunk" (web lead); the booklet does not show it. Hinge at the front edge: not seen. Confidence medium.
- fn 6: which parts make up the tailgate, and whether there is one → the cited arrows are a build move (book 3 p.4-5 steps 5-6), so the source is wrong. LEGO's copy says the "trunk" opens and a Brickset reviewer lists the hatch as working (web leads), so a tailgate probably exists, but the booklet does not show which parts move or where the hinge is. Confidence: source wrong high; tailgate exists medium; parts not seen.
- fn 7: "unsure how the front shock absorber p209 and the rear axle are hung" → book 1 p.36 front-axle sub-step 9 shows a single shock absorber laid across the top of the front axle assembly, between the two sides (one shock for both wheels, not one per wheel); book 1 p.23 step 19 and p.25 step 21 circle the two rear shocks, each from the frame down to the rear axle housing. That it is meant to move: not shown by arrows. Confidence medium.
- fn 9: whether the steering wheel is linked → the booklet does not show a link; not settled further. Confidence low.
### Open questions
- None beyond the above.
### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 6 | source "book 3 step 5 (red arrows swing the rear panel up and round)" | step 5 arrows swing the right rear side frame into place during the build; step 6 locks it with a beam. No tailgate arrow anywhere | book 3 p.4-5 (and book 2 p.47 for the left side) | high |
| 6 | tailgate parts p455/p411/p412 | not seen in the booklet; mark the function "inferred (LEGO product copy says the trunk opens)" | — | medium |
| 7 | note "unsure how the front shock absorber and the rear axle are hung" | one transverse shock across the front axle between the two sides; two rear shocks frame-to-axle | book 1 p.36 (sub-step 9), p.23 step 19, p.25 step 21 | medium |
| 5 | "inferred: that they're meant to open" | no arrow; LEGO copy says doors open | — | medium |

## 8063 Tractor with Trailer
Booklets: 8063-1-1.pdf (book 1, 76 p.), 8063-1-2.pdf (book 2, last, 84 p.); cover numbers match file order. Functions pages: none (book 2 ends with step 32 and the hitched pair on p.79, parts list p.80-81, adverts p.82-84). Used instead: the build steps with arrows and close-up insets. Pages read: all 160 as thumbnails, about 25 close up. Time: about 15 min.
### Functions page (blind reading)
No functions page. Arrows and insets in the build steps:
1. Book 1 p.49 step 35: the red bonnet sub-assembly is fitted and a red curved arrow swings it down at the dashboard end — the bonnet is hinged (it opens).
2. Book 1 p.14 step 12: inset circle shows the red lever (on its catch) and the driving ring on the drive shaft — the PTO / clutch selector; no direction arrow.
3. Book 1 p.12 step 10: vertical worm with a black knob on top (the three-point lift drive); no arrow.
4. Book 2 p.77 step 30: trailer bed shown tipped up on its linear actuator, with a zoom circle at the bed's rear pivot.
5. Book 2 p.79: tractor and trailer hitched, inset shows the hitch pin.
6. Book 1 p.36 step 28: a red curved arrow under the engine; read as a turn-the-model hint, not a function (low confidence).
### Comparison
- fn 1 "roof gear steers the front wheels": NOT ON PAGE (book steps; inferred that it is the steering).
- fn 2 "steering wheel for show": NOT ON PAGE (inferred).
- fn 3 "rolling turns the 4-cylinder engine": NOT ON PAGE (book steps).
- fn 4 "front wheels roll freely": NOT ON PAGE (book step).
- fn 5 "red lever slides the driving ring": NOT ON PAGE (book 1 step 12 inset shows the lever and ring, no arrow).
- fn 6 "PTO turns when engaged": NOT ON PAGE (inferred from gears).
- fn 7 "knob behind the cab lifts the three-point linkage": NOT ON PAGE (book steps).
- fn 8 "gears at the trailer front tip the bed": AGREES with book 2 p.77 (bed tipped on the actuator); the control is not shown with an arrow.
- fn 9 "drawbar swivels on its hitch pin": AGREES with book 2 p.79 inset (hitch).
- fn 10 "trailer wheels roll": NOT ON PAGE (book step).
- fn 11 "trailer wheels on rocking beams (bogie)": NOT ON PAGE (inferred) — and the build suggests the beams are fixed (see below).
- fn 12 "chain hangs" (skip): NOT ON PAGE (book step 30, book 2 p.44).
- Missing from list: the opening bonnet (book 1 p.49 step 35 arrow; LEGO copy also mentions "its opening hood").
### Doubts settled
- fn 1: "that this is the steering is inferred" → LEGO's product copy: "Turn the top gear-wheel to steer the front wheels" (web lead). The booklet does not draw it. Confidence high.
- fn 2: "may be meant to steer as well" → the booklet does not show it; LEGO's copy names only the top gear for steering (lead). Confidence low-medium that it is for show.
- fn 5: which way is engaged and how far the lever swings → the booklet does not show it (book 1 p.14 step 12 inset shows the lever and ring in one position only, no arrow). A retailer listing says a control can "engage or disengage the rear rotary transmission shaft" (lead), so it is a PTO clutch. Direction: not settled. Confidence low.
- fn 6: "unsure what the ring engages; could instead couple the engine" → booklet does not show; the lead above supports PTO. Confidence medium that it is the PTO, low on direction and amount.
- fn 11: "the beams may be fixed" → book 2 p.39 step 25 (sub-steps 1-6, p.38-39): each 11-long red beam carries two upright L-liftarms, each fixed to the trailer frame with its own tan axle pin; the two pins are parallel but at different places along the beam, so the beam cannot rock about either. The beams look fixed. Confidence medium (read from the drawing, not from the model file).
### Open questions
- None beyond the above.
### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| new | (missing) | bonnet hinged at its dashboard end, opens by hand | book 1 p.49 step 35 | medium |
| 11 | each side's beam rocks (bogie) | beam held by two separate pins; fixed. Change to fixed or drop | book 2 p.38-39 step 25 | medium |
| 1 | "that this is the steering is inferred" | not drawn; LEGO copy confirms the top gear steers | — | high |

## 42006 Excavator
Booklets: 42006-1-1.pdf (book 1, 84 p.), 42006-1-2.pdf (book 2, last, 48 p.); cover numbers match. Functions pages: 42006-1-2.pdf p.28 (book 2's p.29 is the Power Functions add-on advert; p.30-41 the PF motor option; p.42 the PF functions page). Pages read: all 132 as thumbnails, about 14 close up. Time: about 10 min.
### Functions page (blind reading)
Book 2 p.28: finished model with three insets. No knob or lever is shown for any of them.
1. Grab: the four claws close together (two arrows pointing inward).
2. Boom raises/lowers and stick (arm) swings in/out (two curved double arrows in one inset).
3. Superstructure slews round on the tracks, "360°".
Book 2 p.42 (PF option): the same grab and boom/stick arrows, with motor, battery box and switch pictures; no slewing arrow.
### Comparison
- fn 1 "knob drives a gearbox; two red levers choose boom, stick or grab": NOT ON PAGE (book steps 19-32; book 1 p.34 step 30 inset circles both change-over catches).
- fn 2 "boom raises and lowers": AGREES (control not shown on the page).
- fn 3 "stick moves in and out": AGREES (control not shown on the page).
- fn 4 "grab opens and closes": AGREES (control not shown on the page).
- fn 5 "superstructure slews 360 degrees": AGREES.
- fn 6 "tracks run freely": NOT ON PAGE (book steps).
- Missing from list: nothing.
### Doubts settled
- fn 1-4: which lever and which lever position gives which function → the booklet does not show it. Book 1 p.34 step 30 inset shows both red catches in one (assembly) position, circled green, with no function marks; the gear-check icons on p.24 and p.29 (steps 18, 22) only show which gear part to use. Confidence: the book does not settle it (high that it isn't shown).
- fn 5: "unsure whether it's turned by hand or from the gearbox" → by hand. Steps 38-41 (book 1 p.46-49) show no gear meshing the turntable's outer teeth, and the PF page (book 2 p.42) motorises grab, boom and stick but shows no slewing, while the main functions page shows slewing. Confidence medium.
### Open questions
- None beyond the above.
### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 5 | "inferred: unsure whether it's turned by hand or from the gearbox" | by hand: no gear on the turntable teeth; PF option motorises the other three only | book 1 p.46-49; book 2 p.42 | medium |

## 42038 Arctic Truck
Booklets: 42038-1-1.pdf (book 1, 84 p.), 42038-1-2.pdf (book 2, last, 80 p.; mdls gives no page count, the PDF header says 80); cover numbers match. Functions pages: 42038-1-2.pdf p.66-67 (one spread); PF option p.68-75 with its own functions page p.76. Pages read: book 2 p.60-80 as thumbnails plus about 14 pages close up. Time: about 15 min.
### Functions page (blind reading)
Book 2 p.66-67:
1. Black knob (axle joiner on a vertical shaft) on top of the frame behind the cab, turned (curved arrow, rotation icon) → drives the function the selector chooses.
2. Red selector lever with a ball top, two positions marked by stickers: position 1 (bed icon) and position 2 (crane icon). In the inset the ball tips towards position 1 on the side where a tan bevel gear shows, towards position 2 on the side where a grey gear shows.
3. Position 1 → the orange container/bed at the back tips up (inset 1).
4. Position 2 → the crane boom raises and lowers (inset 2, straight double arrow).
5. Crane slews round on its base (inset 2, curved arrow at the base); what turns it is not shown.
6. Small gear at the crane's boom pivot, turned (curved arrow) → the hook and barrel are lifted (up arrow under the barrel): the winch.
No steering arrow on this spread. Book 2 p.76 (PF) repeats bed tipping and crane raising, plus the lights.
### Comparison
- fn 1 "HOG steering": NOT ON PAGE (book steps; book 1 p.56 step 53 draws the gear turning and the front track ends swinging).
- fn 2 "position 1 tips the bed": AGREES.
- fn 3 "position 2 raises the boom": AGREES.
- fn 4 "lever selects bed / crane": AGREES.
- fn 5 "crane slews, by hand": AGREES that it slews; "by hand" is not shown.
- fn 6 "black gear at the crane's base winds the winch": AGREES (the gear with the turning arrow sits at the boom pivot, and the load goes up).
- fn 7 "front and rear axles swing (pendular)": NOT ON PAGE (book steps; rear inferred).
- fn 8 "springs" (skip): NOT ON PAGE (book).
- fn 9 "tracks run free and rock on hubs": NOT ON PAGE (book steps).
- fn 10 "cab top tips forward": NOT ON PAGE (book 2 p.26 step 90 arrow; PF step 3 p.71).
- fn 11 "steering wheel for show": NOT ON PAGE (inferred).
- fn 12 "PF motor option": NOT ON PAGE of the main functions spread; on the PF pages p.68-76 (book).
- Missing from list: nothing.
- Page references: the list cites "book 2 pages 67-68 and 76"; the functions spread is PDF p.66-67, p.68 is the PF advert and p.76 the PF functions page.
### Doubts settled
- fn 2/3: which way the ring slides for position 1 → In the functions-page inset (book 2 p.66) position 1 tips the ball towards the end with the tan bevel gear; in the selector sub-model that tan 12-tooth bevel (6589) is at the front end, next to clutch gear p71 (z=-40), and the grey 16-tooth (94925) at the rear end, next to p67 (z=+40) (+z is the rear: tipper floor at z=300). Book 1 p.13 step 12 (1:1 drawing) shows the catch's pivot between the ball and the ring, so the ring moves opposite to the ball: position 1 (ball forward) puts the ring rearward onto p67. This agrees with the list's assignment (tipper's clutch gear p67 at the back, crane's p71 at the front). I could not check the sign convention of `first.by` against this. Confidence medium-low (rests on reading which gear shows in a photo inset).
- fn 5: "unsure whether the 20 tooth gear beside the turntable (p160) is meant to be turned to slew it" → the functions page shows only the slewing arrow, not what turns it; book 1 p.25-30 steps 34-40 show the turntable and gears but no turning arrow. Not settled. Confidence low.
- fn 6: "inferred: that the gear is the winch's handle" → yes: the functions page draws a turning arrow on that gear and the load rising. Confidence high.
- fn 7: rear axle "inferred: the same" → book 1 p.44 step 47 fits the axle on a ball joint ("CLICK"), and p.45-46 steps 48-49 add the shock links either side: it can rock. Note: book 1 p.56 step 53's red arrows are at the front hub ends together with the turning arrow on the steering gear, so they show steering, not the axle rocking; the list cites step 53 for both. Confidence medium.
- fn 10: "unsure which parts form the hinged top" → book 2 p.26 step 90: the arrow swings the whole orange cab front/top panel (with the cab beams) down onto the cab; book 2 p.71 PF step 3 lifts it again. Parts by number: not seen. Confidence medium.
- fn 11: the booklet does not show a link; not settled. Confidence low.
### Open questions
- None beyond the above.
### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 6 | "inferred: that the gear is the winch's handle" | functions page draws the gear turning and the load rising | book 2 p.67 | high |
| 7 | "step 53 draws the front axle rocking" | step 53's arrows show steering (with the gear turning); rocking is shown by the ball-joint mount, book 1 p.44 step 47 | book 1 p.44, p.56 | medium |
| 2/3 | "unsure which way it must slide for position 1" | position 1 = ball towards the tan-bevel (front) end → ring rearward onto p67, as the list assumes | book 2 p.66; book 1 p.13 | medium-low |
| src | "book 2 pages 67-68 and 76" | functions spread is PDF p.66-67 | book 2 | high |

## 42052 Heavy Lift Helicopter
Booklets: omr/instructions/42052-1-1.pdf (the only and last file, 196 pages). Functions pages: 42052-1-1.pdf p.190-191. Pages read: 2 in full, 16 as thumbnails (p.181-196), 6 build pages as thumbnails (p.47-52). Time: about 15 minutes.
### Functions page (blind reading)
1. Battery box switch under the body by the nose wheel (p.190, top-left inset), slid either way → the Power Functions motor turns on and reverses. Everything runs from this one motor.
2. Lever on the helicopter's right side (the far side in the main picture), red knob pushed toward the tail ("A", p.190) → both rotors turn (p.191 A). In the top view the two curved arrows point opposite ways, so the coaxial rotors turn opposite ways.
3. The same right-side lever pushed toward the nose ("B") → the rear loading ramp swings (p.191 B, curved arrow up).
4. Lever on the left side (the near side), knob pushed toward the tail ("C") → the two orange belly/side panels swing out and in (p.191 C).
5. The same left lever pushed toward the nose ("D") → the hook goes up and down on its string (p.191 D).
(Rolling wheels are not shown as a function.)
### Comparison
- fn 1 "M-motor, battery box under the nose, gearbox drives both selector shafts": AGREES (the battery box switch has a two-way arrow on p.190).
- fn 2 "A: right lever, coaxial rotors turn": AGREES.
- fn 3 "B: right lever, rear ramp lowers/raises": AGREES.
- fn 4 "C: left lever, orange cargo doors swing": AGREES.
- fn 5 "D: left lever, winch hook up/down": AGREES.
- fn 6 "Lever in the middle: neither function runs": NOT ON PAGE (inferred).
- fn 7 "Landing gear wheels roll freely": NOT ON PAGE (book: its source cites "page 188 (finished helicopter)", but p.188 shows steps 303-304 of the cargo frame. The finished helicopter is on p.186 and p.190.)
- Missing from list: none.
### Doubts settled
- fn 1: the gear path is inferred → partly confirmed. Steps 87-98 (p.47-52) build a gearbox with a tan 24-tooth gear, rows of red 16-tooth clutch gears and two driving-ring shafts. This is consistent with the list, but at thumbnail size I could not trace the exact 12→24→16 chain. Confidence medium.
- fn 2: that the rotors counter-rotate is inferred → settled. On p.191 A the upper arrow turns clockwise and the lower arrow counter-clockwise (top view). Confidence medium-high.
- fn 2-5: "unsure which way the lever must turn" → partly settled. On p.190, A and C have the knob pushed toward the TAIL (+z in the model; the nose wheels are at z=-380 and the ramp at z=+298). B and D have the knob pushed toward the NOSE (-z). The lever is shown as one lever per side with two end positions. The booklet does not give the sign of `by`. Turning "knob toward tail" into a rotation sign needs the geometry of the changeover catch (6641 at x=±140, z=-60). Confidence high for the physical direction; the sign is not settled.
- fn 2/3 versus 4/5: which lever is on which side → settled. A/B is on the helicopter's right side and C/D on its left (p.190: the A/B leader goes to the far side, the C/D leader to the near side). This matches the list. Confidence medium-high.
- fn 6: neutral position → the booklet does not show it. It follows from how a driving ring works. Confidence high as mechanics, but it is not from the book.
### Open questions
- None beyond the brief.
### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 2,4 | `first` by +0.4 (sign unsure) | knob pushed toward the tail (+z) for A and C | p.190 | high (direction), sign not settled |
| 3,5 | `first` by -0.4 (sign unsure) | knob pushed toward the nose (-z) for B and D | p.190 | high (direction), sign not settled |
| 2 | counter-rotation "inferred" | arrows show opposite turning | p.191 A | medium-high |
| 7 | source "page 188 (finished helicopter)" | p.188 is the cargo frame; the finished model is on p.186/190 | p.186, 190 | high |

## 42066 Air Race Jet
Booklets: omr/instructions/42066-1-1.pdf (the only and last file, 252 pages). Functions pages: 42066-1-1.pdf p.246-247 (one spread). Pages read: 2 in full, 20 as thumbnails (p.233-252). Time: about 15 minutes.
### Functions page (blind reading)
1. Black knob on top at the tail, between the fins, turned → both red rudders swing (p.246 top inset).
2. Black knob on top behind the cockpit, turned → the nose wheel steers (p.246 middle inset).
3. Canopy (the black frame) lifted by hand at its front → the canopy opens (p.246 bottom inset: arrow at the canopy's front edge; no knob or motor shown).
4. Two red slide levers on top of the fuselage, each slid fore or aft (p.247 inset; the stickers show the function icons). They choose what the Power Functions motor drives.
5. Motor function 1 (p.247 upper orange picture), all together: a panel on the TOP of the fuselage behind the cockpit flips up (an air brake; the canopy frame stays closed in this picture), a panel UNDER the fuselage drops down (arrow down), and a grey part under the tail swings (curved arrow; the exhaust/nozzle).
6. Motor function 2 (p.247 lower orange picture): the nose leg and main leg fold up (landing gear retracts).
### Comparison
- fn 1 "M motor, two levers, gearbox, slip clutch": AGREES (two levers, each up/down, p.247).
- fn 2 "Right lever: landing gear folds": AGREES as to what moves. Which lever it is: NOT ON PAGE (inferred).
- fn 3 "Left lever: canopy opens, under-fuselage air brake lowers, exhaust swivels": DIFFERS. The page shows the motor raising a top panel behind the cockpit (an air brake), not the canopy. The canopy frame stays closed in the p.247 picture, and p.246 shows the canopy opened by hand. The list's own moving part p669 60483 is in submodel `roof.ldr` (beams and panels, no windscreen). The canopy frame is a separate submodel, `windscreen.ldr`. So the list's "canopy" is the dorsal air brake, by name only. The other two parts (under-fuselage panel, exhaust) agree.
- fn 4 "Tail knob: rudders": AGREES.
- fn 5 "Knob behind cockpit: nose wheel steers": AGREES.
- fn 6 "Wheels roll freely": NOT ON PAGE (book: p.245-246 pictures).
- Missing from list: the canopy opened by hand (p.246 bottom inset); the parts are in `42066 - windscreen.ldr`, not tied here.
### Doubts settled
- fn 3: "p720 on the hatch under the cockpit (taken to be the air brake: unsure)" → settled as yes. p.247's upper picture shows a panel under the forward fuselage dropping down, in the place of bottomhatch2 (p720 at z=-231). Confidence medium-high.
- fn 3: is the motor-raised part the canopy? → no. It is a top panel/air brake (`roof.ldr`). The canopy works by hand (p.246). Confidence medium-high.
- fn 2/3: which lever (left/right) works which function is inferred → not settled by the booklet. The p.247 inset shows two sliders with sticker icons too small to read at this resolution. Confidence low. The sticker art in the build steps that apply the stickers could settle it; I did not read those.
- fn 2/3: the lever direction (`by` +0.5) → the booklet shows each lever going both ways (up and down arrows), one way per motor direction. The sign is not settled.
### Open questions
- None beyond the brief.
### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 3 | motor "opens and closes the canopy" | motor raises a top air-brake panel behind the cockpit (`roof.ldr`); canopy stays shut | p.247 upper | medium-high |
| new | (absent) | canopy (windscreen.ldr) lifted by hand | p.246 bottom | high |
| 3 | p720 air brake "unsure" | belly panel drops down: confirmed | p.247 upper | medium-high |

## 42068 Airport Rescue Vehicle
Booklets: omr/instructions/42068-1-1.pdf (the only and last file, 200 pages). Functions pages: 42068-1-1.pdf p.184-187 (manual model), p.188-189 (Power Functions upgrade with set 8293, a separate set); p.190-195 are the upgrade's build steps. Pages read: 6 in full, 20 as thumbnails (p.181-200). Time: about 15 minutes.
### Functions page (blind reading)
1. Tan 20-tooth knob on top of the body, turned → the front and rear axles steer; the middle axle does not. Front 20°, rear 12°, drawn from above (p.184 left insets).
2. Grey side hatch just behind the cab swings up and open (p.185 arrow).
3. A side panel at the rear corner of the body (the "5" panel) swings up and open (p.184 right half, curved arrow).
4. Black knob at the foot of the boom, turned → the boom's upper section folds and unfolds (p.186).
5. Black knob at the back of the truck, turned, with the yellow lever on the rear deck: lever top toward the rear (toward the "↕" sticker icon) → the boom rises and falls; lever top toward the front (toward the slewing icon) → the boom slews on its turntable (p.187; the same is shown as A/B on p.189).
6. (Upgrade only, not in this set:) with 8293, a motor and battery box replace the rear knob (p.188-189).
(The engine and wheels are not shown as functions. The shock absorber is visible in the p.186 inset but has no arrow.)
### Comparison
- fn 1 "Tan gear steers front and rear, 20° and 12°, middle fixed": AGREES.
- fn 2 "Pushing the truck turns the V4 engine's pistons from the middle axle": NOT ON PAGE (inferred).
- fn 3 "Rear knob + yellow lever: raise/lower or slew the boom": AGREES.
- fn 4 "Boom-foot knob folds the upper section": AGREES.
- fn 5 "Shock absorber helps hold the boom": NOT ON PAGE as a function (the spring is visible in the p.186 inset; no arrow).
- fn 6 "Grey hatch behind the cab swings open": AGREES (p.185).
- fn 7 "Tool tray slides in": NOT ON PAGE (book steps 248-252).
- fn 8 "Six wheels roll": NOT ON PAGE (book p.184, a picture).
- Missing from list: the rear side panel (with the "5") that swings up (p.184, right half).
### Doubts settled
- fn 2: which axles drive the engine (unsure, inferred) → not settled. The functions pages do not show the engine. The web lead (LEGO product text) says only "4-cylinder engine with moving pistons", nothing on the drive. I did not read the axle/engine build steps. Confidence low. Note: LEGO calls it a 4-cylinder engine; the list's "V4" is not checked.
- fn 3: "Unsure which lever position chooses which" → settled. Lever top toward the REAR (toward the ↕ icon on the deck sticker) = boom up/down. Lever top toward the FRONT (toward the slewing icons) = slewing. Shown on p.187 (two insets, solid lever versus ghost) and p.189 (A = raise toward the ↕ end, B = slew). Confidence medium-high. The sign of the 6641 (p361) rotation was not worked out.
- fn 6: "unsure which parts make the hatch" → the booklet shows only where it is (grey panel behind the cab, right side, p.185). I did not tie it to parts.
### Open questions
- None beyond the brief.
### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 3 | lever position unsure | top toward rear = raise/lower; top toward front = slew | p.187, p.189 | medium-high |
| new | (absent) | rear side panel ("5") swings up | p.184 | medium |
| 2 | "V4 engine" | LEGO text says 4-cylinder (web lead only) | none | low |

## 42070 6x6 All Terrain Tow Truck
Booklets: omr/instructions/42070-1-1.pdf (the only and last file, 404 pages). Functions pages: 42070-1-1.pdf p.394-397 (two spreads). Pages read: 4 in full, 24 as thumbnails (p.381-404). Time: about 15 minutes.
### Functions page (blind reading)
1. White lever on the truck's LEFT side behind the cab door, handle tip pushed DOWN → drive mode (p.394 middle inset). Pushed UP → crane mode (p.396 small top-left inset).
2. Drive mode, left stick on the remote → the truck drives forward and back (p.394 top-left).
3. Drive mode, right stick → the front wheels steer (p.394 bottom-left).
4. While driving, the engine under the bonnet moves its pistons (p.394 top-middle inset, arrows on the pistons).
5. White lever on the truck's RIGHT side (the same place, the other side), handle tip UP → the "slew + hook" pair; tip DOWN → the "outriggers + boom" pair (p.396 big insets, with sticker icons).
6. Crane mode, upper position: left stick slews the crane (p.397 top-left); right stick winds the hook up and down (p.397 top-right).
7. Crane mode, lower position: left stick lowers and raises the four outrigger legs (p.397 bottom-left); right stick raises and lowers the boom (p.397 bottom-right).
### Comparison
- fn 1 "XL motor drives six wheels, left stick, lever to drive": AGREES.
- fn 2 "V8 pistons pump while driving": AGREES.
- fn 3 "M motor steers, right stick, lever to drive": AGREES.
- fn 4 "Drive/crane lever on cab side switches both motors": AGREES.
- fn 5 "Crane-function lever behind cab chooses slew+winch or outriggers+boom": AGREES.
- fn 6 "Slewing, left stick": AGREES.
- fn 7 "Outriggers, left stick": AGREES.
- fn 8 "Winch, right stick": AGREES.
- fn 9 "Boom up/down, right stick": AGREES.
- fn 10 "Rear axles rock on turntables": NOT ON PAGE (inferred).
- fn 11 "24-tooth clutch gears slip": NOT ON PAGE (inferred; skipped as force-only).
- Missing from list: none.
### Doubts settled
- fn 1/3/6-9: "Unsure which way the drive/crane lever goes" → settled. Handle tip DOWN = drive (p.394 middle inset, arrow down toward the drive sticker). Tip UP = crane (p.396 top-left small inset, arrow up). The lever is on the truck's left side, which is +x in the model (front is -z; p1770 41669 is at x=+200). Confidence high for the direction. Turning it into the ring `by` signs was not done.
- fn 5/6-9: "which pair goes with which position" (inferred from layout) → settled. Handle tip UP = slew (left stick) + winch (right stick). Tip DOWN = outriggers (left) + boom (right). p.396's upper inset links to p.397's top row, its lower inset to the bottom row, and the sticker icons above and below the lever match. Confidence high.
- fn 5: "Unsure which part is the handle" → the booklet shows a white handle on the RIGHT side, mirroring the drive/crane handle. The model has two white 41669 parts: p1770 at (200,-376,-260) and an unnamed one at (-200,-376,-260). The second is the crane-function handle, on the right side (-x). Confidence medium (from the pictures plus positions in the .mpd).
- fn 10: pendular rear axles (inferred) → supported. Each rear axle submodel (axle2, axle3) holds a small turntable (99009/99010). Web leads (Brickset and Eurobricks reviews in the search summary) say the rear axles pivot with no springs. The functions pages do not show it. Confidence medium. Note: the list's control p742/p829 is 64179, a frame, not the turntable itself.
### Open questions
- None beyond the brief.
### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 1,3,4 | drive/crane lever direction unsure | handle tip down = drive, up = crane | p.394, p.396 | high (direction) |
| 5-9 | which crane pair per position: inferred | tip up = slew + winch; tip down = outriggers + boom | p.396-397 | high |
| 5 | handle part unsure | white 41669 at (-200,-376,-260), right side | p.396 | medium |
| 10 | inferred | not on page; turntables in the axle submodels; web leads agree | none | medium |

## 42082 Rough Terrain Crane
Booklets: 42082-1-2.pdf (cover "1", 348 pp, ends step 663 with "1 → 2"), 42082-1-1.pdf (cover "2", 332 pp, last). The file index is reversed from the booklet numbers. The list's "book 2" = 42082-1-1 (correct). Functions pages: 42082-1-1 pp.322-327. Pages read: 21 thumbnails + 6 at full size and zoomed (+ book 1 end as thumbnails, 20). Time: about 15 min.

### Functions page (blind reading)
1. p.322 left inset: steering. Front and rear wheels both turned, with curved arrows at both wheels. Leader line to a point at the very back of the chassis, low under the counterweight: the control is there.
2. p.322 middle inset: the V8 with pistons and the orange fan (no leader line, no control shown).
3. p.322 right inset: the operator's cab with a white curved arrow at its side, swinging out: a door or a part of the cab that swings. Leader line to the cab beside the boom foot.
4. p.323: battery box switch on (1). Red lever (2) to the LEFT, toward the outrigger and slew icons. The chassis lever (3), sticker "↑ outrigger | N | ↓ outrigger", pushed RIGHT (↓) → all four outrigger legs swing out and down onto their pads. Insets show a leg folded and then down on its pad.
5. p.324: battery on. Lever 2 to the RIGHT (boom side). Gate knob (3) in the LEFT column, moved up/down → boom luffs up and down (three boom positions). Gate sticker: top row = up, bottom row = down for each column.
6. p.325: same. Gate knob in the MIDDLE column → boom telescopes out and in.
7. p.326: same. Gate knob in the RIGHT column → hook rises and falls (right column: top "hook ↓", bottom "hook ↑").
8. p.327: battery on. Lever 2 LEFT. A different chassis lever (3), sticker "slew left | N | slew right", either way → superstructure slews 360°.
9. Props: a wall frame hangs from the hook (pp.324-325) and frames lie on the ground (pp.326-327).

### Comparison
- fn 1 "handwheel at the back steers all four wheels, front and rear opposite": AGREES (p.322 left inset; control at the back of the chassis).
- fn 2 "rolling runs the V8 at the back of the chassis": AGREES that the V8 is a function (p.322 middle inset). How it is driven is NOT ON PAGE (inferred).
- fn 3 "each axle has a differential": NOT ON PAGE (inferred).
- fn 4 "outriggers: red lever to the chassis side, chassis lever up/down": AGREES (p.323).
- fn 5 "slew: red lever to the chassis side, the other chassis lever left/right": AGREES (p.327).
- fn 6 "luff: red lever to the boom side, gate knob in the luffing column, fore/aft": AGREES (p.324; luffing = the left column).
- fn 7 "telescope: gate knob in the middle column": AGREES (p.325).
- fn 8 "winch: gate knob in the winch column": AGREES (p.326; right column).
- fn 9 "cab door swings open": AGREES as far as I can see (p.322 right inset: a curved arrow at the cab's side). I cannot tell for sure from the photo that the part is a door.
- fn 10 "wall frames as props": AGREES (pp.324-327 show them; not a mechanism).
- Missing from list: none.

### Doubts settled
- fn 1 (inferred: front and rear steer opposite ways): in the p.322 inset, the front wheel is turned clearly and the rear wheel is turned too, with arrows at both. From the photo, the two wheels seem to point opposite ways, but the angle is small and the arrows are drawn as plain curves. Confidence medium for opposite phase. The booklet does not show the gears.
- fn 2 (inferred: which axles drive the V8): the page shows the engine but no drive. Not settled by the booklet; confidence low.
- fn 3 (inferred differentials): the functions pages do not show them. Not settled; I did not read book 1's axle steps.
- fn 4 (lever direction is a guess; which chassis lever is inferred): the sticker on the outrigger lever puts "↑" (raise) on the left and "↓" (lower) on the right, and p.323 draws the lever pushed right to lower the legs. Confidence high for "toward the ↓ side = down". The model's left/right is not settled. pp.323 and 327 show two different chassis levers with different stickers and backgrounds. Which one is on the cab side is not shown; not settled.
- fn 5 (direction is a guess): the slew sticker is symmetric (left/right). The booklet does not say which way is which. Not settled.
- fn 6 ("which way is up is a guess"): the gate sticker puts "boom up" in the top row and "boom down" in the bottom row of the left column (p.325 inset 3 shows the left column's icons clearly). So knob toward the top sticker = boom up. Which way "top" faces on the model (fore or aft) is not shown. Confidence medium.
- fn 7 ("which way out is a guess"): the middle-column icons are too small to read at this resolution. Not settled; low.
- fn 8 (direction, not flagged): right column top = hook down, bottom = hook up (p.326 and p.325 insets). Confidence high for the sticker.

### Open questions
- None beyond step 3.

### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 4 | which way the outrigger lever is thrown is a guess | the lever pushed to the side with the "↓" sticker lowers the legs; "↑" side raises them | 42082-1-1 p.323 | high (sticker); model side not settled |
| 6 | which way is up is a guess | the knob toward the gate's top sticker row = boom up | 42082-1-1 p.324-325 | medium |
| 8 | (no direction given) | knob toward the top row = hook down; toward the bottom row = hook up | 42082-1-1 p.326 | high |

## 42100 Liebherr R 9800
Booklets: 42100-1-1.pdf (cover "1", 368 pp, ends step 485 with "1 → 2" and a Control+ app hint on p.367), 42100-1-2.pdf (cover "2", 372 pp, last, ends step 1000 on p.363). Functions pages: no classic functions page with lever arrows (the model is run from the Control+ app). The nearest are 42100-1-2 p.364 (app set-up in 4 panels; panel 4 shows the boom raised by the app with a large arrow) and p.365 (an app showcase: multi-function control with two sliders, two joysticks and buttons 1-4; one-touch control of the boom, stick and bucket angles; custom movement tiles: drive forward/back 10/25/100 m, turn on the spot 5°/20°, slew 45°, bucket tip). Pages read: about 40 thumbnails + 2 at full size + 7 build pages for fn 8. Time: about 15 min.

### Functions page (blind reading)
1. Drive forward and back on the tracks (p.365 custom tiles "←/→ 10 m, 25 m, 100 m"; joysticks/sliders).
2. Turn on the spot (p.365 tiles "5°", "20°", top view of the machine turning).
3. Slew the superstructure (p.365 tile "45°", top view of the upper body turning).
4. Raise and lower the boom (p.364 panel 4: arrow up on the boom; p.365 one-touch picture).
5. Move the stick (p.365 one-touch picture: stick joint marked).
6. Tilt the bucket (p.365 one-touch picture: bucket joint marked; blue tile: bucket tipping a load).
Two Control+ hubs are shown (p.364 panel 2). Ladder, small actuators on the bucket mount: not shown on these pages.

### Comparison
- fn 1 "right XL motor drives the right track": AGREES (drive on p.365). The gear train is inferred and not shown.
- fn 2 "left XL motor drives the left track": AGREES (as fn 1).
- fn 3 "both tracks same way = drive; opposite = turn on the spot": AGREES (p.365 tiles).
- fn 4 "L motor slews the superstructure": AGREES (p.365 tile "45°").
- fn 5 "XL motor raises/lowers the boom": AGREES (p.364 panel 4; p.365).
- fn 6 "two L motors swing the stick": AGREES (p.365 one-touch).
- fn 7 "L motor tilts the bucket": AGREES (p.365 one-touch and the bucket tile).
- fn 8 "shaft down the stick turns two small actuators on the bucket mount": NOT ON PAGE (book steps 637-640 + inferred).
- fn 9 "access ladder swings up and down": NOT ON PAGE (book step 941).
- Missing from list: none.

### Doubts settled
- fns 1, 2, 4, 5, 6, 7 ("gear train inferred from the model"): the app pages confirm what each function moves. They do not show gear trains, so the booklet's functions pages cannot settle those. Function itself: confidence high; gear trains: not settled by these pages.
- fn 8 (note: "unsure what the small actuators move, and so what this is for; no motor drives the shaft"): 42100-1-2 pp.125-126 (steps 639-640) fit the two small actuators to the bucket mount. Their yellow-arrow insets only show how to set each actuator's length before fitting, at 1:1 scale; they do not show a function. Step 640's red callout marks three spots on the mount (pins), not motion. p.362 (step 999) shows the bucket pushed onto the mount, with yellow arrows on pins pushed in sideways at both ends. No functions or app page shows a movement of the bucket mount apart from the bucket tilt. Answer: the booklet does not show what the small actuators do. A web review describes the bucket as having no back, so it "digs and releases" by tipping. That is a lead only, and it fits fn 7 rather than a separate function. Confidence low; I would keep fn 8 marked unsure.

### Open questions
- None beyond step 3.

### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| — | no change proposed | the app pages agree with fns 1-7; fns 8-9 rest on build steps | 42100-1-2 pp.364-365 | — |

## 42112 Concrete Mixer Truck
Booklets: `42112-1-1.pdf` = book 1 (124 pages; cover "1"), `42112-1-2.pdf` = book 2, the last (92 pages; cover "2"). Functions pages: 42112-1-2.pdf p.88-89 (one spread). Pages read: about 75 (covers, book 2 p.84-89, book 1 p.4-67 as contact sheets, book 1 p.32, 37-38 zoomed). Time: about 25 minutes.
### Functions page (blind reading)
1. p.88 top-left: the black gear knob on the cab roof, turned (circular arrow) → the wheels of the front two axles steer (arrows at both front axles).
2. p.88 middle-left and bottom-left: the chute at the back, first stowed, then swung down by hand (curved arrow).
3. p.88 big photo: a callout to the white selector lever under the middle of the chassis.
4. p.89 top-right: inset of the selector, whose sticker reads drum symbol / N / truck symbol. The lever is pushed toward the truck symbol and the truck is pushed along the ground (straight arrow) → the drum turns (clockwise seen from the back) to mix.
5. p.89 bottom-right: the lever is pushed toward the drum symbol and the red crank on the chassis side is turned (circular arrow) → the drum turns the other way and the load pours out down the chute.
6. N (middle position): the label is shown, but nothing is shown working in it.
### Comparison
- fn 1 "roof gear steers the front two axles": AGREES (p.88).
- fn 2 "the eight wheels roll; rear differentials": AGREES for rolling (p.89 ground arrow). The differentials are NOT ON PAGE (book 1).
- fn 3 "rolling turns the small piston engine": NOT ON PAGE (inferred). See the doubts.
- fn 4 "selector lever: drive / N / crank": AGREES (p.89 insets).
- fn 5 "drive position: rolling turns the drum to mix": AGREES (p.89 top).
- fn 6 "crank position: crank turns the drum the other way to pour": AGREES (p.89 bottom).
- fn 7 "drum's back end rides on rollers on a rocking frame": NOT ON PAGE. The rollers are visible in the p.88 photo, but no motion is shown (inferred).
- fn 8 "chute swings down": AGREES (p.88).
- Missing from list: none.
### Doubts settled
- fn 3: are the four upright axles the pistons of an engine? → Yes. Book 1 step 50 (p.38) builds 4 upright yellow 3L axles, each with a bush below and a yellow cap above, in a 13L beam over the drive line under the cab. This is the usual axle-piston engine. Web leads (LEGO and shop listings) name "moving pistons". Rolling as the drive is consistent with this (no other control exists), but the page does not show it. Confidence: medium-high.
- fn 4/5: which lever position is which, and which way the driving ring goes → The page settles the labels: toward the truck symbol for drive and toward the drum symbol for the crank (p.89). In the model the lever (gearshiftlever.ldr, at z=84) carries a changeover catch (51149) at the ring's z, so the ring slides with the lever. The ring must therefore go toward the 20 tooth clutch gear p356 (z=124, toward the back) for drive and toward p352 (z=44) for the crank. Check that fn 5's `first` (p354 by -10) and fn 6's (by +10) move p354 in those world directions. The page's view direction is not clear enough to turn "right/left" in the inset into front/back. Confidence: medium (mechanics), low (page direction).
- fn 7: does the roller frame rock? → The booklet does not show it. In the model, each side's two rollers sit on one 42003 on a 3L axle (4519); whether it pivots depends on that fit. Confidence: low.
- fn 8: can the chute also swivel? → The page shows only the swing down (p.88). Swivel is not shown. Confidence: high that the swing down is right; the swivel is not supported by the book.
### Open questions
- None given.
### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 3 | inferred piston engine | 4 upright axle pistons built in step 50; source can cite book 1 p.38 | b1 p.38 | medium-high |
| 4-6 | lever direction unknown | toward truck symbol = drive, toward drum symbol = crank; ring must reach p356 (rear) for drive | b2 p.89 | medium |

## 42114 6x6 Volvo Articulated Hauler
Booklets: `42114-1-1.pdf`, the only booklet (456 pages). Functions pages: p.438 (beacon switch, hood), p.440-441 (app functions). Pages read: about 25 (436-456, 217-220). Time: about 20 minutes.
### Functions page (blind reading)
1. p.440 step 4 and p.441 right panel: the app → the truck drives forward and back (arrows along the ground both ways).
2. p.441 first panel: the app → the gearbox in the rear chassis (H-pattern icon 1-3 / 2-R) changes gear.
3. p.441 second panel: the app → the truck bends at the articulation to steer (front half swings left and right).
4. p.441 third panel: the app → the dump body tips up (arrow up), with drive arrows forward and back on the same panel.
5. p.438 top: the orange beacon on the cab roof is turned (arrow) → a lever inside the cab presses the hub's button.
6. p.438 bottom: (1) a long yellow axle pin is pulled out of the front bumper; (2) the hood, with the yellow front fenders, is swung up and back toward the cab, showing the hub and batteries; the pin is stored upright beside the hub.
7. p.441 app screens: multi-function control, alternative control, challenges. These are not mechanisms.
### Comparison
- fn 1 "XL motor drives all six wheels through the gearbox": AGREES (p.440-441). The internal path is not on the page.
- fn 2 "L motor shifts the gearbox 1/2/3/R plus a tipping position": AGREES for the gears (p.441 H icon). The tipping position is NOT ON PAGE (inferred).
- fn 3 "in the tipping position the XL motor raises the body": AGREES that the body tips from the app (p.441). That the XL motor drives it through the gearbox is inferred.
- fn 4 "angular motor steers at the articulation": AGREES (p.441).
- fn 5 "rear half rolls against the front half on a turntable": NOT ON PAGE (inferred).
- fn 6 "beacon switches the hub": AGREES (p.438 top).
- fn 7 "hood tilts forward once the pin is pulled": DIFFERS in direction. p.438 picture 2 shows the hood swung up and back toward the cab, hinged at its rear, not tilted forward. The model's hinge axles p2926/p2927 (15462) are at z=-980, the bonnet's rear (cab) edge (the bonnet runs z -980 to -1213), which fits up and back. The pin and the hub access agree.
- Missing from list: none.
### Doubts settled
- fn 1/2: which L motor turn gives which gear, and the order of the positions → The booklet does not show it on the functions pages (only the H icon, p.441). Web lead (a Eurobricks forum post): first gear and the tipping position are at opposite ends of the selector's travel (about 0° and 270°). Lead only. Confidence: low.
- fn 2/3: is tipping done by the XL motor through a gearbox position? → Supported by leads. The Lego Car Blog review describes the automated gearbox as three speeds plus a fourth output that drives the body's linear actuators. LEGO's description lists steer, tip and change gear from the app, and the set has only the three motors. p.441 shows the tipping panel with drive arrows, which fits one motor doing both. Confidence: medium-high.
- fn 5: does the rear half roll against the front? → The booklet does not show it. Steps 340-341 (p.218-220) join the halves, with no arrow or check picture. Confidence: low.
- fn 7: which side the hood hinges on → At its rear (cab end); it opens up and back (p.438 picture 2, and the model's hinge axles at z=-980). Confidence: medium.
### Open questions
- None given.
### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 7 | hood "tilts forward" | hood swings up and back toward the cab, hinged at its rear edge, after the bumper pin is pulled | p.438 | medium |
| 3 | tipping through gearbox: inferred | body tips from the app; leads say the gearbox's fourth output drives the actuators | p.441 + web lead | medium-high |

Web leads used: [The Lego Car Blog review of 42114](https://thelegocarblog.com/2021/06/29/technic-42114-6x6-volvo-articulated-hauler-review/), [Eurobricks 42114 thread](https://www.eurobricks.com/forum/forums/topic/175540-42114-6x6-volvo-articulated-hauler/page/30), [LEGO 42114 page](https://www.lego.com/product/?p=42114), [LEGO 42112 page](https://www.lego.com/en-ie/product/concrete-mixer-truck-42112), [Toys R Us 42112 listing](https://www.toysrus.ca/en/LEGO-Technic-Concrete-Mixer-Truck-42112/D40888B5.html).

## 8110 Mercedes-Benz Unimog U 400
Booklets: 8110-1-1.pdf = book 1 (84 p.), 8110-1-5.pdf = book 2 (84 p.), 8110-1-2.pdf = book 3 (84 p.), 8110-1-3.pdf = book 4 (60 p.), 8110-1-4.pdf = book 5, the last (48 p.). The file numbers do NOT follow the booklet numbers (cover numbers checked). Functions pages: 8110-1-4.pdf p.43-44. Pages p.39-42 of the same file show moving the crane to the front (steps 1-4). Pages read: about 25 (5 covers, a contact sheet of book 5 p.33-48, p.43-44 in detail, book 4 p.17, 38, 47, 48). Time: about 25 minutes.

### Functions page (blind reading)
Every motor panel shows the Power Functions battery box switch (orange) moved both ways, so the motor runs both ways. Above the motor are a yellow lever and a red lever. To the right is a red knob on a black plate. The plate has icons: truck front (top), pneumatic cylinder (middle), truck rear (bottom).
1. p.43 top left: yellow lever up, red lever down → the front winch hook goes up and down.
2. p.43 top right: yellow lever up, red lever up → the crane turns round on its turntable.
3. p.43 bottom left: yellow lever down (red lever not marked), red side knob pulled OUT → the crane mounted at the REAR (bed below it) works its pneumatic cylinders (up/down arrow at the boom cylinder).
4. p.43 bottom right: yellow lever down, red side knob pushed IN → the crane mounted at the FRONT, over the cab, works its cylinders (up/down arrow). P.39-42 steps 1-4 show taking the crane off the rear and fitting it at the front with an air hose.
5. p.44 top left: yellow lever down, red knob out → air arrives at the bank of three valves on the crane base.
6. p.44 top right: the valve nearest the turntable gear (first in the row) → the main boom swings up and down.
7. p.44 bottom left: the middle valve → the outer arm swings up and down.
8. p.44 bottom right: the far valve → the grab opens and closes.
Only motor and pneumatic functions are shown. Steering, drive, engine, suspension, stabiliser legs and cab tilt are not on these pages.

### Comparison
- fn 1 "roof gear steers front wheels": NOT ON PAGE (book 4, books 1-2; how it is worked is inferred)
- fn 2 "steering wheel turns with steering": NOT ON PAGE (inferred)
- fn 3 "rolling turns the engine": NOT ON PAGE (book 1 and book 3; the link from wheels to engine is inferred)
- fn 4 "differentials": NOT ON PAGE (book 1)
- fn 5 "portal axles swing, sprung": NOT ON PAGE (books 1-2)
- fn 6 "motor gearbox, two rings, four outputs": DIFFERS. The page shows three motor outputs: winch (yellow up, red down), slewing (yellow up, red up) and compressor (yellow down, red lever not marked). There is no fourth gearbox output. The fourth "function" on p.43 is the red knob, which is a separate pneumatic valve (see fn 10 and fn 16).
- fn 7 "yellow up, red down → winch": AGREES
- fn 8 "both up → crane slews": AGREES
- fn 9 "yellow down, red knob out → compressor": AGREES on the yellow lever and the compressor. DIFFERS on the knob: the knob does not select the compressor. It routes the compressed air to the rear crane (out) or the front crane (in).
- fn 10 "yellow down, red knob in → fourth output": DIFFERS. This is not a motor output. With the knob in, the compressor's air goes to the front connection, so the crane works when it is mounted at the front (p.43 bottom right, p.39-42).
- fn 11 "first valve → main boom": AGREES (p.44 top right)
- fn 12 "second valve → outer arm": AGREES (p.44 bottom left)
- fn 13 "third valve → grab": AGREES (p.44 bottom right)
- fn 14 "black gears swing the stabiliser legs": NOT ON PAGE (book 4 steps; how it is worked is inferred)
- fn 15 "cab tilts forward": NOT ON PAGE (book 4 p.17 step 52: a hand presses a yellow catch and the cab is tilted forward. This agrees with the step.)
- fn 16 "fourth valve by the gearbox, unsure": NOT ON PAGE as a valve, but it is the red side knob of p.43-44 (see Doubts)
- Missing from list: nothing new on the pages. One case is not covered: the crane moved to the front (p.39-42), where the red knob (in) sends air to it and its slewing would come from the front output. The list has no function for the crane at the front. This is a rebuild, not a control, so leaving it out may be intended.

### Doubts settled
- fn 2: is the steering wheel linked to the steering? → No. In the model file (submodel `cabDashboard.ldr`) the wheel 2741 sits on an axle pin 3749 in the dashboard, about 120 LDU to the side of the centre steering axle (p1498, x=20). Nothing connects it to the steering axle, so it turns freely. Settled by the model file, not the booklet. The booklet does not show it working. Confidence: medium-high.
- fn 6 / fn 10: what is the "fourth output"? → There is none. The gearbox gives three outputs: front winch, crane slewing, compressor. The red knob is a pneumatic valve that sends air to the rear or the front. Settled by p.43 (bottom pictures: crane at the rear vs crane at the front over the cab), the icon plate beside the knob (truck front / cylinder / truck rear), and p.39-42 (crane moved to the front with a hose). A web lead (Brickimedia and Brickset reviews: "pneumatics and PTO can be channelled to the front or rear") agrees. Confidence: high that the knob is a pneumatic front/rear valve; medium that out = rear and in = front.
- fn 9: which part is the red knob? → Red axle connector 59443 (colour 4) in submodel `valve-1.ldr`. It is joined by axle 6587 and connector 32013 to the lever of valve p826 47223a-f1. Settled by the model file and p.43. Confidence: high.
- fn 16: what does valve p826 do? → It is the red side knob's valve. It routes the compressor's air to the rear crane connection (knob out) or the front one (knob in). Same evidence as above. Confidence: high (valve = knob); medium (which way is which).
- fn 7 / fn 8: which way each catch moves → The page shows lever positions only as "up" and "down" (yellow up + red down = winch; both up = slew; yellow down = compressor). Mapping "up" to the sign of `by` for catches p512 and p516 was not checked in the file. Not settled. Confidence: n/a.
- fn 11: which valve is which → Page p.44: the valve nearest the turntable gear works the main boom, the middle valve the outer arm, the far valve the grab. Mapping these to part numbers p2282 / p2560 / p3196 was not done. The two valves seen in `craneArm-1.ldr` sit at local z 20 and -40, and the third is in `valve-2.ldr`. Confidence: high for the order on the page; not seen for the part numbers.
- fn 1: how the steering is worked → The booklet functions pages do not show it. Not settled.
- fn 3: is the engine turned by the wheels? → The booklet functions pages do not show it. Not settled.
- fn 5: which parts are the axle housings → The booklet does not show it. Not settled.
- fn 14: how the legs are worked → Book 4 p.48 step 12 shows one long axle pushed through the subframe, with a black gear (32270) at each end next to the leg pivots. No arrow shows them being turned. Likely a hand turns a black gear to swing the legs, but the booklet does not show it. Confidence: low.
- fn 15: which parts are the cab → Book 4 p.17 step 52 confirms the cab tilts forward after a yellow catch is pressed. The part identity is not settled. Confidence: high for the function.

### Open questions
- None beyond the above.

### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 6 | motor works one of four outputs, including "a fourth output" | three outputs: winch, slewing, compressor; red knob is a separate air valve | b5 (8110-1-4.pdf) p.43 | high |
| 9 | red knob pushed out is part of selecting the compressor | yellow lever down selects the compressor; knob out sends air to the rear crane | p.43 bottom left, p.44 top left | medium-high |
| 10 | red knob in → unknown fourth motor output | knob in sends air to the front connection (crane mounted at front) | p.43 bottom right, p.39-42 | medium-high |
| 16 | valve p826, unsure what it does | p826 is the red knob's valve: air to rear (out) / front (in) | p.43 + model file `valve-1.ldr` | high |
| 2 | steering wheel turns with the steering (unsure) | not linked; turns freely on an axle pin (model file; booklet silent) | model file | medium-high |
| 9/10 vs 16 | knob is controlled as a gearbox setting | merge: fn 16's control p826 (or its knob 59443) is the knob of fn 9/10 | p.43 | high |

## 9395 Pick-Up Tow Truck
Booklets: 9395-1-1.pdf = book 1 (56 p.), 9395-1-2.pdf = book 2 (56 p.), 9395-1-3.pdf = book 3, the last (56 p.). Cover numbers match the file numbers. Functions page: 9395-1-3.pdf p.34. P.36-52 are the Power Functions add-on (8293) steps, and p.37 shows the model's tow fork swing. Pages read: about 60 (book 3 as a low-resolution contact sheet, p.34 in detail, 3 covers). Time: about 10 minutes.

### Functions page (blind reading)
Two rows. Each has a two-part inset: the red lever beside the seats, and the black gear knob on the side of the body behind the cab (turned both ways).
1. Top: red lever pushed one way (arrow toward the dashboard and steering wheel, which I read as forward) + side gear turned → the winch hook on the boom goes up and down.
2. Bottom: red lever pushed the other way (arrow toward the blue seat beams, which I read as back) + side gear turned → the whole boom with its towing fork swings up and down.
Steering, engine and wheels are not shown.

### Comparison
- fn 1 "roof gear steers front wheels": NOT ON PAGE (book 1 and book 2 steps; how it is worked is inferred)
- fn 2 "rolling turns the engine": NOT ON PAGE (book 1 and book 2 steps)
- fn 3 "red lever is a 2-way selector": AGREES
- fn 4 "selector set for winch, side gear winds winch": AGREES
- fn 5 "selector set for boom, side gear swings boom and fork": AGREES
- fn 6 "steering wheel fixed": NOT ON PAGE (inferred)
- fn 7 "wheels roll freely": NOT ON PAGE (book 3 step 82)
- Missing from list: none.

### Doubts settled
- fn 3: the linkage from lever to catch p111 → The page shows only the lever and its two positions. Not settled by the booklet.
- fn 4 / fn 5: which way the selector goes → Page p.34: winch = lever tipped toward the steering wheel (forward, as I read the inset); boom = lever tipped toward the blue seat beams (back). I did not check whether `by` +0.3 is forward for p612 in the file. Confidence: medium for forward = winch, back = boom; not settled for the sign.
- fn 1: how the steering is worked → The booklet functions page does not show it. Not settled.
- fn 6: is the steering wheel fixed? → Visible in both insets with no arrow. The booklet does not show it turning. Not settled.

### Open questions
- None.

### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 4/5 | selector direction inferred | winch = lever toward the steering wheel (forward); boom = lever toward the seats (back). Check the sign of `by` against this | 9395-1-3.pdf p.34 | medium |

## 9396 Helicopter
Booklets: 9396-1-1.pdf = book 1 (80 p.), 9396-1-3.pdf = book 2 (60 p.), 9396-1-2.pdf = book 3, the last (60 p.). The file numbers do NOT follow the booklet numbers (cover numbers checked). Functions page: 9396-1-2.pdf p.45. P.46-56 are the Power Functions add-on steps. Pages read: about 20 (contact sheet of p.45-60, p.45 in detail, 3 covers). Time: about 10 minutes.

### Functions page (blind reading)
One knob (a black gear with a yellow hub on the fuselage side) is turned both ways in all four selector insets. Two selector levers are seen above it, an upper one and a lower one, each with an icon strip.
1. Upper lever pushed toward the rotor (star) icon + knob → the main rotor turns and the tail rotor turns.
2. Upper lever pushed toward the landing-gear icon + knob → the nose and main landing gear fold (curved arrows at both).
3. Lower lever pushed toward the helicopter icon + knob → the rear loading ramp under the tail swings open and shut.
4. Lower lever pushed toward the hoist icon + knob → the rescue hoist hook at the side door goes up and down.
5. Bottom row: a blue lever (a blue beam) is lifted (curved arrow) → a main rotor blade turns about its own long axis (curved arrow round the blade tip). I read this as a change of blade pitch, not folding.
From the insets I could not see whether the two selectors are on the same side or on opposite sides.

### Comparison
- fn 1 "lever toward rotor symbol → main and tail rotors": AGREES
- fn 2 "lever toward landing-gear symbol → gear retracts": AGREES
- fn 3 "other lever toward hoist symbol → winch": AGREES
- fn 4 "other lever toward helicopter symbol → ramp": AGREES
- fn 5 "blades fold back on hinges, released by blue lever": DIFFERS. The page shows the blade turning about its long axis (pitch), not folding back.
- fn 6 "wheels roll freely": NOT ON PAGE (book 2 and 3 sub-builds)
- Missing from list: none.

### Doubts settled
- fn 1: which lever and which way selects which function → The page settles the icon side. On the upper lever, the rotor icon gives the rotors and the landing-gear icon gives the gear. On the lower lever, the helicopter icon gives the ramp and the hoist icon gives the hoist. This matches the list. Whether the "upper" lever is p1425 and the "lower" is p1428 was not checked in the file. A web lead (a review) says the two levers are "one on the left and one on the right sides", which matches the list. Confidence: high for icon-to-function; medium for which part number is which lever.
- fn 2: which parts fold the nose gear → The page shows that the nose gear folds. The parts are not settled.
- fn 4: the ramp's own parts → The page shows the grey ramp under the tail boom swinging. Whether p1278 and p1399 are its hinge arms is not seen.
- fn 5: what the blue lever does → It changes the main rotor blades' pitch (angle of attack); it does not fold them. Settled by p.45 bottom (the arrow curls round the blade's long axis). Web leads (Eurobricks review "attack angle adjusted with a lever near the cockpit"; Brickimedia "main rotor blades can be tilted") agree. The blue lever's part was not identified. Confidence: medium-high.

### Open questions
- None.

### Proposed changes
| fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|
| 5 | blue lever releases the four blades to fold back on hinges | blue lever tilts the main rotor blades about their long axes (collective pitch) | 9396-1-2.pdf p.45 bottom | medium-high |
