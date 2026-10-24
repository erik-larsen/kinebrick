# Function lists from before 1990: review

Drafted 2026-10-23 from each set's instructions (scans in `omr/instructions/`), one JSON file per set here. 26 sets, 146 functions: 11 marked `skip` (only matter under gravity or force), 16 `inferred:` (the book doesn't show them, or there is no book). "Today" is what KineBrick does now, from trying each control as a drag would. This file is for the review only: answers go into the JSON files, and then it can go.

## Results

| Set | Today | Main problems |
|---|---|---|
| 850 Fork Lift | all work | The file leaves out an axle and 8 tooth gear from book step 13. |
| 851 Tractor | steering doesn't | 34 loose parts (front axle, steering); rolling tilts the hitch. |
| 852 Helicopter | mostly | Dragging a control stick does nothing (its cross shaft works); the skids swing. |
| 854 Go-Kart | all work | The number board swings on the front axle. |
| 855 Mobile Crane | all but shutters | Shutters fused to the frame; rubber band drawn in the wrong place. |
| 856 Bulldozer | all work | The front guard swings. |
| 950 Fork Lift | all work | Same file as the 850, part for part. |
| 952 Tractor | all work | Rolling by a front wheel swings the hitch lever. Its book turned out to be the 851's. |
| 956 Auto Chassis | all work | |
| 1972 Go-Kart | all work | Steering fixed: its slanted column's gear now meshes the rack. |
| 8020 Building Set (truck) | steering works | Rolling looks wrong: a front wheel flips or flings the model (to check). |
| 8024 Universal Set (racer) | steering works | Steering fixed (the 2790 steering rack); the engine's piston floats. |
| 8054 Universal Motor Set (buggy) | partly | The motor holds its shaft still, so the first belt can't turn. |
| 8832 Roadster | steering works | Steering fixed (the 2790 steering rack); the shock absorber is rigid; wheels don't roll right. |
| 8835 Forklift | steering only | No chain, so the forks don't rise; the mast won't tilt; the fork carriage is loose. |
| 8841 Dune Buggy | all work | The roll cage's toggle joints hinge a little. |
| 8844 Helicopter | wheels only | Gears loose or overlapping, no chain, the rotors' crown gears tilted 2° out of mesh, the airframe folds. |
| 8845 Dune Buggy | none | The steering column isn't joined (newer universal joint 62519), the pinion is 6 LDU off the rack, the shocks don't telescope. |
| 8848 Power Truck | steering, differential | The levers do nothing when dragged; the bucket swings freely. |
| 8849 Tractor | partly | Steering fixed; a 24 tooth gear sits 2 LDU off its axle, so the lift stops at the worm. |
| 8851 Excavator | partly | Pneumatic cylinders come apart (barrels and caps have no connection data); track links stuck to the cab. |
| 8854 Power Crane | partly | Steering and slewing gears don't mesh; the hook and boom extension are loose; cylinders don't slide. |
| 8855 Prop Plane | partly | The propeller is a merged shortcut part on the frame; the stick and its linkages float or lock. |
| 8859 Tractor | none fully | The steering gear now slides the rack, but the steering wheel's mount is loose; the differential's bevel doesn't mesh; the cab and legs hinge. |
| 8862 Backhoe | mostly | The loader arm bends at a one-pinned brace; cylinders turn instead of sliding; rear wheels spin in place. |
| 8865 Test Car | steering only | Engine, gearbox, differential, suspension, sliding seats and headlights all locked or loose. |

## What would fix the most

1. ~~**Pinion and rack steering**~~ (1972, 8024, 8832, 8849, 8859): fixed. A slanted column's gear now meshes its rack, gears up to 4.5 LDU off a rack mesh, the 2790 steering rack is a round rack sliding through its holder, and a rack carried round by an axle rocking on the steering shaft isn't given a straight guide that jams it. The 8845's file puts its gear a whole plate into the rack, which is the file's error.
2. **Pneumatic cylinders** (8851, 8854, 8862): rods turn with what they push instead of sliding in their barrels; barrels and caps (127, 128) have no connection data.
3. **Shock absorbers** (8832, 8845, 8865): rigid, or their halves don't telescope.
4. **Toothed toggle joints and half bushes** (8841, 8845, 8849, 8855, 8859): they hinge freely instead of locking.
5. **Gears that should mesh but don't** (8854, 8859, 8865, 8844): the 73071 differential's bevel, and gears placed a little off.
6. **Chains as drives** (8835, 8844).
7. **A control part that does nothing while its shaft works** (852 sticks, 8848 levers).
8. **Loose parts in the OMR files** (851, 8844, 8851, 8854, 8855, 8859, 8865): some are the file's fault, which could be fixed in `models/sets.json` lines.

