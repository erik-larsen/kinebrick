# Function list audit, batch 6 (23 sets), 2026-11-14

The first 23 sets with scanned booklets only (lego.brickinstructions.com), 1998 to 1989: 8218, 8257, 8032, 8062, 8808, 8880, 8022, 8824, 8826, 8828, 8836, 8837, 8868, 8074, 8810, 8815, 8820, 8856, 8825, 8830, 8840, 8850, 8054. Method as before: blind reading first, then the comparison; doubtful functions worked through; review searches recorded as "video lead: Erik to look", never settled from a summary alone. No function list and nothing in the repository was changed. Readers: 6 agents, 2-6 sets each, at most 4 at once.

None of these sets has a modern functions page. The readers used the build steps with motion arrows, cover photos and blueprints, play pages (8257 p.26-27), photo panels (8837 scan 018) and sticker sheets (8868). So "agree" here means agrees with what the booklet draws; many functions rest on the build steps.

One reading was not fully independent: the 8054's buggy pages were read after its list was opened (the reader first took the cover's crane for the main model). The 8054's model file builds the buggy (model A, p.4-5), not the crane on the cover.

A tool fault was found and fixed during this batch: the readers' parts helper read the OMR file, but 28 sets' lists (8880, 8054, 8448, 8844 and most scans-only sets) number their parts in `curated.model` under models/. In the 8880 the two files number parts one apart from about p590. The helper now reads `curated.model`. The 8880's reader worked from the right file; the 8448 (batch 5) and 8844 (batch 1) readers did not, but neither based a proposed change on part numbers past such a shift (not re-checked).

## Counts

| Set | Agree | Differ | Not on page | Missing |
|---|---|---|---|---|
| 8218 | 0 | 0 | 4 | 0 |
| 8257 | 8 | 0 | 2 | 0 |
| 8032 | 0 | 0 | 2 | 0 |
| 8062 | 0 | 0 | 2 | 0 |
| 8808 | 3 | 0 | 0 | 0 |
| 8880 | 9 | 0 | 4 | 0 |
| 8022 | 1 | 0 | 0 | 0 |
| 8824 | 3 | 0 | 0 | 0 |
| 8826 | 2 | 0 | 0 | 0 |
| 8828 | 2 | 2 | 0 | 0 |
| 8836 | 5 | 0 | 0 | 0 |
| 8837 | 7 | 0 | 0 | 0 |
| 8868 | 9 | 0 | 1 | 0 |
| 8074 | 3 | 0 | 2 | 0 |
| 8810 | 4 | 0 | 1 | 0 |
| 8815 | 2 | 0 | 2 | 0 |
| 8820 | 3 | 0 | 1 | 0 |
| 8856 | 4 | 0 | 4 | 0 |
| 8825 | 3 | 0 | 1 | 0 |
| 8830 | 3 | 0 | 1 | 0 |
| 8840 | 5 | 0 | 1 | 0 |
| 8850 | 6 | 0 | 2 | 0 |
| 8054 | 2 | 0 | 1 | 0 |
| **All 23** | **84** | **2** | **31** | **0** |

117 list functions.

## Model file check the orchestrator asked for

| Set | Fn | The question | The booklet shows | Page | Confidence |
|---|---|---|---|---|---|
| 8856 | 1 | The main rotor's axle 1 LDU short of the 2907 and its hub 15 LDU off the mast's end. | Step 25 puts a bush on the mast's top; step 26 pushes the ball 2907 onto the mast's top end, with the ring 2908 round it and the cross 2906 on the ball; step 28 puts a 2-long axle with the dish into the cross. No gap, no mast above the cross. The rotor (Main-Rotor-Center, Main-Rotor-Top, four Rotor-Blade) is drawn about 15 LDU too high. | 8856-1 scans 023, 024, 026 | Medium |

## Proposed changes for Erik


### Changes to what a function is or which part works it

| Set | Fn | The list says | The booklet shows | Page | Confidence |
|---|---|---|---|---|---|
| 8856 Whirlwind Rescue | 1 | "big white handwheel on the right side" | the handwheel p388 (x = +120) is on the left (port) side; the cover shows it on the side you see with the nose pointing left | 001.jpg cover, 022.jpg step 24 | medium-high |
| 8856 Whirlwind Rescue | 2 | "small crank low on the right side" | p390 (x = +115) is on the left (port) side; Technicopedia says port too | 022.jpg step 24 | medium-high |
| 8856 Whirlwind Rescue | 3 | "small crank low on the left side" | p182 (x = -115) is on the right (starboard) side | 022.jpg step 24 | medium-high |
| 8856 Whirlwind Rescue | 4 | "small crank high on the left side" | p392 (x = -115) is on the right (starboard) side | 022.jpg step 24 | medium-high |
| 8825 Night Chopper | 1, 2 | "the handwheel on the right side" | p84 (x = +85) is on the left (port) side; Technicopedia says left | 001.jpg cover, 004.jpg step 14 | medium-high |

### Lever and knob directions

| Set | Fn | The list says | The booklet shows | Page | Confidence |
|---|---|---|---|---|---|
| 8828 Front End Loader | 1 | crank on the right side lifts | lift crank p124 is on the model's left (x +90, model faces −z); Technicopedia agrees | 011 (8720 pulley on the left crank) | medium-high |
| 8828 Front End Loader | 2 | crank on the left side tips the bucket | bucket crank p126 is on the model's right | 011 | medium-high |
| 8868 Air Tech Claw Rig | 5-8 | no lever directions | stickers: ← = claw closes / jib up / boom up; → = opposite (slew ← one way, → other) | p.34, p.59 | medium |

### Model file findings

| Set | Fn | The list says | The booklet shows | Page | Confidence |
|---|---|---|---|---|---|
| 8880 Super Car | 6 | knob p948 6553 in colour 7 | cone handle drawn in blue in step 23's parts box | scan 022 | low (colour only) |
| 8856 Whirlwind Rescue | 1 | (model) rotor hub 15 LDU off the end of the mast, hub axle 1 LDU short of the 2907 | the ball 2907 is pushed onto the mast's top end, the ring 2908 round it, the cross 2906 on the ball, and a 2-long axle with the dish into the cross; no gap. Lower Main-Rotor-Center, Main-Rotor-Top and the four Rotor-Blade so the 2907 sits on the mast's end | 023.jpg step 25, 024.jpg step 26, 026.jpg step 28 | medium |

### Video leads for Erik ("video lead: Erik to look"; never settled from a summary alone)

| Set | Fn | The list says | The booklet shows | Page | Confidence |
|---|---|---|---|---|---|
| 8062 Universal Set with Storage Case | 1 | torso turns on the hips through the universal joint, worked by swinging the upper body | build steps show the torso on an axle 8 joined to the hips by a universal joint; whether it turns or bends is not shown | p.5-7, p.9 | low |
| 8880 Super Car | 12 | seat backs tilt (inferred, unsure) | no arrow; reviews suggest the stock seats are not adjustable | scans 040-041 | low |
| 8824 Hovercraft | 1 | propeller swivels with the column (inferred) | not drawn; Technicopedia agrees | 015, technicopedia.com/8824.html | medium |
| 8836 Sky Ranger | 2 | ailerons go opposite ways (inferred) | cables on opposite sides of the pulley; opposite motion not drawn | 008 (step 12) | medium |
| 8868 Air Tech Claw Rig | 4 | rubber band to the crankshaft inferred | not seen in the steps read | p.4-5, 8, 28 | low |
| 8074 Universal Set with Flex System | 4, 5 | handwheel A luffs jib, B swings tip arm (partly inferred) | parts and cables fit; motion not drawn | p.16-24, cover | medium |
| 8810 Cafe Racer | 5 | stand folds (inferred) | hinge plates, stand only shown down | p.4-5 | medium |
| 8856 Whirlwind Rescue | 2 | gear fold direction unsure | cover blueprint arrow at the nose wheel, too small to read | 001.jpg | low |
| 8856 Whirlwind Rescue | 4 | hoist arm swing inferred | no arrow in the book; Technicopedia says the winch is stowed/deployed by two starboard cranks | n/a | medium |
| 8825 Night Chopper | 2 | front bevel driven by the crown gear (inferred) | step 10 sets the shaft's front gear just behind the crown gear; Technicopedia mentions an 8-tooth spur between them | 003.jpg step 10 | medium |
| 8830 Rally 6-Wheeler | 1 | the rear wheels steer opposite to the front | no arrow for the direction; the geometry supports the list | p.1, p.4-5 | medium-high |
| 8840 Rally Shock n' Roll Racer | 2, 5 | the right rear half-shaft is separate and free of the engine | step 8.2 shows two axles (8 and 3 long); a review says "live rear axle" | p.5 | medium |
| 8850 Rally Support Truck | 6 | the front bar swings on the liftarms' pins and turns in its holders | steps 12 and 15 build it with no motion arrows | p.7-8 | low |

### Source wording only

| Set | Fn | The list says | The booklet shows | Page | Confidence |
|---|---|---|---|---|---|
| 8218 Trike Tourer | 4 | "inferred: that the fork swivels" | could add "the fork sits on one pin only (steps 15-16)"; already says so | p.12, p.15 | medium |
| 8257 Cyber Strikers | 2, 6 | "inferred: the book draws no arrow on the trigger itself" | p.27 panel 2 shows the hand squeezing the trigger as the arm shoots | p.27 | medium |
| 8257 Cyber Strikers | 9 | book 1 step 22, page 26 panel 2 | also the shock absorber icons on p.26-27 | p.26-27 | high |
| 8880 Super Car | 6 | "where the knob sits is inferred from the model" | step 23 fits the cone handle on the centre console, ahead of the gear lever | scans 022-023 | medium-high |
| 8868 Air Tech Claw Rig | 2 | roof knob "inferred from the model file" | knob shown in step 30 inset | p.32 | medium-high |
| 8868 Air Tech Claw Rig | 7, 8 | valve "on the cab's right side" | the stickers for these two sit on the roof (front = claw, rear = jib) | p.34 | medium |
| 8820 Mountain Rambler | 1 | "4 (rack and its holder)" | the rack is in step 5's parts box; step 4 builds its holder | 004.jpg step 5 | medium |
| 8830 Rally 6-Wheeler | 3 | "inferred: ... unsure whether it is meant to turn" | Step 15 shows no gear on the steering wheel's axle. It can stay "for show". | p.11 | medium |
| 8850 Rally Support Truck | 7 | "inferred: engine step 7 fits it on an axle pin" | sub-step 6.3 shows the axle pin in a plate's pin hole, then the pulley on it | p.14 | medium |

