# Function list audit, batch 2 (30 sets), 2026-11-14

An independent second reading of LEGO's functions pages, compared with `curated.functions` in `data/sets/<set>-1.json`, for the 30 newest sets with LEGO PDFs: 42116, 42120, 42121, 42122, 42123, 42124, 42125, 42129, 42101, 42102, 42105, 42106, 42108, 42111, 42115, 42088, 42092, 42093, 42094, 42095, 42096, 42099, 42110, 42071, 42072, 42073, 42074, 42075, 42076, 42077. No function list and nothing in the repository was changed. Method as in batch 1 (blind reading first, then the comparison, every "inferred" or doubtful function worked through), with Erik's rule added: where the booklet does not settle a function, the readers searched for reviews and recorded them as "video lead: Erik to look". A lead is never marked settled from a summary alone; where a summary and the booklet disagree, the booklet stands.

Readers: 8 agents, 3-4 sets each, at most 4 at once. One reading was not fully blind: the 42073's list was printed together with the 42072's, before the 42073's page was read (its section says so).

## Counts

| Set | Agree | Differ | Not on page | Missing |
|---|---|---|---|---|
| 42116 | 2 | 0 | 2 | 0 |
| 42120 | 3 | 0 | 2 | 0 |
| 42121 | 3 | 0 | 2 | 0 |
| 42122 | 6 | 1 | 3 | 0 |
| 42123 | 4 | 0 | 0 | 0 |
| 42124 | 2 | 0 | 6 | 0 |
| 42125 | 1 | 0 | 7 | 0 |
| 42129 | 4 | 0 | 4 | 0 |
| 42101 | 0 | 0 | 5 | 0 |
| 42102 | 4 | 0 | 0 | 0 |
| 42105 | 5 | 0 | 0 | 1 |
| 42106 | 5 | 0 | 5 | 0 |
| 42108 | 7 | 0 | 1 | 0 |
| 42111 | 5 | 1 | 4 | 0 |
| 42115 | 0 | 0 | 11 | 0 |
| 42088 | 0 | 0 | 5 | 0 |
| 42092 | 4 | 0 | 2 | 0 |
| 42093 | 0 | 0 | 4 | 0 |
| 42094 | 5 | 1 | 2 | 1 |
| 42095 | 3 | 0 | 2 | 0 |
| 42096 | 4 | 0 | 1 | 0 |
| 42099 | 4 | 0 | 5 | 0 |
| 42110 | 11 | 2 | 1 | 1 |
| 42071 | 2 | 0 | 1 | 0 |
| 42072 | 3 | 0 | 1 | 0 |
| 42073 | 3 | 0 | 1 | 0 |
| 42074 | 2 | 0 | 2 | 0 (1 possible) |
| 42075 | 5 | 0 | 3 | 0 |
| 42076 | 7 | 1 | 1 | 0 |
| 42077 | 4 | 1 | 2 | 0 |
| **All 30** | **108** | **7** | **85** | **3** |

No functions page: 42101, 42088, 42093 (build steps used) and 42115 (chapter pages only). App pages instead of lever arrows: 42124, 42129, 42099, 42095 (partly). B-model booklets were left out (42071-1-2, 42074-1-2, 42075-1-1, 42079-1-2).

## Model file checks the orchestrator asked for, sets from batch 1 and 2

