# Function lists from before 1990: review

Drafted 2026-10-23 from each set's instructions (scans in `omr/instructions/`), one JSON file per set here (then in `data/functions/`). 26 sets, 146 functions: 11 marked `skip` (only matter under gravity or force), 16 `inferred:` (the book doesn't show them, or there is no book). "Today" is what Kinebrick does now, from trying each control as a drag would. This file is for the review only: answers go into the JSON files' `curated`, and its results are to be replaced by each file's `generated`.

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
| 8849 Tractor | all work | Steering fixed; the 24 tooth gear 2 LDU off its axle is corrected, and the toothed half bushes now lock the hitch's lower links to the cross axle, so the handwheel raises the hitch. |
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
4. **Toothed toggle joints and half bushes** (8841, 8845, 8849, 8855, 8859): a toothed half bush with its teeth against a toothed toggle joint's now locks the toggle joint to its axle, as in 11 bundled models (the 8849's hitch rises; the 8854's and 8862's feet tilt). Still to look at: the 8841's and 8845's toggle joints, which hinge, have no toothed half bush against them.
5. **Gears that should mesh but don't** (8854, 8859, 8865, 8844): the 73071 differential's bevel, and gears placed a little off.
6. **Chains as drives** (8835, 8844).
7. **A control part that does nothing while its shaft works** (852 sticks, 8848 levers).
8. **Loose parts in the OMR files** (851, 8844, 8851, 8854, 8855, 8859, 8865): some are the file's fault, which could be fixed with lines in a set's `curated.settings`.

## Questions for you

They're now each set's `curated.questions`, in its JSON file here, each under every set it names. Answer them there.

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
| 8275 Motorized Bulldozer | none | Every motor's gear is on the frame: Kinebrick's Power Functions motors hold their shafts still, so nothing a motor drives can turn. |
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

They're now each set's `curated.questions`, in its JSON file here, each under every set it names. Answer them there.

# 2010 to 2021: review

Drafted 2026-10-24 from each set's instructions, 104 sets (every OMR set from 2010 to 2021), 737 functions. "Today" is a quick automated check of every function with a control: worked as a drag would, it counts as working if the control turns half a radian and every part its `moves` lists moves, partly if something moves, and not at all if nothing does. A rough measure (a wheel's "rolls freely" counts as working if the wheel turns), to be replaced by a proper check in the probe. Left and right are the vehicle's own, its front at -z, so its left at +x (as the 8880 Super Car's left-hand-drive steering wheel shows); one agent had them the other way round, and its nine files were swapped back.

## Results