---

# The sets

## 8218 Trike Tourer
Booklets: omr/instructions/8218-1/001-016.jpg, one booklet, 16 pages (main model steps 1-17, the front fork built as its own steps 1-7 on p.13-14). Functions pages: none. No motion arrows anywhere. Page 2 is the usual axle gauge and bush hint. Pages read: 9 closely + 16 as one contact sheet. Time: about 6 minutes.
### Functions page (blind reading)
No functions page and no motion arrows. From the build steps:
1. Rear axle → crank → connecting rod and yellow piston in the cylinder (steps 3-4 cylinder, step 10 rod and piston, step 11 rings the crank in red, step 12 wheels). Rolling the trike pumps the piston.
2. Front fork with handlebars and front wheel (fork steps 1-7) is pushed onto one pin in an angle connector at the frame's front (steps 15-16). Nothing else holds it, so it should swivel: steering by the handlebars.
3. Front wheel turns on its axle between the fork's tips (fork step 7).
### Comparison
- fn 1 "rolling turns crank, pumps piston": NOT ON PAGE (book steps 3-4, 9-12); agrees with the steps.
- fn 2 "left rear wheel free on its axle pin": NOT ON PAGE (book steps 9, 12); consistent with the steps; I did not see it myself in detail.
- fn 3 "front wheel rolls freely": NOT ON PAGE (book fork step 7); agrees.
- fn 4 "handlebars steer the fork on a friction pin": NOT ON PAGE (book steps 15-16 + inferred); agrees with my reading.
- Missing from list: none.
### Doubts settled
- fn 4: that the fork swivels (inferred) → yes. Step 15 (p.12) shows the black friction pin and the angle connector; step 16 (p.15) shows the fork pushed onto that single pin with nothing else holding it. Technicopedia lists "steering" as a feature (lead only). Confidence medium-high.
### Video leads
- fn 4: technicopedia.com/8218.html lists the set's features as steering and an engine ("two features"). No video found. https://technicopedia.com/8218.html. Supports the list; no change. video lead: Erik to look only if wanted, confidence medium.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| source | 4 | "inferred: that the fork swivels" | could add "the fork sits on one pin only (steps 15-16)"; already says so | p.12, p.15 | medium |