## Questions for you

- **850 / 950:** book step 13 adds an axle under the mast-top axle with an 8 tooth gear on the 24 tooth gear. What is it for: a slower crank, or a brake? Are the levers by the seat just decoration?
- **851:** does the lever lift the hitch, or only hold it at one height?
- **852:** do the sticks change the blades' pitch together, or tilt the rotor? Should the skids be rigid?
- **854:** should the number board on the nose stay put?
- **856:** which handwheel lifts the arms and which tips the bucket? Should the front guard be fixed?
- **952:** which way does the lever lower the harrow?
- **956:** is the rear seat's armrest meant to fold?
- **1972:** anything moving besides steering and wheels?
- **8024:** is the knob on the rear deck the steering? What is the 8 tooth gear under it for? Should the nose hinge?
- **8832:** does the shock's top attach to the roll bar's top axle?
- **8835:** does the tilt wheel turn all the way round, or only part way?
- **8841:** is the seat back meant to fold?
- **8844:** does the crank retract the landing gear? Should the blades be rigid on the hub?
- **8848:** what does each yellow lever do? Is the front 24 tooth gear a knob or a ratchet? What does the forward drive shaft drive without a motor?
- **8849:** do the toothed half bushes lock the hitch's lower links to the cross axle? Is the exhaust stack meant to turn as you steer? Is only the left rear wheel driven?
- **8851:** is the slew meant to turn freely, or is it clamped by the nut?
- **8854:** is the trans-yellow beacon on the cab roof the steering knob? Do the feet tilt?
- **8855:** which way does each control surface go for each stick direction?
- **8859:** does the lever raise the hitch? Does the bonnet hinge up?
- **8862:** which valve works which cylinder? Does the bonnet lift? Do the outrigger feet tilt? Is the loader arm's brace pinned at both ends?
- **8865:** does the red lever raise the headlights? How far apart are the gear lever's three positions? Should the reclining seats be functions or `skip`?

# 1990 to 2009: review

Drafted 2026-10-24 from each set's instructions, 55 sets (the OMR's from 1990 to 2009, the bundled 8880 and 8448 among them), 332 functions. "Today" comes from trying each control as the joints probe reads the set. The first passes for sets in `omr/` used a helper that read them with only the bundled models' connection table and counted inline primitives as parts; every set was rechecked with the fixed helper, and the 8856 and 8074 files renumbered.

## Results