| Set | Today (works / partly / not) | Main problems |
|---|---|---|
| 8049 Tractor with Log Loader | 2 / 2 / 3 | Roof knob doesn't reach the rack; slew knob turns only its own axle; pump on the frame. |
| 8081 Extreme Cruiser | 4 / 1 / 3 | Engine and differential work; roof steering and doors don't. |
| 8110 Mercedes-Benz Unimog U 400 | 1 / 1 / 0 | Checking timed out (its motor drags the whole model); weakest draft, every line to check. |
| 9390 Mini Tow Truck | 3 / 0 / 0 | Steering and winch work; hook and string loose. |
| 9391 Crawler Crane (Tracked Crane) | 3 / 0 / 1 | Luffing works; slewing from the back knob doesn't; track links scattered. |
| 9392 Quad Bike | 0 / 2 / 3 | Chain drive, steering column and swing arm don't move; 26 chain links loose. |
| 9393 Tractor | 4 / 1 / 1 | Roof steering and the tedder's power take-off don't move; hitch worm a little. |
| 9394 Jet Plane | 3 / 2 / 0 | Wings, landing gear, canopy and tailplanes move only slightly. |
| 9395 Pick-Up Tow Truck | 2 / 2 / 2 | Roof steering, gear lever and side knob don't move; winch works from inside. |
| 9396 Helicopter | 1 / 0 / 5 | Fragmented bodies: the tail boom hangs off the tail rotor's shaft; selector levers don't work. |
| 9397 Logging Truck | 1 / 2 / 5 | Frame is only 56 parts, the chassis a chain of jointed bodies. |
| 41999 4 x 4 Crawler Exclusive Edition | 0 / 2 / 4 | Every Power Functions element is an LDCad path cap, not a part; axle housings have no joint. |
| 42000 Grand Prix Racer | 2 / 0 / 4 | Steering and engine work; the side knob moves nothing; rims and tyres loose. |
| 42004 Mini Backhoe | 4 / 1 / 3 | Loader works; roof steering and backhoe boom and stick don't; both buckets loose. |
| 42006 Excavator | 2 / 0 / 3 | Knob reaches only the selector shafts; boom and grab trains work when driven directly. |
| 42020 Twin-rotor Helicopter | 4 / 0 / 0 | All work. |
| 42021 Snowmobile | 4 / 0 / 0 | All work. |
| 42022 Hot Rod | 2 / 2 / 0 | Steering and engine work; side panels barely move. |
| 42023 Construction Crew | 2 / 1 / 1 | Roof steering locked; dump body on the frame. |
| 42024 Container Truck | 1 / 2 / 2 | Steering and the gearbox selector locked. |
| 42026 Black Champion Racer | 2 / 0 / 1 | Pull-back motor holds the rear wheels. |
| 42029 Customized Pick up Truck | 4 / 3 / 1 | Steering and bonnet work; the selector lever is locked; hook loose. |
| 42031 Cherry Picker | 4 / 0 / 0 | All work. |
| 42032 Compact Tracked Loader | 2 / 0 / 2 | Lift works; the bucket and fork levers are rigid on the arms. |
| 42033 Record Breaker | 2 / 0 / 2 | Pull-back motor holds the rear wheels. |
| 42034 Quad Bike | 0 / 0 / 2 | Pull-back motor holds the rear wheels. |
| 42035 Mining Truck | 4 / 0 / 1 | Engine and tipping work; the steering rack is jointed as turning, not sliding. |
| 42036 Street Motorcycle | 0 / 3 / 3 | Fork, handlebars and kickstand on the frame; many loose parts. |
| 42037 Formula Off-Roader | 3 / 2 / 1 | Steering and engine work. |
| 42038 Arctic Truck | 4 / 3 / 2 | Steering works; the selector and actuators don't. |
| 42039 24 Hours Race Car | 4 / 3 / 2 | Engine and steering work; the selector's ring doesn't couple. |
| 42040 Fire Plane | 3 / 1 / 4 | Joystick doesn't reach the control surfaces; the hatch is loose. |
| 42041 Race Truck {Reissue} | 3 / 1 / 1 | Engine works; the roof gear moves nothing (knob wheels). |
| 42042 Crawler Crane | 3 / 0 / 6 | Motor shaft on the frame; tracks and hoist work from their ring shafts, slew and luff don't. |
| 42043 Mercedes-Benz Arocs 3245 | 6 / 0 / 7 | Motor's output axle on the frame; valves and pump loose; beacons do steer both front axles. |
| 42044 Display Team Jet | 3 / 0 / 0 | Works, the canopy's flexible axles being submodels. |
| 42045 Hydroplane Racer | 1 / 1 / 0 | Engine works; its propeller gear isn't joined to the crank. |
| 42046 Getaway Racer | 0 / 0 / 2 | Pull-back motor holds the rear wheels. |
| 42047 Police Interceptor | 2 / 0 / 0 | All work. |
| 42048 Race Kart | 1 / 2 / 1 | Steering wheel doesn't steer; the gear lever rocks but the ring doesn't slide. |
| 42049 Mine Loader | 2 / 1 / 2 | Rolling and engine work; articulation, claw and arm don't. |
| 42050 Drag Racer | 3 / 1 / 1 | Steering and engine work; the bodywork lever and wheelie knob are jammed. |
| 42052 Heavy Lift Helicopter | 1 / 0 / 5 | Motor jammed; levers turn alone. |
| 42053 Volvo EW160E | 4 / 0 / 1 | Steering and slewing work; pneumatics are custom parts; boom, stick and grab one body. |
| 42054 CLAAS XERION 5000 TRAC VC | 5 / 1 / 8 | Motor on the frame; steering turns the whole cab; jib has no joint. |
| 42055 Bucket Wheel Excavator | 3 / 2 / 5 | Mine truck all loose; motor fused to the boom; many drive shafts stuck. |
| 42056 Porsche 911 GT3 RS | 5 / 3 / 3 | Steering, hood and wing work; paddles locked; doors fused. |
| 42057 Ultralight Helicopter | 3 / 0 / 2 | Rotor and propeller spin free on their pins. |
| 42058 Stunt Bike | 1 / 0 / 1 | Pull-back motor holds the rear wheel; the ramp is fused to it. |
| 42059 Stunt Truck | 1 / 0 / 1 | Pull-back motor holds the rear wheels. |
| 42060 Roadwork Crew | 3 / 0 / 5 | Truck steering, tipper and excavator cranks locked; excavator bucket fused onto the tipper. |
| 42061 Telehandler | 4 / 1 / 1 | Four-wheel steering works; boom lift and extension barely move. |
| 42062 Container Yard | 4 / 0 / 6 | Truck steering works; the reach stacker's steering, boom and claws are locked. |
| 42063 BMW R 1200 GS Adventure | 2 / 0 / 3 | Engine works; the front fork has no joint. |
| 42064 Ocean Explorer | 5 / 3 / 1 | Crane partly; the helicopter's rotor shaft is joined to the helipad. |
| 42065 RC Tracked Racer | 1 / 0 / 4 | Motors' sprocket axles on the frame. |
| 42066 Air Race Jet | 2 / 2 / 2 | Motor loose; worms nearly jammed. |
| 42068 Airport Rescue Vehicle | 4 / 0 / 2 | Steering works; the tool tray is loose. |
| 42069 Extreme Adventure | 5 / 2 / 1 | Rear axle hangs only on its shocks; side panels on the frame. |
| 42070 6x6 All Terrain Tow Truck | 0 / 2 / 8 | Motor gearbox jointed loose; battery box loose; little works. |
| 42071 Dozer Compactor | 1 / 2 / 0 | Articulated steering works; blade knob won't turn. |
| 42072 WHACK! | 1 / 0 / 2 | Pull-back motor holds the rear wheels. |
| 42073 BASH! | 2 / 0 / 1 | Mostly works. |
| 42074 Racing Yacht | 1 / 1 / 1 | Winch cranks and rubber-band loops don't turn; rolling swings the hull. |
| 42075 First Responder | 6 / 0 / 2 | Steering, engine and winch work. |
| 42076 Hovercraft | 3 / 0 / 6 | Propeller drive and ramp work; stern steering and gantry don't; carriage loose. |
| 42077 Rally Car | 4 / 0 / 3 | Steering moves slightly (a knuckle jams); doors on the frame. |
| 42078 Mack Anthem | 3 / 2 / 8 | Pistons hinged to the frame; steering gear jammed; crane drives jammed. |
| 42079 Heavy Duty Forklift | 4 / 0 / 2 | Rear steering and engine work; inner mast has no joint. |
| 42080 Forest Machine | 2 / 1 / 5 | Cab is the frame; valves and motor on the frame. |
| 42081 Volvo Concept Wheel Loader ZEUX | 6 / 0 / 2 | Chassis has no joint to the rear body; actuators only spin their inputs. |
| 42082 Rough Terrain Crane | 7 / 0 / 2 | Motor-side driving ring welded in; inner boom floats; steering and lever don't turn. |
| 42083 Bugatti Chiron | 4 / 0 / 4 | Steering, doors and wing work; rolling barely reaches the gearbox; key lies on the ground. |
| 42084 Hook Loader | 2 / 0 / 1 | Hook arm works; steering locked. |
| 42088 Cherry Picker | 3 / 0 / 1 | Boom worm locked; slewing works. |
| 42092 Rescue Helicopter | 3 / 1 / 1 | Rotor and winch gears work; tail propeller on a friction pin. |
| 42093 Chevrolet Corvette ZR1 | 2 / 2 / 0 | Rolling stops short of the crank (12/8 tooth gears 20 LDU apart); steering gear doesn't reach. |
| 42094 Tracked Loader | 2 / 3 / 2 | Actuator jams after 4 LDU; front knob doesn't reach the turntable. |
| 42095 Remote-Controlled Stunt Racer | 1 / 0 / 3 | Motors' gears and track links on the frame. |
| 42096 Porsche 911 RSR | 4 / 0 / 1 | Steering works; rolling doesn't reach the half shafts. |
| 42099 4x4 X-treme Off-Roader | 1 / 0 / 6 | 106 loose parts; motor gears locked; rack drags the hubs erratically. |
| 42100 Liebherr R 9800 | 2 / 0 / 7 | Motor gears fused; turntable top turns alone; track clutch halves break the drive. |
| 42110 Land Rover Defender | 6 / 2 / 5 | Steering and winch work; levers locked; tailgate and lids fused. |
| 42101 Buggy | 3 / 0 / 1 | Steering gear stuck; swing arm works. |
| 42102 Mini CLAAS XERION | 4 / 0 / 0 | Steering works; the rake drive doesn't. |
| 42105 Catamaran | 0 / 2 / 2 | Rudders and daggerboards don't move from their controls. |
| 42106 Stunt Show Truck & Bike | 6 / 0 / 2 | Steering works; trailer ramp and bike gears locked. |
| 42107 Ducati Panigale V4 R | 1 / 3 / 3 | Gear lever locked; fork on the frame; rear wheel loose. |
| 42108 Mobile Crane | 2 / 4 / 1 | Steering, outriggers, slewing and winch work; luffing and extension don't; inner boom no joint. |
| 42109 App-Controlled Top Gear Rally Car | 0 / 0 / 4 | Whole drivetrain on the frame. |
| 42111 Dom's Dodge Charger | 6 / 1 / 1 | Steering, bonnet and boot work; wheelie lever locked; rack has no joint. |
| 42112 Concrete Mixer Truck | 4 / 2 / 2 | Steering works; the drum barely moves; chute locked. |
| 42113 Bell-Boeing V-22 Osprey | 1 / 1 / 6 | Motor on the frame; buttons loose; rotors and nacelles jammed. |
| 42114 6x6 Volvo Articulated Hauler | 2 / 0 / 5 | Motors on the rear frame; actuators and two driving rings loose. |
| 42115 Lamborghini Sián (Sian) FKP 37 | 2 / 1 / 7 | Steering works; paddles move only their linkage; rolling doesn't reach the engine. |
| 42116 Skid Steer Loader | 2 / 0 / 1 | Both knobs work, the arm knob also moving the bucket. |
| 42120 Rescue Hovercraft | 2 / 2 / 1 | Steering and drive coupled, each moving the other's parts. |
| 42121 Heavy Duty Excavator | 3 / 0 / 1 | Boom knob turns boom, actuator and stick rigidly; side knob on the frame. |
| 42122 Jeep Wrangler | 3 / 0 / 5 | Winch works; steering and both axle turntables locked; doors on the frame. |
| 42123 McLaren Senna GTR | 2 / 1 / 1 | Steering and engine work; doors on the frame. |
| 42124 Off-Road Buggy | 2 / 0 / 4 | Motors on the frame; steering crank 0.07 rad; front arms locked. |
| 42125 Ferrari 488 GTE AF CORSE #51 | 5 / 0 / 2 | Engine and doors work; the steering column's axle is loose. |
| 42129 4x4 Mercedes-Benz Zetros Trial Truck | 2 / 1 / 4 | Motors' gears fused; axle bodies have no joint; lock rings loose. |
| 42131 Cat D11 Bulldozer | 1 / 0 / 9 | All four motor shafts on the frame; actuators spin instead of extending. |