## 8257 Cyber Strikers
Booklets: omr/instructions/8257-1/001-077.jpg. One scan folder with: book 1 purple tracked striker p.1-25 (steps 1-28), play pages p.26-27, a purple alternative model p.28-41 (steps 1-22, not in the MPD), its motor add-on with 8735 p.42-46 (marked "8257+8735"), book 2 teal wheeled striker p.47-75 (cover p.47, steps 1-29), sticker sheets p.76-77. The MPD holds the two strikers (striker-a, striker-b) as the main model. Functions pages: no real functions page; the two play pages p.26 (4 panels: how to set the seat) and p.27 (2 panels: push the strikers, fire the arm) show how the models are worked. Pages read: 12 closely + 77 as two contact sheets. Time: about 12 minutes.
### Functions page (blind reading)
From p.26-27 and the build steps (both strikers work the same way):
1. Each striker is pushed back and forth on the floor by hand, held by its handle (p.27 panel 1, red double arrows). Purple on tracks, teal on wheels.
2. Squeezing the trigger under the handle top fires the scissor arm out at the other striker (p.27 panel 2: the hand's fingers are drawn squeezing, with motion lines; the purple arm is shot out to full length).
3. A hit on the target makes the opponent's seat flip and throws the driver off (p.27 panel 2: the teal driver flies).
4. Setting the seat (p.26): panel 1 driver beside the striker; panel 2 the target lever pulled forward/down (red arrow); panel 3 the driver pressed into the seat (red arrow); panel 4 the seat cage swung down over the driver (curved red arrow), with click lines. Step 28 (p.25) and teal step 29 (p.75) mark "CLICK" at the catch.
5. Step 26 (p.22; teal p.72): the hand pulls the target lever toward the viewer; a red arrow shows the grey catch beam above swinging up. So the target lever is the catch that lets go of the seat.
6. Icons on p.26-27 (and p.2): the shock absorber with its spring is right, without it is crossed out. So a spring shock absorber drives the seat.
Note: the red curved arrows at step 20 (p.16, teal p.66) are "turn the model round" arrows (step 21 is drawn from the other side), not a function.
### Comparison
- fn 1 "purple striker on free tracks, pushed": AGREES (p.27 panel 1).
- fn 2 "purple trigger fires scissor arm": AGREES (p.27 panel 2).
- fn 3 "purple seat flips, clicks into catch": AGREES (p.26 panels 2-4, p.25 CLICK).
- fn 4 "purple target lever is the catch": AGREES (step 26 p.22, p.26 panel 2).
- fn 5 "teal striker on free wheels, pushed": AGREES (p.27 panel 1).
- fn 6 "teal trigger fires scissor arm": AGREES (p.27 panel 2).
- fn 7 "teal seat flips, clicks": AGREES (p.75 CLICK, p.26 by analogy).
- fn 8 "teal target lever is the catch": AGREES (teal step 26 p.72).
- fn 9 "shock absorber flips the seat" (skip): NOT ON PAGE as an arrow (book step 22), but the shock absorber icons on p.26-27 back it.
- fn 10 "rubber bands pull trigger back" (skip): NOT ON PAGE (step 20 + inferred hook points).
- Missing from list: none for the main model. The purple alternative model (p.28-41) and its motor add-on (p.42-46) are not in the MPD; out of scope.
### Doubts settled
- fn 2 and fn 6: "inferred: the book draws no arrow on the trigger" → p.27 panel 2 draws the hand squeezing the trigger (fingers wrapped under the handle top, motion lines) as the arm shoots out. Confidence medium.
- fn 3 and fn 7: seat fixed to its lever (inferred) → p.26 panel 4 shows the cage swinging as one piece with its lever. Confidence medium.
- fn 10: where the rubber bands hook on (inferred) → not settled; step 20 shows only "2x rubber band" in the parts box and the bands are not visible in the scan. Confidence low. It is a skip row, so it does not matter for the check.
### Video leads
- One search ("8257 Cyber Strikers review functions trigger"): only shop listings and Brickimedia (https://En.Brickimedia.org/wiki/8257_Cyber_Strikers), which says each striker has a "neck" that swings forward and a cockpit with a swinging dome. Nothing on the trigger or bands. No video found. confidence low.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| source | 2, 6 | "inferred: the book draws no arrow on the trigger itself" | p.27 panel 2 shows the hand squeezing the trigger as the arm shoots | p.27 | medium |
| source | 9 | book 1 step 22, page 26 panel 2 | also the shock absorber icons on p.26-27 | p.26-27 | high |

## 8032 Universal Set
Booklets: omr/instructions/8032-1/001-072.jpg, one booklet with six models (cover p.1 shows all six). The MPD holds only the first model, "Sawer" (pages 2-7, steps 1-9 with sub-steps 1-6). Last pages p.69-72 are a motor add-on for the buggy (8032+8720). Functions pages: none; no motion arrows in the sawer's steps. Pages read: 6 closely + 72 as two contact sheets. Time: about 6 minutes.
### Functions page (blind reading)
No functions page. From cover p.1 (top-left photo) and steps 6-9 (p.4-7):
1. The handwheel (step 6) turns an axle with a 24-tooth gear (step 7). At first sight I took the gear to mesh the toothed blade (step 8). On a closer look the step 7 inset puts a pin into a hole of the gear, the blade's teeth face down, away from the gear, and the blade's end brick sits on that pin. So the gear is a crank: the handwheel pushes the toothed blade back and forth.
2. Two links (step 9; sub-step 6 on p.7) join the blade's far end and the base to the tilted upper frame, so the frame rocks as the blade moves.
3. A crown gear sits on top of the upper frame (sub-step 5, p.7), on an axle with two bushes. It looks like a saw blade; nothing drives it.
### Comparison
- fn 1 "handwheel works the saw by a crank; link rocks the frame": NOT ON PAGE (book steps 6-9 + inferred); agrees with my reading of the steps.
- fn 2 "crown gear turns freely like a saw blade": NOT ON PAGE (inferred); agrees: sub-step 5 has the gear on an axle held by bushes in a brick's round hole.
- Missing from list: none.
### Doubts settled
- fn 1: what the crank and links do (inferred) → step 7 inset (pin into the gear) and step 9 (blade teeth down, link pinned at the blade's end) support the crank and the rocking frame. Confidence medium.
- fn 2: crown gear turns freely (inferred) → sub-step 5 (p.7): axle through a round brick hole, held by two bushes. Confidence medium.
### Video leads
- None searched: the build steps settle both rows to medium.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| (none) | | | | | |

## 8062 Universal Set with Storage Case
Booklets: omr/instructions/8062-1/001-088.jpg, one booklet with several models (helicopter on the cover, others on the back cover p.88). The MPD holds only the first model, "Ice Hockey" (goal, player and a crown-gear puck), pages 2-10 (goal steps 1-7, player steps 1-17, arm sub-steps 1-7 on p.8-9). Back cover p.88 bottom photo shows it. Motor add-on pages for the helicopter near the end (8062+8720). Functions pages: none; no motion arrows (the red arrow at step 10, p.6, only marks where an axle 4 goes in). Pages read: 9 closely + 88 as two contact sheets. Time: about 9 minutes.
### Functions page (blind reading)
No functions page. From steps 5-17 (p.5-10) and the photos (p.2, p.88):
1. Hips (step 6, p.5): sub-steps 1-3 put a short axle 4 through an angle part that carries an upright axle, a universal joint on the axle 4's end, and an axle 8 on the joint. The axle 8 is the torso's axle (it stands up in step 12 and the torso is built on it in steps 12-15). So the torso is joined to the hips through the universal joint and can swing, carrying the arm and stick. Which way it swings (turn on the hips or bend forward) the steps do not show. Confidence low.
2. The stick is fixed between the hand's two yellow liftarms on two axles 4 (arm sub-step 4, p.8); the stick is part of the arm.
3. The puck (a crown gear, step 17) lies loose; the goal (steps 1-7) is static.
### Comparison
- fn 1 "swinging the upper body sweeps the stick; torso turns on the hips through the universal joint": NOT ON PAGE (book steps 5-6, 12-15, 17 + inferred). Agrees that the torso swings on the joint; the direction and what the user works are not shown. The model file has the torso axle 8 (3707 in sub 6) tilted about 35 degrees on the joint, and the hip part is 6553, so a bend forward is as likely as a turn.
- fn 2 "stick fixed to the arm": NOT ON PAGE (arm sub-steps 4-7, p.8); agrees.
- Missing from list: none.
### Doubts settled
- fn 1: how the torso is worked (inferred) → not settled by the booklet. Confidence low.
### Video leads
- fn 1: one search ("8062 universal set ice hockey player how it works"). Technicopedia (https://technicopedia.com/8062.html) lists the first model as the "Hockey Game" but says nothing on how it moves. No video found. A LEGO Education "Ice Hockey Player" (other set) swings its arm by a handle on the back; that is a different model and only a hint. video lead: Erik to look (try a video of the 8062 hockey game), confidence low.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| video | 1 | torso turns on the hips through the universal joint, worked by swinging the upper body | build steps show the torso on an axle 8 joined to the hips by a universal joint; whether it turns or bends is not shown | p.5-7, p.9 | low |

## 8808 Formula One Racer
Booklets: one scanned booklet, omr/instructions/8808-1/001-032.jpg (each scan is a two-page spread). Main model (the racer, steps 1-17): scans 001-014. Alternate buggy: scans 015-024. 8720 motor add-on: scans 025-032 (not in the set as sold). Functions pages: none (a 1994 booklet). I used the build steps with motion arrows and the cover. Pages read: 7 closely (008-014) + 32 as two contact sheets. Time: about 8 minutes.
### Functions page (blind reading)
No functions page. From the build steps:
1. Steering wheel → front wheels steer. Step 16 (scan 013): the steering wheel on an axle with a small gear. Steps 12-13 (scans 009-010): the steering arms on pins, with arrows for fitting. Step 15 (scan 012): a grey rack across the front.
2. Rear wheels roll freely, doubled up on the rear axle (step 17, scan 014).
3. Front wheels roll freely in the steering arms (step 17).
- Step 12 (scan 009) has a curved arrow that swings the black liftarm pair from step 11 up into the roll hoop behind the cockpit. This is a build move, not a function.
### Comparison
- fn 1 "steering wheel steers the front wheels through an 8 tooth gear and rack": AGREES (book steps 12-16, no functions page). The cited parts are correct (p79 2819 steering wheel, p49/p53 4261 steering arms, p71 3743 rack).
- fn 2 "rear wheels roll together": AGREES (step 17).
- fn 3 "front wheels roll freely": AGREES (step 17).
- Missing from list: none.
### Doubts settled
- None. No function is inferred or marked unsure.
### Video leads
- None. Every function is settled by the build steps, so I did no search.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| — | — | no change | — | — | — |

## 8880 Super Car
Booklets: one scanned booklet, omr/instructions/8880-1/001-093.jpg (two-page spreads). Main model (the car, steps 1-36): scans 001-051. Photos: 052 (underside), 053 (rear hatch open on its prop, V8 showing), 054 (front). Alternate Formula One car: scans 055-092. Sticker sheet: 093. The sticker sheet has a 1-2-3-4 H gate, a separate "1 / 2" marker, "V8" and "4x4x4". Functions pages: none. I used the cover (001: red arrows at the front, over the steering wheel in the blueprint, and at the rear), the build steps and the photos. Pages read: 26 closely (001, 003, 011-013, 017-026, 030, 032-042, 048, 049, 051, 053, 054, plus crops) + 93 as four contact sheets. Time: about 30 minutes.
### Functions page (blind reading)
No functions page. From the cover, the build steps and the photos:
1. Pushed along, all four wheels drive through three differentials: the centre one at step 3 (scan 003) and the front and rear ones at step 15 (scan 013, with the half shafts pushed in).
2. A 4-speed gearbox with sliding driving rings (step 13, scan 011, with a sliding arrow). The gear lever stands in an H gate on the centre console (step 22, scan 021). The H gate gets the 1-2-3-4 sticker (sheet, scan 093).
3. A V8 with a crankshaft at 1:1 (engine sub-build, scans 027-029). It sits at the rear (step 27, scan 030). Photo 053 shows it.
4. The steering wheel steers. The dashboard and column are on scans 031-033 (step 28). The cover has a turning arrow over the steering wheel in the blueprint.
5. All four wheels steer. Step 19 (scan 017) shows a front and a rear steering rack, and scan 019 shows how to set both straight (90° marks on both ends). The cover's blueprint draws the turned wheel outlines.
6. An upright knob axle with a 24 tooth gear is fitted from above, behind the cockpit (step 29, scans 034-035). It is a second way to steer (a "hand of god" knob). This is inferred from where it goes. The book gives no arrow.
7. Pop-up headlights. Step 29 (scan 034) builds the two pods on pivots. The cover's front arrow and blueprint show them up. Step 26 (scan 026) fits a cross shaft at the nose. A blue cone handle on a short upright axle goes on the centre console, ahead of the gear lever (step 23, scans 022-023). It is probably the headlight control, but that is inferred.
8. Independent suspension on all four wheels, with shock absorbers (step 24, scan 024; the upper arms at step 25, scan 025; photos 052-054).
9. The rear body lifts as one hatch over the V8 (sub-build on scans 042-047, fitted at step 33 on scan 048). The cover has an arrow at the rear. Photo 053 shows it open, held up by a strut.
10. Seats: built on scan 040 and fitted at step 32 (scan 041). The book shows no motion arrow for them.
- Step 24 has an inset (scan 024, 1-3) where a pin by the lower arm is turned with a red arrow. Technicopedia calls it a removable suspension travel stop. This is a set-up, not a function.
### Comparison
- fn 1 "4WD through three differentials; V8 still in neutral": AGREES (steps 3, 15 and 36).
- fn 2 "in gear, rolling runs the V8 by a chain": AGREES (steps 13, 19 and 27). The book shows the gearbox, the chain and the engine. That the chain drives the crankshaft I read from where it runs, not from an arrow.
- fn 3 "gear lever in an H gate, 4 speeds": AGREES (steps 13 and 22, and the 1-2-3-4 sticker).
- fn 4 "steering wheel steers all four wheels, the rear ones the other way, about half as far": AGREES (steps 19-21, scan 019 and steps 28-29). The book does not show the rear direction or how far it turns. Technicopedia says the front rack has a 16 tooth pinion and the rear one an 8 tooth pinion, so the front turns more. That fits "about half as far".
- fn 5 "knob behind the cockpit steers the car": NOT ON PAGE (book step 29 shows it fitted, with no arrow). Technicopedia confirms a "hand of god" wheel behind the seats that drives the steering.
- fn 6 "knob on the centre console pops up the headlights": NOT ON PAGE (cover arrow and steps 21, 23, 26 and 29). The source calls the knob's place inferred. Step 23 settles it (see below).
- fn 7 "front independent suspension": AGREES (steps 9, 18, 24 and 25; photos).
- fn 8 "rear independent suspension": AGREES (same steps).
- fn 9 "springs hold the car up" (skip): AGREES (step 24).
- fn 10 "rear body lifts as one hatch": AGREES (cover arrow at the rear; steps 31 and 33; photo 053).
- fn 11 "prop rod holds the hatch open" (skip): AGREES (photo 053 shows the strut; page 45).
- fn 12 "seat backs tilt on their hinges": NOT ON PAGE (inferred). No arrow in the book. See doubts and video leads.
- fn 13 "turning the fan runs the V8 in neutral": NOT ON PAGE (inferred). The fan is on the crankshaft (engine sub-build, scan 028), so this follows from how it is built. LEGO does not show it as a function.
- Missing from list: none of the functions in the book is missing. The "1 / 2" sticker on the sheet (scan 093) has no function I can tie to it. It may mark the headlight knob's two positions (down/up). Low confidence; no change proposed.
### Doubts settled
- fn 6: where is the headlight knob? → Step 23 (scans 022-023) fits a single cone handle from the parts box ("1x") on a short upright axle on the centre console. In the isometric view it is ahead of the gear lever. Step 21 (scan 020) fits the shaft with its universal joint and 16 tooth gear, and step 26 fits the nose cross shaft. Technicopedia says the lights open "via a lever on the dash", through a u-joint and spur and bevel gears, turning about 135°. This matches the list. Confidence: medium-high. Caveat: the book draws the cone in blue, but the model has p948 6553 in colour 7 (light grey). This is a colour point only, low confidence.
- fn 12: are the seat backs meant to tilt? → The book does not settle it: there is no arrow on scans 040-041. The model's seat (8880-step32.ldr) hangs the back on the hinge plates 4275b/4276b at 15°, so a hand could tilt it. The search leads say the stock seats are not adjustable: a Eurobricks mod adds "adjustable sliding seats" as a new feature, and The Lego Car Blog says the seats are less functional than in earlier sets. Not settled. Confidence that the backs are a real function: low.
- fn 13: is turning the fan a function? → It follows from the build (the fan is on the crankshaft). It is not a LEGO-shown function. Keep it as inferred. Confidence that it works as described: medium.
- fn 5: technicopedia confirms the knob behind the seats. The book shows only that it is fitted. Confidence: medium-high.
### Video leads
- fn 12 (seat backs tilt): the search found no source for tilting seats. A Eurobricks mod thread adds "adjustable sliding seats" as new (https://www.eurobricks.com/forum/forums/topic/79397-8880-mod2-mode-4ws-and-adjustable-sliding-seats). The Lego Car Blog review says the seats are "no where near as functional as its predecessors" (https://thelegocarblog.com/2012/01/07/8880-review/). Video lead: Erik to look. Confidence that tilting is a real function: low.
- fn 5 and fn 6 (knob steering and headlight lever): technicopedia (https://technicopedia.com/8880.html) has animated GIFs of the steering and of the headlights opening, and describes the "hand of god" knob behind the seats and the headlight "lever on the dash". This supports the list. It is not a video, so it is not a lead that needs Erik.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| source | 6 | "where the knob sits is inferred from the model" | step 23 fits the cone handle on the centre console, ahead of the gear lever | scans 022-023 | medium-high |
| video | 12 | seat backs tilt (inferred, unsure) | no arrow; reviews suggest the stock seats are not adjustable | scans 040-041 | low |
| model | 6 | knob p948 6553 in colour 7 | cone handle drawn in blue in step 23's parts box | scan 022 | low (colour only) |

Tool note (not a set fault): audit-parts.ts reads `omr/8880-1 Super Car.mpd`, but the 8880's list uses `curated.model` = `models/8880-Super Car.mpd`. From about p590 on, the two files number the parts one apart. So the tool's output for p595 onward names the wrong parts (it printed p595 3710 where the list's part is 6549). Read with models/8880-Super Car.mpd, every cited part matches its part number. The tool should read `curated.model`.

## 8022 Starter Set (plane)
Booklets: one scan folder, 19 files; plane on 003-005 (steps 1-14), then three other models and the 8720 motor pages (018-019). Functions pages: none. Pages read: 3 closely (003-005, zoomed) + 1 contact sheet. Time: about 6 min.
### Functions page (blind reading)
No functions page and no motion arrows. From the steps: crown gears on cross and lengthwise shafts (steps 3-4), propeller on a shaft with an 8 tooth gear (step 8), a shaft with an 8 tooth gear (step 10), wheels (step 14). So:
1. Push the plane along → the wheels turn the gear train → the propeller spins. (Read from the gears that the steps fit, no arrow.)
2. The dark grey frame on ball-joint rods over the cockpit (steps 12-14) looks like a fixed cockpit frame; no sign that it moves.
### Comparison
- fn 1 "rolling spins the propeller": AGREES. NOT ON PAGE (book steps 3-4, 8, 10, 14; gear path inferred from the model).
- Missing from list: nothing.
### Doubts settled
- fn 1: gear path is "inferred from the model file" → the steps put the two crown gears (3650a, steps 3-4), the propeller's 8 tooth gear (step 8 inset) and the wheel shaft's 8 tooth gear (step 10 inset) where the list says; no step shows an arrow. Settled by steps 3-4, 8, 10, confidence medium.
### Video leads
- None searched (no unsettled function).
### Proposed changes
None.

## 8824 Hovercraft
Booklets: one scan folder, 33 files; hovercraft 001-015 (steps 1-20), helicopter B model 016-032, sticker sheet 033. Functions pages: none; cover (001) blueprint has arrows. Pages read: 11 closely (001 cover zoomed, 007-015) + 1 contact sheet. Time: about 10 min.
### Functions page (blind reading)
Cover blueprint: two-way turning arrows at the black knob on top of the cabin; a turning arrow at the propeller. Steps: front wheel pair on a cross axle with gears (step 9), gears to an upright shaft (13-14), rear wheel pair on an upright column with a 24 tooth gear (step 15), propeller with a crown gear on a toggle joint (step 20), black knob (step 20).
1. Black knob on the cabin, turned either way → steers (rear wheel unit on the upright column, step 15).
2. Push the hovercraft along → the front wheels drive the gear train → the propeller spins (cover arrow at the propeller).
3. Rear wheels roll freely.
Whether the propeller swivels with the steering: step 20 mounts the propeller's shaft in a toggle joint on top of an upright shaft; the cover draws no swivel arrow.
The grey A-frame at the bow (steps 13, 16, 18) is fixed (cover blueprint draws it with dimensions only).
### Comparison
- fn 1 "black wheel steers rear wheels and propeller": AGREES for the steering (cover arrows at the knob). The propeller swivel is NOT ON PAGE (inferred from the model).
- fn 2 "rolling spins the propeller": AGREES (cover arrow at the propeller; gear path inferred).
- fn 3 "rear wheels roll freely": AGREES (book step 15).
- Missing from list: nothing.
### Doubts settled
- fn 1 / question "Does the propeller swivel with the steering?": step 20 shows the propeller on a toggle joint on top of an upright shaft; the cover shows only the spin. Technicopedia (written, not a video) says the drive propeller's bearing is a vertical axle and the propeller turns with the wheels when steering. Partly settled: medium.
- fn 2: gear path inferred → steps 9, 13-14, 17, 20 show the gears; the cover arrow shows the propeller turns. Confidence medium-high.
### Video leads
- fn 1 propeller swivel: Technicopedia's 8824 page says the rear wheels steer by swinging the tail and the propeller turns with the steering. https://technicopedia.com/8824.html (written page, no time). video lead: Erik to look, confidence medium.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| video | 1 | propeller swivels with the column (inferred) | not drawn; Technicopedia agrees | 015, technicopedia.com/8824.html | medium |

## 8826 ATX Sport Cycle
Booklets: one scan folder, 20 files; quad 004-012 (steps 1-13, front built on 009-011, sub-steps 1-6), buggy B model 013-016, 8720 pages 017-020. Functions pages: none; cover blueprint has no arrows. Pages read: 6 closely (001 cover, 007, 008, 010, 011, 012) + 1 contact sheet. Time: about 5 min.
### Functions page (blind reading)
No arrows. From the steps:
1. Handlebars → the whole front end (two fork legs, both front wheels, mudguards, headlight) turns on the 4-long axle pushed down through the frame in step 12.
2. Four wheels roll freely; no drive.
### Comparison
- fn 1 "handlebars steer the front end": AGREES (book steps).
- fn 2 "wheels roll freely": AGREES.
- Missing from list: nothing.
### Doubts settled
None open.
### Video leads
None searched.
### Proposed changes
None.

## 8828 Front End Loader
Booklets: one scan folder, 11 files (spreads); loader 001-005 (steps 1-18), grader B model 006-009, 8720 motor pages 010-011 (left), back cover 011 (right). Functions pages: none; back cover blueprint has arrows. Pages read: 7 closely (002-005, 010, 011, cover zoomed) + 1 contact sheet. Time: about 10 min.
### Functions page (blind reading)
Back cover blueprint: a curved arrow for the arms rising and a dashed arc for the bucket tipping. Steps: steering knuckles (step 4), rack and 8 tooth pinion with gears (step 7), worm on a crank shaft (step 11), flex cables from a crank (step 11 pink inset), long vertical axle (step 12), round knob on the roof (step 18). The 8720 pages put a pulley on the crank on the side shown (the model's left, with the bucket to the viewer's left) and drive it from the motor.
1. Crank on one side → worm → the arms rise and fall.
2. Crank on the other side → flex cables → the bucket tips.
3. Roof knob → vertical axle → rack → steers the wheels under the cab.
4. Wheels roll freely.
### Comparison
- fn 1 "right crank raises the arms": DIFFERS in side. The list's control p124 is at x = +90; the loader faces −z (bucket p163 at z −285), and in LDraw (y down, a model facing −z) +x is the model's LEFT. Technicopedia also says the lift crank is on the left. The mechanism and parts agree.
- fn 2 "left crank tips the bucket": DIFFERS in side. p126 is at x = −90, the model's RIGHT; Technicopedia says the dump crank is on the right.
- fn 3 "roof knob steers the rear wheels": AGREES (steps 3-4, 7, 12, 18).
- fn 4 "wheels roll freely": AGREES.
- Missing from list: nothing (8720 motor is an add-on, not the set as sold).
### Doubts settled
- Question "Right crank lift, left crank bucket?": No. The lift (worm) crank is on the left, the bucket crank on the right. Settled by the model positions (x sign) and by the 8720 page 011, which puts the motor pulley on the crank on the side shown (the model's left, and a worm suits a motor), and Technicopedia agrees. Confidence medium-high. Only the words "right"/"left" need to change; the control parts p124 and p126 are right.
- Question "Does the 8720 motor drive the lift?": page 011 (step 4) puts a pulley on the left crank and a band from the motor, so yes, the lift, by the same reasoning. Confidence medium.
### Video leads
- fn 1, 2 sides: Technicopedia's 8828 page: front bucket lifted by a crank on the left side (worm to a 24 tooth crown gear, then 14 tooth bevel gears); dumped by a crank on the right side. https://technicopedia.com/8828.html (written page). Booklet does not name sides; this agrees with the model. Confidence medium-high.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| direction | 1 | crank on the right side lifts | lift crank p124 is on the model's left (x +90, model faces −z); Technicopedia agrees | 011 (8720 pulley on the left crank) | medium-high |
| direction | 2 | crank on the left side tips the bucket | bucket crank p126 is on the model's right | 011 | medium-high |

## 8836 Sky Ranger
Booklets: one scan folder, 24 files; plane 004-014 (steps 1-21), helicopter B model 015-021, 8720 pages 022-024. Functions pages: none; cover blueprint has arrows. Pages read: 10 closely (001 cover zoomed, 004-010, 012-014) + 1 contact sheet. Time: about 9 min.
### Functions page (blind reading)
Cover: a turning arrow at the propeller; a red down arrow at the right wing's rear flap (flap tilted). Steps: flat-twin engine with crankshaft (step 9), shock absorber (step 3), stick on a toggle joint on the floor shaft with toothed half bushes (steps 3-4), double pulley with two 4 cm flex cables (step 12), propeller (step 13), legs and cross axle (step 14), wing axles and flaps (steps 17-20), rods (step 21).
1. Propeller turned → the two pistons move in the engine.
2. Control stick tilted → flaps behind the wings tilt (cover arrow on one flap).
3. Main landing gear swings, held by the shock absorber.
4. Wheels roll freely.
### Comparison
- fn 1 "propeller turns the flat-twin engine": AGREES (step 9, cover arrow).
- fn 2 "stick works the ailerons, opposite ways": AGREES that the stick works the flaps (cover arrow, steps 3-4, 12, 17-20); "opposite ways" NOT ON PAGE (inferred).
- fn 3 "sprung main landing gear": AGREES (steps 3, 14, 16; no arrow).
- fn 4 "spring": AGREES (step 3); skipped.
- fn 5 "wheels roll freely": AGREES.
- Missing from list: nothing.
### Doubts settled
- fn 2 / question "Does the stick's toggle grip the floor shaft?": step 3 inset sets the toothed toggle joint on the 8-long floor shaft between two toothed half bushes pushed against it; that pairing is LEGO's way to lock a toggle joint's angle to its axle. Confidence medium.
- fn 2 "flaps go opposite ways": step 12 right inset (end view) shows the two cables pinned on opposite sides of the double pulley's centre, so one pushes while the other pulls. Confidence medium (whether each crank then gives opposite flap motion is not drawn).
### Video leads
- fn 2: search found only a Technicopedia airplanes table listing the 8836 with ailerons from the stick (https://technicopedia.com/airplanes.html); no video, no detail on opposite motion. video lead: Erik to look, confidence low.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| video | 2 | ailerons go opposite ways (inferred) | cables on opposite sides of the pulley; opposite motion not drawn | 008 (step 12) | medium |

## 8837 Pneumatic Excavator
Booklets: one scan folder, 32 files; excavator 006-018 (chassis steps 1-9, upper steps 10-24, arm sub-steps on 014-016), truck crane B model 019-029, 8720 pages 030-032. Functions pages: none as such; page 018 has two photo panels with arrows (the nearest thing to a functions page). Pages read: 9 closely (007, 008, 010, 012, 013, 017, 018 zoomed three times) + 1 contact sheet. Time: about 12 min.
### Functions page (blind reading)
Page 018 photo panels: top, the yellow knob pushed down and turned, arrows at a wheel pair steering; bottom, the knob pulled up and turned, a long arc under the body (the upper body turning). Steps: hand pump (11-12), two valves and hoses with coloured marks (17-18, 22), big cylinder under the boom, small cylinder on the stick (21-23), sliding 8 tooth gear on the knob's axle (step 8 inset, arrow up).
1. Hand pump supplies air.
2. Valve near the reader in step 18 (away from the grey tower) → big cylinder (green/yellow marked hoses) → boom up/down.
3. Valve on the tower side → small cylinder (blue/red marked hoses) → bucket curls.
4. Knob down + turn → steering.
5. Knob up + turn → upper body slews on the turntable.
6. Wheels roll freely.
### Comparison
- fn 1 "inner valve → boom": AGREES (step 18 hose marks green/yellow from the near valve; step 22 the big cylinder carries green/yellow).
- fn 2 "outer valve → bucket": AGREES (blue/red marks).
- fn 3 "stick fixed to the boom": AGREES (no arrow; arm steps and step 21).
- fn 4 "knob down steers the wheels under the boom end": AGREES with page 018 top panel for the function. Note: the photo draws the steering arrows at the wheels at the cab end, under the pump (boom pointing right), but step 23's drawing shows the steering rack at the boom end, as does the model (steering axles at x −190, boom toward −x). The photo's upper body may be slewed; the list stands.
- fn 5 "knob up slews the upper body": AGREES (page 018 bottom panel, step 8 inset).
- fn 6 "wheels roll freely": AGREES.
- fn 7 "hand pump": AGREES (skipped in the list).
- Missing from list: nothing.
### Doubts settled
- Question "Which valve works which cylinder?": the hose colour marks in step 18 and step 22 match the list (near valve green/yellow to the boom cylinder; tower-side valve blue/red to the bucket cylinder). Settled by pages 012 and 017, confidence medium-high.
- fn 5 "the pinned gear meshes the turntable base's teeth" (inferred): step 8 inset fits an 8 tooth gear on a pin under the upper plate and the sliding 8 tooth gear on the knob's axle beside it (arrow up). Page 018 bottom panel confirms the slew. What the pinned gear meshes with is not drawn. Function settled, confidence high; mesh partner confidence low.
### Video leads
None searched (functions settled by page 018).
### Proposed changes
None.

## 8868 Air Tech Claw Rig
Booklets: one scan folder, 59 pages. p.1 cover; p.2-3 pneumatic hints and length rulers; p.4-34 main model (truck with knuckle crane), steps 1-32; p.35-58 the B model (yellow claw vehicle), steps 1-27; p.59 the sticker sheet 166285 (eight valve pictograms). Functions pages: none. Used step 32 (p.34, where the four valve stickers are placed), the sticker sheet p.59, and steps with arrows. Pages read: 22 closely + 2 contact sheets. Time: about 15 minutes.
### Functions page (blind reading)
No functions page. From the build steps and stickers:
1. Battery box with switch on the cab roof (step 29, p.31) → 9V motor (step 22, p.23) → small pump (step 24, p.25) = compressor feeding the valves (page 2 shows the compressor idea).
2. Valve, sticker at the cab roof front (p.34 callout; sticker p.59 lower-left pair) → claw closes (lever ← green) / opens (lever →).
3. Valve, sticker at the cab roof rear (p.34; sticker p.59 upper-left pair) → outer arm (jib) with claw raised (←) / lowered (→).
4. Valve, sticker low on the cab's left side, front (p.34; sticker p.59 lower-right pair) → main boom up (←) / down (→).
5. Valve, sticker low on the cab's left side, rear (p.34; sticker p.59 upper-right pair) → crane turret slews one way (←) / the other (→). Built from two lengthwise cylinders (step 9, p.9, arrows on the rods) with racks (step 13) and the turntable (step 14).
6. Roof knob (round part on the upright shaft's top, step 30 inset, p.32) → front wheels steer; the upright shaft with U-joint is put in at step 18 (p.19), steering arms at step 5 (p.6).
7. Rolling → rear tandem axles with two differentials (step 3, p.5) and propeller shaft with U-joints (step 2, p.4) → V engine in the nose (step 27, p.28; arrow at sub-step 7 shows the input shaft).
8. A steering wheel in the cab on a short horizontal axle (step 23, p.24). It does not appear to connect to the steering; likely decoration (low).
9. Wheels roll; claw head on the jib tip (step 28).
### Comparison
- fn 1 "motor runs compressor": AGREES (book steps 20-24, 29).
- fn 2 "roof knob steers front wheels": AGREES (step 30 knob on the upright shaft; gear path not checked).
- fn 3 "front wheels roll free": AGREES.
- fn 4 "rolling runs the engine": AGREES for differentials, shaft and engine; the rubber band link is NOT ON PAGE (inferred).
- fn 5 "rear left valve slews": AGREES (sticker placement p.34).
- fn 6 "front left valve raises big arm": AGREES (sticker placement p.34).
- fn 7 "rear right valve raises front arm": AGREES in function; the sticker for it is on the roof rear, not on the right side. Consistent with a rear valve whose label sits on the roof.
- fn 8 "front right valve opens claw": AGREES in function; sticker on the roof front.
- fn 9 "claw head hangs free": NOT ON PAGE (inferred); skip set.
- fn 10 "tanks, stacks, horns fixed": AGREES (steps 30-32).
- Missing from list: the cab steering wheel (step 23) only if it turns anything; I think it is decoration. No other missing function.
### Doubts settled
- fn 2: the roof knob as the steering control → step 30 (p.32) shows a round knob fitted on the upright shaft's top on the roof, the shaft from step 18. Confidence medium-high.
- fn 4: the rubber band from the gears to the crankshaft → not settled; I saw no band in the steps I read (2, 3, 7, 27). Confidence low either way.
- fn 9: claw hangs free → the jib sticker (p.59 upper-left pair) draws the claw hanging straight down in both jib positions, which supports it. Confidence low-medium.
- fn 5-8 which valve: sticker positions on p.34 (claw front-roof, jib rear-roof, boom front-left-low, slew rear-left-low) fit the list's front/rear assignment. Confidence medium. Sticker directions: lever toward the green ← arrow = claw closes / jib up / boom up / slew one way; → = the opposite. The list gives no directions.
### Video leads
- One search ("lego technic 8868 Air Tech Claw Rig review functions"): no functions detail in summaries. Leads: Eurobricks pictorial review https://eurobricks.com/forum/forums/topic/78325-pictorial-review-8868-air-tech-claw-rigmaterials-handler , LUGNET review https://news.lugnet.com/technic/?n=3345 . fn 4 (rubber band) and fn 9: video lead: Erik to look, confidence low.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| direction | 5-8 | no lever directions | stickers: ← = claw closes / jib up / boom up; → = opposite (slew ← one way, → other) | p.34, p.59 | medium |
| source | 2 | roof knob "inferred from the model file" | knob shown in step 30 inset | p.32 | medium-high |
| source | 7, 8 | valve "on the cab's right side" | the stickers for these two sit on the roof (front = claw, rear = jib) | p.34 | medium |
| video | 4 | rubber band to the crankshaft inferred | not seen in the steps read | p.4-5, 8, 28 | low |

## 8074 Universal Set with Flex System
Booklets: one scan folder, 46 pages, four models. p.1 cover (crane is the large picture); p.2-11 model 1 (front loader, steps 1-21); p.12-24 model 2, the tower CRANE (tower steps 1-7 p.12-15, house steps 1-9 p.16-18, joining steps 8-13 p.19-24); p.25-35 model 3 (log loader); p.36-43 model 4 (forklift); p.44-46 motor add-on 8720 for model 4. The model file is the Crane ("8074 - Crane.ldr"). Functions pages: none. Pages read: 12 closely + 1 contact sheet + cover crop. Time: about 10 minutes.
### Functions page (blind reading)
No functions page. From the build steps and the cover:
1. Handwheel with crank handle low on the tower (step 7, p.15) → winch axle across the tower base (string from step 4) → hook up/down; cover p.1 draws an up-down red arrow by the hook.
2. A small hanging axle on a pin beside the winch (step 7 inset "4", p.15) — likely a pawl on the winch gear.
3. Round yellow knob on the tower side (step 7 inset, p.15) → via the gear under the turntable (step 5 sub-steps 3-5, p.14) → slews the crane top.
4. House at the back: two worms on 10-long axles (house step 3, p.16), handwheels (step 5, p.17), 24-tooth gears and levers (step 6, p.17) → Flex cables (house step 8, 4 cm and 7.2 cm; step 10, two 5.6 cm; step 12, 10.4 cm and 4.8 cm) → the jib and the arm hanging at the jib tip (steps 12-13, p.23-24). The cover shows the jib raised and the tip arm swung up, with a red ←→ arrow over the house drawing. I could not tell from the drawings alone which handwheel works which part.
### Comparison
- fn 1 "handwheel winds winch": AGREES (steps 4, 7, 13; cover arrow).
- fn 2 "pawl on winch gear": AGREES that the part is there (step 7 inset); that it is a ratchet is inferred. Skip set.
- fn 3 "knob slews": AGREES (steps 5, 7).
- fn 4 "one handwheel luffs the jib": NOT ON PAGE as a motion; parts agree with steps 3, 5, 6, 9-11. Which train goes to the jib is inferred.
- fn 5 "other handwheel swings the tip arm": NOT ON PAGE as a motion; parts agree with steps 3, 5-6, 8, 12-13.
- Missing from list: nothing found.
### Doubts settled
- fn 2: ratchet → the step 7 inset shows a 4-long axle on a pin hanging by the winch, which fits a pawl. Confidence medium.
- fn 4/5: which handwheel works the jib and which the arm → not settled by the drawings; step 10 runs the two 5.6 cm cables to the jib's pivot and step 12 runs the long 10.4 cm cable along the jib to the arm's top, which fits the list. Confidence medium.
### Video leads
- One search ("lego technic 8074 Universal Set Flex System crane review"): Technicopedia https://technicopedia.com/8074.html says the crane is stationary and the flex cables also act as braces; Brickset review https://brickset.com/reviews/set-8074-1 says each model has 2-3 features. Neither says which handwheel does what. fn 4/5: video lead: Erik to look, confidence low.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| video | 4, 5 | handwheel A luffs jib, B swings tip arm (partly inferred) | parts and cables fit; motion not drawn | p.16-24, cover | medium |

## 8810 Cafe Racer
Booklets: one scan folder, 9 pages (spreads). p.1 cover; p.2 hints; p.3-6 left half the motorbike (main model), steps 1-13; p.6 right to p.7 the trike B model; p.8-9 the 8720 motor add-on for the trike. Functions pages: none. Pages read: 5 closely + 1 contact sheet. Time: about 6 minutes.
### Functions page (blind reading)
No functions page and no motion arrows in the motorbike steps. From the steps:
1. Handlebars → front fork turns on the 4-long axle through the steering head (step 11, p.5; step 12).
2. Rear swing arm on a pivot under the frame with two shock absorbers (steps 6-10, p.4) → rear wheel rises and falls.
3. Front and rear wheels roll free (steps 8, 11).
4. A stand under the middle of the bike from hinge plates (steps 9-10, p.4; seen down in step 11, p.5). The steps don't show it folded (the bike is built upside down to step 10).
### Comparison
- fn 1 "handlebars steer": AGREES (step 11).
- fn 2 "swing arm": AGREES (steps 6-10).
- fn 3 "shock springs": AGREES (step 6, cover); skip set.
- fn 4 "wheels roll free": AGREES.
- fn 5 "parking stand folds": NOT ON PAGE (inferred).
- Missing from list: nothing.
### Doubts settled
- fn 5: stand folds on its hinge plates → the book shows hinge plates (step 9 inset) but never the stand in two positions. Not settled by the book. Technicopedia's text says the kickstand is "manually retracted on a pair of standard finger hinges" (written review lead, not a video). Confidence medium.
### Video leads
- fn 5: Technicopedia https://technicopedia.com/8810.html (written review) says the stand folds on hinges and the rear shocks are stiff; front fork has no suspension (fits the list). video lead: Erik to look, confidence medium.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| video | 5 | stand folds (inferred) | hinge plates, stand only shown down | p.4-5 | medium |

## 8815 Speedway Bandit
Booklets: one scanned booklet, omr/instructions/8815-1/001-009.jpg (9 scans, two pages per scan). The go-kart is scans 003-005 (steps 1-10); scans 005-008 are the alternate model (a road roller); scan 008-009 add the 8720 motor. Functions pages: none. Used the cover (001.jpg) and the build steps. Pages read: 9 closely (6 zoomed crops). Time: about 8 minutes.
### Functions page (blind reading)
No functions page. From the cover and the build steps:
1. Steering wheel → front wheels steer. The cover's blueprint draws a curved red arrow round the steering wheel (001.jpg). Steps 6-9 (004-005.jpg) build the column, a rack-like grey part with ball ends (step 8) and the steering arms.
2. Wheels roll (steps 3-4, 10).
3. A cylinder block with an exhaust sits behind the seat (step 5, 004.jpg). Blind, I saw no arrow for it and did not see what drives it.
4. The number board sits on a hinge plate (step 8 inset, 004.jpg). No arrow.
### Comparison
- fn 1 "steering wheel steers the front wheels": AGREES (cover arrow; steps 8-10).
- fn 2 "pushing the kart works the engine's piston": NOT ON PAGE (book steps 3 and 5). Step 3's inset (003.jpg) shows the crank and connecting rod put on the 4-long rear axle, and step 5 puts the cylinder over it. My blind reading missed the crank; the build steps support the list.
- fn 3 "four wheels roll freely": AGREES (steps 3-4, 10).
- fn 4 "number board tilts on its hinge": NOT ON PAGE (inferred).
- Missing from list: none.
### Doubts settled
- fn 4: whether the number board should tilt → the hinge plate (step 8 inset, 004.jpg) is a real hinge, so it can tilt; the book shows no arrow. Confidence medium. Not worth a model change.
### Video leads
- One search ("lego technic 8815 Speedway Bandit review functions"). The summaries (technicarchives.blogspot.com/2018/12/8815-speedway-bandit.html, brickset.com/reviews/set-8815-1) say only that it was the first go-kart with the new cylinder element. Nothing about the hinge. No video found.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| (none) | | | | | |

## 8820 Mountain Rambler
Booklets: one scanned booklet, omr/instructions/8820-1/001-010.jpg (10 scans). The buggy is scans 003-006 (steps 1-13); the alternate model and the 8720 motor pages come after (001.jpg left half is the 8720 version). Functions pages: none. Used the cover (001.jpg right half) and the build steps. Pages read: 6 closely (3 zoomed crops). Time: about 6 minutes.
### Functions page (blind reading)
No functions page. From the cover and the build steps:
1. Steering wheel (step 7, 004.jpg) → front wheels steer, through a column, the ridged grey steering rack (in step 5's parts box) and the steering arms (steps 3-4).
2. Step 5's inset (004.jpg) shows a grey part between a 6-long and an 8-long axle, with two small arrows along it. Blind, I read it as a universal joint. After comparison: it is the shock absorber, and the arrows show it compressing.
3. Wheels roll (steps 3, 12-13).
4. The two round headlights (step 10, 005.jpg) sit on ball-ended holders. No arrow; not a function as far as the book shows.
### Comparison
- fn 1 "steering wheel steers the front wheels": AGREES. Source wording: the rack is in step 5's parts box, not step 4's; step 4 builds the rack's holder. Minor.
- fn 2 "rear wheels on a swinging arm": NOT ON PAGE (book steps 5, 11-13). Step 5's inset arrows show the shock compressing, and step 11 shows the 10-long pivot axle. This supports the list.
- fn 3 "shock spring pushes the wheels back down": AGREES with step 5 (skipped in the list, correctly).
- fn 4 "four wheels roll freely": AGREES.
- Missing from list: none. The headlights are not shown moving.
### Doubts settled
- None. No function is inferred or marked unsure.
### Video leads
- None needed; no search done.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| source | 1 | "4 (rack and its holder)" | the rack is in step 5's parts box; step 4 builds its holder | 004.jpg step 5 | medium |

## 8856 Whirlwind Rescue
Booklets: one scanned booklet, omr/instructions/8856-1/001-048.jpg (48 scans). The helicopter is scans 004-027 (steps 1-28; 027 is the step-28 close-up of the rotor blades). The second model (the car) is scans 028-045. Scans 046-048 add the 8720 motor. Functions pages: none. Used the cover (001.jpg) and the build steps. Pages read: 20 closely (8 zoomed crops) + 2 contact sheets of all 48. Time: about 20 minutes.
### Functions page (blind reading)
No functions page. From the cover and the build steps:
1. The main rotor turns (cover, red curved arrow over the hub, 001.jpg).
2. The main rotor tilts: red up and down arrows at the blade tips on the cover (001.jpg). It sits on a ball-and-ring hub (step 26, 024.jpg), and a black arm next to the mast reaches up to the hub (steps 23-26, 021-024.jpg).
3. The tail rotor turns (cover, curved arrow at the tail). A shaft with universal joints runs up the tail boom (steps 25-26, 023-024.jpg).
4. Landing gear: the cover's blueprint draws a nose wheel on a leg with a red curved arrow above it (001.jpg, left of the cabin). That suggests the gear retracts. The arrow turns clockwise in that view (nose to the left), but its head and centre are too small to read for sure.
5. Winch: string wound on an axle (step 15, 013.jpg); hook hangs from the side (cover).
6. Handwheel and small pulley-wheel cranks are fitted on the sides in step 24 (022.jpg). The book does not say which one works what.
7. Flex cables (steps 12, 15-16, 25) run from the cockpit toward the mast and tail. They belong to the rotor-tilt controls (2 above).
### Comparison
- fn 1 "big handwheel spins main and tail rotors": AGREES with the cover arrows and steps 18, 23-28. Side wording: the list says "right side"; the handwheel p388 is at x = +120, which is the LEFT (port) side (see note at top).
- fn 2 "small crank low on the right retracts the landing gear": NOT ON PAGE (book steps; the folding is inferred). The cover's blueprint arrow at the nose wheel supports that the gear moves. Side wording: p390 is at x = +115, the LEFT (port) side. Technicopedia also says port.
- fn 3 "small crank low on the left winds the winch": NOT ON PAGE (book steps 14-16, 24). Side wording: p182 is at x = -115, the RIGHT (starboard) side.
- fn 4 "small crank high on the left swings the hoist arm": NOT ON PAGE (inferred). Side wording: p392 is at x = -115, the RIGHT (starboard) side.
- fn 5 "stick forward/back tilts the rotor forward/back": AGREES that the rotor tilts (cover up and down arrows); the linkage rests on the build steps.
- fn 6 "stick left/right tilts the rotor sideways": AGREES in the same way as fn 5.
- fn 7 "pawl on the winch gear": NOT ON PAGE (inferred; skipped).
- fn 8 "landing gear wheels roll freely": AGREES (steps 7, 10).
- Missing from list: none.
### Doubts settled
- fn 2: which way the gear folds → not settled. The cover blueprint (001.jpg, the blue drawing left of the cabin) shows a wheel on a leg and a curved red arrow over it, clockwise with the nose to the left. With the leg hanging below its pivot, that would swing the wheel forward and up, but I can't read the arrow's centre or head well enough at this scan size. Confidence low. Video lead below.
- fn 4: does the high crank swing the hoist arm? → not settled by the book (no arrow). Technicopedia says the rescue winch "can be stowed or deployed" and is worked by two cranks on one side (starboard). That fits the list's two winch cranks (p182, p392 both at x = -115). Confidence medium (written source only, no video seen).
- fn 5: does the ring 2908 stay still while the rotor spins? → Step 26 (024.jpg) shows the black arm reaching up to the underside of the hub at the ring. Step 25 (023.jpg) puts a bush on the mast first. The book can't show whether the ring turns. Confidence low; leave the note.
- fn 5/6: which way of the stick works which cable → not settled; no arrows in the book.
- Extra check, fn 1 (the main rotor on the mast). Step 25 (023.jpg) puts a grey bush on the top end of the 12-long mast, just above the grey plates. Step 26 (024.jpg; inset top to bottom: dark grey cross 2906, grey ball 2907, light grey four-knob ring 2908) pushes the ball onto the top end of the mast, with the ring round the ball and the cross on top of the ball. In the main picture the cross sits directly on the ball, and no mast shows above the cross. Bare mast shows only between the plates and the bush/ring. Step 28 (026.jpg) pushes a 2-long axle with the grey dish down into the top of the cross. So the hub sits right on the mast's top end, and the mast ends inside the ball. In the model file, Main-Rotor-Center is at y = -337 (2907 and 2908 at -317), and the mast 3708 (in Top-Back-Function-Tower, centre y = -210, 240 LDU long) ends at about y = -330. That fits the caller's finding that the hub is 15 LDU off the axle's end and the hub axle 1 LDU short. The book shows no gap, so the rotor (Main-Rotor-Center, Main-Rotor-Top and the four Rotor-Blade) is drawn too high by about that amount. Confidence medium: the scans are small, but the ball clearly sits on the mast's end.
### Video leads
- fn 2 (landing gear folding direction): Technicopedia (https://www.technicopedia.com/8856.html) says the 3-point landing gear retracts with a crank on the port side. It doesn't give the direction. Video lead: Erik to look (search "8856 Whirlwind Rescue" on YouTube, landing gear retracting). Confidence low.
- fn 4 (hoist arm): Technicopedia says the rescue winch on the port side can be stowed or deployed and is worked by two cranks on the starboard side. Brickimedia (https://en.brickimedia.org/wiki/8856_Whirlwind_Rescue) calls it a "retractable harness crane". This supports the list, but it's a summary only. Video lead: Erik to look. Confidence medium.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| model | 1 | (model) rotor hub 15 LDU off the end of the mast, hub axle 1 LDU short of the 2907 | the ball 2907 is pushed onto the mast's top end, the ring 2908 round it, the cross 2906 on the ball, and a 2-long axle with the dish into the cross; no gap. Lower Main-Rotor-Center, Main-Rotor-Top and the four Rotor-Blade so the 2907 sits on the mast's end | 023.jpg step 25, 024.jpg step 26, 026.jpg step 28 | medium |
| what | 1 | "big white handwheel on the right side" | the handwheel p388 (x = +120) is on the left (port) side; the cover shows it on the side you see with the nose pointing left | 001.jpg cover, 022.jpg step 24 | medium-high |
| what | 2 | "small crank low on the right side" | p390 (x = +115) is on the left (port) side; Technicopedia says port too | 022.jpg step 24 | medium-high |
| what | 3 | "small crank low on the left side" | p182 (x = -115) is on the right (starboard) side | 022.jpg step 24 | medium-high |
| what | 4 | "small crank high on the left side" | p392 (x = -115) is on the right (starboard) side | 022.jpg step 24 | medium-high |
| video | 2 | gear fold direction unsure | cover blueprint arrow at the nose wheel, too small to read | 001.jpg | low |
| video | 4 | hoist arm swing inferred | no arrow in the book; Technicopedia says the winch is stowed/deployed by two starboard cranks | n/a | medium |

## 8825 Night Chopper
Booklets: one scanned booklet, omr/instructions/8825-1/001-008.jpg (8 scans, two pages each). The helicopter is 002-005 left (steps 1-15); 005 right to 007 is the alternate model; 001 left and 008 are the 8720 motor pages. Functions pages: none. Used the cover (001.jpg right half) and the build steps. Pages read: 6 closely (4 zoomed crops). Time: about 8 minutes.
### Functions page (blind reading)
No functions page. From the cover and the build steps:
1. The pulley-wheel handwheel on the side (step 14, 004.jpg) → main rotor turns. Steps 8 and 11 (002-003.jpg): a crown gear on the 10-long cross axle and a small gear at the foot of the 6-long mast.
2. Tail rotor turns: the cover blueprint (001.jpg) draws a 2-blade part at the tail with a red curved arrow. Step 8's inset shows a gear on a 3-long axle at the tail end, and step 10 (003.jpg) lays a 12-long shaft along the boom with a gear at each end.
3. The white round light on the nose (steps 6, 12). No arrow.
### Comparison
- fn 1 "handwheel turns the main rotor": AGREES (cover; steps 8, 11, 13-14). Side wording: the list says "right side"; the handwheel p84 is at x = +85, the LEFT (port) side. Technicopedia says "a single crank on the left side".
- fn 2 "same handwheel turns the tail rotor": AGREES (cover arrow at the tail; steps 8, 10). How the front of the shaft is driven is inferred (see below).
- fn 3 "nose light turns freely": NOT ON PAGE (inferred).
- fn 4 "airframe holds its shape": AGREES (steps 1-3, 13, 15).
- Missing from list: none.
### Doubts settled
- fn 2 / question "does the tail shaft's front bevel mesh the crown gear?" → Step 10 (003.jpg) sets the shaft's front end, with its gear, in a plate right behind and above the crown gear on the cross axle. The cover arrow says the tail rotor turns. So the book means the front gear to be driven from the crown gear. Confidence medium. Whether it meshes the crown gear directly or through another gear can't be read at this scan size. Technicopedia says the crown gear "meshes with an 8-tooth spur that feeds 14-tooth bevel gears" on the tail rotor, which may mean a gear in between (lead below).
- fn 3: the light turning → not shown; a free spin on a pin is harmless. Confidence low that it is a function at all.
### Video leads
- fn 2: Technicopedia (https://technicopedia.com/8825.html) gives the drive as crank → 8-tooth and 24-tooth gear; the 24-tooth crown gear meshes an 8-tooth spur feeding 14-tooth bevels to the tail rotor; both rotors at the same rate, 3:1 to the crank. Brickset review (https://brickset.com/reviews/44890): main and tail rotors are driven by hand, its only function. No video found. Video lead: Erik to look (does the tail shaft's front gear mesh the crown gear directly?). Confidence medium.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| what | 1, 2 | "the handwheel on the right side" | p84 (x = +85) is on the left (port) side; Technicopedia says left | 001.jpg cover, 004.jpg step 14 | medium-high |
| video | 2 | front bevel driven by the crown gear (inferred) | step 10 sets the shaft's front gear just behind the crown gear; Technicopedia mentions an 8-tooth spur between them | 003.jpg step 10 | medium |

## 8830 Rally 6-Wheeler
Booklets: omr/instructions/8830-1/001-024.jpg, one booklet of 24 scans. Main model p.1-12 (steps 1-16). p.13-20 are the alternative model (a formula car). p.21-23 are the 8830+8720 motor add-on, built on the alternative car. p.24 is an advert. Functions page: none. The cover (p.1) has the only motion arrows: curved red arrows round the handwheel on the roof. Pages read: 9 closely + 1 contact sheet. Time: about 8 min.
### Functions page (blind reading)
No functions page. These come from the cover and the build steps:
1. Handwheel on the roof (cover arrows, step 11 tall shaft with a 24 tooth gear, step 16 the wheel on top) → steers the wheels. Steps 3 and 6 show steering arms and a rack at both the front and the rear axle. The middle axle has no pivots. Step 7 shows a shaft with a 24 tooth crown gear and 8 tooth gears driving the racks. The booklet does not show which way the rear wheels turn.
2. The six wheels roll freely when the car is pushed.
3. The small steering wheel in front of the driver (step 15). It is not shown to connect to any gear.
### Comparison
- fn 1 "handwheel steers front and rear, middle straight, rear opposite": AGREES. The opposite turn of the rear wheels is inferred (see below).
- fn 2 "six wheels roll freely": AGREES.
- fn 3 "driver's steering wheel is for show": AGREES with steps 15-16 (no gears). The list's source says "inferred".
- fn 4 "roll cage rigid": NOT ON PAGE (book steps 9-15). A structural item, not a function.
- Missing from list: none.
### Doubts settled
- fn 1: do the front and rear wheels turn opposite ways? → Yes, most probably. Step 7 drives both racks from 8 tooth gears on one shaft, so both racks slide the same way. In the model file the front steering arms pivot at z=-90 and the front rack is at z=-50, behind the pivots. The rear arms pivot at z=130 and the rear rack is at z=90, in front of the pivots. So the front and rear wheels turn opposite ways, which gives a tight turn. Step 6 (p.4) shows the same layout. Settled by step 6 and the model geometry, not by any arrow. Confidence: medium-high.
- fn 3: is the small steering wheel connected? → No. Step 15 (p.11) fits it on a short axle in the front frame with no gear. Confidence: medium.
### Video leads
- fn 1 (direction of the rear steering): Brickipedia says only that the steering turns both the front and the back pair of wheels. It gives no direction. https://en.brickimedia.org/wiki/8830_Rally_6-wheeler. No video was found. video lead: Erik to look, confidence low.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| source | 3 | "inferred: ... unsure whether it is meant to turn" | Step 15 shows no gear on the steering wheel's axle. It can stay "for show". | p.11 | medium |
| video | 1 | the rear wheels steer opposite to the front | no arrow for the direction; the geometry supports the list | p.1, p.4-5 | medium-high |

## 8840 Rally Shock n' Roll Racer
Booklets: omr/instructions/8840-1/001-019.jpg, one booklet of 19 scans. Main model p.1-9 (steps 1-16). p.10-16 are the alternative model (a van). p.17-19 are the 8840+8720 motor add-on. Functions page: none. The only motion arrow is a red push arrow at step 9 (p.6): axle 10 is pushed into the rear frame. Pages read: 7 closely + 1 contact sheet. Time: about 8 min.
### Functions page (blind reading)
No functions page. These come from the cover and the build steps:
1. Steering wheel in front of the seat → front wheels steer. Step 6 shows the column with its wheel and a gear. Step 9 shows the rack on the tie-rod plate.
2. The rear wheels drive the 2-cylinder engine behind the seat. Step 8 shows a rear axle with a gear and a shaft. Step 9 shows the engine and its gear.
3. Rear suspension. The rear frame with the engine pivots on axle 10 (step 9, red arrow). Step 15 adds two shock absorbers. The cover shows the black springs at the rear.
4. The wheels roll freely when the buggy is pushed.
### Comparison
- fn 1 "steering wheel steers front wheels via gear and rack": AGREES.
- fn 2 "left rear wheel runs the V2 engine": AGREES that the rear wheels drive the engine. That only the left wheel drives it is inferred (see below).
- fn 3 "rear frame swings on the cross axle, held by two shocks": AGREES.
- fn 4 "springs hold the rear frame down" (skip): AGREES (step 15).
- fn 5 "wheels roll freely, right rear wheel free of the engine": AGREES. The right half-shaft is inferred (see below).
- fn 6 "roll cage and wing rigid": NOT ON PAGE (steps 12-15). A structural item.
- Missing from list: none.
### Doubts settled
- fn 2 and fn 5: are the rear wheels on separate half-shafts, so that only the left wheel drives the engine? → Step 8.2 (p.5, zoomed) shows an 8-long axle from one side and a separate 3-long axle from the other side, meeting at the gears. This fits the list. The scan is too small to see which axle carries which gear. Confidence: medium.
### Video leads
- fn 2 and fn 5: Technicopedia calls the rear "a swing arm ... with a live rear axle (not independent)", with the V2 between the rear wheels. "Live axle" may mean only that the axle rides on the arm. It does not settle whether the two rear wheels are joined. The booklet's two axles stand. https://technicopedia.com/8840.html. No video was found. video lead: Erik to look, confidence low.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| video | 2, 5 | the right rear half-shaft is separate and free of the engine | step 8.2 shows two axles (8 and 3 long); a review says "live rear axle" | p.5 | medium |

## 8850 Rally Support Truck
Booklets: omr/instructions/8850-1/001-032.jpg, one booklet of 32 scans. Main model p.1-17: steps 1-22, with the engine built on p.12-14 (sub-steps 1-7). p.18-30 are the alternative model (a tractor unit). p.31-32 are the 8850+8720 motor add-on. Functions page: none, and no motion arrows other than the sliding arrows in the step 15 inset (p.8). Pages read: 11 closely + 1 contact sheet. Time: about 12 min.
### Functions page (blind reading)
No functions page. These come from the cover and the build steps:
1. Yellow beacon on the roof → front wheels steer. Step 14 shows a tall upright shaft (12 long) with a 24 tooth gear at its foot. Step 11 shows a shaft with a crown gear and an 8 tooth gear. The rack is at the front (steps 8-9). Step 22 puts the beacon on top of the shaft.
2. The rear wheels drive a differential (sub-step 4, p.4). From it the drive goes through 24 tooth gears and a long shaft to the front, where it turns the V6 engine (engine p.12-14, dropped in at step 19).
3. An axle at the back of the chassis turns from the drive train (sub-steps 5-7). This is my reading of the gears. The booklet does not say what the axle is for.
4. Front bar. It is an axle in two grey holders on short yellow liftarms at the bumper (steps 12 and 15). The step 15 inset has arrows that only slide the bushes and holders onto the axle. The booklet shows no movement of the bar.
5. Pulley wheel on the back of the engine, on an axle pin in a plate (engine sub-steps 6-7).
6. The wheels roll freely.
### Comparison
- fn 1 "beacon steers front wheels": AGREES.
- fn 2 "rear differential": AGREES.
- fn 3 "V6 runs as the truck rolls": AGREES. My blind reading had the engine driven from the front of the long shaft, as the list says.
- fn 4 "rear power-take-off axle": AGREES that the axle turns. What it is for is inferred.
- fn 5 "front wheels roll freely": AGREES.
- fn 6 "front bar swings and turns": NOT ON PAGE (inferred). See below.
- fn 7 "engine pulley turns freely": AGREES with engine sub-step 6.3 (an axle pin in a plate with a pin hole). It is not shown turning.
- fn 8 "cab and roll cage rigid": NOT ON PAGE (steps 15-21 and the cover). A structural item.
- Missing from list: none.
### Doubts settled
- fn 7: does the pulley turn freely? → Sub-step 6.3 (p.14) puts an axle pin in a 2x2 plate with a pin hole, and sub-step 7 puts the pulley on that pin. It is not on the crankshaft, so it turns freely, but only for show. Confidence: medium.
- fn 6: is the front bar meant to swing or turn? → Not settled. Step 12.2 (p.7) fits each short liftarm on a 2-long axle in a beam hole, with a bush. That allows the liftarm to swing. Step 15 (p.8) slides holders and bushes onto the 12-long bar. Nothing shows motion. Confidence: low.
### Video leads
- fn 6: The search found only short Brickset user reviews ("a small, but cool jeep"; the round pistons). None describes the front bar. https://brickset.com/reviews/set-8850-1. No video was found. video lead: Erik to look, confidence low.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| video | 6 | the front bar swings on the liftarms' pins and turns in its holders | steps 12 and 15 build it with no motion arrows | p.7-8 | low |
| source | 7 | "inferred: engine step 7 fits it on an axle pin" | sub-step 6.3 shows the axle pin in a plate's pin hole, then the pulley on it | p.14 | medium |

## 8054 Universal Motor Set
Booklets: omr/instructions/8054-1/001-024.jpg, one booklet of 24 scans. p.2-3 explain the motor and battery box. p.4-5 build the buggy (model A, steps 1-9; the cover's small inset). p.6-11 build the crane (the cover's main picture). p.12-16 build a vehicle with a cab. p.17-23 build the helicopter. p.24 is the back cover. Functions page: none. Motion arrows: the step 7 inset on p.9 (red arrows sliding the crane's gear shafts, a selector) and the red belt arc on p.11. Pages read: 9 closely + 1 contact sheet. Time: about 8 min.

The model file (`curated.model` = models/8054-Universal Motor Set.mpd) builds the buggy, model A, not the cover's main crane. I did my blind reading on the crane before I opened the JSON. I read the buggy pages (p.4-5) only after I had seen the list. So the buggy reading is not fully blind. I ran no part tools for 8054, so the correction about `curated.model` does not change anything here.
### Functions page (blind reading)
Crane, p.6-11 (not in the model file):
1. Motor → rubber band (red arc, step 12) → gearbox. Pushing the two shafts in or out (step 7 inset, red arrows) selects which of two string drums turns: the hook winch, or the boom raised by a string over the grey A-frame.
2. Turning the 24 tooth gear on the front of the base slews the upper body. Steps 4-5 show a vertical shaft with a turntable gear and a horizontal shaft with a gear.
3. The four wheels roll freely.

Buggy, p.4-5 (read after the list):
1. Motor at the back → rubber bands → the big belt wheel's axle → the belt wheels on the rear axle. The rear axle has twin wheels on each side. Steps 4 and 6-9; the step 8 inset shows the band on the motor's shaft.
2. The front wheels roll freely, with no steering.
### Comparison (buggy, the model file)
- fn 1 "motor drives the rear wheels through two band stages": AGREES (steps 4, 6-9).
- fn 2 "front wheels roll freely, no steering": AGREES.
- fn 3 "bands slip, so the motor can't stall" (skip): NOT ON PAGE (inferred). It is harmless as a skip.
- Missing from list: none for the buggy. The crane's functions are not in the list, because the model file is the buggy.
### Doubts settled
- fn 3: The booklet does not show slip. It stays inferred and skipped. Confidence: n/a.
- fn 1's note (the motor's shaft can't be turned in Kinebrick): this is a solver limit, not a fault in the model file or the list.
### Video leads
- None. Every listed function is settled by the booklet or is a skip, so I did not search.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| (note) | - | the model file is the buggy (model A) | the cover's main model is the crane, with a motor gearbox, a 2-drum selector and slewing; it is not modelled | p.1, p.6-11 | high |