| Set | Today | Main problems |
|---|---|---|
| 8094 Control Center (robot arm) | partly | The base motor's crown gear isn't driven; the claws move with the whole arm; the chute swings. Its rubber bands aren't in the file. |
| 8825 Night Chopper | partly | Nothing meshes the handwheel to the rotors (the tail shaft's bevel sits 20 LDU above the crown gear's axis). |
| 8830 Rally 6-Wheeler | all work | |
| 8840 Rally Shock n' Roll Racer | partly | The slanted pinion sits 4.8 LDU off the rack, just past the tolerance; the swing arm and shocks don't work; the V2's pistons don't move. |
| 8850 Rally Support Truck | partly | The prop shaft's bevel doesn't mesh the differential; the V6's input gear isn't joined to its crank; the cab-side beams miss their pins by 15 LDU. |
| 8074 Universal Set with Flex System (tower crane) | none | The Flex cables pass nothing on; the winch's string doesn't wind. |
| 8810 Cafe Racer | partly | The fork doesn't turn on the steering head; the shocks don't telescope; the rear wheel is on the frame. |
| 8815 Speedway Bandit | all work | |
| 8820 Mountain Rambler | partly | Steering locked (its holder hinged to the frame); the swing arm doesn't carry the wheels. |
| 8838 Shock Cycle | partly | The fork is loose; the shocks don't telescope; the file never places its `Axle-with-Gears` submodel, so the wheel can't reach the engine. |
| 8826 ATX Sport Cycle | mostly | Steering works from the top clamp, but the grips only spin. |
| 8856 Whirlwind Rescue | partly | The tail bevels don't mesh; a worm sits 32 LDU from its gear where 30 are needed; Flex cables; the rotor head can't tilt. |
| 8828 Front End Loader | partly | Lift and steering work; the bucket's Flex cables and loose bucket don't; the old 2857 tyres are loose. |
| 8836 Sky Ranger | partly | The stick's toggle spins; Flex cables; the main gear's shock doesn't shorten. |
| 8837 Pneumatic Excavator | partly | Valves and cylinders don't work; the chassis, turntable halves and bucket are loose. |
| 8868 Air Tech Claw Rig | partly | Steering works; valves are on the frame and cylinders come apart; the differential's bevel doesn't drive the prop shaft. |
| 8022 Starter Set (plane) | partly | The gears are right, but the plane swings round its single wheel axle. |
| 8824 Hovercraft | partly | The propeller's mount spins with the drive; toothed toggles hinge. |
| 8032 Universal Set (saw) | all work | |
| 8062 Universal Set with Storage Case (hockey player) | partly | The goal and puck ride with the stick; the stick sits on one of its two axles. |
| 8808 Formula One Racer | all work | The rear wing's 4864a panels are loose. |
| 8880 Super Car | mostly | Suspension, rear hatch and seats don't move. |
| 8202 Bungee Chopper | partly | Turning a rear wheel swings the whole model round the axle; the 2994 wheels have no axle hole in the library table. |
| 8203 Rover Discovery | mostly | The cage tilts both ways where the nose should only go down. |
| 8204 Sky Flyer 1 | none | Rubber-band belt; the plane tips round its single axle. |
| 8208 Custom Cruiser | none | The fork on one friction pin is rigid; the rear wheel is on the frame; turning a wheel turns the whole bike 2-2.7 rad (to look at). |
| 8209 Future F1 | mostly | The rear suspension is fused to the front. |
| 8217 The Wasp | all work | |
| 8218 Trike Tourer | mostly | The fork on one friction pin is rigid. |
| 8245 Robot's Revenge | partly | rideAlong glues the buggy and robot together; the 2994 wheels; the step-18 knob is missing from the file. |
| 8257 Cyber Strikers | partly | rideAlong welds the two strikers together hundreds of LDU apart; tracks not recognised. |
| 8448 Super Street Sensation (convertible) | partly | A duplicate universal joint breaks the steering column; the 32198 bevel pair to the prop shaft doesn't mesh. |
| 8001 Battle Droid | mostly | The catch button and the backpack gear don't work. |
| 8002 Destroyer Droid | mostly | The plunger can't slide; the shell is the frame. |
| 8464 Pneumatic Front End Loader | partly | The front and rear frames are fused, so it can't bend to steer; valves and cylinders are on the frame. |
| 8466 4x4 Off-Roader | partly | The wheels don't connect to the half shafts; the gear lever and selector aren't in the file; the rack isn't a slider. |
| 8012 Super Battle Droid | partly | Elbows fused; most leg parts loose. |
| 8416 Forklift | partly | The bevels below the mast don't mesh; the steering is locked; 93 parts loose (the fork carriage). |
| 8418 Mini Loader | partly | The bucket and all four wheels are loose. |
| 8419 Excavator | partly | The 20 tooth bevel pair in the turntable centre doesn't mesh; the treads are loose. |
| 8281 Mini Tractor | partly | The rear axle's 20 and 12 tooth bevels don't mesh. |
| 8283 Telehandler | partly | Steering works; the boom won't lift or extend; the bucket is loose. |
| 8285 Tow Truck | partly | Rims loose; a worm 60 LDU from its gear (misplaced in the file); the boom's strut fused into it; a clutch gear drives the engine from the steering. |
| 8289 Fire Truck | partly | Knob wheels don't mesh, so the outriggers and ladder don't work. |
| 8270 Rough Terrain Crane | partly | The luffing arms aren't joined to the boom; the hook is loose. |
| 8272 Snowmobile | partly | Unequal ski steering; the track's links scatter; the track frame swings free. |
| 8273 Off Road Truck | partly | The roof knob, slewing and luffing don't reach; the bed tips. |
| 8274 Combine Harvester | none fully | The header (164 parts) isn't joined to the combine; knob gears don't mesh. |
| 8275 Motorized Bulldozer | none | Every motor's gear is on the frame: KineBrick's Power Functions motors hold their shafts still, so nothing a motor drives can turn. |
| 8063 Tractor with Trailer | partly | Rolling runs the engine and the power take-off; the three-point linkage partly lifts; the roof gear's steering moves nothing; the trailer partly tips. |
| 8256 Super Kart | mostly | The steering column's foot isn't joined to the tie rod. |
| 8258 Crane Truck | partly | The file places no wheels, and its hook is in a submodel it never uses; outriggers and slewing don't work. |
| 8259 Mini Bulldozer | all work | |
| 8260 Tractor | mostly | The bucket is loose. |
| 8261 Rally Truck | partly | Knob gears and a 12/20 tooth bevel pair don't mesh; the rear arms are fused. |