In all: 277 functions work, 90 partly, 267 not.

## What would fix the most

1. **Motors that hold their shafts still** (8110, 41999, 42042, 42043, 42052, 42054, 42055, 42065, 42066, 42070, 42080, 42082, 42095, 42099, 42100, 42109, 42113, 42114, 42124, 42129, 42131): a Power Functions or Powered Up motor should be a control that turns its output; today its output, and often the gear on it, is fixed to the motor. By far the most common: most big sets from 2010 on have a motor.
2. **Pull-back motors that hold their axles** (42026, 42033, 42034, 42046, 42058, 42059, 42072): the same, for the spring motor's axle.
3. **Gear selectors that don't shift** (9395, 9396, 42006, 42024, 42029, 42038, 42039, 42048, 42052, 42056, 42083, 42107, 42110, 42112, 42115): levers on changeover catches, rotary catches and paddles don't slide their driving rings, so a gearbox stays in whatever gear its file builds it in. The 8880's and 956's gear levers work through the viewer's shift; these need the same, from the lever.
4. **Linear actuators that extend** (42038, 42049, 42061, 42070, 42078, 42081, 42094, 42108, 42121, 42131): their halves turn together or spin instead of sliding.
5. **Bodies with no joint, floating** (41999, 42063, 42069, 42079, 42081, 42082, 42108, 42129): inner boom sections, axle housings, front forks.
6. **Hinged doors, lids and panels fused to the frame** (42056, 42069, 42077, 42110, 42122, 42123).
7. **Steering trains that stop short** (8049, 9393, 9395, 42023, 42041, 42076, 42093, 42122): knob wheels, gears just off mesh, a rack jointed as turning (42035).
8. **Pneumatics** (8049, 8110, 42043, 42053, 42080).
9. **Errors in the files**: 41999 (every Power Functions element an LDCad path cap, not a part), 42083 (its key lies on the ground), 42123 (leaves out step 220's roof gear), 42107 (its fork shocks, 65151-f1, aren't in the LDraw library), 42055 (the mine truck all loose), 9397 (a 56-part frame, the chassis a chain of bodies), 42093 (two submodels 2 LDU off centre).

## Instruction books out of order

LEGO's PDF numbering doesn't always follow the books: 8110 (-1, -5, -2, -3, -4 are books 1 to 5), 8275 (-1 is book 3), 8448 (-2 is book 1), 9394 (-2 is book 1, -3 the alternate), 9396 (-2 is book 3), 42024, 42029 and 42082 (-2 is book 1), 42032, 42035, 42036 and 42037 (-2 builds the main model, -1 the alternate). This belongs with each set's record, so nobody works it out twice.

## Questions for you

They're now each set's `curated.questions`, in its JSON file here, each under every set it names. Answer them there.