| Set | Fn | The question | The booklet shows | Page | Confidence |
|---|---|---|---|---|---|
| 8258 | 2 | In the front outriggers' drive (submodel m-1k'ka), a 16-tooth gear 4019 on an axle pin 3749 sits 4 LDU off its beam's hole. | Book 2, step 78 sub-step 21: one axle pin and one gear go into a hole of the grey frame, meshing the gear already there. In the file the two 16-tooth gears are 36 LDU apart; a mesh and the beam's holes both need 40. Move m-1k'ka 4 LDU (from y -24 to -20 in m-1k'k). | 8258-1-5.pdf (book 2) p.42 | High (the file), medium (the step's picture is small) |
| 9396 | — | One rim 42610 sits on nothing. | It is the left main wheel, p1200 at x -180. The right main gear has two wheels (rims p1224 at x 140 and p1198 at x 180) on one tan long pin 32556 (p1197), as the nose wheels share one (p34). The left side has only the outer rim and no pin. The parts list has 6 small tyres (4617848); the file has 5 (51011). So the file lacks the left inner wheel (rim 42610 + tyre 51011 at x -140) and its tan long pin 32556 at x -160, mirroring p1224, p1225 and p1197. | 9396-1-2.pdf (book 3) p.59, parts list | Medium-high |
| 42094 | 2 | The cab sits on its turntable with its holes 14.14 LDU off two half pins 4274, as if turned. | Step 138: the finished cab goes onto the top of the big turntable at the body's rear, square to the body, with two pins under the cab going into the two black pin-holed parts on the turntable's top. The cab is fixed to the turntable top and slews with it. So the cab (or the turntable top) is drawn turned against the other; turn one so the pins meet the holes. | 42094-1-1.pdf p.78 | Medium |
| 42084 | 2 | A panel group (42084_20/_21) one hole off. | Asked of the batch 3 reader of 42084; in batch 3's report. | — | — |

## Proposed changes for Erik


### Changes to what a function is or which part works it

| Set | Fn | The list says | The booklet shows | Page | Confidence |
|---|---|---|---|---|---|
| 42102 Mini CLAAS XERION | 3 | pivot unclear; may tip sideways | the rake unit hangs on the rear axle (step 50) and lifts about it; drop "may tip sideways" from the note | p.47, p.52 inset | medium |
| 42105 Catamaran | new | (none) | a second sail crank: deck2's arm p31 33299b with grip p32, mirror of p54; each crank works one sail | p.96 shows one; deck2 in model | low (book), medium (review) |
| 42105 Catamaran | 1 | grip may be p8/p10 joiners | the arm p57 33299b with grip p58 on the gear's axle is the likely second grip; crossbar likely slides sideways | p.96 inset | low |
| 42111 Dom's Dodge Charger | 10 | "the red lever ... pushing it" | a light grey lever (p328 is grey) beside the red fire extinguisher | p.229 bottom | medium |
| 42115 Lamborghini Sián FKP 37 | 7 | control p2652 (the wing's pivot) | a floor-pivoted lever with a curved arrow (step 462); reviews say a passenger-footwell foot lever | b1 p.299 | medium |
| 42092 Rescue Helicopter | 4 | winch arm swings out on a pin | no arrow on the arm; the drum's axle (with the tan gear in mesh) goes through the arm, so swinging it would unmesh the winch | p.72-73 (steps 116-117), p.80 | low-medium |
| 42094 Tracked Loader | 5 | control is the black 12 tooth gear on the grab (p1064) | control is the small yellow lever with the red pin at the arm root (step 178), moved fore and aft; it swings the upper clamp | p.136 top right, p.107 | medium |
| 42094 Tracked Loader | new | (none) | a red part under the rear, pushed up (small arrow); probably a winch latch or brake | p.136 bottom right, p.44 (step 78) | low |
| 42110 Land Rover Defender | 8 | hook out, knob front right winds in | also a red ball-ended lever, front left (p978 6628 on its lever, step 314), worked before pulling the hook out: likely the winch lock | p.491, p.193 | medium |
| 42110 Land Rover Defender | 15 | the roof, with its rack, lifts off | only the roof rack (with roof box, side case, ladder) lifts off; the white roof stays | p.491 | high |
| 42110 Land Rover Defender | 5 | lever tips sideways | a round knob on the rod p385, rocked left/right; + left, − right | p.490 | high (part), medium (direction) |
| 42076 Hovercraft | 4 | the knob raises and lowers the white bridge; moves rack p697 and cab axle p726 | the knob moves the rack (crane arm with hook foot) up and down; the cab stays at height; take p726 out of moves (and put it in stays) | 42076-1-1 p.150 top left and middle | low-medium |
| 42077 Rally Car | 5 | the bonnet lifts at its back edge, hinged at the front | it lifts at its front edge, hinged at the windscreen end; it is two halves, each lifting alone | 42077-1-1 p.180 bottom left; steps 193-195 p.120-121 | medium-high |
| 42077 Rally Car | 5 | control p813 18944 (a fixed front panel in car.ldr) | the control must be a part of a bonnet half (hood1.ldr or hood2.ldr); consider one function per half | p.180; car.ldr | medium |

### Lever and knob directions

| Set | Fn | The list says | The booklet shows | Page | Confidence |
|---|---|---|---|---|---|
| 42108 Mobile Crane | 5 | no direction | knob clockwise (seen from the left side) raises the boom | p.267 middle | high |
| 42108 Mobile Crane | 6 | no direction | knob anticlockwise (seen from the left side) lowers the hook | p.267 left | high |
| 42108 Mobile Crane | 7 | no direction | knob anticlockwise (seen from the right side) extends the boom | p.267 right | high |
| 42111 Dom's Dodge Charger | 10 | push | pull toward the rear of the car | p.229 bottom | medium |
| 42110 Land Rover Defender | 6 | no direction | D forward, N middle, R back | p.490 | medium |
| 42110 Land Rover Defender | 7 | no direction | LO forward, HI back | p.490 | medium |

### Model file findings

| Set | Fn | The list says | The booklet shows | Page | Confidence |
|---|---|---|---|---|---|
| 42093 Chevrolet Corvette ZR1 | 1 | (skip: 12 tooth gear in the model where the set has 8 tooth) | step 2 confirms the 8 tooth gear; already in docs/ldraw-errata.md, not corrected | p.4 | high |
| 42077 Rally Car | 5 | the halves pivot near the front bumper (car-local z about 496) | pivot at the rear end, by the windscreen | steps 193-195 p.120-121 | low-medium |

### Video leads for Erik ("video lead: Erik to look"; never settled from a summary alone)

| Set | Fn | The list says | The booklet shows | Page | Confidence |
|---|---|---|---|---|---|
| 42116 Skid Steer Loader | (new?) | nothing | arrow over the cage's front roof frame with the lights, back to front, no control drawn | p.64 main picture | low |
| 42120 Rescue Hovercraft | 5 | small front fan spins freely (inferred) | not shown turning; not driven (step 168) | p.117, p.120 | low |
| 42122 Jeep Wrangler | 7 | doors swing open | not shown on the functions page | p.118 | medium |
| 42122 Jeep Wrangler | 8 | backrest folds forward (inferred) | not shown on p.118 or steps 132-138 | p.72-73, p.118 | low |
| 42124 Off-Road Buggy | 6 | rear unit swings (inferred) | not shown moving in the book; reviews say rear suspension exists | — | medium |
| 42129 4x4 Mercedes-Benz Zetros Trial Truck | 4 | lock reaches centre and rear "from the parts" | page shows a diff-lock icon only; reviews say centre + rear, no front | p.372 | medium |
| 42105 Catamaran | 4, new | one crank swings the sails | review says two cranks, front sail and rear sail | brickset 47920 | medium |
| 42105 Catamaran | 1 | slides or swings unknown | arrow arcs over the crossbar end to end | p.96 | low |
| 42106 Stunt Show Truck & Bike | 10 | doors swing | no review mentions doors | brickset 48580 | low |
| 42108 Mobile Crane | 1 | rear axles opposite, inferred | not shown either way | p.32, p.266 | medium |
| 42111 Dom's Dodge Charger | 6 | rear axle sprung, inferred | not drawn | none | medium |
| 42115 Lamborghini Sián FKP 37 | 7 | control inferred | foot lever in the passenger footwell (reviews) | b1 p.299 | medium |
| 42115 Lamborghini Sián FKP 37 | 3 | drive / neutral (or reverse), inferred | not shown; reviews say drive, neutral, reverse | none | medium |
| 42115 Lamborghini Sián FKP 37 | 2 | which paddle shifts up, inferred | not shown | none | low |
| 42115 Lamborghini Sián FKP 37 | 10 | engine cover opens, inferred | not shown; product text says the rear hood opens | none | medium |
| 42115 Lamborghini Sián FKP 37 | 11 | seats tilt, unsure | not shown | none | low |
| 42088 Cherry Picker | 2 | turntable turns, inferred | no arrow; review summary says it turns 360 degrees | brickfanatics review | medium |
| 42092 Rescue Helicopter | 4 / new | arm swings; two doors | reviews say four opening doors and moveable cockpit controls | brickfanatics review | low |
| 42094 Tracked Loader | 4, new | free middle position; red latch | not shown in the book | reviews listed above | low |
| 42095 Remote-Controlled Stunt Racer | 5 | tail wheels roll freely (inferred) | wheels on a blue arm at the back, no arrow; reviews call it the wheelie bar | p.63 | medium |
| 42099 4x4 X-treme Off-Roader | 7 | front half twists against rear half (inferred, unsure) | two turntables on one lengthwise line (steps 105, 202); shock tops attached later; not settled | p.59, 61, 125 | low |
| 42110 Land Rover Defender | 4 | three differentials | not on page; reviews say 3 differentials | — | medium |
| 42074 Racing Yacht | new | (no tiller function) | the rudder inset's arrow is drawn round the tiller; LEGO text says "wheel and tiller steering" | 42074-1-1 p.81 | low |
| 42075 First Responder | 8 | seats tip forward (inferred) | an unexplained curved arrow beside the seat in the bonnet inset | 42075-1-2 p.112 | low |
| 42076 Hovercraft | 4 | as above | as above | p.150 | low-medium |
| 42076 Hovercraft | 9 | deck fan rotors spin (inferred) | no arrow on them | p.151 | low |
| 42077 Rally Car | 2, 3 | rear-wheel drive to V6, front free | engine shown, no drive arrow | p.181 | medium |

### Source wording only

| Set | Fn | The list says | The booklet shows | Page | Confidence |
|---|---|---|---|---|---|
| 42121 Heavy Duty Excavator | 1, 2, 3 | "page 48 ..., back cover" | the functions page is p.115 (PDF), with three insets; I did not check p.48 | p.115 | high |
| 42122 Jeep Wrangler | 7 | "page 118 (middle inset, a door open)" | the door in the middle inset is closed; doors rest on steps 171-176 only | p.118 | high |
| 42124 Off-Road Buggy | 6 | "steps 99-104 ... add the two long shock absorbers above it" | steps 99 and 101 give the pivot; steps 103-104 add two rigid struts (6L axle + connectors), not shocks; the soft shocks (41838) come in another step | p.56, 57, 59, 60 | medium |
| 42124 Off-Road Buggy | 7 | "steps 103-104 (the soft shock absorbers)" | steps 103-104 are rigid struts; cite the step that fits the 41838 shocks | p.59-60 | medium |
| 42125 Ferrari 488 GTE AF CORSE #51 | 6 | "inferred: ... it isn't clear whether the arms are meant to swing"; note "Unsure" | book: step 9 (joints in rear half-shafts), step 10 (two yellow shock absorbers at the rear), step 18 (links); remove "unsure" | p.17, p.23 | high |
| 42129 4x4 Mercedes-Benz Zetros Trial Truck | 8 | "inferred: ... nothing below it" | model truck.ldr step 76: wheel on a 2L axle in an angled connector; cite that step | — | high |
| 42101 Buggy | 5 | "steps 5 and 25 show it on a half pin" | the steering wheel is added in step 26 | 42101-1-1 p.32 | high |
| 42106 Stunt Show Truck & Bike | 4 | "the book doesn't show how the gear drives them" | step 12 (crank on the gear's axle) and step 15 (red link pinned to the blue legs) | p.21, p.23 | high |
| 42106 Stunt Show Truck & Bike | 10 | "pinned to the cab on one line" | upright axle hinge with half bushes (step 112), clips on a pin (step 113) | p.105 | medium |
| 42108 Mobile Crane | 8 | "inferred: which lever locks which drive" | left lock (p1216) with the winch panel, right lock (p1220) with the extension panel | p.267 | medium-high |
| 42111 Dom's Dodge Charger | 2 | "page 228 bottom-left inset (arrow at the rear wheel)" | that arrow is at the front wheel and shows steering | p.228 | high |
| 42088 Cherry Picker | 2 | "a single upright pin" | an upright grey 5L axle in a round hole | p.20 (step 21) | high |
| 42092 Rescue Helicopter | 3 | "inferred: from the parts" | steps 103 and 105 put a 12 tooth gear on each end of the cross axle | p.65, p.67 | medium |
| 42093 Chevrolet Corvette ZR1 | 4 | "unsure whether LEGO meant it to be linked" | nothing behind the wheel's pin; for show | p.72 | high |
| 42094 Tracked Loader | 2 | "which knob does which is inferred" | p.137 inset and p.136 show it | p.136-137 | high |
| 42094 Tracked Loader | 4 | two speeds inferred | tortoise and hare stickers by the lever | p.137 | medium |
| 42094 Tracked Loader | 6 | "inferred: page 136" | hinge on red axle pin at top of cab; page arrow; reviews call them doors | p.76, p.136 | medium |
| 42096 Porsche 911 RSR | 4 | "book: page 290; ... front axle steps" | p.290 shows the front springs but no arrow; the function rests on the build steps | p.290 | high |
| 42099 4x4 X-treme Off-Roader | 9 | inferred: step 302 | step 302 shows the wheel on a short axle in the separate body module | p.186 | high |
| 42110 Land Rover Defender | 4 | "three differentials drawn" | no differential labelled on p.490 | p.490 | high |
| 42075 First Responder | 2 | source cites p.113 top-left arrow on the front wheel | that arrow is the steering's; the engine drive is in the build steps only | 42075-1-2 p.113 | high |
| 42076 Hovercraft | 4 | note: which gear drives the rack is unsure | both gears drive it (8 tooth to 8 tooth) | crane.ldr; steps 212-215 p.133-134 | medium |
| 42077 Rally Car | 1 | steering steps inferred | the page settles it | p.180-181 | high |

---

# The sets

## 42116 Skid Steer Loader
Booklets: one, omr/instructions/42116-1-1.pdf, 68 pp (main model; the B model's booklet is not in the folder). Functions pages: 42116-1-1.pdf p.64. Pages read: 3 closely + 3 contact sheets. Time: about 6 minutes.
### Functions page (blind reading)
1. Lower-left inset: turning the black gear on top of the cage (circular arrow) → the loader arm (white beams) rises, arrow up.
2. Lower-right inset: turning the black gear at the right rear (circular arrow) → the bucket tips down, arrow down.
3. Main picture: an arrow over the front of the cage roof, where the black frame with the two lights is, curving from back to front. No control is drawn. I read it as the black arm frame swinging as the arm works (the same motion as 1); it may also mean the cage tips forward. Not sure.
### Comparison
- fn 1 "top gear raises and lowers the loader arm": AGREES (inset, gear on top of cage).
- fn 2 "right rear gear tilts the bucket": AGREES (inset, rear gear, bucket tips).
- fn 3 "four wheels roll freely": NOT ON PAGE (book steps 59-60). No steering on the page.
- fn 4 "worm holds the arm" (skip): NOT ON PAGE (inferred).
- Missing from list: none for sure. The main picture's arrow (item 3) is not explained by the list; most likely it is fn 1 seen from another view.
### Doubts settled
- fn 4: worm self-locking is inferred → the worm is in the build (step 16, p.16, per the list's source); that a worm cannot be back-driven is a property of the gear, not something the book shows. Leave as skip. Confidence medium.
- Main picture's top arrow: not settled from the page alone. Confidence low that it is a separate function.
### Video leads
- Main picture's top arrow (cage or arm): search summary (Brickset, Brick Fanatics) says only "a bucket that lifts and tips" and one summary line claims "a working steering system"; the booklet shows no steering, and skid steers steer by wheel speed, so the booklet stands. https://brickset.com/article/56689/review-42116-skid-steer-loader , https://www.brickfanatics.com/?p=93596 — video lead: Erik to look (does the cage tip forward?), confidence low.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| video | (new?) | nothing | arrow over the cage's front roof frame with the lights, back to front, no control drawn | p.64 main picture | low |

## 42120 Rescue Hovercraft
Booklets: one, omr/instructions/42120-1-1.pdf, 124 pp (bags 1-3 shown on p.4; the B model aircraft's booklet is not in the folder). Functions pages: 42120-1-1.pdf p.120. Pages read: 2 closely + 2 contact sheets. Time: about 5 minutes.
### Functions page (blind reading)
1. Main picture: the hovercraft pushed along the ground (arrows on the ground, forward) → both rear fans spin (circular arrows on both).
2. Main picture: a circular arrow round the post with the two blue lights in the middle of the deck → the beacon spins (no control drawn; it goes with the pushing).
3. Inset (top view): turning the black gear knob near the beacon (circular arrow) → both rear fan housings swivel left and right together.
### Comparison
- fn 1 "pushing spins the two big fans": AGREES.
- fn 2 "pushing spins the beacon": AGREES (circular arrow round the blue lights).
- fn 3 "knob steers fans and front wheels": AGREES for the fans and the knob; the front wheels and handlebars are NOT ON PAGE (book steps 43-52, 169).
- fn 4 "front wheels roll freely": NOT ON PAGE (book steps 45-46).
- fn 5 "small front fan spins freely": NOT ON PAGE (inferred).
- Missing from list: none.
### Doubts settled
- fn 5: the small fan (46667) is put into a hub (60208) at step 168, p.117, with nothing under it to drive it; the page shows no arrow on it, and the functions page does not show it turning. That it is not driven: confidence high. That it turns freely rather than being held: not settled, confidence medium (it sits on a pin in the hub).
### Video leads
- fn 5: one search; summaries (Brickset, Brick Fanatics, Eurobricks) say nothing about the small fan. https://brickset.com/article/58008/review-42120-rescue-hovercraft , https://www.eurobricks.com/forum/forums/topic/183392-42120-rescue-hovercraft-video-review — video lead: Erik to look, confidence low (minor).
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| video | 5 | small front fan spins freely (inferred) | not shown turning; not driven (step 168) | p.117, p.120 | low |

## 42121 Heavy Duty Excavator
Booklets: one, omr/instructions/42121-1-1.pdf, 120 pp (bags 1-4 on p.4-5; B model booklet not in the folder). Functions pages: 42121-1-1.pdf p.115. Pages read: 2 closely + 2 contact sheets. Time: about 6 minutes.
### Functions page (blind reading)
1. Top inset (top view, "360°"): the superstructure turns all the way round; no control drawn (by hand).
2. Middle inset: turning the black gear knob on the side of the superstructure (side seen, cab hidden on the far side) → the stick swings out and up (the ghost shows the stick hanging down from the same boom tip). At 2000 px I first read this as the boom; at 3400 px the boom is the same in both and only the stick moves.
3. Bottom inset: turning the black gear knob at the back of the superstructure → the boom rises (the ghost shows the whole arm lower, stick angle the same).
4. Main picture: no arrows. No bucket function and no drive to the tracks shown.
### Comparison
- fn 1 "rear knob raises and lowers the boom": AGREES (bottom inset).
- fn 2 "side knob, opposite the cab, moves the stick": AGREES (middle inset; the cab is on the far side).
- fn 3 "superstructure slews by hand": AGREES (top inset, 360°). Source says "back cover"; it is p.115, the functions page, not the back cover.
- fn 4 "tracks roll freely": NOT ON PAGE (book steps 94-104).
- fn 5 "bucket fixed; cylinder for show": NOT ON PAGE (book steps 27-30); consistent with the page, which shows no bucket function.
- Missing from list: none.
### Doubts settled
- fn 2 note (raising the boom may move the stick a little): a model behaviour, not a booklet question; not settled by the page. No action.
### Video leads
- none (all functions settled by the booklet).
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| source | 1, 2, 3 | "page 48 ..., back cover" | the functions page is p.115 (PDF), with three insets; I did not check p.48 | p.115 | high |

## 42122 Jeep Wrangler
Booklets: one, omr/instructions/42122-1-1.pdf, 124 pp (bags 1-2 on p.4). Functions pages: 42122-1-1.pdf p.118 (p.119 is the model beside the real Jeep, no arrows; p.120 is an advert). Pages read: 1 closely (cropped 4 ways) + 4 contact sheets. Time: about 8 minutes.
### Functions page (blind reading)
1. Main picture: turning the gear on the front bumper (circular arrow) → the winch reels the string with the hook (hook drawn large beside it).
2. Top inset: turning the black gear knob at the back, on top between the roll bars (circular arrow) → the front wheels steer (arrow at the front wheel).
3. Middle inset: the bonnet open, hinged at the windscreen, engine showing. By hand.
4. Bottom inset: the model on a wireframe of rough ground, axles articulated → suspension / axles swing. No control.
### Comparison
- fn 1 "rear knob steers": AGREES.
- fn 2 "front axle pendular": AGREES (bottom inset; which axle swings is not clear from the picture).
- fn 3 "rear axle pendular, shocks telescope": AGREES for the articulation (bottom inset); the shocks telescoping is inferred, as the source says.
- fn 4 "springs push the rear axle back" (skip): NOT ON PAGE (inferred).
- fn 5 "front gear winds the winch": AGREES.
- fn 6 "bonnet opens": AGREES.
- fn 7 "two doors swing open": DIFFERS in source: the list says the middle inset shows "a door open"; the near door in that inset is closed (cropped at 3000 px). Doors are NOT ON PAGE; rests on book steps 171-176.
- fn 8 "rear backrest folds forward": NOT ON PAGE (inferred). Steps 132-138 (p.72-73) show no folding arrow.
- fn 9 "wheels roll freely": NOT ON PAGE as a function (book steps).
- Missing from list: none.
### Doubts settled
- fn 3: shocks telescope (inferred from parts) → the page shows the axle articulating but no shock detail; the parts (4254/4255 with springs) make it plausible. Confidence medium, not settled by the book.
- fn 7: doors open → not on the page; search summaries (owner comments) say the hood and doors open. Lead only. Confidence medium that they open.
- fn 8: backrest folds → not shown in steps 132-138 nor on p.118. Not settled. Confidence low.
### Video leads
- fn 7 and fn 8: one search. Summaries say "the hood and doors open" (owner comments) and the winch is worked by "the cog on the right"; none mentions a folding rear seat. https://www.brickfanatics.com/lego-technic-42122-jeep-wrangler-review , https://www.newelementary.com/2020/12/lego-technic-review-42122-jeep-wrangler.html , https://www.eurobricks.com/forum/forums/topic/181760-review-42122-technic-jeep-wrangler — video lead: Erik to look (doors: confidence medium; backrest: confidence low).
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| source | 7 | "page 118 (middle inset, a door open)" | the door in the middle inset is closed; doors rest on steps 171-176 only | p.118 | high |
| video | 7 | doors swing open | not shown on the functions page | p.118 | medium |
| video | 8 | backrest folds forward (inferred) | not shown on p.118 or steps 132-138 | p.72-73, p.118 | low |

## 42123 McLaren Senna GTR
Booklets: one, 42123-1-1.pdf, 148 pp (no B model). Functions pages: 42123-1-1.pdf p.144 (photo page: main picture and three insets with arrows; no other functions page; front p.1-12 checked). Pages read: 2 closely (p.144 at 1400 and a crop at 3000) + 28 as contact sheets. Time: about 5 minutes.
### Functions page (blind reading)
1. Gear on top of the roof turned by hand (turning arrow) → front wheels steer (curved arrow at the front wheel). Right inset.
2. Pistons of the engine behind the cab move up and down (up/down arrow). Middle inset. What drives them is not shown.
3. Both doors open upward (dihedral). Main picture and left inset, no arrow.
### Comparison
- fn 1 "roof gear steers the front wheels": AGREES.
- fn 2 "rolling the car turns the V8": AGREES (page shows the pistons moving; that the right rear wheel drives them is from steps 1-35 and the parts).
- fn 3 "doors swing up and forward": AGREES.
- fn 4 "front wheels and left rear wheel roll freely": NOT ON PAGE (book step 219-220; implied by the photo of the car rolling).
- Missing from list: none.
### Doubts settled
- None flagged (no "inferred" or "unsure"). fn 1's note (model file leaves out step 220's roof gear) is a known model gap, not checked again.
### Video leads
- None needed.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| (none) | | | | | |

## 42124 Off-Road Buggy
Booklets: one, 42124-1-1.pdf, 88 pp. Functions pages: 42124-1-1.pdf p.79 (CONTROL+ app page; p.77-78 are app set-up pages). Pages read: 5 closely (p.56, 57, 60, 62, 79) + 42 as contact sheets. Time: about 12 minutes.
### Functions page (blind reading)
1. App (main control) → buggy drives forward and back (straight arrows at the wheels, left inset).
2. App → front wheels steer (curved arrows, left inset).
3. Main picture shows the suspension (yellow front shocks) but no arrow; right inset shows the buggy on rough ground (app challenge), no arrow.
### Comparison
- fn 1 "front motor steers the front wheels": AGREES (app control on the page; motor from steps 1-17).
- fn 2 "rear motor drives the rear wheels through the differential": AGREES.
- fn 3 "differential": NOT ON PAGE (book steps 67-69, p.55 inset).
- fn 4 "front independent suspension": NOT ON PAGE (book steps 18-38; visible in the photo, no arrow).
- fn 5 "front springs" (skip): NOT ON PAGE (book step 33).
- fn 6 "rear unit swings on a pivot, two soft shocks": NOT ON PAGE (inferred).
- fn 7 "rear springs" (skip): NOT ON PAGE (inferred).
- fn 8 "front wheels roll freely": NOT ON PAGE (book step 127).
- Missing from list: none.
### Doubts settled
- fn 6 (inferred: does the rear unit swing?): Yes, very likely. Step 99 (p.56) puts two 4L axles out of the front of the rear unit as its pivot; step 101 (p.57) hangs the rear unit on the chassis there. The model file has exactly two soft shock absorbers (41838, "Shock Absorber 6.5L Soft"): one in buggy.ldr at the rear (60,-171,295) and one in roofrear.ldr, as the list says. But the source wording is wrong: steps 103-104 (p.59-60) add two rigid struts (6L axle, axle connector, blue pin, angled connector) from the roll cage, not shock absorbers. I did not find the step that fits the soft shocks. Confidence medium. Reviews (search below) confirm the buggy has rear suspension.
- fn 7 (inferred: rear springs): the two soft shock absorbers exist in the model (41838). Confidence medium; same source wording problem as fn 6.
### Video leads
- fn 6/7: reviews say the buggy has front and rear suspension; one Eurobricks reviewer says the rear works less well than the front. https://www.eurobricks.com/forum/forums/topic/181979-review-42124-off-road-buggy-control-segment-coming-later , https://ttpm.com/?p=15963 , https://en.hothbricks.com/quickly-test-lego-technic-42124-off-road-buggy/ (no video times). video lead: Erik to look, confidence medium (only to see the rear unit swing).
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| source | 6 | "steps 99-104 ... add the two long shock absorbers above it" | steps 99 and 101 give the pivot; steps 103-104 add two rigid struts (6L axle + connectors), not shocks; the soft shocks (41838) come in another step | p.56, 57, 59, 60 | medium |
| source | 7 | "steps 103-104 (the soft shock absorbers)" | steps 103-104 are rigid struts; cite the step that fits the 41838 shocks | p.59-60 | medium |
| video | 6 | rear unit swings (inferred) | not shown moving in the book; reviews say rear suspension exists | — | medium |

## 42125 Ferrari 488 GTE AF CORSE #51
Booklets: one, 42125-1-1.pdf, 328 pp. Functions pages: none with arrows. p.322 is a page of four photos without arrows (open door with steering wheel and cockpit, rear three-quarter, rear wheel, engine bay with two banks of pistons); p.1-12 are photos and story, p.9-10 designer pages. Pages read: 4 closely (p.17, 23, 322, and p.9-10 as one sheet) + 58 as contact sheets. Time: about 12 minutes.
### Functions page (blind reading)
No functions page. p.322 photos (no arrows):
1. Door open upward (front-hinged).
2. Steering wheel in the cockpit.
3. Engine with two banks of pistons in the engine bay.
Build steps: step 9 (p.17) marks the rear half-shaft joints with red circles; step 10 (p.17) adds two yellow shock absorbers at the rear.
### Comparison
- fn 1 "steering wheel steers the front wheels": NOT ON PAGE (book steps 104-112, 128-132, 181; the photo shows the wheel only).
- fn 2 "rolling the car turns the V8": NOT ON PAGE (steps 1-47; photo shows the engine, no arrow).
- fn 3 "rear differential": NOT ON PAGE (steps 1-3).
- fn 4 "front independent suspension": NOT ON PAGE (steps 81-96).
- fn 5 "front springs" (skip): NOT ON PAGE.
- fn 6 "rear suspension arms with shock absorbers": NOT ON PAGE (inferred) — settled below.
- fn 7 "doors swing up and forward": AGREES with the p.322 photo (no arrow) and steps 532-562.
- fn 8 "front wheels roll freely": NOT ON PAGE (step 585).
- Missing from list: none.
### Doubts settled
- fn 6 (inferred, note "unsure whether the rear has working suspension"): Yes, the rear has working suspension. Step 10 (p.17) adds two yellow shock absorbers (6.5L extra stiff, 76537; both are in chassisrear.ldr at x = ±100) between the rear arms and the frame. Step 9 (p.17) marks with red circles the joints in the rear half-shafts, which are there so the hubs can rise and fall. Step 18 (p.23) adds yellow 5L axle links with connectors (rigid links, likely the upper links). Confidence high that springs exist; medium that the arms swing in the model as built. Reviews agree (search below). The source can become "book: steps 9-10 (rear arms and two shock absorbers), 18".
### Video leads
- fn 6: reviews describe working rear suspension (Brick Fanatics: front and rear suspension, steering, V8 with moving pistons; Robb Report: multi-link rear with shock absorbers). https://www.brickfanatics.com/?p=93448 , https://www.eurobricks.com/forum/forums/topic/181975-review-42125-technic-ferrari-488-gte-af-corse-51 , https://www.newelementary.com/2021/01/lego-technic-review-42125-ferrari-gte.html (no video times). Booklet already settles it; video lead: Erik to look only to see the travel, confidence high.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| source | 6 | "inferred: ... it isn't clear whether the arms are meant to swing"; note "Unsure" | book: step 9 (joints in rear half-shafts), step 10 (two yellow shock absorbers at the rear), step 18 (links); remove "unsure" | p.17, p.23 | high |

## 42129 4x4 Mercedes-Benz Zetros Trial Truck
Booklets: one, 42129-1-1.pdf, 384 pp. Functions pages: 42129-1-1.pdf p.372 (CONTROL+ page; p.370-371 are app set-up). Pages read: 1 closely (p.372 at 2400) + 42 as contact sheets. Time: about 10 minutes.
### Functions page (blind reading)
1. App, main control → truck drives forward and back on all four wheels ("4x4", straight arrows) and steers (curved arrows at the front wheels). Middle inset.
2. Axles articulate over rough ground (left inset, front view, wheels at different heights; no arrow).
3. App → differential lock (icon of a chassis with locked axles, right inset, truck climbing a slope).
4. App screens: "main control", "alternative control" (a gear-lever icon with left/right arrows; a control layout in the app, not a model function), "challenges & achievements".
### Comparison
- fn 1 "two L motors drive all four wheels": AGREES.
- fn 2 "centre differential": NOT ON PAGE (book steps 13, 16).
- fn 3 "axle differentials": NOT ON PAGE (axle steps).
- fn 4 "medium motor locks the differentials": AGREES (icon); which differentials it reaches is not on the page.
- fn 5 "L motor steers the front wheels": AGREES.
- fn 6 "axles sway and rise on swinging arms": AGREES (left inset).
- fn 7 "springs" (skip): NOT ON PAGE.
- fn 8 "steering wheel turns freely": NOT ON PAGE (inferred).
- Missing from list: none.
### Doubts settled
- fn 4 (note: centre and rear, or also front, "drawn from the parts"): the model has a lock catch at the centre (truck.ldr p517 35188 + p513 18947) and a second catch in the rearaxlelock submodel (p1064 35188 + p1030 18947); the front axle has no lock submodel. Reviews say the rear is locked together with the centre, and none mentions a front lock. I did not read the axle build steps. Centre and rear only: confidence medium (model + reviews); the booklet's axle steps would make it high.
- fn 8 (inferred: steering wheel not connected): settled from the model file: truck.ldr step 76 puts the wheel (2819) on a 2L notched axle (32062) in an angled connector (32034), with nothing below. Confidence high that the model has no link; the booklet step was not read.
### Video leads
- fn 4: Eurobricks review says the rear differential is locked together with the centre; New Elementary describes the medium motor and orange changeover catch at the centre; no source mentions a front lock. https://www.eurobricks.com/forum/forums/topic/186660-review-42129-4x4-mercedes-benz-zetros-trial-truck , https://www.newelementary.com/2021/10/lego-technic-review-42129-mercedes-benz-zetros.html (no video times). video lead: Erik to look, confidence medium.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| video | 4 | lock reaches centre and rear "from the parts" | page shows a diff-lock icon only; reviews say centre + rear, no front | p.372 | medium |
| source | 8 | "inferred: ... nothing below it" | model truck.ldr step 76: wheel on a 2L axle in an angled connector; cite that step | — | high |

## 42101 Buggy
Booklets: omr/instructions/42101-1-1.pdf only (cover "42101", 48 pp; the last 4 pages are adverts and the parts list). Functions pages: none. p.2 is LEGO's general "measure the axle 1:1" page, not a functions page. p.44 (step 36) is the finished model, no arrows. Pages read: 4 closely + 48 as contact sheets. Time: about 6 minutes.
### Functions page (blind reading)
No functions page, and no build step has a motion arrow (all red/green arrows are "put the part here"). What the build steps show:
1. Gear on an upright axle behind the seat (step 27, p.33) → front wheels steer (knuckles steps 19-20, tie rod step 22).
2. Shock absorber at the back (step 12, p.13) → rear suspension.
3. Four wheels roll; no drive train, no motor.
4. Small steering wheel added in step 26 (p.32), on its own, away from the steering axle.
### Comparison
- fn 1 "top gear steers front wheels": NOT ON PAGE (book steps 9, 19-22, 27); the steps agree with it.
- fn 2 "rear swing arm with shock": NOT ON PAGE (book steps 10, 12, 14, 23-24); the steps agree.
- fn 3 "shock spring pushes wheels down": NOT ON PAGE (book step 12).
- fn 4 "four wheels roll freely": NOT ON PAGE (book steps 19-20, 23-24); agrees.
- fn 5 "steering wheel spins, not joined to steering": NOT ON PAGE (inferred).
- Missing from list: none.
### Doubts settled
- fn 5: is the steering wheel joined to the steering? → No. Step 26 (p.32) puts the steering wheel 16091 on a part in front of the seat, about 57 LDU forward of the steering axle (p94 at z=47, p91 at z=-10); nothing joins them. Its source cites "steps 5 and 25"; the steering wheel goes on in step 26. Confidence medium (that it spins freely is not shown; that it is not joined is high).
### Video leads
- none needed.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| source | 5 | "steps 5 and 25 show it on a half pin" | the steering wheel is added in step 26 | 42101-1-1 p.32 | high |

## 42102 Mini CLAAS XERION
Booklets: omr/instructions/42102-1-1.pdf only (56 pp). Functions page: 42102-1-1 p.52 (the finished model with arrows and an inset, just before the adverts). Pages read: 1 closely (two crops at 3000 px) + 56 as contact sheets + 12 build pages (p.39-50) at contact-sheet size. Time: about 8 minutes.
### Functions page (blind reading)
1. Push the tractor along (big floor arrow) → the wheels roll and the two rake/mower discs at the back spin (curved arrows round the discs).
2. Front wheel: curved floor arrow round its foot → the front wheels steer. The black gear on the cab roof has no arrow.
3. Inset (top right): the black connector at the top of the rake arm tips back (arrow) and the red rake lifts up (arrow).
### Comparison
- fn 1 "roof gear steers front wheels": AGREES (the page shows the wheel's steering arrow; the roof gear as control rests on step 53).
- fn 2 "pushing spins the rake": AGREES.
- fn 3 "rake lifts": AGREES with the page; how it pivots is from build steps and the model file (below).
- fn 4 "four wheels roll freely": AGREES (shown as the push arrow).
- Missing from list: none.
### Doubts settled
- fn 3 (note "inferred: what pivots isn't clear"): the whole rake unit (submodel Substep_Step-50: gray bracket 61904, lime arm, rake) holds the 7-long rear axle p112 44294 and its tan 20T bevel gear; step 50 (p.47) shows the rear axle pushed through the bracket. The submodel is drawn tilted about 4 degrees about the sideways (x) axis. So the rake lifts by swinging about the rear axle line, and the 12T bevel gear rolls round the 20T gear as it does. The black 3-long connector p116 42003 at the arm's top is the part the inset shows tipping with it. A sideways tip about the drive shaft is not what the inset shows. Confidence medium.
### Video leads
- none needed.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| what | 3 | pivot unclear; may tip sideways | the rake unit hangs on the rear axle (step 50) and lifts about it; drop "may tip sideways" from the note | p.47, p.52 inset | medium |

## 42105 Catamaran
Booklets: omr/instructions/42105-1-1.pdf only (100 pp; main model; p.97 shows the B and C models, which have their own online booklets). Functions page: 42105-1-1 p.96. Pages read: 2 closely (p.96 at 3000 px, four crops; p.43) + 100 as contact sheets + p.4-27 and p.69-78 at contact-sheet size. Time: about 14 minutes.
### Functions page (blind reading)
1. Bottom-left inset (seen from behind): turn the black gear at the back between the hulls (arrow over the top, left to right, i.e. clockwise seen from behind); the arrow arcs over the white crossbar → both rudders turn the same way (both arrows point the same way).
2. Right insets: turn the crank handle (black arm, gray grip) on top of the lime block on a vertical axis (arrow clockwise seen from above) → the daggerboard with the lime fin goes down (down arrow). Only the one hull's crank is drawn.
3. Top-left inset and its close-up: tip a gray grip on a black arm (arrow from up-left over to down-right, about a sideways axis); a black link rod runs from it → the boom and sail swing (arrow at the boom's foot). The callout points to a grip beside the mast base, on one side of the deck.
4. Bottom-right inset: the boat floats.
### Comparison
- fn 1 "back gear steers both rudders": AGREES.
- fn 2 "right hull handle lowers daggerboard": AGREES (page 96 and step 74, p.43: yellow arrows, turn the handle, the rack goes down).
- fn 3 "left hull handle lowers daggerboard": AGREES by symmetry (step 101); page 96 draws only one crank.
- fn 4 "crank swings the sails": AGREES as to the control's type and place; which sail(s) it swings is not settled (below).
- fn 5 "boat floats": AGREES.
- Missing from list: possibly a second sail crank (see doubts). The two black steering wheels on the hulls appear on the page with no arrow; not a shown function.
### Doubts settled
- fn 1 (note "slides or swings"): the page arrow arcs over the whole crossbar from one end to the other, which reads as the bar moving sideways. The model file: the crossbar 40490 hangs on two vertical pins (2780 with round connectors at x=±40) and the black arm 33299b (p57) with grip 18654 (p58) sits on the same fore-and-aft axle as the gear. With both rudders turning the same way, the link-rod ends must move sideways, which needs a sideways shift, not a swing in a vertical plane. Not fully settled by the book. Confidence low. The p57/p58 arm with grip on the gear's axle is the more likely second grip, not the white joiners p8/p10.
- fn 4 (note "which crank works the sails"): the page's close-up shows a gray round grip on a black thin arm turning about a sideways axis, with a link rod ending in a ball. In the model the p54 33299b arm with grip p55 18654, on a sideways axle with the white levers p50/p51 6632 and link p52 43093, matches this exactly, on the side of the deck the callout points to. So p54 is the right control. Confidence medium-high. But the deck has a mirror crank on the other side: deck2 has its own 33299b p31 with grip p32 18654 and its own link pins. The list has no function for it. Whether p54 swings the jib and p31 the main sail (or the reverse) is not shown on the page. Confidence low.
### Video leads
- fn 4 and missing second crank: Brickset's review summary says two cranks control the sails, one turning the front sail and the other the rear sail, left or right; plus a gear at the back (the rudders). https://brickset.com/article/47920/review-42105-catamaran (no time). Video lead: Erik to look, confidence medium. Also https://www.eurobricks.com/forum/forums/topic/174922-review-42105-catamaran
- fn 1 (slide or swing): no review describes it. Video lead: Erik to look, confidence low.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| what | new | (none) | a second sail crank: deck2's arm p31 33299b with grip p32, mirror of p54; each crank works one sail | p.96 shows one; deck2 in model | low (book), medium (review) |
| video | 4, new | one crank swings the sails | review says two cranks, front sail and rear sail | brickset 47920 | medium |
| what | 1 | grip may be p8/p10 joiners | the arm p57 33299b with grip p58 on the gear's axle is the likely second grip; crossbar likely slides sideways | p.96 inset | low |
| video | 1 | slides or swings unknown | arrow arcs over the crossbar end to end | p.96 | low |

## 42106 Stunt Show Truck & Bike
Booklets: omr/instructions/42106-1-1.pdf only (120 pp; bike, trailer and truck in one book). Functions page: 42106-1-1 p.116. Pages read: 4 closely (p.116 at 3000 px with crops; p.21, p.23, p.105) + 120 as contact sheets + p.16-35 and p.103-110 at contact-sheet size. Time: about 12 minutes.
### Functions page (blind reading)
1. Turn the gear knob on the cab roof (arrow over its top toward the truck's back) → the front wheel steers (curved arrow at its foot).
2. Bottom-left inset: pull the bike back by hand, let go (chevrons back, arrow forward) → it runs forward (pull-back motor).
3. Middle inset: take the bike and its stand off; turn the gear on the trailer's side (curved arrow) → the blue legs at the front swing down and out (big curved arrow), the trailer stands as a ramp sloping down to its back.
4. Bottom-right inset: the bike jumps off the ramp, over the truck, through the fire ring.
### Comparison
- fn 1 "roof gear steers": AGREES.
- fn 2 "truck wheels roll freely": NOT ON PAGE (book steps 47, 100); no conflict.
- fn 3 "trailer hitch swings": NOT ON PAGE (inferred; p.115 and p.116 show it hitched, no arrow).
- fn 4 "trailer gear swings the legs down": AGREES.
- fn 5 "trailer wheels roll": NOT ON PAGE (bag 2 steps).
- fn 6 "rear wheel winds the pull-back motor": AGREES (inset 2).
- fn 7 "spring drives the bike, jump": AGREES (insets 2 and 4).
- fn 8 "bike front wheel rolls": NOT ON PAGE (step 16).
- fn 9 "removable stand": AGREES (inset 3 draws it apart).
- fn 10 "truck doors swing": NOT ON PAGE (inferred).
- Missing from list: none.
### Doubts settled
- fn 4 (note "the book doesn't show how the gear drives them"): step 12 (p.21) puts the gear on a red 6-long axle through the trailer side; on the axle sits a red 3-long arm, pinned to the red 9-long beam (p2084 40490). Step 15 (p.23, yellow arrow) swings that beam over and pins it to the blue beam. So gear → axle → red crank arm → red 9-long link → blue legs: a crank and link. The listed parts are right. Confidence high.
- fn 10 (inferred doors): the "door1/door2" submodels are the red skull pods between the front and rear wheels on p.116 (the doors' place). Step 112 (p.105) puts a half bush on an upright axle stub at one end of each pod; the model file has a vertical axle with half bushes top and bottom (18651 with 32123b at local x=-20, z=-60). Step 113 joins the pod at that axle and at a pin at the other end. This reads as a door on a vertical hinge that clips shut on the pin. The list's "pinned to the cab on one line" is right in effect; the hinge is the upright axle. Confidence medium.
- fn 3 (hitch swing): p.115 and p.116 show the trailer on one pin at the truck's back. A single pin lets it swing. Confidence medium-high; nothing in the book says otherwise.
### Video leads
- fn 10: one search found no review that names opening doors (Brick Fanatics, Brickset 48580, Eurobricks 174923). https://brickset.com/article/48580/review-42106-stunt-show-truck-bike. Video lead: Erik to look, confidence low.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| source | 4 | "the book doesn't show how the gear drives them" | step 12 (crank on the gear's axle) and step 15 (red link pinned to the blue legs) | p.21, p.23 | high |
| source | 10 | "pinned to the cab on one line" | upright axle hinge with half bushes (step 112), clips on a pin (step 113) | p.105 | medium |
| video | 10 | doors swing | no review mentions doors | brickset 48580 | low |

## 42108 Mobile Crane
Booklets: omr/instructions/42108-1-1.pdf only (one book, 272 pp). Functions pages: 42108-1-1.pdf p.266-267 (a spread just before the advert and parts list). Pages read: 5 closely (266, 267, 32, and 39-42 as one sheet) + 4 contact sheets. Time: about 12 minutes.
### Functions page (blind reading)
1. Orange beacon knobs on top of the chassis (two, both with turn arrows) → all four axles steer (p.266 top-left ghost view, arrows on every wheel). The arrows do not show if the rear axles turn the other way.
2. Black gear knobs at the back of the chassis, one each side → the rear outriggers swing out and down onto their feet (p.266 top-middle inset). The main photo shows the front outriggers down too; their control is not drawn.
3. Superstructure turns 360° (p.266 bottom-left inset). No knob drawn.
4. Left side of the superstructure, rear knob (hook icon) turned anticlockwise as seen from the left → hook lowers (p.267 left panel). A red lever with a white ball by the boom foot on this side is shown locked, then turned forward to unlock.
5. Left side, front knob (boom-raise icon) turned clockwise as seen from the left → boom raises (p.267 middle panel).
6. Right side, single knob (telescope icon) turned anticlockwise as seen from the right → boom extends (p.267 right panel). A red lever on this side is shown locked, then turned toward the rear to unlock.
### Comparison
- fn 1 "orange knobs steer all four axles": AGREES. Rear-opposite sense not shown on the page.
- fn 2 "eight wheels roll freely": NOT ON PAGE (inferred; the p.266 wheel arrows belong to the steering). Harmless.
- fn 3 "four outriggers swing out and down": AGREES for the rear pair (gears at the back). Front pair: in the photo, control inferred.
- fn 4 "superstructure slews": AGREES. The page draws no knob, so "by hand" stays inferred.
- fn 5 "knob nearer the cab raises the boom": AGREES (p1192 at x=-192 z=-100 is the front knob on the two-knob side). Page gives the direction: clockwise (seen from that side) raises.
- fn 6 "rear knob winds the winch": AGREES (p1195). Page: anticlockwise (seen from that side) lowers the hook.
- fn 7 "right-side knob extends the boom": AGREES (p1155 at x=+192). Page: anticlockwise (seen from the right) extends.
- fn 8 "red levers lock winch and extension": AGREES.
- Missing from list: none.
### Doubts settled
- fn 8: which lever locks which drive → the lock on the two-knob side (p1216, x=-100) is drawn with the hook-lowering panel, so it locks the winch; the lock on the single-knob side (p1220, x=+100) is drawn with the extension panel, so it locks the extension. Settled by p.267, confidence medium-high. Ratchet or full lock: not settled (the page shows only "locked" and "unlocked").
- fn 1: rear axles steer opposite to front → not settled. The step-52 inset (p.32) has two-headed arrows on all four axles, which show that they turn but not which way. p.266 wheel arrows are not clear enough. Confidence low.
- fn 3: front outriggers worked by liftarm handles p242/p244 → the p.266 main photo shows the front outriggers down, so they move; the handle is not drawn. Build steps 71-77 (p.39-42) build the legs with no motion arrow. Confidence medium that they move by hand; low on which part is the handle.
- fn 4: slewing by hand → the page shows no knob for it; consistent with by hand. Confidence medium.
### Video leads
- fn 1: a LEGO.com customer review (found through search) says the front and rear wheels move opposite each other; Brickset says the inner two axles turn less than the outer two. https://brickset.com/article/48198/review-42108-mobile-crane . Video lead: Erik to look. Confidence medium.
- fn 3: Brickpicker says the outriggers are flimsy and pop back during play. https://app.brickpicker.com/lego-reviews/42108-mobile-crane . Says nothing about the front control. Video lead: Erik to look. Confidence low.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| direction | 5 | no direction | knob clockwise (seen from the left side) raises the boom | p.267 middle | high |
| direction | 6 | no direction | knob anticlockwise (seen from the left side) lowers the hook | p.267 left | high |
| direction | 7 | no direction | knob anticlockwise (seen from the right side) extends the boom | p.267 right | high |
| source | 8 | "inferred: which lever locks which drive" | left lock (p1216) with the winch panel, right lock (p1220) with the extension panel | p.267 | medium-high |
| video | 1 | rear axles opposite, inferred | not shown either way | p.32, p.266 | medium |

## 42111 Dom's Dodge Charger
Booklets: omr/instructions/42111-1-1.pdf only (one book, 236 pp). Functions pages: 42111-1-1.pdf p.228-229 (a spread before the film adverts and the parts list). Pages read: 4 closely (228, 229 and two zoomed insets) + 4 contact sheets. Time: about 10 minutes.
### Functions page (blind reading)
1. Black gear knob on the rear deck behind the roof, turned → the front wheels steer (p.228 bottom-left inset: turn arrow on the knob, arrow at the front wheel).
2. Front suspension: the front wheel and its shock absorber move up and down (p.228 top-left inset, two-headed arrow).
3. The bonnet lifts open, and the boot lid lifts open (p.229 top inset, two arrows).
4. A light grey lever in the cabin (next to the red fire extinguisher) pulled toward the rear → a bar swings down under the car and lifts it into a wheelie (p.229 bottom inset).
5. The engine and supercharger are shown (p.228 main photo) with no arrow.
### Comparison
- fn 1 "gear behind the roof steers": AGREES.
- fn 2 "rolling turns the V8": NOT ON PAGE (book steps 58-73). Its `source` says "arrow at the rear wheel" in the p.228 inset: that arrow is at the front wheel (the supercharger end) and belongs to the steering.
- fn 3 "rear differential": NOT ON PAGE (book steps 58-73).
- fn 4 "front independent suspension": AGREES.
- fn 5 "front springs": AGREES (implied by the same inset).
- fn 6 "rear axle sprung on a ball joint": NOT ON PAGE (inferred). The model has the submodel "rear-shock-assy" with two shocks (p101, p105).
- fn 7 "rear springs": NOT ON PAGE (inferred).
- fn 8 "bonnet opens": AGREES.
- fn 9 "boot lid opens": AGREES.
- fn 10 "red lever works the wheelie bar": DIFFERS. The lever on the page is light grey; the red part beside it is the fire extinguisher. The cited control p328 (2825) is colour 71, light bluish grey, so the part is plausibly right but the word "red" is wrong. The arrow shows the lever pulled toward the rear of the car; the list says "pushing it".
- Missing from list: none.
### Doubts settled
- fn 2: supercharger driven by the chain → not drawn on p.228 (photo only). Not settled; confidence low. Not a video question.
- fn 10: which parts make the lever → page shows a light grey liftarm lever beside the red fire extinguisher. audit-parts: p328 2825 colour 71 in "frond-end-bracket" at z=-232. This matches a grey lever, so the cited part is plausible. Direction: pull toward the rear. Settled by p.229 bottom inset, confidence medium (small inset).
- fn 6/7: rear sprung axle → the model holds two rear shocks (submodel rear-shock-assy); the book page draws no arrow. Not settled from the booklet; confidence medium that the axle is sprung.
### Video leads
- fn 6: The Lego Car Blog says the rear suspension copies the real car's live-axle set-up, with independent front suspension. https://thelegocarblog.com/2021/07/23/technic-42111-doms-dodge-charger-review/ . Video lead: Erik to look. Confidence medium.
- fn 10: Bzpower and The Lego Car Blog describe a lever that drops a stand for the wheelie. https://bzpower.info/story.php?ID=11117 . The booklet already settles this function; it is listed only as support.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| what | 10 | "the red lever ... pushing it" | a light grey lever (p328 is grey) beside the red fire extinguisher | p.229 bottom | medium |
| direction | 10 | push | pull toward the rear of the car | p.229 bottom | medium |
| source | 2 | "page 228 bottom-left inset (arrow at the rear wheel)" | that arrow is at the front wheel and shows steering | p.228 | high |
| video | 6 | rear axle sprung, inferred | not drawn | none | medium |

## 42115 Lamborghini Sián FKP 37
Booklets: omr/instructions/42115-1-1.pdf = "Book One" (cover p.3), 324 pp; omr/instructions/42115-1-2.pdf = "Book Two" (cover p.3), 332 pp, the last. Functions pages: NONE. Neither the end of book 2 (p.305-332: build, photos, parts list, owners' area p.329) nor the end of book 1 (p.305-324) nor the front of book 1 (p.1-27: story pages) has a functions spread. The book has chapter pages with text only: book 1 p.28 "Gearbox & rear suspension", p.138 "Engine & front suspension"; book 2 p.4 "Interior details & seats", p.56 "Rear spoiler", p.190 "Scissor doors", p.312 "Rims & tires". Pages read: about 8 closely (b1 p.28, 138, 297-304 as sheet; b2 p.36-41 as sheet, p.56) + about 10 contact sheets. Time: about 20 minutes.
### Functions page (blind reading)
No functions page. From chapter pages and the build-step arrows seen:
1. Gearbox seen through windows in the bottom (b1 p.28 text).
2. V12 engine and pushrod suspension (b1 p.138 text).
3. Rear spoiler moves into place (b2 p.56 text). A tall upright lever pivoting at the floor with a curved yellow arrow is built at b1 p.299 (step 462), and another curved arrow is at b1 p.304 (step 471).
4. Scissor doors (b2 p.190).
5. Seats (b2 p.4 "Interior details & seats"): title only, no motion shown.
### Comparison
- fn 1 "pushed along, all wheels drive, V12 turns": NOT ON PAGE (book steps).
- fn 2 "paddle shifters change gear": NOT ON PAGE (book steps; which paddle shifts up inferred).
- fn 3 "centre console lever: drive / neutral (or reverse)": NOT ON PAGE (inferred).
- fn 4 "steering wheel steers": NOT ON PAGE (book steps).
- fn 5 "pushrod suspension": NOT ON PAGE (book steps and the p.138 chapter text, which names pushrod suspension).
- fn 6 "springs": NOT ON PAGE.
- fn 7 "rear spoiler rises": NOT ON PAGE (book steps; control inferred).
- fn 8 "scissor doors": NOT ON PAGE (chapter page b2 p.190).
- fn 9 "front hood lifts": NOT ON PAGE (book step 1078).
- fn 10 "engine cover lifts": NOT ON PAGE (inferred).
- fn 11 "seat backs tilt": NOT ON PAGE (inferred).
- Missing from list: none found.
### Doubts settled
- fn 7: which lever raises the spoiler → the list's control p2652 (43093, blue, in the submodel "4-12-rear-spoiler") is the wing's own pivot, not a lever the user works. Book 1 p.299 step 462 builds a tall upright lever pivoting at the floor, with a curved yellow arrow. Reviews (below) say a foot lever in the passenger footwell raises the spoiler. The driver's side is +x (steering wheel p1826 at x=+120), so the passenger footwell is -x. Not settled from the booklet alone; confidence medium that the control should be the step-462 floor lever.
- fn 3: what the centre lever selects → not shown in the pages read. Not settled; confidence low.
- fn 2: which paddle shifts up → not shown in the pages read. Not settled; confidence low.
- fn 1: front wheels driven → not settled from the pages read; confidence low.
- fn 10: engine cover opens → not settled from the booklet; product text (lead only) says "opening front and rear hood". Confidence medium.
- fn 11: seats tilt → not settled; the chapter page gives only a title. Confidence low.
### Video leads
- fn 7: Brickset's owner review and other reviews say a foot lever in the passenger footwell kicks up the rear spoiler; a Eurobricks user says it lifts only about 1 cm. https://brickset.com/reviews/59433 , https://brickset.com/article/51767/review-42115-lamborghini-si%C3%A1n-fkp-37 . Video lead: Erik to look. Confidence medium.
- fn 3: Brickset's owner review lists an automatic gear lever in the middle plus sport shifts by the steering wheel; GeekCulture says the gear stick has 3 positions: drive, neutral and reverse (but places it beside the steering wheel). https://geekculture.co/?p=148107 . Video lead: Erik to look. Confidence medium.
- fn 2: product text says 8-speed sequential gearbox; nothing found on which paddle shifts up. https://www.brickfanatics.com/lego-technic-42115-lamborghini-sian-fkp-37-review/ (functions section not in the summary). Video lead: Erik to look. Confidence low.
- fn 10: product listing says the front and rear hoods open. https://davidjones.com/product/lego-42115-technic-lamborghini-sián-fkp-37-23613698 . Video lead: Erik to look. Confidence medium.
- fn 1, fn 11: no lead found.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| what | 7 | control p2652 (the wing's pivot) | a floor-pivoted lever with a curved arrow (step 462); reviews say a passenger-footwell foot lever | b1 p.299 | medium |
| video | 7 | control inferred | foot lever in the passenger footwell (reviews) | b1 p.299 | medium |
| video | 3 | drive / neutral (or reverse), inferred | not shown; reviews say drive, neutral, reverse | none | medium |
| video | 2 | which paddle shifts up, inferred | not shown | none | low |
| video | 10 | engine cover opens, inferred | not shown; product text says the rear hood opens | none | medium |
| video | 11 | seats tilt, unsure | not shown | none | low |

## 42088 Cherry Picker
Booklets: 42088-1-1.pdf only (40 pp; the main model; cover p.1 says 42088, no number; the B model's booklet is not in omr/instructions). Functions pages: none. The book ends with step 36 (p.38), the parts list (p.39) and an advert (p.40). There is no functions spread and no photo page. Pages read: 9 closely + 40 as contact sheets. Time: about 10 minutes.
### Functions page (blind reading)
No functions page. From the build steps:
1. A knob (the 12 tooth gear on the end of the worm's axle at the back of the boom mount) turns the worm, which turns the 24 tooth gear on the boom's pivot: the boom goes up and down (steps 30-34, pp.28-34; cover).
2. The boom mount sits on an upright 5L axle in a round hole on the chassis (step 21, p.20; step 36, p.38): the mount and boom turn round by hand.
3. The bucket hangs from the boom tip on a white round pin joiner between two blue axle pins (step 7, p.37): it turns round on the vertical pin.
4. The 4 wheels are on long tan pins: they roll free. No steering is shown.
p.16 has a yellow curved arrow on the blue seats and a red box: this is a build instruction (flip the seats up), not a function.
### Comparison
- fn 1 "gear knob raises boom by worm": NOT ON PAGE (book steps 30-34). The build steps agree.
- fn 2 "boom mount turns on upright pin": NOT ON PAGE (book step 21/36 + inferred). The build steps agree. The "pin" is a grey 5L axle (32073 in step 21, p.20) standing in a round hole. The wording is slightly wrong but the joint is the same.
- fn 3 "bucket turns round on upright pins": NOT ON PAGE (book p.37). The build steps agree. In the model, the blue axle pins' pin ends sit in the 62462 round joiner, so the bucket can turn.
- fn 4 "bucket hanger swings at boom tip" (skip): NOT ON PAGE (book p.33/37). The model agrees: 6536 at the tip is on the red 2L axle 32062 by its pin hole and is drawn turned 30 degrees against the boom, so it hangs level.
- fn 5 "four wheels roll freely, no steering": NOT ON PAGE (inferred). The build steps agree (tan pins, pp.5-7, 17-18).
- Missing from list: none.
### Doubts settled
- fn 2: "inferred: that it turns" → the axle stands in a round hole of the chassis (step 21, p.20), and the boom mount is set on it (step 36, p.38). Nothing locks it. Confidence medium (no arrow in the book; the review below says the boom rotates 360 degrees).
- fn 5: "inferred" → wheels on long tan pins, no steering link in any step. Confidence high.
### Video leads
- fn 2: Brick Fanatics review (https://www.brickfanatics.com/lego-technic-42088-cherry-picker-review): "only one play feature", the boom raised and lowered by gear and screw. The search summary also says the boom and basket turn 360 degrees. A retailer review says the basket stays upright under gravity. No video time given. The book does not contradict this. Video lead: Erik to look, confidence medium.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
| --- | --- | --- | --- | --- | --- |
| source | 2 | "a single upright pin" | an upright grey 5L axle in a round hole | p.20 (step 21) | high |
| video | 2 | turntable turns, inferred | no arrow; review summary says it turns 360 degrees | brickfanatics review | medium |

## 42092 Rescue Helicopter
Booklets: 42092-1-1.pdf only (84 pp; main model; the concept plane B model's booklet is not here). Functions pages: 42092-1-1.pdf p.80 (photo spread with arrows; p.81 is the model photo continuing the spread). Pages read: 10 closely + 30 as contact sheets. Time: about 15 minutes.
### Functions page (blind reading)
1. A gear under the belly (circular arrow) spins the main rotor (big circular arrow) and the tail rotor (small circular arrow). p.80 top left.
2. The two rear side doors (white, one on each side) swing open outward (curved double arrows). p.80 bottom left.
3. The winch: the stretcher on its string goes up and down (vertical double arrow). The tan gear beside the drum is visible, but no arrow is on any knob. p.80 right.
Build steps: step 44 (p.26) shows the same rear-door arrows. Steps 116-117 (pp.72-73) show yellow push arrows on the drum's axle pin (fitting it; not a function).
### Comparison
- fn 1 "belly gear spins main and tail rotors": AGREES (p.80).
- fn 2 "tan gear winds the winch": AGREES in effect (p.80 shows the stretcher moving; the tan gear is the only drum control in view). The book has no arrow on the tan gear itself.
- fn 3 "12 tooth gear on the right side also turns the winch, via a cross axle": NOT ON PAGE (inferred). The build steps support it: step 103 (p.65) puts a 10L axle across with a 12 tooth gear at the winch end, and step 105 (p.67) puts a 12 tooth gear on the other end. In the model the black 12 tooth gear (80,-209,-60) and the tan gear on the drum axle (100,-209,-43) sit at right angles as a bevel pair.
- fn 4 "winch arm swings out on a pin": NOT ON PAGE (inferred). No arrow on the arm on p.80 or in steps 108-117. See doubts.
- fn 5 "two rear doors swing open sideways": AGREES (p.80; p.26).
- fn 6 "stretcher hangs level" (skip): AGREES (p.80 photo, p.78).
- Missing from list: none from the functions page. Reviews mention "four opening doors" and "moveable cockpit controls"; the book shows only the two rear doors. See video leads.
### Doubts settled
- fn 3: inferred second winch knob → steps 103 and 105 (pp.65, 67) give the cross axle a 12 tooth gear at each end, and the winch-side gear sits by the tan gear (p.72-73). This is a second knob for the winch. Confidence medium: the build steps support it, but the book never shows it used.
- fn 4: inferred arm swing → not shown anywhere. The winch arm (74695, winch.ldr) is held on one long pin with stop bush (32054), but the drum's axle pin runs through the same arm and the tan gear on that axle meshes with the cross axle's 12 tooth gear. If the arm swung, the drum and tan gear would go with it and come out of mesh. Steps 116-117 push the drum's axle pin home through the arm. My reading is that the arm is meant to stay in place. Confidence low-medium.
### Video leads
- fn 4 and the missing doors/controls: Brick Fanatics review (https://www.brickfanatics.com/lego-technic-42092-rescue-helicopter-review) lists "working rotor blades, four opening doors, moveable cockpit controls and a working winch with stretcher". Brickset review (https://brickset.com/article/40997/review-42092-rescue-helicopter) names only the rotor drivetrain and the winch. No video time given. The book (p.80) shows only two doors; the book stands. Video lead: Erik to look (whether the front doors open, whether the winch arm swings), confidence low.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
| --- | --- | --- | --- | --- | --- |
| what | 4 | winch arm swings out on a pin | no arrow on the arm; the drum's axle (with the tan gear in mesh) goes through the arm, so swinging it would unmesh the winch | p.72-73 (steps 116-117), p.80 | low-medium |
| video | 4 / new | arm swings; two doors | reviews say four opening doors and moveable cockpit controls | brickfanatics review | low |
| source | 3 | "inferred: from the parts" | steps 103 and 105 put a 12 tooth gear on each end of the cross axle | p.65, p.67 | medium |

## 42093 Chevrolet Corvette ZR1
Booklets: 42093-1-1.pdf only (148 pp; main model; the hot rod B model's booklet is not here). Functions pages: none. p.143 is an advert for the range and p.144 shows photos of the model and the real car with no arrows. Pages read: 7 closely + 148 as contact sheets. Time: about 15 minutes.
### Functions page (blind reading)
No functions page and no motion arrows found in the contact sheets. From the build steps:
1. Differential at the rear (steps 2-8, pp.4-9). Step 2 (p.4) puts an 8 tooth gear on a 3L yellow axle by the 20 tooth gear (the drive to the engine).
2. V8 engine with yellow-capped pistons (seen through the bonnet, p.108).
3. A 12 tooth gear at the back above the exhausts (photo p.144): this is a hand-of-god steering knob.
4. The steering wheel (step 109, p.72) is fitted on a blue axle pin into a frame, with nothing behind it.
5. Wheels (step 206).
### Comparison
- fn 1 "rear wheels drive the V8 through the differential" (skip): NOT ON PAGE (book steps). Step 2 (p.4) confirms the set has an 8 tooth gear on the drive shaft. This matches the skip reason and docs/ldraw-errata.md.
- fn 2 "gear at back steers front wheels": NOT ON PAGE (book steps; p.144 photo shows the gear). No contradiction found.
- fn 3 "front wheels roll and steer": NOT ON PAGE (book steps).
- fn 4 "steering wheel turns on its pin, not linked": NOT ON PAGE (inferred).
- Missing from list: none found.
### Doubts settled
- fn 1: "drive path ... inferred" → step 2 (p.4, zoomed) shows the 8 tooth gear and the 3L axle, so the drive goes from the differential to the engine. The model's 12 tooth gear is a model fault, already in docs/ldraw-errata.md. Confidence high.
- fn 4: "unsure whether LEGO meant it to be linked" → step 108-109 (p.72): the wheel goes on a blue axle pin in a small frame of two angle connectors and two orange 2L axle connectors; no axle or gear goes behind it. It is for show. Confidence high.
### Video leads
None needed: every function is settled by the build steps (no search made).
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
| --- | --- | --- | --- | --- | --- |
| model | 1 | (skip: 12 tooth gear in the model where the set has 8 tooth) | step 2 confirms the 8 tooth gear; already in docs/ldraw-errata.md, not corrected | p.4 | high |
| source | 4 | "unsure whether LEGO meant it to be linked" | nothing behind the wheel's pin; for show | p.72 | high |

## 42094 Tracked Loader
Booklets: 42094-1-1.pdf only (140 pp; main model; the tracked dumper B model's booklet is not here). Functions pages: 42094-1-1.pdf p.136 (four photo panels) and p.137 (model photo with the "360°" inset). Pages read: 9 closely + about 75 as contact sheets. Time: about 20 minutes.
### Functions page (blind reading)
1. Rear knob of the two black gear knobs on top of the rear body (circular arrow, p.136 bottom left) → the arm and grab go up and down (big arc).
2. Front knob of the two on top (circular arrow, p.137 inset, top view) → the upper body (cab, arm, engine cover) turns 360 degrees on the tracks.
3. Black gear knob on the side at the back (circular arrow, p.136 bottom right) → the winch cable and hook go in and out (straight double arrow).
4. Red lever on top at the back (double curved arrow, left-right, p.136 bottom right). Stickers beside it show a tortoise and a hare (p.137), so it selects slow or fast for the winch.
5. A small curved arrow points up at a red part under the rear, below the lights (p.136 bottom right). Its build steps are 76-78 (pp.42-44): a red part is pushed down by the winch knob's gear in step 78 (red box, white arrow). Probably a latch or brake for the winch. Purpose not certain.
6. Grab: a big curved double arrow on the upper clamp (opens and closes over the log), and a horizontal double arrow at the red pin on a small yellow lever at the arm root, by the cab (p.136 top right). Step 178 (p.107) fits that yellow lever with its red pin and draws the upper clamp's long beam swinging up (red arc). Step 163-164 (p.95 red box) shows a 20 and a 12 tooth gear inside the grab.
7. Cab: a curved double arrow under the seat, between the seat and the console with the joystick (p.136 top left). The consoles are hinged at the top of the cab on a red axle pin (steps 125/136, pp.71, 76). They swing out.
### Comparison
- fn 1 "rear knob raises arm by linear actuator": AGREES (p.136 bottom left).
- fn 2 "front knob turns cab on turntable": AGREES (p.137 inset; arrow on the front knob of the pair).
- fn 3 "side knob at back winds winch": AGREES (p.136 bottom right).
- fn 4 "red lever: fast, slow, free middle": AGREES on the lever and two speeds (arrow; tortoise and hare stickers on p.137). The book does not show the free middle.
- fn 5 "black gear on the grab's side closes the upper clamp": DIFFERS on the control. The page puts the hand control at the small yellow lever with the red pin at the arm root (fore-aft arrow, p.136 top right; fitted in step 178, p.107). The black gears are the inner 20/12 gearing (p.95), not a knob with an arrow.
- fn 6 "armrest consoles tip up on hinges at the back of the cab": AGREES in substance (p.136 top left arrow; hinge on a red axle pin at the top of the cab, p.76). Brick Fanatics calls them doors.
- fn 7 "tracks roll freely": NOT ON PAGE (book steps 179-218).
- fn 8 "sprung front idlers" (skip): NOT ON PAGE (book steps 179-180).
- Missing from list: the red part under the rear with the small upward arrow (p.136 bottom right; steps 76-78, pp.42-44). Probably a winch latch or brake.
### Doubts settled
- fn 2: "which knob does which is inferred" → p.137 inset puts the 360 arrow on the front knob, and p.136 bottom left puts the arm arrow on the rear knob. Confidence high.
- fn 4: "inferred: two speeds and free middle" → the tortoise and hare stickers by the lever (p.137) confirm two speeds. The free middle is still not shown. Confidence medium for the speeds, low for the free middle.
- fn 5: "unsure whether the gear tilts the whole grab or only closes the upper clamp" → p.136 top right draws the arc on the upper clamp only, and p.107 (step 178) draws the upper clamp's long beam swinging up. The hand control is the yellow lever at the arm root (step 178), working the clamp through the long link. The 20/12 gears in the grab (p.95) are inside the linkage. Confidence medium.
- fn 6: "inferred" → the hinge is real (red axle pin at the top of the cab, p.76 step 136), and p.136 shows the arrow. Confidence medium (the arrow's exact motion, tip up or swing out, is hard to read on the photo).
### Video leads
- fn 4 (free middle) and the red part under the rear: listings (https://www.lego.com/en-nz/product/tracked-loader-42094) say "2-speed winch"; Brick Fanatics review (https://www.brickfanatics.com/lego-technic-42094-tracked-loader-review) calls the cab parts "doors". No video time given. RacingBrick (https://racingbrick.com/tag/42094/) and Eurobricks (https://www.eurobricks.com/forum/forums/topic/169077-review-42094-tracked-loader) reviews may show the lever's middle position and the red latch. Video lead: Erik to look, confidence low.
- fn 5: whether the yellow lever at the arm root is the clamp control. Same reviews. Video lead: Erik to look, confidence medium.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
| --- | --- | --- | --- | --- | --- |
| what | 5 | control is the black 12 tooth gear on the grab (p1064) | control is the small yellow lever with the red pin at the arm root (step 178), moved fore and aft; it swings the upper clamp | p.136 top right, p.107 | medium |
| what | new | (none) | a red part under the rear, pushed up (small arrow); probably a winch latch or brake | p.136 bottom right, p.44 (step 78) | low |
| video | 4, new | free middle position; red latch | not shown in the book | reviews listed above | low |
| source | 2 | "which knob does which is inferred" | p.137 inset and p.136 show it | p.136-137 | high |
| source | 4 | two speeds inferred | tortoise and hare stickers by the lever | p.137 | medium |
| source | 6 | "inferred: page 136" | hinge on red axle pin at top of cab; page arrow; reviews call them doors | p.76, p.136 | medium |

## 42095 Remote-Controlled Stunt Racer
Booklets: 42095-1-1.pdf only (72 pp, one book). Functions page: 42095-1-1.pdf p.63. Pages 64-67 are the battery-change steps (lift the top), not a functions page. Pages read: 4 closely (p.2, 63, 64 and crops of p.63) + 2 contact sheets (p.1-12, 57-72). Time: about 6 minutes.
### Functions page (blind reading)
1. PF IR remote, both levers the same way → racer drives forward or back (first panel, double arrow).
2. Remote levers opposite ways → racer spins on the spot (second panel, curved arrow).
3. One lever alone → racer turns one way (third panel).
4. The other lever alone → racer turns the other way (fourth panel).
5. No arrows on the tail's small yellow wheels; the main picture shows them on a blue arm at the back.
Also p.64 step 4 (battery change): the blue top tips forward and over, after the hoses and a pin come out.
### Comparison
- fn 1 "left track, one lever": AGREES (the page shows each lever working one side; it does not say which lever is left).
- fn 2 "right track, other lever": AGREES (same).
- fn 3 "skid steering": AGREES (all four panels).
- fn 4 "blue top hinges forward for the batteries": NOT ON PAGE (book: p.64 step 4 arrow; matches what I see there).
- fn 5 "tail wheels roll freely": NOT ON PAGE (inferred).
- Missing from list: none.
### Doubts settled
- fn 5: inferred that the tail wheels are a free-rolling wheelie bar → the functions page shows the wheels at the back on a blue arm, clear of the ground, but no arrow. Not settled by the book; plausible. Confidence medium.
### Video leads
- fn 5: reviews say the racer runs mostly in wheelies, and its rear wheelie bar with two wheels limits how far it rears up (Brickset review https://brickset.com/article/42140/review-42095-remote-controlled-stunt-racer ; RacingBrick https://racingbrick.com/?p=4668 ; Eurobricks summary mentions "two wheels at the rear"). No time in video given. Video lead: Erik to look, confidence medium.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| video | 5 | tail wheels roll freely (inferred) | wheels on a blue arm at the back, no arrow; reviews call it the wheelie bar | p.63 | medium |

## 42096 Porsche 911 RSR
Booklets: 42096-1-1.pdf only (296 pp, one book). Functions pages: 42096-1-1.pdf p.290-291 (one spread). Pages read: 2 closely + 2 crops + 2 contact sheets (p.1-20, 277-296). Time: about 5 minutes.
### Functions page (blind reading)
1. Doors (both) → swing open by hand, up and out (p.290 top inset, two arrows).
2. A door seen open from the side, no arrow (p.290 middle inset; a view, not a function).
3. Steering wheel in the cab turned → front wheels steer (p.290 bottom inset: curved arrow on the steering wheel, double arrow at the front wheel).
4. Rear wheel → rises and falls (p.291 top inset, up/down arrow): rear suspension.
5. Flat-six engine → pistons move up and down, crankshaft turns (p.291 bottom inset); worked by the car rolling (no separate control shown).
The front springs are visible in the big picture on p.290 but carry no arrow.
### Comparison
- fn 1 "rear wheels drive the flat six through the differential": AGREES (p.291 engine inset; the drive from the wheels is from build steps).
- fn 2 "steering wheel steers front wheels": AGREES.
- fn 3 "doors open on hinges": AGREES.
- fn 4 "front independent suspension": NOT ON PAGE (front axle build steps; springs seen in the photo, no arrow).
- fn 5 "rear independent suspension": AGREES (p.291 top inset).
- Missing from list: none.
### Doubts settled
- None flagged (no "inferred" or "unsure" in any source or note; fn 2's "gear path read from the model" is a detail, the function itself is on the page).
### Video leads
- None needed.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| source | 4 | "book: page 290; ... front axle steps" | p.290 shows the front springs but no arrow; the function rests on the build steps | p.290 | high |

## 42099 4x4 X-treme Off-Roader
Booklets: 42099-1-1.pdf only (224 pp, one book). Functions pages: 42099-1-1.pdf p.218-219 (Control+ app pages: connect, drive forward/back, app screens). Pages read: 8 closely (p.59, 61, 124, 125, 218, 219 and two sheets read closely) + 7 contact sheets (p.1-20, 54-65, 66-90, 93-108, 120-144, 186-193, 205-224). Time: about 12 minutes.
### Functions page (blind reading)
1. Control+ app (one-touch control) → the model drives forward and back (p.218 panel 4, arrows both ways).
2. Control+ app → steering (the orange marker on the one-touch wheel, p.218-219; no steering arrow on the model).
3. App shows tilt angles (32°, 17°) from the hub's sensor; not a mechanism.
No mechanical function is drawn with arrows beyond driving.
### Comparison
- fn 1 "front XL motor drives front wheels": AGREES (drive on p.218; the gear train is read from the model, as the source says).
- fn 2 "rear XL motor drives rear wheels": AGREES (same).
- fn 3 "four-wheel drive from both motors": AGREES (p.218 panel 4).
- fn 4 "L motor steers through a rack": AGREES in kind (app steering, p.218-219); the rack and links rest on build steps.
- fn 5 "front open differential": NOT ON PAGE (book steps 8-37).
- fn 6 "rear open differential": NOT ON PAGE (book steps 127-140).
- fn 7 "front half twists against rear half on two turntables": NOT ON PAGE (book steps + inferred).
- fn 8 "four red shock absorbers" (skip): NOT ON PAGE (book steps).
- fn 9 "dashboard steering wheel turns freely": NOT ON PAGE (inferred).
- Missing from list: none.
### Doubts settled
- fn 7: inferred articulation, and unsure whether either axle also swings on its own → partly settled. Step 105 (p.59) fixes the front turntable to the front motor module; step 107 (p.61) joins the front axle under it, the turntable at the very front and the two red shocks' upper ends left free (fixed later). Steps 173-180 (p.101-107) fix the rear motor rigidly to the rear axle, its shocks' upper ends also free. Step 202 (p.125) joins the front unit to the rear unit through the middle turntable. Both turntables lie on one lengthwise line, so a twist between two halves is consistent. What the book does not show me: where the body and the shocks' upper ends finally attach, which decides which side "twists" and whether each axle is a pendular axle on its own turntable instead. Confidence low-medium.
- fn 9: inferred that the dashboard wheel is not joined to the steering → step 302 (p.186) fits it on a short axle in the body shell module, built apart from the chassis; nothing behind it. Settled, confidence high.
- fn 1, 2, 4: "gear train inferred from the model": the functions are on the app page; the gear details are a model reading, no doubt about the function.
### Video leads
- fn 7: a New Elementary review summary mentions "two big turntable and spring-based suspension" (https://www.newelementary.com/2019/08/lego-technic-review-42099-4x4-x-treme.html); RacingBrick (https://racingbrick.com/?p=5329) and Sariel's review (listed in the Eurobricks 2H2019 video thread, https://www.eurobricks.com/forum/forums/topic/172487-technic-2h2019-video-reviews/page/2) cover it in detail. No time given. Video lead: Erik to look (does the front axle unit twist against the body, or does each axle swing on its own turntable?), confidence low.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| video | 7 | front half twists against rear half (inferred, unsure) | two turntables on one lengthwise line (steps 105, 202); shock tops attached later; not settled | p.59, 61, 125 | low |
| source | 9 | inferred: step 302 | step 302 shows the wheel on a short axle in the separate body module | p.186 | high |

## 42110 Land Rover Defender
Booklets: one file, omr/instructions/42110-1-1.pdf, 496 pages (the only and last booklet). Functions pages: 42110-1-1.pdf p.490-491 (one spread: p.490 the drivetrain drawing and three lever pictures, p.491 the arrow pictures). Front of book (p.1-5) checked: cover, tips, app page, sub-assembly overview; no functions. Pages read: 6 closely (p.490, 491, 193, 187-192 as a 3-wide sheet) + about 160 as contact sheets (p.1-24, 100-235, 470-496). Time: about 25 minutes.
### Functions page (blind reading)
1. Gear knob on top of the roof turned → steering wheel turns and the front wheels steer (p.491 top left).
2. Pushing the car along → the six pistons of the engine move up and down (p.491 top middle, pistons with up/down arrows).
3. 4-speed sequential gearbox: the "+ −" control at the back end of the console, a round black knob on a rod along the car, rocked left or right (double arc arrow; "+" printed on the left, "−" on the right) (p.490 lower inset).
4. D-N-R selector: the tall grey lever (red changeover catch with a grey perpendicular connector on top), on the left of the console, tipped: D forward, N middle, R back (p.490 top inset; seen from behind in the third inset).
5. HI-LO selector: the short lever with a black 12-tooth knob gear on top, on the right of the console, tipped: LO forward, HI back (p.490 middle inset).
6. Drawing labels only these three: "4-speed sequential gearbox", "High and low gear selector", "D-N-R gear selector". No differential is labelled.
7. Independent suspension: each of the four wheels moves up and down (p.491 middle, arrows at all four wheels).
8. Winch (p.491 bottom middle): picture 1, an arrow points to a red ball-ended lever at the front of the engine bay, car's left side, and the hook is pulled out of the bumper; picture 2, the black knob gear at the front of the engine bay, car's right side, is turned and the hook is drawn back in.
9. Spare wheel turned (picture 1, arrow round it), then the tailgate with the spare swings open sideways, hinged on the car's right (picture 2) (p.491 bottom left).
10. Bonnet lifts open; front door (right one shown) swings open (p.491 bottom right).
11. Lid of the roof box lifts open; lid of the side case on the roof swings open (p.491 middle left).
12. The roof rack, with the roof box, the side case and the ladder, lifts off the car; the white roof stays on (p.491 right, big arrow).
### Comparison
- fn 1 "roof knob steers the front wheels": AGREES (gear train from the model, not the page).
- fn 2 "steering wheel turns with the steering": AGREES.
- fn 3 "pushing the car turns the engine's pistons through the drivetrain": AGREES for the pistons (p.491); the path through the differentials and selectors is inferred, consistent with the p.490 drawing.
- fn 4 "front, rear and centre differentials": NOT ON PAGE (inferred). The p.490 drawing labels no differential. The source text "three differentials drawn" overstates the page.
- fn 5 "sequential gearbox, + / − lever tips sideways": AGREES on what moves. The handle is a round knob rocked left/right about the rod along the car, not a lever; p385 3706 is that knob's rod (shiftplate submodel: 4032a, 92947, 14769 stacked on it). Direction: + to the left, − to the right as seen from behind (medium).
- fn 6 "D-N-R lever p377 slides p330": AGREES (left lever). Direction not in the list: D forward, R back.
- fn 7 "HI-LO lever p368 slides p331": AGREES (right lever). Direction not in the list: LO forward, HI back.
- fn 8 "winch: hook pulls out, knob front right winds it in": DIFFERS in one point. The knob (p896, x = −100, car's right) AGREES. The page also shows a red ball-ended lever at front left (car's left) worked before the hook is pulled out. In the model this is the tilted lever at chassis step 314 (book p.193): 6628 red tow-ball pin p978 on 62462 p977 / 2780 p976, with 6536, 32039, red 32062 on a 15462, set beside the winch drum. It looks like the winch's lock (a pawl on the drum gear). The list does not name it.
- fn 9 "suspension": AGREES.
- fn 10 "two front doors open": AGREES (one shown; the model has two).
- fn 11 "bonnet lifts": AGREES.
- fn 12 "turn the spare wheel to free the tailgate, then it swings open sideways": AGREES. Latch p1504 at x = +60 (car's left), hinge on the right, as in picture 2.
- fn 13 "roof box lid": AGREES.
- fn 14 "side case lid, right side of the roof": AGREES (p.490 shows the case on the car's right).
- fn 15 "the roof, with its rack, lifts off": DIFFERS. The page lifts off only the roof rack with the roof box, the side case and the ladder; the white roof stays on the car. (The function is skipped, so this is wording only for now.)
- Missing from list: the winch lock lever (see fn 8). Nothing else.
### Doubts settled
- fn 5: which part is the handle → a round knob (4032a / 92947 / 14769 on the rod p385) at the back end of the console, rocked left/right; settled by p.490 lower inset and the shiftplate submodel, confidence high for the part, medium for which way is +.
- fn 6 / fn 7: which console lever is D-N-R → the left one, p377 (x = +20, car's left), the one with the grey 6536 on its 4519; HI-LO is the right one, p368 (x = −20), with the black 32270 knob gear on top. Settled by p.490 (all three insets: the D-N-R lever is the tall grey one, the HI-LO lever carries the black knob gear; in the inset from behind D-N-R is on the left) and the shiftplate submodel. Confidence high. The list's guess is right.
- fn 1, 3, 4: gear trains "inferred from the model". The page does not draw them; no booklet step shows motion arrows for them. Not settled by the booklet; nothing found against the list.
- fn 8 extra lever: read from p.491 picture 1 and book p.193 (step 314). That it is a lock or ratchet on the drum is inferred from where it sits; confidence medium.
### Video leads
- fn 4: search summary (Racing Brick, Eurobricks) says the model has all-wheel drive with 3 differentials, and that a reversed front or rear differential jams the centre one. https://racingbrick.com/2019/09/decoding-the-gearbox-of-the-lego-technic-42110-land-rover-defender/amp , https://www.eurobricks.com/forum/forums/topic/173423-video-review-42110-land-rover-defender/page/2 . No time given. Video lead: Erik to look, confidence medium (agrees with the list).
- fn 5 direction (+ left or right): not in the search summaries. Video lead: Erik to look, confidence low.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| what | 8 | hook out, knob front right winds in | also a red ball-ended lever, front left (p978 6628 on its lever, step 314), worked before pulling the hook out: likely the winch lock | p.491, p.193 | medium |
| what | 15 | the roof, with its rack, lifts off | only the roof rack (with roof box, side case, ladder) lifts off; the white roof stays | p.491 | high |
| what | 5 | lever tips sideways | a round knob on the rod p385, rocked left/right; + left, − right | p.490 | high (part), medium (direction) |
| direction | 6 | no direction | D forward, N middle, R back | p.490 | medium |
| direction | 7 | no direction | LO forward, HI back | p.490 | medium |
| source | 4 | "three differentials drawn" | no differential labelled on p.490 | p.490 | high |
| video | 4 | three differentials | not on page; reviews say 3 differentials | — | medium |

## 42071 Dozer Compactor
Booklets: 42071-1-1.pdf (52 pp) is the main model (the dozer compactor with the front blade, as on the box); 42071-1-2.pdf (48 pp) is the B model (it has its own functions page at p.47). Functions page: 42071-1-1.pdf p.48. Pages read: 1 closely + 4 contact sheets (covers of both, p.41-52 of book 1, p.33-48 of book 2). Time: about 5 minutes.
### Functions page (blind reading)
1. Upright grey knob behind the cab, turned → the front section swings left and right: articulated steering (top inset, rotation symbol at the rear, curved arrow at the front).
2. Black knob in front of the cab, turned (rotation symbol on top) → the blade on its orange arms swings up and down (bottom inset, double curved arrow).
No arrows on the wheels.
### Comparison
- fn 1 "knob behind cab steers by bending": AGREES (p92 26287 sits at the top behind the cab, where the callout points).
- fn 2 "knob in front of cab raises the blade through a worm": AGREES (p120 32270 sits at the top in front of the cab, where the callout points).
- fn 3 "wheels roll freely": NOT ON PAGE (book steps 50-51).
- Missing from list: none.
### Doubts settled
- None flagged.
### Video leads
- None needed.
### Proposed changes
None.

## 42072 WHACK!
Booklets: one file, omr/instructions/42072-1-1.pdf, 52 pages (only and last). Functions page: 42072-1-1.pdf p.49. Pages read: 2 closely (p.49; p.46-48 as a 3-wide sheet) + 52 as a contact sheet, + p.19-30 as a sheet. Time: about 6 minutes.
### Functions page (blind reading)
1. Pull-back motor: the car pushed back by hand along the ground, let go, it runs forward (right insets, top two).
2. Crash: when the front hits a wall, the loose block on the nose (the one built at step 53, p.46-48) flies up off the car (right inset, bottom; left inset, hitting another car). A circle marks the lime arm low at the front as the trigger, and a circle marks the nose block.
### Comparison
- fn 1 "pull-back motor through the rear wheels": AGREES.
- fn 2 "front wheels roll freely": NOT ON PAGE (book steps 50-52); plainly true.
- fn 3 "the low front lever knocked back flicks the bonnet block off": AGREES. The control p49 is the lime 32140 (colour 27, step 23), the arm the page circles low at the front.
- fn 4 "pull-back spring drives the car" (skipped): AGREES.
- Missing from list: none.
### Doubts settled
- fn 3: how the lever reaches the block is inferred. The page circles the lime arm (p49) and the block; build steps 17-28 (p.20-28) have no motion arrows. Control and moving block settled by p.49, confidence high; the linkage between is from the model, medium.
### Video leads
- None needed.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| — | — | no change | — | p.49 | — |

## 42073 BASH!
Booklets: one file, omr/instructions/42073-1-1.pdf, 56 pages (only and last). Functions page: 42073-1-1.pdf p.52. Pages read: 1 closely (p.52) + 56 as a contact sheet. Time: about 4 minutes.
Note on independence: the 42073 list was printed together with the 42072 list (one command) before p.52 was read, so this reading is not fully blind. The page is the same layout as the 42072's p.49 and was read from the page itself.
### Functions page (reading)
1. Pull-back motor: pushed back by hand, let go, runs forward (right insets).
2. Crash: hitting a wall throws the loose nose block up off the car (right inset bottom; left inset). Circles mark the red arm low at the front and the nose block.
### Comparison
- fn 1 "pull-back motor": AGREES.
- fn 2 "front wheels roll freely": NOT ON PAGE (book steps 49-52); plainly true.
- fn 3 "red low front lever flicks the bonnet block off": AGREES. Control p38 is the red 32140 (colour 4), the arm circled on p.52.
- fn 4 "pull-back spring" (skipped): AGREES.
- Missing from list: none.
### Doubts settled
- fn 3: the linkage is inferred from the model; control and block settled by p.52, confidence high; linkage medium.
### Video leads
- None needed.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| — | — | no change | — | p.52 | — |

## 42074 Racing Yacht
Booklets: 42074-1-1.pdf (cover "1", 84 pp, the main yacht, steps 1-128, the last booklet of the main model); 42074-1-2.pdf (cover "2", 72 pp, the B model: a catamaran, steps 75-86 on its last pages; drop it). Functions pages: 42074-1-1.pdf p.80-81 (one spread). Pages read: 6 closely + 4 contact sheets. Time: about 12 minutes.
### Functions page (blind reading)
1. Top-left inset (p.81, linked to the helm on p.80): the small steering wheel turned → the rudder and tiller at the stern swing from side to side (curved two-way arrow round the grey tiller and the tan bevel gear).
2. Top-right inset (p.81, linked to the gear below the helm): the steering wheel turned, the arrow on the wheel only. Nothing else is marked. I read it as a second view of the helm (function 1), not a new function. Low confidence.
3. Bottom inset (p.81): the two black winch cranks on the deck turned → the boom and mainsail swing (curved arrow on the boom). Blue rubber bands join the cranks.
### Comparison
- fn 1 "helm turns the rudder": AGREES.
- fn 2 "either winch crank swings the boom": AGREES.
- fn 3 "four small wheels under the hull roll": NOT ON PAGE (inferred). The wheels exist (13971 at y=0 under the hull, steps 18-21), so this is safe.
- fn 4 "rubber bands slip": NOT ON PAGE (inferred; marked skip).
- Missing from list: maybe the tiller as a second control (the tiller pushed by hand turns the rudder and the helm). LEGO's product text says "wheel and tiller steering", and the top-left inset draws the arrow round the tiller. Low-medium confidence; the booklet does not say which is the control.
### Doubts settled
- fn 3: inferred → the wheels are built in at steps 18-21 and sit at the hull's bottom; the page draws no arrow on them. Keep as is. Confidence medium.
- fn 4: not checkable from the booklet; keep skipped.
### Video leads
- Tiller: LEGO's shop text "working rudder with wheel and tiller steering" (search summary; https://www.lego.com/en-ca/product/42074 and https://www.brickmissing.com/llms/sets/42074-1-racing-yacht.md). Review: https://brickset.com/article/33175/review-42074-racing-yacht. Video lead: Erik to look whether the tiller is meant to be worked by hand. Confidence low.
- fn 3: no source mentions the wheels. Nothing to look at.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| video | new | (no tiller function) | the rudder inset's arrow is drawn round the tiller; LEGO text says "wheel and tiller steering" | 42074-1-1 p.81 | low |

## 42075 First Responder
Booklets: 42075-1-1.pdf (96 pp, the B model, a hot rod; drop it); 42075-1-2.pdf (116 pp, the main First Responder, steps 1-153, the only booklet of the main model). Functions pages: 42075-1-2.pdf p.112-113 (one spread). Pages read: 5 closely + 3 contact sheets. Time: about 12 minutes.
### Functions page (blind reading)
1. p.112 inset: the bonnet tips up and forward (arrow up at the bonnet). A second curved arrow is drawn at the cab floor beside the blue seat, sweeping forward and down. What it shows is not clear: a seat tipping forward, or the drive going forward to the engine.
2. p.113 top left: the black gear on the cab roof turned → the front wheels steer (curved arrow round the front wheel).
3. p.113 bottom left: the black gear on the front bumper turned → the hook's string winds in and out (straight two-way arrow).
4. p.113 top right: the rear wheels rise and fall (two-way arrows up and down on both rear wheels; differential and suspension visible).
5. p.113 bottom right: the light mast swings up from lying along the roof to standing upright (curved two-way arrow), by hand.
### Comparison
- fn 1 "roof gear steers": AGREES.
- fn 2 "pushed along, rear wheels drive the 2-cylinder engine": NOT ON PAGE (book steps 36-41, 49-52, 117-122). Its source cites "page 113 (top left photo, the arrow on the front wheel)"; that arrow belongs to the steering (fn 1), not to the engine.
- fn 3 "front wheels roll freely": NOT ON PAGE (book steps).
- fn 4 "bumper gear winds the winch": AGREES.
- fn 5 "rear axle swings, sprung": AGREES (the page shows the rear wheels rising and falling; one shock between them).
- fn 6 "light mast swings up": AGREES.
- fn 7 "bonnet tips up and forward": AGREES.
- fn 8 "the two seats tip forward": NOT ON PAGE (inferred). See doubts.
- Missing from list: none.
### Doubts settled
- fn 8 "seats tip forward" (inferred from the p.112 inset's lower arrow): not settled. The seats (24116, a bent panel) go in at step 73 (p.52), each on one pin; the step shows no arrow. The inset's arrow starts behind the seat at mid-height and ends low and forward at the floor, which fits a seat back tipping forward but also fits a drive arrow. Confidence low either way.
- fn 2 "which steps": steps 117-122 (p.81-83) do build the yellow engine; not read closely. The page's p.112 inset, with the bonnet up, shows the engine bay. Confidence medium that the engine exists and is driven; the drive itself is not on the page.
### Video leads
- fn 8: one search; nothing about seats. Reviews to look at: https://www.eurobricks.com/forum/forums/topic/160420-review-42075-first-responder and RacingBrick's speed build https://racingbrick.com/2018/01/lego-technic-42075-first-responder-unboxing-speed-build-review/amp. Video lead: Erik to look whether the seats tip and what the p.112 lower arrow means. Confidence low.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| source | 2 | source cites p.113 top-left arrow on the front wheel | that arrow is the steering's; the engine drive is in the build steps only | 42075-1-2 p.113 | high |
| video | 8 | seats tip forward (inferred) | an unexplained curved arrow beside the seat in the bonnet inset | 42075-1-2 p.112 | low |

## 42076 Hovercraft
Booklets: 42076-1-1.pdf (156 pp, the only booklet, steps 1-240 plus the truck). Functions pages: 42076-1-1.pdf p.150-151 (one spread). Pages read: 6 closely + 3 contact sheets. Time: about 14 minutes.
### Functions page (blind reading)
1. p.150 top left: the black gear on the left of the carriage on top of the red gantry turned → vertical movement along the tall black gear rack (two-way up-down arrow drawn on the rack itself).
2. p.150 top middle (after an arrow from 1): the white cab with its carriage slides from side to side along the gantry's top beam (two-way arrow), by hand. The rack's L-shaped foot hangs free below the beam, like a crane hook.
3. p.150 bottom left: the two black gears on yellow upright shafts beside the bow turned (circular arrows) → the ramp at the bow lowers and rises (curved two-way arrow).
4. p.151 top middle: the truck. Its roof gear turned → front wheels steer (curved arrow on the front wheel); its rear wheel rises and falls (two-way arrow).
5. p.151 top right (seen from above): the black gear on top at the stern turned → both propeller pods swing together (curved arrows on both pods).
6. p.151 bottom right: the hovercraft pushed along (two-way arrow on the hull) → both propellers spin (circular arrows).
### Comparison
- fn 1 "pushed along, wheels spin both propellers": AGREES.
- fn 2 "stern gear swings both pods (and the hidden wheels steer)": AGREES for the pods; the hidden wheels steering rest on book steps 34-49 (not read).
- fn 3 "either deck gear lowers the ramp": AGREES (both gears carry arrows).
- fn 4 "carriage gear raises and lowers the white bridge": DIFFERS, probably. The page puts the arrow on the rack, which suggests the rack moves through the carriage while the carriage and cab stay at height; the rack's foot hangs free below the beam (p.150 top middle) and LEGO's text calls this "a crane with an operator's cab". The cab is fitted to the carriage (steps 234-240, p.144-148), not to the rack. The list moves both the rack p697 (64781, "Gear Rack 1 x 13") and the cab's axle p726 (60485, in cabin.ldr): one of the two must stay relative to the other, so the list contradicts itself whichever is right.
- fn 5 "bridge slides along the top beam": AGREES (the cab and carriage slide; by hand).
- fn 6 "truck roof gear steers": AGREES.
- fn 7 "truck rear axle swings, sprung": AGREES.
- fn 8 "truck's wheels roll": AGREES (the truck is shown driving up the ramp).
- fn 9 "deck fan rotors spin freely": NOT ON PAGE (inferred).
- Missing from list: none.
### Doubts settled
- fn 4 note "which of the two black gears drives the rack": both do. In crane.ldr the first knob (32270 at 20,-60,0) shares an axle with an 8 tooth gear (10928 at 20,-60,-40); the second knob (32270 at 40,-60,-60) has its own 8 tooth gear (10928 at 40,-60,-40), one stud from the first, so they mesh. Steps 212-215 (p.133-134) build the two gear axles this way. The page's arrow is on one of them only. Confidence medium.
- fn 4 "what moves" (rack or cab): rack, with the cab staying at height, from the page's arrow on the rack and the free-hanging rack foot. Confidence low-medium; see the video lead.
- fn 7 "which steps build it is inferred": the page settles the function itself; steps not checked. Confidence high for the function.
- fn 9: the page draws no arrow on the deck fans; LEGO's text "rear fans that spin when you drive it" refers to the propellers. Not settled.
### Video leads
- fn 4: search summary (LEGO and retailer text): "a crane with an operator's cab", "raisable loading ramp", "rear fans that spin when you drive it". https://www.lego.com/en-nz/product/hovercraft-42076, https://www.brickfanatics.com/lego-sets/technic-2/hovercraft-3. Video lead: Erik to look whether the knob lifts the rack (crane hook) or the cab. Confidence low-medium.
- fn 9: no source mentions the deck fans. Video lead: Erik to look. Confidence low.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| what | 4 | the knob raises and lowers the white bridge; moves rack p697 and cab axle p726 | the knob moves the rack (crane arm with hook foot) up and down; the cab stays at height; take p726 out of moves (and put it in stays) | 42076-1-1 p.150 top left and middle | low-medium |
| source | 4 | note: which gear drives the rack is unsure | both gears drive it (8 tooth to 8 tooth) | crane.ldr; steps 212-215 p.133-134 | medium |
| video | 4 | as above | as above | p.150 | low-medium |
| video | 9 | deck fan rotors spin (inferred) | no arrow on them | p.151 | low |

## 42077 Rally Car
Booklets: 42077-1-1.pdf (188 pp, the only booklet of the main model, steps 1-295). Functions pages: 42077-1-1.pdf p.180-181 (one spread). Pages read: 8 closely + 2 contact sheets. Time: about 14 minutes.
### Functions page (blind reading)
1. p.180 top left (linked to the roof gear on p.181): the black gear on the roof turned → the front wheels steer (curved arrow round the front wheel).
2. p.180 bottom left: the bonnet tips up at its FRONT edge, hinged at the windscreen end (arrow up at the front). Only one half is raised in the photo; the other front fender is still down. The near door swings open (curved arrow).
3. p.181 top middle: the rear wheels rise and fall (two-way arrows on both rear wheels).
4. p.181 top right: the whole rear body (rear roof, rear wings, spoiler) tilts up from the back to show the engine and rear axle (two arrows up). A door swings open (arrow on the side).
5. p.181 bottom right: an x-ray view of the engine behind the seats: three yellow pistons in a row seen from the side (one bank of a V6). No arrow.
### Comparison
- fn 1 "roof gear steers": AGREES.
- fn 2 "pushed along, rear wheels drive the V6": NOT ON PAGE as a drive (book steps, not cited by number); the page shows the engine only (p.181 bottom right x-ray, p.181 top right).
- fn 3 "front wheels roll freely": NOT ON PAGE (inferred).
- fn 4 "all four wheels independently sprung": AGREES for the rear wheels; the front suspension is not on the page.
- fn 5 "bonnet lifts at its back edge, hinged at the front": DIFFERS. The page shows the front edge lifting, hinged at the windscreen end. Steps 193-195 (p.120-121) build each bonnet half (white panel with blue fender top) and pin it at its rear end, by the windscreen pillar. There are two halves (hood1.ldr and hood2.ldr), and the photo raises one. The control p813 (18944) sits directly in car.ldr at the front centre (car-local 0,-10,514): a fixed front panel, not part of the bonnet. The moves part p808 is in hood2.ldr (one half).
- fn 6 "two doors swing open": AGREES.
- fn 7 "rear body tilts up": AGREES.
- Missing from list: none (the bonnet's two halves may each need a function; see proposed changes).
### Doubts settled
- fn 1 "the steering's build steps are inferred": the page settles the function (roof gear, front wheel arrow). Confidence high. The source wording only.
- fn 2 "which steps is inferred": the page shows the engine (V6 seen side-on) but no drive arrow. Not settled from the booklet; I did not find the differential steps. Confidence medium that it is right, as the engine has no other input.
- fn 3 (inferred): not on page; no check made beyond the list's own reason. Confidence medium.
- fn 5 hinge side: settled by p.180 bottom-left photo and steps 193-195 (p.120-121): hinged at the windscreen end. Confidence medium-high. In the model file the halves' pivot (87082 at hood-local 0,0,-120) lands at car-local z of about 496, near the front bumper (514), which looks like the front: if so the model hinges the halves at the wrong end. Confidence low-medium on the model reading.
### Video leads
- fn 2 / fn 3: search summary: one Brickset reviewer says the car "doesn't have 4-wheel drive" and mentions a V6 (https://brickset.com/article/33243/review-42077-rally-car); RacingBrick's features video https://racingbrick.com/2017/12/lego-technic-42077-rally-car-speed-build-features/amp. This fits fn 2 and fn 3 (rear-wheel drive only). Video lead: Erik to look. Confidence medium.
### Proposed changes
| kind | fn | list says | booklet shows | page | confidence |
|---|---|---|---|---|---|
| what | 5 | the bonnet lifts at its back edge, hinged at the front | it lifts at its front edge, hinged at the windscreen end; it is two halves, each lifting alone | 42077-1-1 p.180 bottom left; steps 193-195 p.120-121 | medium-high |
| what | 5 | control p813 18944 (a fixed front panel in car.ldr) | the control must be a part of a bonnet half (hood1.ldr or hood2.ldr); consider one function per half | p.180; car.ldr | medium |
| model | 5 | the halves pivot near the front bumper (car-local z about 496) | pivot at the rear end, by the windscreen | steps 193-195 p.120-121 | low-medium |
| source | 1 | steering steps inferred | the page settles it | p.180-181 | high |
| video | 2, 3 | rear-wheel drive to V6, front free | engine shown, no drive arrow | p.181 | medium |