## What would fix the most

1. ~~**Bevel pairs that should mesh but don't**~~ (8281, 8419, 8448, 8850, 8868, 8416, 8261): fixed in the gear data. The old 20 tooth bevel (32198) had no teeth; the 12 and 14 tooth bevels' radii were measured off their shapes rather than LEGO's tooth size, so they couldn't mesh with gears of other sizes; and the old differential's 28 tooth crown wheel (73071's 4142), which a 14 tooth bevel pinion drives, had no teeth. Still to look at: the 8419's stick linkage locks on its own, the 8859 stops 0.2 rad into rolling from a wheel, and the 8825's tail shaft bevel sits 20 LDU above its crown gear's axis.
2. **Knob wheels (32072) meshing with each other** (8289, 8261, 8274, 8273, 8258).
3. **Shock absorbers that telescope** (8810, 8838, 8840, 8836, 8272, 8261, 8466, 8209, 8448, 8257).
4. **Pneumatic cylinders and valves** (8837, 8868, 8464, 8285).
5. **Flex cables and rubber-band belts as push rods and drives** (8074, 8828, 8836, 8856, 8204, 8094, 8868).
6. **Forks and steering heads** (8208, 8218, 8810, 8838: a fork on one friction pin is held rigid; the 2904 steering head).
7. **Wheels the library table can't seat**: the 2994 has no axle hole (8202, 8208, 8245).
8. **rideAlong across separate models in one file** (8245, 8257, 8062) glues them together.
9. **A tilted pinion measured from its nearer edge** (8840): 4.8 LDU off at the gear's middle, about 3.2 at its edge.
10. **Motors that hold their shafts still** (8275, 8054, 8094): a motor should be a control that turns its shaft.
11. **Errors in the files**: 8258 (no wheels, hook unused), 8466 (no gear lever), 8838 (submodel never placed), 8245 (knob missing), 8285 (worm misplaced), 8448 (duplicate universal joint), 8850 (beams miss their pins).

## Questions for you

The agents' questions are in their reports; the ones that decide a function:

- **8094:** does one arm motor both grip and lift?
- **8825:** does the tail shaft's front bevel really mesh the crown gear, 20 LDU above its axis?
- **8840:** is the rear wing meant to tilt?
- **8850:** what is the axle out of the back for? Does the front bar swing?
- **8074:** does one cable train luff the jib and the other swing the tip arm?
- **8810:** does the parking stand fold?
- **8838:** do the rubber bands hold the stand up or down?
- **8856:** which way does the landing gear fold? Does the high left crank swing the hoist arm?
- **8828:** right crank lift, left crank bucket? Does the 8720 motor drive the lift?
- **8836:** does the stick's toggle grip the floor shaft?
- **8837 / 8868 / 8464:** which valve works which cylinder?
- **8824:** does the propeller swivel with the steering, like a rudder?
- **8032:** what is the model, and is its crown gear a saw blade?
- **8880:** what lifts with the rear hatch? Do the seats recline? Is turning the engine by its fan a function?
- **8202:** is it wound by pulling it back? Is the idler arm a one-way clutch?
- **8208 / 8218:** does the fork swivel on its single friction pin to steer?
- **8209:** is the rear meant to be suspension?
- **8245:** what releases the robot's head, and which way do its arms spring?
- **8257:** is the 6572 the trigger, and is the seat fixed to its lever?
- **8448:** how many speeds does the gate give? Do the headlights pop up, and the convertible's seats fold?
- **8001:** do the knees bend? **8002:** do the blasters bend at the elbow, and is the back leg linked to the shell?
- **8466:** what do the two push-down axles on the roof do? Which panels swing with each door?
- **8012:** does the blaster rod tilt the blasters?
- **8416:** is the beacon the steering, the mast two-stage, the tilt worked by the roof levers?
- **8419 / 8283:** which rear knob does which?
- **8281:** does the lever pivot on the rear axle, lifting the tedder?
- **8285:** front left winch, rear left boom, right side extension? Do the side lockers open?
- **8289:** which side gears slew and which raise the ladder?
- **8270:** does the inner boom slide? **8273:** does the rear bogie rock? **8274:** how does the 24 tooth gear lift the feeder?
- **8275:** which M motor works the blade and which the ripper? **8063:** what does the red lever engage?
- **8261:** is the front axle pendular? **8260:** is the steering wheel decoration?
