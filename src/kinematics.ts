// Moves a mechanism: works out which motions its joints and ground contacts allow, and
// carries them out. See "How it works" in ARCHITECTURE.md, step 7.
//
// How the motion is described
// ---------------------------
// At any instant, each body's motion is a *twist*: an angular velocity ω (how fast it turns,
// about which axis) and a velocity v (how fast the point at the model's origin moves with it).
// Any point p on the body then moves at  v + ω × p.  That's 6 numbers per body, and all the
// bodies' numbers together form one long motion vector.
//
// Joints and ground contacts each say "these points must move together" or "this point must
// not move", which are linear equations on the motion vector. The motions that satisfy all of
// them (the equations' null space) are the motions the user can drive. The car has exactly
// one: rolling along its length.
//
// Positions are kept as one pose per *root* body (the frame) plus an angle per turning joint,
// and every other body's pose is rebuilt from those, following a tree of turning joints out
// from the root. That keeps those joints exactly together however long the model is dragged.
// The joints the tree doesn't follow (one per closed loop of parts, and every slide and ball
// joint) are pulled back together after each step (see closeLoops). A body reached only
// through those, such as a piston, is a root of its own.

import { Matrix4, Quaternion, Vector3 } from 'three';
import { Joint, Mechanism, StringLine } from './mechanism.ts';
import { StringCircle, stringLayout } from './paths.ts';
import { links, spinners } from './constraints/balls.ts';
import { couplings } from './constraints/couplings.ts';
import { acrossDirections, addPointVelocity, axisOf, type Connection, DOWN, DRIVE_WEIGHT, type Equations, STUD, UP } from './constraints/equations.ts';
import { gears, meshContact } from './constraints/gears.ts';
import { holdRows, holds } from './constraints/holds.ts';
import { joints } from './constraints/joints.ts';
import { loops } from './constraints/loops.ts';
import { rails } from './constraints/rails.ts';
import { rests, restingOn } from './constraints/rests.ts';
import { screws } from './constraints/screws.ts';
import { hungFrom, strings } from './constraints/strings.ts';
import { tyres } from './constraints/tyres.ts';
import { TRACE, trace, traceJam } from './trace.ts';
import { BodyRow, combine, dampedSolution, dot, EPSILON, fromBasis, gramOf, inBasis, leastTurning, mixes, dotsWith, NotFinite, nullSpace, orthonormalize, rowsTimes, RANK_TOLERANCE, Row, smallestTurning, solveSymmetric, supportOf, symmetricEigen, Tier, without } from './linalg.ts';
// The inference (src/inference/racks.ts and rests.ts) imports these from here.
export { acrossDirections, nullSpace };

// Each kind of connection's equations (see src/constraints/), in the order they're written: the
// order of the rows decides which the elimination takes first, and so the motions to the last bit.
const CONNECTIONS: Connection[] = [holds, joints, couplings, spinners, links, gears, screws, rests, tyres, rails, loops, strings];

// How close a tyre must be to the ground to count as touching it, in LDU. Models are often
// built half an LDU out (an official tractor's front tyres sit half an LDU above its rear ones).
const GROUND_TOLERANCE = 1;
// How far past the end of its travel a slide may go, in LDU, before it counts as there: closing
// the loops leaves a slide built at its end a hair past it.
const LIMIT_TOLERANCE = 1e-6;
// How far a tyre must roll in a step, in LDU, for that step to set its scrub rate (see
// Kinematics.treadScrubRate): the tiny steps that close a loop or settle the model on the ground
// would make it meaningless.
const MIN_ROLL = 0.01;

// How far a tyre may scrub sideways, as a fraction of how far it rolls, unless a model says
// otherwise (see Kinematics.scrub and freeMotions): real steering only approximates every
// wheel turning round one centre, and real tyres scrub. Enough for a car whose front wheels
// turn alike (an official fork-lift truck's) to roll with its steering well turned.
export const DEFAULT_SCRUB = 0.1;
// How far a tyre may scrub sideways rolling any way but the one that scrubs least, however
// much more scrub is allowed (see freeMotionsApart): else a steered car could also scrub its
// way straight on.
const USUAL_SCRUB = 0.02;
// How many times as much a drag may turn things with its holds as with nothing held before its
// holds are chosen again (see chooseDragHolds).
const HOLDS_DETOUR = 10;
// How far a tyre may rise or sink, as a fraction of how far it moves across the ground. A
// wheel steered on a pivot that leans a little (as real cars' do, and as models are often
// built) rises or sinks a little as it turns; an axle rocking with the car standing still
// would push one tyre into the ground, and isn't allowed.
const LIFT = 0.05;
// How far a steered tyre's contact may be from the upright axis it steers on, and still pivot on
// the ground about it (see steeringPivot): a stud.
const PIVOT_REACH = 20;
// How far loop closing may move any joint from where a step's motion had it going, as a
// fraction of the step's largest joint turn, before the step counts as past a dead point (see
// turnJoint). Steps short of one need a few percent at most.
const DEAD_POINT = 0.25;
// How many times faster than in the step before the fastest joint may turn (for each turn of
// the joint being turned) before a dead point counts as just ahead (see turnJoint). Gears
// keep it steady, and linkages change it gently, except close to a dead point.
const DEAD_POINT_RATE = 1.5;
// How far the fastest joint in a closed loop may have turned in the step before, in radians,
// for a jump in its rate to tell a dead point (see turnJoint). Further, and its rate is sampled
// too coarsely to tell: an engine's connecting rods, geared up from a wheel a motor turns 15
// degrees at a time, swing back and forth faster and slower from one step to the next.
const DEAD_POINT_SAMPLE = (10 * Math.PI) / 180;
// How far apart a joint may be left after closing the loops, in LDU, before the step counts as
// past a dead point (see turnJoint). Models' rounded-off positions leave a hundred-thousandth.
const DEAD_POINT_GAP = 1e-3;
// How far a joint may be left from where a step's motion had it going, in radians, and the step
// still be taken on or just after play (see turnJoint): closing loops that play left open turns
// joints off their way, by up to 0.73 radians in twenty sets that go on play (the 8274's, 2026-11-20).
// Further is not play but a linkage flipped: the 9395 Pick-Up Tow Truck's winch, a step after one
// on play, turned a joint 27.7 radians off its way and moved 506 parts up to 140 LDU, and only the
// collision test stopped it there, naming the pair it met first (2026-11-20).
const PLAY_STRAY = Math.PI / 2;
// Largest turn per step in turnJoint, in radians (about 2 degrees).
const MAX_TURN_STEP = 0.035;
// The smallest step a turn is cut down to, a step at a time, to leave a jam ahead (see turnJoint).
const LEAST_TURN_STEP = MAX_TURN_STEP / 16;
// How many times as fast as the joint being turned another joint may turn, if gears don't tie it
// to that joint, before the motion counts as a dead point (see turnJoint). Linkages turn their
// joints a few times as fast at most; past this, the mechanism is near singular as read (the
// 42125's front uprights, turning 41 times as fast as its wishbone and the gears they mesh with
// 312 times), and its steps tear it apart, however small. Gears may turn things far faster, so
// joints geared to the one turned don't count.
const WILD_RATE = 50;
// How much faster the joints may turn in a drag's motion without the car moving on its
// suspension than with it, for the motion without to be taken all the same (see jointMotion).
const SUSPENSION_GAIN = 2;
// A joint whose axis lies this near level (the sine of its angle to the level) rocks or tips
// what it carries rather than turning it round (see leastTiers' keepSteering).
const LEVEL_AXIS = 0.1;
// Play. Real parts have a little of it, and a loop of rigid parts built to fit only as the model
// was built (an upright on two towballs a hair further apart than the arms it hangs from) turns
// on it. When nothing turns a joint exactly, a motion that opens the loops at most PLAY_RATE (LDU
// per radian of the joint) is taken, and its steps may leave them at most PLAY apart (LDU) (see
// playMotion). A turning row counts as how far it moves a point a stud (STUD, LDU) away, so it
// compares with the rest.
const PLAY_RATE = 1;
const PLAY = 0.1;
// With loopPlay, the clearances of real parts, in LDU (estimates, 2026-11-16, not measured; see
// loopBudgets): a pin or axle turning in a round hole, across it (RADIAL) and along it (AXIAL),
// and a towball in its socket (BALL). KINEBRICK_PLAY_SCALE multiplies them all, to see how much
// a result hangs on them.
const PLAY_SCALE = Number((typeof process !== 'undefined' ? process.env?.KINEBRICK_PLAY_SCALE : undefined) ?? 1);
const RADIAL = 0.1 * PLAY_SCALE;
const AXIAL = 0.25 * PLAY_SCALE;
const BALL = 0.05 * PLAY_SCALE;
// How much the joints' turning counts against the loops' opening in choosing a motion that takes
// up play: only enough to choose between motions that open them alike.
const TIE_BREAK = 0.1;
// How far apart a loop's joints may drift before closeLoops pulls them back, in LDU (or radians).
const LOOP_TOLERANCE = 1e-11;
// How far off its axle's axis a gear's or tyre's centre may be and still be taken on it (see
// onAxis), in LDU: a part placed a hair off, not one on another axle.
const ON_AXIS = 1;
// The solver's switches. Each Kinematics has its own (see Kinematics.options), which may be
// changed at any time: two settings can be compared on one loaded model.
export interface Options {
  // A drag that turns a joint chooses its motion by least motion, tier by tier (see leastTurning),
  // rather than by holding what it doesn't need (see chooseDragHolds), as pushes still do. ?holds in
  // the viewer, or KINEBRICK_LEAST=0 for the tests and scripts, has it choose holds instead.
  // Closing a step's loops keeps to the tiers too, as one problem with choosing the motion (see
  // docs/one-problem.md). ?passes in the viewer, or KINEBRICK_ONE=0 for the tests and scripts, has
  // it close them by the least motion by size, as before.
  leastMotion: boolean;
  oneProblem: boolean;
  // Least motion: how much keeping still what a step left still counts in closing the loops,
  // against closing them (see advance). Closing them by plain least squares undoes, a hair a step,
  // what the tiers kept still, and over a long drag that adds up: the 956 Auto Chassis, driven
  // round a circle, drifted off it as its steering crept, and its gear lever was carried round with
  // the drive shaft. KINEBRICK_CLOSE_STILL sets it (0 turns it off).
  closeStill: number;
  // Whether the turning tier counts a balanced body's turning against what it turns on rather
  // than the frame (see leastTiers). KINEBRICK_BALANCED=0 turns it off.
  balanced: boolean;
  // Least motion: a body the turning tier leaves turning less than this fraction of the body it
  // turns most is held still, if it can be, and the tier solved again (see leastTurning): static
  // friction holds what would only creep, rather than letting everything give a little. 0.2 does best
  // in the function check, and 0.3 fails one more test. KINEBRICK_STILLNESS sets it (0 turns it off).
  stillness: number;
  // The free-parts rule (decisions 291, 295 and 309): a drag keeps every joint that it doesn't drive
  // as still as it can, before everything else in its choice of motion: as few of them turning as
  // can, as friction holds them (see leastTiers and classifyDrag). 'wheels': for a drag of a wheel
  // on the ground only; 'all': for every drag; 'off': not at all, and the joints aren't classified.
  // KINEBRICK_FREE_PARTS sets it, ?freeparts= in the viewer; off by default in both.
  freeParts: 'off' | 'wheels' | 'all';
  // Least motion: a drag that turns a joint is solved only over the parts it can reach, the rest
  // held where they are on the frame (see outOfReach). It's far quicker on a big model.
  // KINEBRICK_REACH=0 turns it off.
  reach: boolean;
  // A gear's or tyre's centre is taken on the axis of the turning joint the part sits on (see
  // onAxis), not where the part itself is placed, for every kind of gear mesh. Off by default, for now; KINEBRICK_CENTRES=1
  // turns it on.
  centres: boolean;
  // Least motion for a push of a part that hangs on a turning joint (a door, an arm of a
  // linkage): its holds as a drag that turns that joint has them, and each step's motion chosen
  // by the tiers, the point pushed going the way it is pushed (see pushStepByTiers), rather than
  // the least-squares mix of the free motions left by holding all that can be held. On by
  // default; KINEBRICK_LEAST_PUSH=0 turns it off.
  leastPush: boolean;
  // Least motion: a gear that turns on a body carrying a driving ring (a clutch gear on a
  // gearbox's output shaft, which the ring locks to the shaft only when it's shifted into it)
  // costs nothing for turning against that body: it's made to spin free there (see leastTiers).
  // Off by default, for now; KINEBRICK_FREE_CLUTCH=1 turns it on.
  freeClutch: boolean;
  // Rolling judged once more with the parked motions in (see freeMotionsApart): of the free
  // motions joined, those in which tyres travel are kept only if they scrub no more than rolling
  // allows. Off by default, for now; KINEBRICK_SCRUB_JOINED=1 turns it on.
  scrubJoined: boolean;
  // Play as an amount, not a rate (see loopBudgets): a pose is allowed while every loop closes
  // within the clearances of its joints, and pushes take play as turns do. Play is the last
  // resort (see jointMotion), and a step on play must still turn the dragged joint as asked (see
  // turnJoint). On by default (decision 121 of 2026-11-16); KINEBRICK_LOOP_PLAY=0 turns it off,
  // and KINEBRICK_PLAY_SCALE scales the clearances.
  loopPlay: boolean;
  // Least motion: a push step that would turn a joint gears don't tie to the pushed part wildly
  // fast stops there as stuck (see pushStepByTiers). On by default; KINEBRICK_PUSH_WILD=0 turns it
  // off.
  pushWild: boolean;
  // The model lifted off the ground, as held in the hand: no tyre touches the ground, and the
  // frame (the first body) is kept still instead, as for a model with no tyres (see findGround).
  // Its wheels then turn freely, and a differential worked with its drive held turns one wheel
  // back as the other goes forward. Read when the solver is made, so changing it later does
  // nothing. Off unless asked for: the viewer's "Lift off the ground" option (?lifted=1), or a
  // function's `lifted` in the function check.
  lifted: boolean;
  // A turn keeps the motion it found for the step after its last (see turnJoint) for the next turn
  // of the same joint the same way, where nothing has changed since: the viewer turns a step at a
  // time, and would otherwise work out that motion again. On; KINEBRICK_KEEP_AHEAD=0 turns it off,
  // for comparing (decision 174 of 2026-11-17).
  keepAhead: boolean;
  // A drag's steps after its first are worked on its working set, the tree's columns its first
  // step turned and those rows tie to them, every other column fixed (decision 266 of 2026-11-20;
  // see Kinematics.turnJoint). On by default (decision 272); KINEBRICK_WORKING_SET=0 turns it off. The audit: after this many
  // radians of the dragged joint on the set, a turn is worked in full and the set made afresh (0:
  // never; KINEBRICK_WORKING_SET_AUDIT). The compare mode works each turn on the set and in full,
  // and keeps the full one (KINEBRICK_WORKING_SET_COMPARE=1; see wsStats).
  workingSet: boolean;
  workingSetAudit: number;
  workingSetCompare: boolean;
  // A search for a turn's motion from the same state, with the same holds, as the last one takes
  // that one's free motions and the motions its tiers chose (see jointMotionNearOrigin): a drag's
  // first step after its holds were tested from where it starts. The same bits. On;
  // KINEBRICK_REUSE_SEARCH=0 turns it off, for comparing; =check works each such search out
  // afresh too and counts the motions that differ in a bit (see searchStats).
  reuseSearch: boolean;
  reuseSearchCheck: boolean;
}

// The switches a new Kinematics starts with, unless it's given others. The viewer sets them from
// its address (?holds, ?passes, see main.ts), and the tests and scripts from KINEBRICK_LEAST=0,
// KINEBRICK_ONE=0, KINEBRICK_CLOSE_STILL, KINEBRICK_BALANCED=0, KINEBRICK_STILLNESS,
// KINEBRICK_REACH=0, KINEBRICK_CENTRES=1, KINEBRICK_LEAST_PUSH=0, KINEBRICK_FREE_CLUTCH=1 and
// KINEBRICK_SCRUB_JOINED=1.
const setting = (name: string) => (typeof process !== 'undefined' ? process.env?.[name] : undefined);
// The free-parts count (see Kinematics.countFree): off unless asked for.
const FREE_COUNT = () => setting('KINEBRICK_FREE_COUNT') === '1';
export const experiments: Options = {
  leastMotion: setting('KINEBRICK_LEAST') !== '0',
  oneProblem: setting('KINEBRICK_ONE') !== '0',
  closeStill: setting('KINEBRICK_CLOSE_STILL') !== undefined ? Number(setting('KINEBRICK_CLOSE_STILL')) : 1e-3,
  balanced: setting('KINEBRICK_BALANCED') !== '0',
  stillness: setting('KINEBRICK_STILLNESS') !== undefined ? Number(setting('KINEBRICK_STILLNESS')) : 0.2,
  freeParts: (['wheels', 'all'].includes(setting('KINEBRICK_FREE_PARTS') ?? '') ? setting('KINEBRICK_FREE_PARTS') : 'off') as Options['freeParts'],
  reach: setting('KINEBRICK_REACH') !== '0',
  centres: setting('KINEBRICK_CENTRES') === '1',
  leastPush: setting('KINEBRICK_LEAST_PUSH') !== '0',
  freeClutch: setting('KINEBRICK_FREE_CLUTCH') === '1',
  scrubJoined: setting('KINEBRICK_SCRUB_JOINED') === '1',
  loopPlay: setting('KINEBRICK_LOOP_PLAY') !== '0',
  pushWild: setting('KINEBRICK_PUSH_WILD') !== '0',
  lifted: false,
  keepAhead: setting('KINEBRICK_KEEP_AHEAD') !== '0',
  workingSet: setting('KINEBRICK_WORKING_SET') !== '0',
  workingSetAudit: Number(setting('KINEBRICK_WORKING_SET_AUDIT') ?? 0),
  workingSetCompare: setting('KINEBRICK_WORKING_SET_COMPARE') === '1',
  reuseSearch: setting('KINEBRICK_REUSE_SEARCH') !== '0',
  reuseSearchCheck: setting('KINEBRICK_REUSE_SEARCH') === 'check',
};

// How much a tyre's scrubbing (LDU) counts against joints' turning (radians) in least motion's
// sparse friction tier (see leastTiers).
const SCRUB_WEIGHT = 100;
// Experimental, within least motion: whether its friction tier is sparse (see leastTiers).
// Sparse passes one more of the tests, but loses functions in the function check, and takes
// longer.
const SPARSE_FRICTION = false;
// How near its joint's axis a body's middle must be for it to count as balanced on it, in LDU.
const BALANCE = 2;
// How much each part's turning against the frame (radians) counts against joints' turning in least
// motion's friction tier (see leastTiers).
const TURNING_WEIGHT = 1;



// Everything that says where the mechanism is (see Kinematics.snapshot).
export interface KinematicsState {
  roots: Map<number, Matrix4>;
  jointAngles: number[];
  treadTravel: number[];
  treadScrub: number[];
}

// For each tyre on the ground, a row for how fast it scrubs sideways, and one for how fast it
// travels (see Kinematics.freeMotions).
// One shaft of a universal joint (see findCouplings).
interface Shaft {
  body: number;
  joint: number; // the joint it turns on, or -1 for a shaft that floats between two joints
  mount: number; // the body it turns in (the frame, for a floating shaft)
  axis: Vector3; // its axis at the start (model coordinates)
  away: number; // +1 if its axis points away from the joint's middle, else -1
  near: Vector3; // the point on its axis nearest the joint's middle, at the start
}

// Rows on the bodies' motions as the tyres write them (BodyRow), or on the tree's coordinates.
export interface Slip<R = Row> {
  sideways: R[]; // how fast each tyre scrubs sideways
  travel: R[]; // how fast each tyre's hub travels along the way it rolls
  lift: R[]; // how fast each tyre's contact point rises or sinks
  rise: R[]; // how fast the frame rises or sinks over each tyre's hub, on its suspension
}

// What a search for a turn's motion depends on besides the mechanism (see Kinematics.searchInputs).
interface SearchInputs {
  angles: Float64Array;
  poses: Float64Array;
  rest: string;
  drag: Drag;
  ws: object | null;
}

// A drag's state: what it holds still and what it has found out, made when the drag starts
// (holdWhatTheDragDoesntNeed) and dropped when it ends (letGoAfterDrag). Between drags the solver
// has an empty one, which holds nothing.
class Drag {
  held = new Set<number>(); // bodies held still for the length of the drag
  // Bodies held against the frame rather than against what they turn on (which the drag turns):
  // an assembly hanging on a driven axle stays level, not carried round.
  heldToFrame = new Set<number>();
  together: number[]; // bodies turned with the grabbed one (see turnTogether)
  turning: { grabbed: number; joint: number } | null = null; // the part grabbed and the joint it turns, if the drag turns a joint
  steering: Set<number> | null = null; // the steering bodies, worked out once a drag (see leastTiers)
  grip = true; // least motion: whether the drag still prefers, of the motions that leave the frame still, those in which no tyre scrubs (see chooseMotion)
  suspension: boolean | null = null; // least motion: whether the drag's motion uses the suspension, chosen at its first step (see jointMotion)
  choosingHolds = false; // while its holds are chosen (see holdWhatTheDragDoesntNeed and jointMotion)
  plainOnly = false; // while they are, whether its motions may not use the suspension (see chooseDragHolds)
  drivenLast = false; // while they are, whether what its part drives is tried last (see chooseDragHolds)
  outOfReach = new Set<number>(); // the bodies it can't reach, held where they are on the frame (see Options.reach)
  springs = false; // whether the slides that springs hold at rest are held still for it (see chooseDragHolds)
  // The free-parts rule's classification (see Kinematics.classifyDrag), made at the drag's first step.
  free: Set<number> | null = null; // the joints free and not driven
  candidates: number[] = []; // the joints the rule may hold: all but the driven, the wheels on the ground and the control's
  heldJoints = new Set<number>(); // the joints the rule chose, at the drag's first step, to hold still for the drag (see chooseHeldJoints)
  driven: Set<number> | null = null; // the joints whose turning the drag fixes
  kind: 'wheel' | 'turn' | 'push' = 'turn';
  // KINEBRICK_FREE_COUNT=1: each joint's two bodies against each other where the count last looked,
  // how far each free joint has moved over the drag, and how far the control has.
  counted: { rel: Matrix4[]; moved: number[]; travel: number; grab: Vector3 | null } | null = null;

  constructor(together: number[] = []) {
    this.together = together;
  }
}

export class Kinematics {
  // Each body's pose: from its starting position (model coordinates) to where it is now.
  poses: Matrix4[] = [];
  // Each joint's angle in radians, measured from the start. Only joints in the tree are used.
  jointAngles: number[] = [];
  // How far each tyre's hub has rolled since the start, in LDU, forwards positive (forwards is
  // the way the tyre rolls when it turns positive about its axis). Rolling without slipping,
  // the tyre turns by this ÷ its radius.
  treadTravel: number[] = [];
  // How far each tyre has scrubbed sideways since the start, in LDU (see freeMotions).
  treadScrub: number[] = [];
  // How fast each tyre scrubbed sideways in the last step that rolled the model, as a fraction of
  // how fast it rolled (0 until it has rolled).
  treadScrubRate: number[] = [];
  // The least scrub rolling would need, as a fraction like `scrub`, when that's more than `scrub`
  // allows, so the model can't roll; else null. Set by freeMotions, for the position it was
  // last asked about.
  scrubNeeded: number | null = null;
  // The ground's height (LDraw y), or null if no tyre touches it.
  groundY: number | null = null;
  // How far a tyre may scrub sideways, as a fraction of how far it rolls (see freeMotions).
  // More lets a car whose steering is further from every wheel turning round one centre (both
  // front wheels turned alike, say) roll at a bigger steering angle; but too much would let a
  // car with no steering at all turn, its tyres scrubbing round.
  scrub = DEFAULT_SCRUB;
  // Its switches (see Options): those of experiments when it was made, unless it was given others.
  options: Options;

  // What follows is the solver's own. Some of it isn't private, as the connections in
  // src/constraints/ read it to write their equations; nothing else should.
  mech: Mechanism;
  bodyCount: number;
  // The tree that rebuilds poses: for each body, the joint that connects it to its parent
  // body, or -1 for a root body.
  parentJoint: number[] = [];
  private order: number[] = []; // bodies, parents before children
  private rootPoses = new Map<number, Matrix4>();
  private basis: number[][] | null = null; // the tree's basis at the current poses (see treeBasis)
  // Bodies that only slide or swivel on another (a bumper resting on tiles, a crane's
  // outrigger, a gear lever on its ball), and that other body: the root of a tree of their
  // own, joined by nothing but slides and ball joints to it, with no gears (a rack, which its
  // gear moves, or holds) and no universal joint (a half shaft on a ball in its wheel's hub,
  // which the differential turns).
  mounts = new Map<number, number>();
  private basisOrders = new WeakMap<number[][], number[]>(); // each basis's columns, deepest bodies' first (see leastSquares)
  private basisSmall: number[][] | null = null; // the basis on a working set's columns (see Options.workingSet)
  // The columns of the tree joints the free-parts rule holds (see Drag.heldJoints), left out of the basis:
  // such a joint is held by having no coordinate, as the working set leaves columns out, rather than by a
  // row each (decision 324: 380 rows made a piece of 0.1 rad take 1.4 s on the 9397). Set from the held
  // joints at a step's start (see syncHeldColumns), so a step's basis doesn't change under it.
  private droppedColumns = new Set<number>();
  private droppedKey = '';
  // The tree's coordinates, in which the solver works (see treeBasis): six for each root body
  // (how it turns and moves), then one for each joint in the tree (how fast it turns).
  private rootColumn = new Map<number, number>(); // a root body's first coordinate
  private jointColumn: number[] = []; // a joint's coordinate, or -1 if it's not in the tree
  private columns = 0; // how many coordinates
  fixedBody = -1; // kept still when the model has no tyres on the ground
  // Each model's frame, the main model's (body 0) first (see Mechanism.frames), and for each
  // body, the frame of the model it is in. Each frame stands on its own tyres, settles on them
  // by itself and is held by itself (see findGround and settle).
  frames: number[] = [0];
  frameOf: number[] = [];
  stillFrames = new Set<number>(); // further frames kept still: no tyres on the ground, or the model lifted
  frozen = new Set<number>(); // bodies the user has frozen (Alt-click)
  springsHeld = false; // slides that springs hold at rest held still (see steeringBodies)
  drag = new Drag(); // the drag going on, or an empty one between drags (see Drag)
  private stepByTiers = false; // one problem: whether the last step's motion was chosen by least motion's tiers (see jointMotion)
  // Whether the last motion asked for in a turn was blocked by the slides held at their ends: none
  // with them held, one without (see jointMotion). And whether the last turn ended so, at an end
  // of its travel (see turnJoint), which the check names a limit.
  private blockedByEnds = false;
  endReached = false;
  private deadPoint: { joint: number; way: number; angles: number[] } | null = null; // where a turn last stopped at one (see turnJoint)
  private couplingBodies: Set<number> | null = null; // the bodies of train couplings' holders (see turnJoint, leastTiers)
  private ringBodies: Set<number> | null = null; // the bodies that carry a driving ring (see leastTiers)
  private built = false; // the constructor done: reset() may then set a layout's cars on the rails (see setOnRails)
  private lastStep: { joint: number; way: number; angles: number[]; ratio: number; played: boolean } | null = null; // the last step a turn took (see turnJoint)
  private loopJoints: Set<number> | null = null;
  private turningRows: Int32Array | null = null; // each body's three turning rows of the tree basis, in order (see turningIn) // the joints in closed loops of joints (see inLoop), once worked out
  private pins: Set<number> | null = null; // bodies free to spin on their one axis (see findPins), once worked out
  private framed: Set<number> | null = null; // the bodies that can't move against the frame (see fixedToFrame), once worked out
  contactTreads: number[] = []; // indices into mech.treads
  private contactHeights: number[] = []; // for each tyre, where it touched the ground at the start (LDraw y)
  // Bodies held only by a ball joint at each end (a steering link), and those two joints.
  links: { body: number; balls: [number, number] }[] = [];
  // Bodies held only by a turning joint and a ball on its axis (a towball in a steering rack, its
  // tie rod's socket on the ball), by that turning joint.
  spinners: number[] = [];
  private leastScrub = 0; // the least scrub rolling needed, the last time the free motions were worked out (see freeMotionsApart)
  private played = false;
  private closingFirmOnly = false; // whether only the rows that take no play are being closed (see closeLoops)
  private turningJointsOf: number[][] | null = null; // each body's turning joints (see onAxis), found when first needed
  traceNames: string[] | null = null; // with TRACE, each row's kind of connection, as buildEquations adds it (see traceJam in trace.ts)
  private traceName = ''; // with TRACE, the kind of connection whose rows buildEquations is adding
  private nearOriginDepth = 0; // how deep in calls that have moved the model to near the origin (see nearOrigin)
  private closingStill: number[] = []; // least motion: the bodies a step left still, kept so as the loops close (see advance)
  private closingFollowers = new Set<number>(); // resting bodies whose support moves in the step: they follow it as the loops close (see advance)
  private gripped = false; // whether the motion last chosen was one of those
  // The slides held at an end of their travel for the step under way, which the motion chosen
  // would otherwise push past it (see jointMotion; decision 192 of 2026-11-18). Each holds as a
  // row: it slides no further (see buildEquations).
  private endHeld = new Set<number>();
  // The way the turn under way turns its joint (1 or -1), or 0 outside a turn (see jointMotion).
  private turnWay = 0;
  // The slides a step of the turn under way left past an end, though the motion didn't push them
  // there (closing the loops did, to second order): held for the rest of the turn (see turnJoint).
  private turnHeld = new Set<number>();
  // The motion the last turn found for the step after its last, kept for the next turn (see
  // turnJoint): in model coordinates, with what it was found with and where everything was.
  private aheadKept: { joint: number; way: number; motion: number[]; played: boolean; stepByTiers: boolean; gripped: boolean; endHeld: number[]; state: KinematicsState; drag: Drag; frozen: string; fixedBody: number; scrub: number } | null = null;
  private slipRows: number[][] = []; // the tyres' scrubbing and lifting rows, in the tree basis, as freeMotionsApart last found them
  // Universal joints: for each shaft, the joint it turns on (whose axis runs through the joint's
  // middle), which way along that axis points away from the middle (+1 or -1), and the point
  // on that axis nearest the middle (model coordinates, at the start).
  // `hangs`, for a grooved ball on a shaft that hangs on nothing else (see hangingBalls): held at
  // its place in its socket ('point'), or on its socket's axis ('axis').
  couplings: { shafts: Shaft[]; turningOnly: boolean; hangs?: 'point' | 'axis' }[] = [];
  // For each string (see Mechanism.strings): its free length at the start, and where its hook
  // hung then, relative to the middle of the two pulleys it hangs from (model coordinates).
  strings: { length: number; hookOffset: Vector3 | null }[] = [];

  constructor(mech: Mechanism, options: Partial<Options> = {}) {
    this.options = { ...experiments, ...options };
    this.mech = mech;
    this.bodyCount = mech.bodies.length;
    this.findLinks();
    this.findFrames();
    this.findGround();
    this.buildTree();
    this.findCouplings();
    this.findMounts();
    this.reset();
    // With centres (see onAxis), where each tyre touches the ground at the start is where it
    // touches with its centre on its axle's axis, so that settling doesn't move the car at once.
    if (this.options.centres) {
      this.mech.treads.forEach((_, i) => {
        const p = this.contactPoint(i);
        if (p) this.contactHeights[i] = p.y;
      });
    }
    this.strings = (mech.strings ?? []).map((s) => ({
      length: this.stringNow(s).layout.length,
      hookOffset: s.hook ? this.hookOffset(s) : null,
    }));
    this.built = true;
    this.setOnRails();
  }

  // A train layout's cars set on the rails, coupled: a layout places them by hand, a few LDU off
  // the track's centreline (or a stud or more, on a curve), and its magnets a little apart, so
  // the loops are closed from where it was built, as many times as it takes (closing them once
  // gets most of the way from far off).
  private setOnRails() {
    if (!this.mech.riders?.length) return;
    let gap = Infinity;
    for (let round = 0; round < 6 && gap > LOOP_TOLERANCE; round++) {
      const left = this.closeLoops(-1);
      if (left >= gap) break;
      gap = left;
    }
    // Being set on the rails isn't rolling or scrubbing: the readout starts from there.
    this.treadTravel.fill(0);
    this.treadScrub.fill(0);
    this.treadScrubRate.fill(0);
  }

  // ---------------------------------------------------------------------------
  // Strings

  // A string where it is now: the circles it goes round (its drum, or where it's tied at its
  // start; its pulleys; where it's tied at its end), each with the body carrying its middle,
  // and its layout (see stringLayout). `moved` gives the bodies' poses to use instead (to see
  // how the layout changes as a body moves).
  stringNow(s: StringLine, poseOf = (body: number) => this.poses[body]): { circles: StringCircle[]; bodies: number[]; axis: Vector3; layout: ReturnType<typeof stringLayout> } {
    const circles: StringCircle[] = [];
    const bodies: number[] = [];
    const point = (index: number) => s.path.points[index];
    if (s.drum) {
      const p = point(s.drum.point);
      circles.push({ center: p.center.clone().applyMatrix4(poseOf(s.drum.mount)), radius: p.radius, turn: p.turn });
      bodies.push(s.drum.mount);
    } else {
      circles.push({ center: s.start!.at.clone().applyMatrix4(poseOf(s.start!.body)), radius: 0, turn: 1 });
      bodies.push(s.start!.body);
    }
    for (const w of s.pulleys) {
      const p = point(w.point);
      circles.push({ center: p.center.clone().applyMatrix4(poseOf(w.mount)), radius: p.radius, turn: p.turn });
      bodies.push(w.mount);
    }
    circles.push({ center: s.end.at.clone().applyMatrix4(poseOf(s.end.body)), radius: 0, turn: 1 });
    bodies.push(s.end.body);
    const first = s.drum ?? s.pulleys[0];
    const axis = point(first.point).axis.clone().transformDirection(poseOf(first.mount));
    return { circles, bodies, axis, layout: stringLayout(circles, axis) };
  }

  // How much string its drum has paid out since the start, in LDU (0 if it isn't wound on one):
  // as far as the drum's rim has turned, the way the string goes round it.
  payout(s: StringLine): number {
    if (!s.drum) return 0;
    const p = s.path.points[s.drum.point];
    const j = this.mech.joints[s.drum.joint];
    const angle = (j.bodyB === s.drum.body ? 1 : -1) * Math.sign(axisOf(j.from, j.to).dot(p.axis)) * this.jointAngles[s.drum.joint];
    return p.turn * p.radius * angle;
  }

  // Where a string's hook hangs, relative to the middle of the circles either side of its pulley
  // (the pulleys it hangs from), or to the last circle before it, for a hook tied to the string's
  // end.
  private hookOffset(s: StringLine): Vector3 {
    const { circles } = this.stringNow(s);
    const h = s.hook!.pulley + 1; // circles start with the drum (or where it's tied)
    return circles[h].center.clone().sub(hungFrom(circles, h));
  }

  // Rows saying how fast a length worked out from a string's layout (by `measure`) changes as
  // the bodies carrying its circles move: for each circle, the change of the length with its
  // middle (by finite differences), times how fast that middle moves.
  stringRate(s: StringLine, measure: (layout: ReturnType<typeof stringLayout>) => number, n: number): BodyRow {
    const { circles, axis, bodies } = this.stringNow(s);
    const row = new BodyRow(n);
    const base = measure(stringLayout(circles, axis));
    const h = 1e-3;
    circles.forEach((circle, i) => {
      const g = new Vector3();
      for (let k = 0; k < 3; k++) {
        const moved = circles.map((c, m) => (m === i ? { ...c, center: c.center.clone().setComponent(k, c.center.getComponent(k) + h) } : c));
        g.setComponent(k, (measure(stringLayout(moved, axis)) - base) / h);
      }
      // The middle moves at v + ω × c, so the length changes at g · v + (c × g) · ω.
      const turn = new Vector3().crossVectors(circle.center, g);
      for (let k = 0; k < 3; k++) {
        row.add(6 * bodies[i] + k, turn.getComponent(k));
        row.add(6 * bodies[i] + 3 + k, g.getComponent(k));
      }
    });
    return row;
  }

  // A row for how fast a wheel's rim turns relative to what it turns in, about a circle's axis,
  // the way the string goes round it.
  rimRate(body: number, mount: number, point: { axis: Vector3; radius: number; turn: number }, n: number): BodyRow {
    const row = new BodyRow(n);
    const z = point.axis.clone().transformDirection(this.poses[mount]).multiplyScalar(point.turn * point.radius);
    for (let k = 0; k < 3; k++) {
      row.add(6 * body + k, z.getComponent(k));
      row.sub(6 * mount + k, z.getComponent(k));
    }
    return row;
  }

  // Back to the starting position.
  reset() {
    this.jointAngles = this.mech.joints.map(() => 0);
    this.treadTravel = this.mech.treads.map(() => 0);
    this.treadScrub = this.mech.treads.map(() => 0);
    this.treadScrubRate = this.mech.treads.map(() => 0);
    for (const root of this.rootPoses.keys()) this.rootPoses.set(root, new Matrix4());
    this.updatePoses();
    if (this.built) this.setOnRails();
  }

  // Moves the whole model as one by `pose`, opening no joint: a model worked out afresh where its
  // frame sees it is stood back where the frame is (see main.ts).
  carry(pose: Matrix4) {
    for (const root of this.rootPoses.values()) root.premultiply(pose);
    this.updatePoses();
  }

  // Puts each body where `poses` says (one for each body), turning each turning joint to suit:
  // a model worked out afresh as it was built is posed as the one it replaces was (see main.ts).
  // A joint's angle is kept within half a turn of `near`'s, where that gives one, so a winch's
  // drum keeps the turns it has wound.
  poseAs(poses: Matrix4[], near: (number | undefined)[] = []) {
    for (const root of this.rootPoses.keys()) this.rootPoses.set(root, poses[root].clone());
    this.mech.joints.forEach((joint, j) => {
      if (joint.kind !== 'revolute') return;
      // bodyB as bodyA sees it: turned about the joint's axis (see updatePoses).
      const turn = poses[joint.bodyA].clone().invert().multiply(poses[joint.bodyB]);
      const axis = axisOf(joint.from, joint.to);
      const across = new Vector3(1, 0, 0).cross(axis).lengthSq() > 0.1 ? new Vector3(1, 0, 0).cross(axis).normalize() : new Vector3(0, 1, 0).cross(axis).normalize();
      const turned = across.clone().transformDirection(turn);
      let angle = Math.atan2(new Vector3().crossVectors(across, turned).dot(axis), across.dot(turned));
      const was = near[j];
      if (was !== undefined) angle = was + Math.atan2(Math.sin(angle - was), Math.cos(angle - was));
      this.jointAngles[j] = angle;
    });
    this.updatePoses();
  }

  // A body joined to the rest only by two ball joints could spin about the line through the
  // balls without moving anything else. Nothing would make it, so equations() doesn't let it,
  // unless gears or a coupling turn it (a half shaft with a constant velocity joint's ball at
  // each end, turning the wheel hub with the differential's output).
  private findLinks() {
    for (let body = 1; body < this.bodyCount; body++) {
      const joints = this.mech.joints.flatMap((j, i) => (j.bodyA === body || j.bodyB === body ? [i] : []));
      const balls = joints.filter((i) => this.mech.joints[i].kind === 'ball');
      const geared = this.mech.gears.some((g) => g.body === body) || this.mech.couplings.some((c) => c.bodyA === body || c.bodyB === body) || this.screwed(body);
      const tyred = this.mech.treads.some((t) => t.body === body);
      if (joints.length === 2 && balls.length === 2 && !geared && !tyred) this.links.push({ body, balls: [balls[0], balls[1]] });
      // Nor could one joined only by a turning joint and a ball on that joint's axis spin about
      // it (the 8448 Super Car's towballs, in its steering rack): equations() keeps that joint
      // still.
      const turning = joints.filter((i) => this.mech.joints[i].kind === 'revolute');
      if (joints.length === 2 && balls.length === 1 && turning.length === 1 && !geared && !tyred) {
        const j = this.mech.joints[turning[0]];
        const d = axisOf(j.from, j.to);
        const off = new Vector3().subVectors(this.mech.joints[balls[0]].from, j.from);
        if (off.addScaledVector(d, -off.dot(d)).length() < 1) this.spinners.push(turning[0]);
      }
    }
  }

  // For each universal joint, the joint each shaft turns on: the one whose axis passes through
  // the universal joint's middle. A shaft that turns in nothing but the joints at its ends (the
  // middle of a double universal joint) turns about its end's axle hole, against the frame.
  private findCouplings() {
    for (const c of this.mech.couplings ?? []) {
      // Of the joints on its axis, the one it turns in that's nearest the frame: a driveshaft
      // turns in the frame and in its differential's side gear alike, and it's how it turns
      // against the frame that the wheel's hub follows.
      const depth = (body: number): number => {
        const link = this.parentLink(body);
        return link ? 1 + depth(link.parent) : 0;
      };
      const shafts = [c.bodyA, c.bodyB].map((body, side): Shaft => {
        let best = -1;
        let bestDistance = 2; // LDU
        let bestDepth = Infinity;
        this.mech.joints.forEach((j, i) => {
          if (j.kind !== 'revolute' || (j.bodyA !== body && j.bodyB !== body)) return;
          const d = axisOf(j.from, j.to);
          const fromCenter = new Vector3().subVectors(j.from, c.center);
          const distance = fromCenter.clone().addScaledVector(d, -fromCenter.dot(d)).length();
          const mountDepth = depth(j.bodyA === body ? j.bodyB : j.bodyA);
          if (distance < 2 && (mountDepth < bestDepth || (mountDepth === bestDepth && distance < bestDistance))) [best, bestDistance, bestDepth] = [i, distance, mountDepth];
        });
        const end = side === 0 ? c.atA : c.atB;
        if (best < 0) {
          // A floating shaft, against the frame: about the line through the middles of the
          // joints at its two ends (so turning it leaves both where they are), or failing a
          // second joint, about its end's axle hole.
          const other = this.mech.couplings.find((o) => o !== c && (o.bodyA === body || o.bodyB === body));
          const axis = other ? new Vector3().subVectors(other.center, c.center).normalize() : (side === 0 ? c.axisA : c.axisB).clone();
          const away = other ? 1 : new Vector3().subVectors(end, c.center).dot(axis) >= 0 ? 1 : -1;
          return { body, joint: -1, mount: 0, axis, away, near: c.center.clone() };
        }
        const j = this.mech.joints[best];
        const d = axisOf(j.from, j.to);
        const near = j.from.clone().addScaledVector(d, new Vector3().subVectors(c.center, j.from).dot(d));
        // Which way is away from the joint's middle: towards the end part, or if that's at the
        // middle itself (a grooved ball), towards the joint the shaft turns on.
        let along = new Vector3().subVectors(end, c.center).dot(d);
        if (Math.abs(along) < 1) along = j.from.clone().add(j.to).multiplyScalar(0.5).sub(c.center).dot(d);
        const away = along >= 0 ? 1 : -1;
        return { body, joint: best, mount: j.bodyA === body ? j.bodyB : j.bodyA, axis: d, away, near };
      });
      this.couplings.push({ shafts, turningOnly: c.turningOnly === true });
    }
    this.hangingBalls();
  }

  // A shaft that hangs on nothing but grooved balls in sockets (a constant velocity joint's ball,
  // 52731, at each end of a drive shaft, in its differential's and its hub's sockets: the 42099
  // 4x4 X-treme Off-Roader's): no joint of its own, its balls tied by their turning only (see
  // Coupling.turningOnly), so nothing would say where it is, and it would turn about wherever
  // least motion has it. Its ball in the socket nearest the frame (the fewest joints from it,
  // then the socket whose body has the lowest part number) is held at its place in that socket;
  // each other ball on its socket's axis, free along it, so suspension can change how far apart
  // the sockets are (the 42000 Grand Prix Racer's). One end held, the shaft can't drift along its
  // own line. A shaft with a joint of its own keeps only the coupling of its turning.
  private hangingBalls() {
    const depth = (body: number): number => {
      const link = this.parentLink(body);
      return link ? 1 + depth(link.parent) : 0;
    };
    const couplings = this.mech.couplings ?? [];
    for (let body = 1; body < this.bodyCount; body++) {
      if (this.parentLink(body) || this.mech.joints.some((j) => j.bodyA === body || j.bodyB === body)) continue;
      const balls = couplings.flatMap((c, i) => (c.bodyA === body || c.bodyB === body ? [i] : []));
      if (!balls.length || balls.some((i) => couplings[i].bodyA !== body || !couplings[i].turningOnly || couplings[i].ratio !== undefined)) continue;
      const lowest = (b: number) => Math.min(...this.mech.bodies[b].parts);
      const held = balls.reduce((best, i) => {
        const [d, e] = [depth(couplings[i].bodyB), depth(couplings[best].bodyB)];
        return d < e || (d === e && lowest(couplings[i].bodyB) < lowest(couplings[best].bodyB)) ? i : best;
      });
      for (const i of balls) this.couplings[i].hangs = i === held ? 'point' : 'axis';
    }
  }

  // Whether a body is a linear actuator's input or piston, which its screw turns or slides.
  private screwed(body: number): boolean {
    return (this.mech.screws ?? []).some((s) => s.input === body || s.piston === body);
  }

  // A shaft's axis now (the joint it turns on, or for a floating shaft its own axis), in model
  // coordinates.
  shaftAxis(shaft: Shaft): Vector3 {
    if (shaft.joint < 0) return shaft.axis.clone().transformDirection(this.poses[shaft.body]);
    const j = this.mech.joints[shaft.joint];
    return axisOf(j.from, j.to).transformDirection(this.poses[j.bodyA]);
  }

  // Which model each body is in (see frames): a further model's parts' bodies are in its frame,
  // the rest in the main model's.
  private findFrames() {
    this.frames = this.mech.frames ?? [0];
    this.frameOf = new Array(this.bodyCount).fill(0);
    (this.mech.frameParts ?? []).forEach((parts, k) => {
      for (const p of parts) this.frameOf[this.mech.bodyOf[p]] = this.frames[k + 1];
    });
  }

  // Each model's ground is level with its lowest tyre, and its tyres within GROUND_TOLERANCE of
  // it touch it: two models in one file may stand at different heights (the 42062 Container
  // Yard's reach stacker on its base plate). A model with no tyres is kept still instead (the
  // main model's frame as fixedBody, a further one's in stillFrames), and so are all of them
  // with the model lifted (see Options.lifted). groundY, for the viewer, is the main model's
  // ground, or with no tyres on it the lowest of the others'.
  private findGround() {
    if (this.options.lifted) {
      this.fixedBody = 0;
      for (const f of this.frames) if (f !== 0) this.stillFrames.add(f);
      return;
    }
    const lowest = new Map<number, number>();
    for (const t of this.mech.treads) {
      const p = lowestPoint(t.center, t.axis, t.radius);
      const f = this.frameOf[t.body];
      if (p) lowest.set(f, Math.max(lowest.get(f) ?? -Infinity, p.y));
    }
    for (const f of this.frames) {
      if (lowest.has(f)) continue;
      if (f === 0) this.fixedBody = 0;
      else this.stillFrames.add(f);
    }
    if (lowest.size === 0) return;
    // On a train layout the frame is the track, which stays put on the table while the trains
    // run on it (see Rail).
    if (this.mech.rails?.length) this.fixedBody = 0;
    this.groundY = lowest.get(0) ?? Math.max(...lowest.values());
    this.mech.treads.forEach((t, i) => {
      const p = lowestPoint(t.center, t.axis, t.radius);
      this.contactHeights[i] = p ? p.y : 0;
      if (p && Math.abs(p.y - lowest.get(this.frameOf[t.body])!) < GROUND_TOLERANCE) this.contactTreads.push(i);
    });
  }

  private findMounts() {
    for (const root of this.rootPoses.keys()) {
      if (this.frames.includes(root)) continue;
      const own = this.mech.joints.filter((j) => j.bodyA === root || j.bodyB === root);
      const mounts = new Set(own.map((j) => (j.bodyA === root ? j.bodyB : j.bodyA)));
      const geared = this.mech.gears.some((g) => g.body === root) || this.mech.couplings.some((c) => c.bodyA === root || c.bodyB === root) || this.screwed(root);
      if (own.length > 0 && own.every((j) => (j.kind === 'slide' && !j.turns) || j.kind === 'ball') && mounts.size === 1 && !geared) this.mounts.set(root, [...mounts][0]);
      // Or that only slides along one line, turning or not, in the holes of one or more (a loose
      // axle, such as the one through the tops of the 8865 Test Car's cylinder banks), on the
      // first of those: left standing in the world, it would come out of them as the car rolls.
      else if (own.length > 0 && own.every((j) => j.kind === 'slide' && onOneLine(j, own[0])) && !geared) this.mounts.set(root, [...mounts][0]);
    }
  }

  // A spanning tree over the turning joints, starting from the frame (body 0). Joints that
  // close a loop aren't in the tree, nor are slide and ball joints: closeLoops keeps those
  // together. A group the frame's tree doesn't reach is a tree of its own, and its root is
  // chosen by what holds the group, not by the bodies' numbers: first a body that slides on a
  // body already placed (an outrigger's beam in the chassis, so a drag of it slides it and
  // what hangs from it goes along), then one that hangs by a ball on one, then, held by
  // nothing, a body of what's left with no gear. Of several, the one with the most parts, the group's
  // main piece; only bodies alike in that are taken by number. Rooted at the lowest-numbered
  // body, the 8258 Crane Truck's outrigger had its 7L beam as the root and the bent beam that
  // slides in the chassis hanging from it by a hinge, so a drag of the bent beam spun it on
  // the hinge.
  private buildTree() {
    this.parentJoint = new Array(this.bodyCount).fill(-1);
    const visited = new Array(this.bodyCount).fill(false);
    const grow = (start: number) => {
      this.rootPoses.set(start, new Matrix4());
      visited[start] = true;
      const queue = [start];
      while (queue.length) {
        const body = queue.shift()!;
        this.order.push(body);
        this.mech.joints.forEach((j, index) => {
          if (j.kind !== 'revolute') return;
          const other = j.bodyA === body ? j.bodyB : j.bodyB === body ? j.bodyA : -1;
          if (other >= 0 && !visited[other]) {
            visited[other] = true;
            this.parentJoint[other] = index;
            queue.push(other);
          }
        });
      }
    };
    // The bodies not yet placed that a joint of this kind joins to one already placed.
    const heldBy = (kind: Joint['kind']) => {
      const held = new Set<number>();
      for (const j of this.mech.joints) {
        if (j.kind !== kind || visited[j.bodyA] === visited[j.bodyB]) continue;
        held.add(visited[j.bodyA] ? j.bodyB : j.bodyA);
      }
      return [...held];
    };
    const main = (bodies: number[]) => bodies.reduce((best, b) => (this.mech.bodies[b].parts.length > this.mech.bodies[best].parts.length || (this.mech.bodies[b].parts.length === this.mech.bodies[best].parts.length && b < best) ? b : best));
    if (this.bodyCount > 0) grow(0);
    // Each further model's tree starts at its frame (see frames), as the main model's does.
    for (const f of this.frames) if (!visited[f]) grow(f);
    for (;;) {
      const left = visited.flatMap((v, b) => (v ? [] : [b]));
      if (!left.length) break;
      const slides = heldBy('slide');
      const balls = heldBy('ball');
      // Held by nothing (a grab hanging on a crane's string, a knob that only meshes): what
      // the turning parts turn on, a body with no gear, rather than a gear (the 42050 Drag
      // Racer's steering knob, a gear on a pin, turns on the pin).
      const geared = new Set(this.mech.gears.map((g) => g.body));
      const plain = left.filter((b) => !geared.has(b));
      grow(main(slides.length ? slides : balls.length ? balls : plain.length ? plain : left));
    }
    for (const root of this.rootPoses.keys()) {
      this.rootColumn.set(root, this.columns);
      this.columns += 6;
    }
    this.jointColumn = this.mech.joints.map((_, j) => (this.inTree(j) ? this.columns++ : -1));
  }

  // An orthonormal basis for the motions the tree allows, as motion vectors: the rows of the
  // result are the motion vector's places (6 per body), its columns the basis vectors.
  //
  // Every motion that keeps the tree's joints together is the bodies turning and moving as the
  // root bodies and the tree's joint speeds say, so solving for those (one number per joint,
  // rather than six per body) gives the same answers from a far smaller system of equations,
  // with the tree's joints dropped from it. The basis is made orthonormal, so that the
  // smallest motion in its coordinates is the smallest motion of the bodies too.
  //
  // It depends only on where the bodies are, so it's kept until they move (see updatePoses):
  // a drag asks for the free motions many times over at one pose, holding different bodies.
  private treeBasis(): number[][] {
    // A drag's working set (see Options.workingSet): only its columns, while a step is worked on it.
    if (this.wsActive && this.ws) return (this.basisSmall ??= this.makeBasis(this.ws.columns));
    return (this.basis ??= this.makeBasis(null));
  }

  // The basis of treeBasis, of every column, or (`only`) of those columns alone: the same
  // arithmetic, each column made square to those of the bodies beyond it that are kept. Its
  // columns are kept in order, and the order deepest first (see leastSquares) in basisOrders.
  private makeBasis(only: Set<number> | null): number[][] {
    // Each body's motion, as a list of coordinates and what one unit of each does to it
    // (6 numbers: turning, then the velocity of the origin).
    const chains: { column: number; twist: number[] }[][] = [];
    for (const body of this.order) {
      const j = this.parentJoint[body];
      if (j < 0) {
        const first = this.rootColumn.get(body)!;
        chains[body] = Array.from({ length: 6 }, (_, k) => ({ column: first + k, twist: Array.from({ length: 6 }, (_, i) => (i === k ? 1 : 0)) }));
        continue;
      }
      // Turning about the joint's axis d through point c, at rate 1, bodyB relative to bodyA:
      // turn d, velocity of the origin c × d.
      const joint = this.mech.joints[j];
      const parent = joint.bodyA === body ? joint.bodyB : joint.bodyA;
      const d = axisOf(joint.from, joint.to).transformDirection(this.poses[joint.bodyA]);
      const c = joint.from.clone().applyMatrix4(this.poses[joint.bodyA]);
      const v = new Vector3().crossVectors(c, d);
      const sign = joint.bodyB === body ? 1 : -1;
      const twist = [d.x, d.y, d.z, v.x, v.y, v.z].map((x) => sign * x);
      chains[body] = [...chains[parent], { column: this.jointColumn[j], twist }];
    }
    // The columns of J, which turns coordinates into a motion vector, made orthonormal by
    // Gram-Schmidt, twice over for accuracy (some columns are nearly alike, such as two joints
    // on one axle). A joint's column moves only the bodies beyond the joint (its child body and
    // all that hangs on it), and a root's columns only the bodies of its tree. So, taken from
    // the deepest bodies up, each column need only be made square to the columns of the bodies
    // beyond it, and stays among those bodies: far less work than taking every column against
    // every other, for a basis with the same span. Plain loops: this runs every step.
    const n = 6 * this.bodyCount;
    const kept = (c: number) => (!only || only.has(c)) && !this.droppedColumns.has(c);
    const columns: (Float64Array | undefined)[] = Array.from({ length: this.columns }, (_, c) => (kept(c) ? new Float64Array(n) : undefined));
    chains.forEach((chain, body) => {
      for (const { column, twist } of chain) {
        const col = columns[column];
        if (col) for (let k = 0; k < 6; k++) col[6 * body + k] = twist[k];
      }
    });
    const children: number[][] = Array.from({ length: this.bodyCount }, () => []);
    for (const body of this.order) {
      const link = this.parentLink(body);
      if (link) children[link.parent].push(body);
    }
    const ownColumns = (body: number): number[] => {
      const j = this.parentJoint[body];
      if (j >= 0) return kept(this.jointColumn[j]) ? [this.jointColumn[j]] : [];
      const first = this.rootColumn.get(body)!;
      return [first, first + 1, first + 2, first + 3, first + 4, first + 5].filter(kept);
    };
    const beyond: number[][] = []; // the bodies beyond each body, itself included
    const done: number[][] = []; // their columns, made orthonormal
    // Each column's places: those of the bodies beyond its own body, the only ones it moves (in
    // the same order as among a body further in's places, so leaving the rest out of a sum
    // leaves out only zeros).
    const placesOf: number[][] = [];
    const order: number[] = [];
    for (const body of [...this.order].reverse()) {
      beyond[body] = [body, ...children[body].flatMap((c) => beyond[c])];
      const places: number[] = [];
      for (const b of beyond[body]) for (let k = 0; k < 6; k++) places.push(6 * b + k);
      const others = children[body].flatMap((c) => done[c]);
      const own: number[] = [];
      for (const c of ownColumns(body)) {
        const u = columns[c]!;
        placesOf[c] = places;
        for (let pass = 0; pass < 2; pass++) {
          for (const b of [...others, ...own]) {
            const e = columns[b]!;
            const along = placesOf[b];
            let d = 0;
            for (const i of along) d += u[i] * e[i];
            for (const i of along) u[i] -= d * e[i];
          }
        }
        let length = 0;
        for (const i of places) length += u[i] * u[i];
        length = Math.sqrt(length);
        for (const i of places) u[i] /= length;
        own.push(c);
        order.push(c);
      }
      done[body] = [...others, ...own];
    }
    // Turned round: a row for each coordinate of the motion vector. Plain loops: the same numbers,
    // without a function call for each (this is worked out afresh in many rounds of a step).
    const list = columns.flatMap((col, c) => (col ? [c] : []));
    const place = new Map(list.map((c, p) => [c, p]));
    const basis: number[][] = [];
    for (let i = 0; i < n; i++) {
      const row = new Array<number>(list.length);
      for (let p = 0; p < list.length; p++) row[p] = columns[list[p]]![i];
      basis.push(row);
    }
    this.basisOrders.set(basis, order.map((c) => place.get(c)!));
    return basis;
  }

  // Works something out with the model moved across the ground (x and z) so that its frame is at
  // the origin, then moves it back. A motion is written as each body's turning and the velocity
  // of the point at the origin, so the further the model is from the origin, the more turning
  // weighs in the solver's sums against everything else, and the motions it picks would depend on
  // where the model is: the 956 Auto Chassis, steered and kept driving, picked a different line
  // round its circle once it had gone a few thousand LDU, and wandered off across the grid.
  // `work` gets functions that turn a motion worked out there into one where the model is, and
  // back. Within it, everything is near the origin, and calls within it work there too.
  private nearOrigin<T>(work: (toModel: (motion: number[]) => number[], fromModel: (motion: number[]) => number[]) => T): T {
    const at = new Vector3().setFromMatrixPosition(this.poses[0]).setY(0);
    if (this.nearOriginDepth > 0 || at.lengthSq() < EPSILON) return work((m) => m, (m) => m);
    const moveBy = (by: Vector3) => {
      const t = new Matrix4().makeTranslation(by.x, 0, by.z);
      for (const pose of this.rootPoses.values()) pose.premultiply(t);
      this.updatePoses();
    };
    // The velocity of the point at the origin, from that of the point `at`, there: v − w × at.
    const shifted = (motion: number[], sign: number) => {
      const out = motion.slice();
      for (let b = 0; b < this.bodyCount; b++) {
        const w = new Vector3(motion[6 * b], motion[6 * b + 1], motion[6 * b + 2]);
        const d = new Vector3().crossVectors(w, at).multiplyScalar(sign);
        out[6 * b + 3] -= d.x;
        out[6 * b + 4] -= d.y;
        out[6 * b + 5] -= d.z;
      }
      return out;
    };
    moveBy(at.clone().negate());
    this.nearOriginDepth++;
    try {
      return work((m) => shifted(m, 1), (m) => shifted(m, -1));
    } finally {
      this.nearOriginDepth--;
      moveBy(at);
    }
  }

  // Rebuilds every body's pose from the root poses and joint angles.
  private updatePoses() {
    this.basis = null;
    this.basisSmall = null;
    for (const body of this.order) {
      const j = this.parentJoint[body];
      if (j < 0) {
        this.poses[body] = this.rootPoses.get(body)!.clone();
        continue;
      }
      const joint = this.mech.joints[j];
      const parent = joint.bodyA === body ? joint.bodyB : joint.bodyA;
      // The child turns about the joint axis, as it was at the start, relative to its parent.
      const angle = joint.bodyA === parent ? this.jointAngles[j] : -this.jointAngles[j];
      this.poses[body] = this.poses[parent].clone().multiply(rotationAbout(joint.from, axisOf(joint.from, joint.to), angle));
    }
  }

  // The body this body turns on (its parent in the tree) and the joint between them, or null
  // for a root body such as the frame.
  parentLink(body: number): { parent: number; joint: number } | null {
    const j = this.parentJoint[body];
    if (j < 0) return null;
    const joint = this.mech.joints[j];
    return { parent: joint.bodyA === body ? joint.bodyB : joint.bodyA, joint: j };
  }

  // The upright joint a tyre's wheel steers on, for a tyre on the ground (see tyres.ts): of the
  // turning joints on the tree's path from the tyre's body to its model's frame, the first whose
  // axis is within 45 degrees of upright (a kingpin, a fork's steering head, a swivelling leg),
  // with where its axis is now; null if there's none, or if the tyre's contact, `contact`, is
  // more than PIVOT_REACH ahead of or behind that axis, along `forward`, the way the tyre rolls
  // (its trail). Carried round the axis, the contact rolls along by its distance out to the side
  // of it, which the tyre turning on its axle takes up, and slides sideways by its trail.
  steeringPivot(tread: number, contact: Vector3, forward: Vector3): { joint: number; at: Vector3; axis: Vector3 } | null {
    const t = this.mech.treads[tread];
    const frame = this.frameOf[t.body];
    let body = t.body;
    for (let n = 0; n < this.bodyCount && body !== frame; n++) {
      const link = this.parentLink(body);
      if (!link) return null;
      const j = this.mech.joints[link.joint];
      const axis = axisOf(j.from, j.to).transformDirection(this.poses[j.bodyA]);
      if (Math.abs(axis.dot(DOWN)) > Math.SQRT1_2) {
        const at = j.from.clone().applyMatrix4(this.poses[j.bodyA]);
        const off = contact.clone().sub(at);
        off.addScaledVector(axis, -off.dot(axis));
        return Math.abs(off.dot(forward)) <= PIVOT_REACH ? { joint: link.joint, at, axis } : null;
      }
      body = link.parent;
    }
    return null;
  }

  // Whether the drag works the car's steering, or rolls it: the part grabbed is one of its
  // steering bodies (see steeringBodies), or turns one through gears, or carries a tyre. Only then
  // does a steered tyre pivot on the ground (see steeringPivot and tyres.ts): a drag of anything
  // else (a trailer swinging on its hitch, a lever) keeps its tyres' grip as it was, else it may
  // steer the wheels to go where it couldn't (the 8049 Tractor with Log Loader, swung on its
  // hitch, slewed round on its steered front wheels and came back turned half round). Rolled by a
  // wheel, the same tractor and trailer need the front wheels to pivot as they go round (its
  // function 8, 11 LDU off there and back with it, 701 without).
  dragSteers(): boolean {
    const grabbed = this.drag.turning?.grabbed;
    if (grabbed === undefined || this.contactTreads.length === 0) return false;
    const steering = (this.drag.steering ??= this.steeringBodies());
    return steering.has(grabbed) || [...this.gearedTo(grabbed, true)].some((b) => steering.has(b)) || this.mech.treads.some((t) => t.body === grabbed);
  }

  // A drag's steps that pivot a steered tyre on the ground about its steering axis (see
  // steeringPivot and tyres.ts): the most its contact was carried sideways and up or down, in LDU
  // for each radian of the dragged joint, and the tyre. The function check stores it with the
  // function's result and sets it back to null, so a result that leaned on the pivot shows it.
  pivoted: { slide: number; rise: number; tread: number } | null = null;
  // How far drags have gone on play (radians, or LDU for a push) since this was last set to 0: a
  // record for the check, as pivoted is.
  onPlay = 0;
  // With loopPlay: each joint that closes a loop, and how far it may open (see loopBudgets).
  private budgets: Map<number, number> | null = null;

  private notePivots(motion: number[]) {
    const joint = this.drag.turning?.joint;
    if (joint === undefined || !this.dragSteers()) return;
    const rate = Math.abs(this.jointRate(motion, joint));
    if (rate < EPSILON) return;
    for (const i of this.contactTreads) {
      const p = this.contactPoint(i);
      if (!p) continue;
      const t = this.mech.treads[i];
      const axis = t.axis.clone().transformDirection(this.poses[t.body]);
      const forward = new Vector3().crossVectors(DOWN, axis).normalize();
      const sideways = new Vector3().crossVectors(forward, DOWN).normalize();
      const pivot = this.steeringPivot(i, p, forward);
      if (!pivot) continue;
      const carried = new Vector3().crossVectors(pivot.axis, p.clone().sub(pivot.at)).multiplyScalar(this.jointRate(motion, pivot.joint) / rate);
      const [slide, rise] = [Math.abs(carried.dot(sideways)), Math.abs(carried.dot(DOWN))];
      if (Math.max(slide, rise) > 1e-3 && (!this.pivoted || Math.max(slide, rise) > Math.max(this.pivoted.slide, this.pivoted.rise))) this.pivoted = { slide, rise, tread: i };
    }
  }

  // What the shaft a body turns on turns in: up the tree from the body, past everything turning
  // on that same line (the shaft, and anything else on it), the first body that doesn't (a
  // differential's axle housing, round its half shafts), or a root (the frame).
  housing(body: number): number {
    const joint = this.mech.joints[this.parentJoint[body]];
    let link = this.parentLink(body)!;
    while (this.parentJoint[link.parent] >= 0 && onOneLine(joint, this.mech.joints[this.parentJoint[link.parent]])) link = this.parentLink(link.parent)!;
    return link.parent;
  }

  // Whether a joint is in the tree that places the bodies.
  inTree(joint: number): boolean {
    const j = this.mech.joints[joint];
    return this.parentJoint[j.bodyA] === joint || this.parentJoint[j.bodyB] === joint;
  }

  // Whether a joint is part of a closed loop of joints: its two bodies are joined some other
  // way too.
  private inLoop(joint: number): boolean {
    this.loopJoints ??= this.findLoopJoints();
    return this.loopJoints.has(joint);
  }

  // The bodies that are only pins: every joint they have turns on one line, and nothing turns
  // them (no gear, tyre or coupling), so how far they turn on it is anyone's guess (a crank pin
  // in a crankshaft's round holes, carrying connecting rods).
  private findPins(): Set<number> {
    const pins = new Set<number>();
    for (let body = 1; body < this.bodyCount; body++) {
      const joints = this.mech.joints.filter((j) => j.bodyA === body || j.bodyB === body);
      if (joints.length < 2 || joints.some((j) => j.kind !== 'revolute')) continue;
      if (this.mech.gears.some((g) => g.body === body) || this.mech.treads.some((t) => t.body === body) || this.mech.couplings.some((c) => c.bodyA === body || c.bodyB === body) || this.screwed(body)) continue;
      if (joints.every((j) => onOneLine(j, joints[0]))) pins.add(body);
    }
    return pins;
  }

  // The joints in closed loops of joints: all but the bridges, the joints whose bodies nothing
  // else joins. Found in one walk over the joints (Tarjan's): a joint from a body to one first
  // reached through it is a bridge if nothing reached from there leads back to before it. (Asking
  // of each joint whether a search round it gets from one body to the other takes minutes on a
  // model of thousands of bodies, the 42131 Cat D11 Bulldozer.)
  private findLoopJoints(): Set<number> {
    const joints = this.mech.joints;
    const ends: number[][] = Array.from({ length: this.bodyCount }, () => []); // the joints at each body
    joints.forEach((j, index) => {
      ends[j.bodyA].push(index);
      if (j.bodyB !== j.bodyA) ends[j.bodyB].push(index);
    });
    const reached = new Array(this.bodyCount).fill(-1); // in what order each body was first reached
    const back = new Array(this.bodyCount).fill(-1); // the earliest body reachable from it, without going back the way it came
    const bridges = new Set<number>();
    let count = 0;
    for (let start = 0; start < this.bodyCount; start++) {
      if (reached[start] >= 0) continue;
      reached[start] = back[start] = count++;
      // The walk: each body, the joint it was reached by, and how many of its joints it has tried.
      const stack = [{ body: start, via: -1, next: 0 }];
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.next < ends[top.body].length) {
          const index = ends[top.body][top.next++];
          if (index === top.via) continue;
          const j = joints[index];
          const other = j.bodyA === top.body ? j.bodyB : j.bodyA;
          if (reached[other] < 0) {
            reached[other] = back[other] = count++;
            stack.push({ body: other, via: index, next: 0 });
          } else {
            back[top.body] = Math.min(back[top.body], reached[other]);
          }
          continue;
        }
        stack.pop();
        const parent = stack[stack.length - 1];
        if (!parent) continue;
        back[parent.body] = Math.min(back[parent.body], back[top.body]);
        if (back[top.body] > reached[parent.body]) bridges.add(top.via);
      }
    }
    return new Set(joints.flatMap((_, index) => (bridges.has(index) ? [] : [index])));
  }

  // The bodies that can't move against the frame however the mechanism moves, holds and tyres
  // aside: the frame, and any held to it by a loop of joints that can't flex. The 858 V-6
  // engine's block is: its frame, the body with the most structure parts, is one of its
  // cylinder banks, and the block hangs between the two banks, which an axle across their tops
  // holds in a V. Worked out once, from the joints alone.
  private fixedToFrame(): Set<number> {
    if (this.framed) return this.framed;
    const holds = { frozen: this.frozen, fixedBody: this.fixedBody };
    const drag = { held: this.drag.held, heldToFrame: this.drag.heldToFrame };
    this.frozen = new Set();
    this.drag.held = new Set();
    this.drag.heldToFrame = new Set();
    this.fixedBody = -1;
    const basis = this.treeBasis();
    const slip: Slip<BodyRow> = { sideways: [], travel: [], lift: [], rise: [] }; // tyre rows go here, not into the equations
    const motions = nullSpace(inBasis(this.buildEquations(null, slip, true), basis), basis[0].length).map((z) => fromBasis(z, basis));
    Object.assign(this, holds);
    Object.assign(this.drag, drag);
    this.framed = new Set();
    for (let body = 0; body < this.bodyCount; body++) {
      if (motions.every((m) => [0, 1, 2, 3, 4, 5].every((k) => Math.abs(m[6 * body + k] - m[k]) < RANK_TOLERANCE))) this.framed.add(body);
    }
    return this.framed;
  }

  // Whether a body turns like a knob: on a joint whose axis stays put in what it's mounted on
  // (a gear, a crank, a wheel), rather than turning and travelling at once as part of a loop
  // (a connecting rod, the middle beam of a linkage). Drags turn the first kind and push the rest.
  // A body in a loop turns like a knob if what it's mounted on can't move against the frame (see
  // fixedToFrame). It still does otherwise if all its joints are turning ones on one axis: a
  // shaft held in several places (a crane's winch drum, whose axle also passes through bricks
  // pinned to the cab; the axle at the top of its boom, which drives the boom's luffing), not a
  // link pinned at two (a connecting rod).
  // Whether a body that a drag would push (it hangs on a hinge, but doesn't turn like a knob) can't
  // start a push by any of `points` (on the body as built): its hinge has no exact motion, nothing
  // held (play is a drag's last resort, after friction pins), or turns only by swinging the rest of
  // the model round it, moving none of the points. The check and the viewer both ask this, so that
  // they free pins for the same pushes (decision 141 of 2026-11-17: the 41999 Crawler's body
  // shell, whose hinge swings the model round it until friction pins are freed, and which the
  // viewer pushed nowhere instead).
  hingeStuck(body: number, points: Vector3[]): boolean {
    const link = this.parentLink(body);
    if (link === null || this.mech.joints[link.joint].kind !== 'revolute' || this.turnsLikeAKnob(body)) return false;
    const motion = this.jointMotion(link.joint, false);
    return motion === null || points.every((p) => this.pointVelocity(motion, body, p.clone().applyMatrix4(this.poses[body])).length() < 1e-6);
  }

  // Whether a drag of `body` on its joint, with its holds chosen as a drag's are (see
  // holdWhatTheDragDoesntNeed), has a motion: an exact one, or with `play`, one on play too (see
  // Options.loopPlay) that a step can be taken on. The check and the viewer both ask this, so that they free pins for the same
  // drags (decision 139 of 2026-11-17). The holds are let go after, unless `keep` (the viewer's
  // drag goes on with them).
  dragMoves(body: number, play: boolean, keep = false): boolean {
    const link = this.parentLink(body);
    if (this.frames.includes(body) || !link) return false;
    this.holdWhatTheDragDoesntNeed(body, () => this.jointMotion(link.joint, false) !== null, link.joint);
    let moves = this.jointMotion(link.joint, false) !== null;
    // A motion on play counts only where a step can be taken on it, one way or the other: a play
    // motion that no step can follow moves nothing (decision 155 of 2026-11-17: the 8272
    // Snowmobile's ski, lifted, had one, and a drag of it went nowhere). The step is undone, and
    // with it what a turn leaves behind (where it last stopped at a dead point, its last step).
    if (!moves && play && this.jointMotion(link.joint, true) !== null) {
      const before = this.snapshot();
      const [deadPoint, lastStep, onPlay] = [this.deadPoint, this.lastStep, this.onPlay];
      for (const way of [1, -1]) {
        const went = this.turnJointPlain(link.joint, way * MAX_TURN_STEP);
        this.restore(before);
        if (Math.abs(went) > 1e-9) moves = true;
        if (moves) break;
      }
      [this.deadPoint, this.lastStep, this.onPlay] = [deadPoint, lastStep, onPlay];
      // The step may have chosen the holds afresh: chosen again as at the start, for a drag that
      // goes on with them.
      this.letGoAfterDrag();
      this.holdWhatTheDragDoesntNeed(body, () => this.jointMotion(link.joint, false) !== null, link.joint);
    }
    if (!keep) this.letGoAfterDrag();
    return moves;
  }

  turnsLikeAKnob(body: number): boolean {
    const link = this.parentLink(body);
    if (!link) return false;
    if (this.parentJoint[link.parent] < 0 || !this.inLoop(link.joint) || this.fixedToFrame().has(link.parent)) return true;
    const own = this.mech.joints[link.joint];
    const d = axisOf(own.from, own.to);
    return this.mech.joints.every((j) => {
      if (j.bodyA !== body && j.bodyB !== body) return true;
      if (j.kind !== 'revolute' || new Vector3().crossVectors(d, axisOf(j.from, j.to)).length() > 0.01) return false;
      const off = new Vector3().subVectors(j.from, own.from);
      return off.addScaledVector(d, -off.dot(d)).length() < 1;
    });
  }

  // How far a slide joint's bodyB has slid along it, relative to bodyA, since the start, in LDU.
  slideOffset(joint: number): number {
    const j = this.mech.joints[joint];
    const onA = j.from.clone().applyMatrix4(this.poses[j.bodyA]);
    const onB = j.from.clone().applyMatrix4(this.poses[j.bodyB]);
    return onB.sub(onA).dot(axisOf(j.from, j.to).transformDirection(this.poses[j.bodyA]));
  }

  // Two parts that have gone past the end of their travel, or null if none have: a slide
  // joint slid past either end (a plate run off its row of tiles), or a gear run off the end of
  // a rack's teeth.
  atLimit(): [number, number] | null {
    for (let j = 0; j < this.mech.joints.length; j++) {
      const { range, sliding } = this.mech.joints[j];
      if (!range || !sliding) continue;
      const offset = this.slideOffset(j);
      if (offset < range[0] - LIMIT_TOLERANCE || offset > range[1] + LIMIT_TOLERANCE) return sliding;
    }
    // A gear on a rack (or on a row of racks): where it touches must be within the teeth of
    // one of them.
    const rackMeshes = this.mech.meshes.filter((m) => m.kind === 'rack');
    for (const gearIndex of new Set(rackMeshes.map((m) => m.gearA))) {
      let nearest: [number, number] | null = null;
      let onTeeth = false;
      for (const mesh of rackMeshes.filter((m) => m.gearA === gearIndex)) {
        const contact = meshContact(this, mesh)!;
        const rack = contact.b;
        const middle = rack.center.clone().applyMatrix4(this.poses[rack.body]);
        const along = Math.abs(new Vector3().subVectors(contact.pitchPoint, middle).dot(contact.across));
        if (along <= rack.length / 2 + 1e-9) onTeeth = true;
        nearest = nearest ?? [contact.a.part, rack.part];
      }
      if (!onTeeth && nearest) return nearest;
    }
    return null;
  }

  // The point on a joint's axis nearest to `p`, where the joint is now.
  nearestOnAxis(joint: number, p: Vector3): Vector3 {
    const j = this.mech.joints[joint];
    const pose = this.poses[j.bodyA];
    const from = j.from.clone().applyMatrix4(pose);
    const d = axisOf(j.from, j.to).transformDirection(pose);
    return from.addScaledVector(d, new Vector3().subVectors(p, from).dot(d));
  }

  // A joint's axis where it is now: a point on it and its direction (bodyB turns about it
  // relative to bodyA by the right-hand rule).
  jointAxisNow(joint: number): { point: Vector3; dir: Vector3 } {
    const j = this.mech.joints[joint];
    const pose = this.poses[j.bodyA];
    return { point: j.from.clone().applyMatrix4(pose), dir: axisOf(j.from, j.to).transformDirection(pose) };
  }

  // Whether the frame is kept still (the model has no tyres on the ground).
  frameFixed(): boolean {
    return this.fixedBody >= 0;
  }

  // Freezing a body: a body that turns on a joint stops turning on it; a root body (the
  // frame) stops moving altogether. Everything else moves only in ways that allow that.
  toggleFreeze(body: number) {
    if (this.frozen.has(body)) this.frozen.delete(body);
    else this.frozen.add(body);
  }

  isFrozen(body: number): boolean {
    return this.frozen.has(body);
  }

  frozenBodies(): number[] {
    return [...this.frozen];
  }

  unfreezeAll() {
    this.frozen.clear();
  }

  // Before a drag: holds still everything the drag doesn't need to move, so that pushing a
  // car leaves its steering alone and turning its steering wheel leaves the car where it is.
  // Tries holding each body that turns on a joint, those on friction pins first, then the
  // deepest in the mechanism (a planet gear before its differential), and keeps each hold for
  // which `stillPossible` says the drag
  // can still happen. `grabbed` is never held, and nor are wheels with tyres: rolling is their
  // job (holding one front wheel would let the car pivot round it while the steering moves).
  // These holds last only for the drag, and are separate from the bodies the user freezes.
  //
  // Worms lock: a worm gear can't be driven from its gear. So first, any worm the drag would
  // drive from its gear's side is held still. Returns true if that was needed, so the caller
  // can say why a part won't move.
  //
  // A drag that turns a joint passes it as `joint`: then each hold is tried with a quick test
  // (see quickTest), and only the holds it ends up with are checked with `stillPossible`. If
  // they leave the drag impossible after all, as many of them are kept as it allows.
  //
  // While they're chosen, the tyres may scrub only as much as the drag needs with nothing held
  // but the car's steering (and the usual USUAL_SCRUB): a model allowed more scrub would
  // otherwise keep holds it can scrub its way past (the Ackermann car's differential, its tyres
  // scrubbing round a bend rather than its rear wheels turning at different speeds).
  // Holds nothing more where its sums meet a value that is not finite (see refuseNotFinite).
  holdWhatTheDragDoesntNeed(grabbed: number, stillPossible: () => boolean, joint = -1): boolean {
    try {
      return this.holdWhatTheDragDoesntNeedWhole(grabbed, stillPossible, joint);
    } catch (err) {
      if (!(err instanceof NotFinite)) throw err;
      this.refuseNotFinite(err);
      return false;
    }
  }

  private holdWhatTheDragDoesntNeedWhole(grabbed: number, stillPossible: () => boolean, joint: number): boolean {
    // Least motion for a push (see Options.leastPush): a push of a part that hangs on a turning
    // joint is held as a drag that turns that joint, and its steps are chosen by the tiers.
    if (joint < 0 && this.options.leastPush && this.options.leastMotion) {
      const link = this.parentLink(grabbed);
      if (link && this.mech.joints[link.joint].kind === 'revolute') joint = link.joint;
    }
    return this.nearOrigin(() => {
      const scrub = this.scrub;
      // A drag starts (or starts again, its holds chosen afresh): what it held and found before is
      // dropped, but for what turns with its part (see turnTogether).
      this.drag = new Drag(this.drag.together);
      this.drag.choosingHolds = true;
      try {
        return this.chooseDragHolds(grabbed, stillPossible, joint);
      } finally {
        this.drag.choosingHolds = false;
        this.scrub = scrub;
      }
    });
  }

  private chooseDragHolds(grabbed: number, stillPossible: () => boolean, joint: number): boolean {
    const worms = this.wormsAgainst(grabbed);
    for (const worm of worms) this.drag.held.add(worm);
    const wormLocked = worms.length > 0;
    this.drag.turning = joint >= 0 ? { grabbed, joint } : null;
    // A drag that can go with the slides that springs hold at rest held still (see
    // Joint.springHeld) keeps them so for its whole length, its loops closed with them held too:
    // the car stays at its height while a motor steers it or drives it. Free, the 42124's
    // steering motor slid its front shock absorbers' rods, built at the top of their travel, past
    // it as the loops closed, and stopped at once. Only a drag that needs them (a suspension arm,
    // a shock absorber's rod) lets them slide.
    if (this.mech.joints.some((j) => j.springHeld && j.kind === 'slide')) {
      this.drag.springs = true;
      if (!stillPossible()) this.drag.springs = false;
    }
    // Least motion: only worms are held (they lock), and what stands alone on what's still (it
    // can't be needed, and holding it only saves work; held on something that turns, it would
    // be carried round: the 956 Auto Chassis's gear lever, which sits on the drive shaft);
    // jointMotion chooses the rest, tier by tier.
    if (this.options.leastMotion && joint >= 0) {
      for (const body of this.standingAlone(grabbed)) {
        const parent = this.parentLink(body)!.parent;
        if (this.parentJoint[parent] < 0 || this.drag.held.has(parent) || this.frozen.has(parent)) this.drag.held.add(body);
      }
      if (this.options.reach) this.drag.outOfReach = this.outOfReach(grabbed);
      // A car that can't roll with its steering free (the scrub its steering leaves rules out
      // every way to roll: the 8245's caster fork) has its steering held, as tier 2 would keep
      // it still anyway.
      if (this.contactTreads.length > 0 && !stillPossible()) {
        const steering = [...this.steeringBodies()].filter((b) => b !== grabbed && !this.frozen.has(b) && !this.drag.held.has(b));
        for (const b of steering) this.drag.held.add(b);
        if (!stillPossible()) for (const b of steering) this.drag.held.delete(b);
      }
      return wormLocked;
    }
    // A drag that turns its joint without the car moving on its suspension keeps to that: a hold
    // that left it only the suspension would be let go (on the 42125 Ferrari 488 GTE, holding
    // the driveshaft its front wheels drive, through constant velocity joints, left turning one
    // of them only a lurch of the car on its suspension, which stopped it a step on).
    this.drag.plainOnly = false;
    const [usual] = this.freeMotionsApart();
    if (joint >= 0) {
      const axes = this.jointAxes();
      const basis = this.treeBasis();
      this.drag.plainOnly = usual.some((z) => Math.abs(this.rateIn(this.turningIn(z, basis), axes, joint)) > EPSILON);
    }
    // While the holds are chosen, the tyres may scrub no more than the drag needs with only the
    // car's steering held, as it's held first (see holdWhatTheDragDoesntNeed).
    let least = this.leastScrub;
    if (this.contactTreads.length > 0) {
      const steering = [...this.steeringBodies()].filter((b) => b !== grabbed && !this.frozen.has(b) && !this.drag.held.has(b));
      if (steering.length > 0 && !steering.includes(grabbed)) {
        for (const b of steering) this.drag.held.add(b);
        this.freeMotionsApart();
        least = Math.max(least, this.leastScrub);
        for (const b of steering) this.drag.held.delete(b);
      }
    }
    this.scrub = Math.min(this.scrub, Math.max(USUAL_SCRUB, least * 1.01));
    const quick = joint >= 0 ? this.quickTest(joint) : null;
    if (quick) {
      // Holds that leave the drag turning things far more than it would with nothing held have
      // shut off what turning the part is for, and left it a long way round: chosen again with
      // what the part's gears drive held last. (The 855 Mobile Crane's boom extension knob:
      // holding the pinion on its extension rack, deep in the boom, left the knob turning only
      // by luffing the boom, its gear rolling round the one it drives, the luffing knob spinning
      // 80 times as far.)
      this.drag.drivenLast = false;
      const loose = this.motionSize(joint);
      let order = this.chooseHolds(grabbed, quick);
      const held = this.motionSize(joint);
      if (loose > 0 && held > HOLDS_DETOUR * loose) {
        this.drag.held = new Set(worms);
        this.drag.heldToFrame.clear();
        this.drag.drivenLast = true;
        order = this.chooseHolds(grabbed, quick);
        this.drag.drivenLast = false;
      }
      if (stillPossible()) return wormLocked;
      // Too many: keep as many of them as the drag allows, in the order they were chosen
      // (found by halving), those held against the frame among the rest: at full lock, the 956
      // Auto Chassis's gear lever, held against the frame, is chosen before its drive shaft,
      // which leaves its tyres too much to scrub; listed after it, the lever was let go too, and
      // swung round with the shaft it sits on, into the engine.
      const chosen = order.flatMap((b) => (this.drag.heldToFrame.has(b) ? [{ b, toFrame: true }] : this.drag.held.has(b) && !worms.includes(b) ? [{ b, toFrame: false }] : []));
      const keep = (count: number) => {
        this.drag.held = new Set([...worms, ...chosen.slice(0, count).flatMap((h) => (h.toFrame ? [] : [h.b]))]);
        this.drag.heldToFrame = new Set(chosen.slice(0, count).flatMap((h) => (h.toFrame ? [h.b] : [])));
      };
      keep(0);
      if (!stillPossible()) return wormLocked; // impossible whatever's held
      let [lo, hi] = [0, chosen.length]; // keeping lo is possible, hi isn't
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        keep(mid);
        if (stillPossible()) lo = mid;
        else hi = mid;
      }
      keep(lo);
      return wormLocked;
    }
    this.chooseHolds(grabbed, stillPossible);
    return wormLocked;
  }

  // The bodies that steer a car: those that turn when, and only when, its wheels turn about
  // upright axes (a steering wheel, and the gears and shafts down to its rack). Found with the
  // tyres it stands on lifted off the ground and not turning on their axles, so that steering
  // doesn't roll them. A model lifted (see Options.lifted) stands on none: its steering is what
  // turns any of its tyres so, as held in the hand.
  private steeringBodies(): Set<number> {
    const standing = this.options.lifted ? this.mech.treads.map((_, i) => i) : this.contactTreads;
    const treads = [...new Set(standing.map((i) => this.mech.treads[i].body))];
    const [contact, held, toFrame] = [this.contactTreads, this.drag.held, this.drag.heldToFrame];
    // What working out the free motions sets, as it was (this works them out for a car that isn't there).
    const [scrubNeeded, leastScrub, slipRows] = [this.scrubNeeded, this.leastScrub, this.slipRows];
    this.contactTreads = [];
    this.drag.held = new Set(treads);
    this.drag.heldToFrame = new Set();
    // And the car on its springs (see Joint.springHeld): free, each suspension arm's swing turns
    // its tyre a little about the upright too, which the steering doesn't, so nothing counted as
    // steering (the 8880 Super Car, on sliding shock absorbers), and its steering crept.
    this.springsHeld = true;
    // The motions' bodies' turning only (see turningIn): that's all this needs of them.
    let motions: Float64Array[];
    try {
      const basis = this.treeBasis();
      motions = this.freeMotionsInBasis().map((z) => this.turningIn(z, basis));
    } finally {
      [this.contactTreads, this.drag.held, this.drag.heldToFrame] = [contact, held, toFrame];
      [this.scrubNeeded, this.leastScrub, this.slipRows] = [scrubNeeded, leastScrub, slipRows];
      this.springsHeld = false;
    }
    const axes = this.jointAxes();
    // How fast each tyre turns about the upright against the frame, in each motion; those rows
    // made orthonormal.
    const heading = treads.map((b) => motions.map((w) => { const f = this.frameOf[b]; return DOWN.x * (w[3 * b] - w[3 * f]) + DOWN.y * (w[3 * b + 1] - w[3 * f + 1]) + DOWN.z * (w[3 * b + 2] - w[3 * f + 2]); }));
    // With the free-parts rule on (see Options.freeParts): a tyre's turning about the upright counts as
    // a heading only above rounding, against the motions' own size, as the tests below are: where it was
    // 1e-8 (the 8844 Helicopter after a turn of 0.01 rad, 0 at its built pose), orthonormalize made it a
    // whole heading, and five free bodies counted as steering from a drag's second step on.
    const most = Math.max(0, ...motions.map((w) => w.reduce((m, x) => Math.max(m, Math.abs(x)), 0)));
    const headings = orthonormalize(this.options.freeParts === 'off' ? heading : heading.filter((r) => Math.hypot(...r) > 1e-6 * most));
    const steering = new Set<number>();
    if (headings.length === 0) return steering;
    for (const body of this.order) {
      const j = this.parentJoint[body];
      if (j < 0 || treads.includes(body)) continue;
      // How fast it turns in each motion: steering if that's all down to the tyres turning.
      const rates = motions.map((w) => this.rateIn(w, axes, j));
      const size = Math.hypot(...rates);
      if (size < 1e-6) continue;
      const left = rates.slice();
      for (const h of headings) {
        const d = left.reduce((sum, x, i) => sum + x * h[i], 0);
        for (let i = 0; i < left.length; i++) left[i] -= d * h[i];
      }
      if (Math.hypot(...left) < 1e-6 * size) steering.add(body);
    }
    // Not a gear that only idles on the steering: riding on a steering body and carrying none of
    // its own, it turns against its shaft just as the steering does, with the tyres held, but
    // it doesn't steer. Counted, its spin was kept as small as the steering's, so a drive
    // running through it turned the steering shaft along (the 8285 Tow Truck's 16 tooth gear
    // idling on its steering shaft, in the drive to its engine: rolling the truck steered it;
    // decision 90 of 2026-11-15). Only if no tyre's heading depends on it: held still against the
    // frame, such a gear stops no motion, since its mesh already holds it. A gear that is itself
    // the steering turns against the frame as the tyres do, and stays in, though the tyres it
    // steers hang on a linkage rather than under it (the 42080 Forest Machine's turntable).
    for (const body of [...steering]) {
      const link = this.parentLink(body);
      const carries = [...steering].some((c) => this.parentLink(c)?.parent === body);
      if (!link || !steering.has(link.parent) || carries || !this.mech.gears.some((g) => g.body === body)) continue;
      const j = link.joint;
      const d = axes[j];
      const f = this.frameOf[body];
      const own = motions.map((w) => this.rateIn(w, axes, j));
      const against = motions.map((w) => d.x * (w[3 * body] - w[3 * f]) + d.y * (w[3 * body + 1] - w[3 * f + 1]) + d.z * (w[3 * body + 2] - w[3 * f + 2]));
      if (Math.hypot(...against) < 1e-6 * Math.hypot(...own)) steering.delete(body);
    }
    return steering;
  }

  // The holds for a drag (see holdWhatTheDragDoesntNeed), on top of any already there. Returns
  // the bodies it tried, in the order it tried them.
  private chooseHolds(grabbed: number, stillPossible: () => boolean): number[] {
    const depth = (body: number): number => {
      const link = this.parentLink(body);
      return link ? 1 + depth(link.parent) : 0;
    };
    const wheels = new Set(this.mech.treads.map((t) => t.body));
    // A car stays where it is unless the drag needs it to move: pushing it, or turning a wheel
    // it stands on (which drives it). Steering doesn't, nor does turning a wheel off the ground
    // (the 8880 Super Car's steering knob, a small tyre on its back).
    // Each model in the file stands so by itself (see frames): working a part of one doesn't
    // drive off another.
    const onGround = new Set(this.contactTreads.map((i) => this.mech.treads[i].body));
    for (const f of this.frames) {
      if (grabbed === f || onGround.has(grabbed) || !this.contactTreads.some((i) => this.frameOf[this.mech.treads[i].body] === f)) continue;
      this.drag.held.add(f);
      if (!stillPossible()) this.drag.held.delete(f);
    }
    // Nor does what only slides on the car (a bumper resting on tiles) slide along it, nor what
    // swivels on a ball in it (a gear lever) swivel. But a resting body (see Rest) isn't held:
    // it moves as what it rests on does, and whether it has to can't be told from this instant
    // alone (a push rod stands still on a camshaft until a pin comes round under it).
    const resting = new Set((this.mech.rests ?? []).map((r) => r.body));
    for (const body of this.mounts.keys()) {
      if (body === grabbed || this.frozen.has(body) || resting.has(body)) continue;
      this.drag.held.add(body);
      if (!stillPossible()) this.drag.held.delete(body);
    }
    // A string's pulleys aren't held either: they turn as it runs round them.
    const pulleys = new Set((this.mech.strings ?? []).flatMap((s) => s.pulleys.flatMap((w) => (w.joint >= 0 ? [w.body] : []))));
    const candidates = this.order.filter((b) => b !== grabbed && this.parentJoint[b] >= 0 && !this.frozen.has(b) && !wheels.has(b) && !pulleys.has(b) && !resting.has(b));
    // On a car standing on its tyres, what steers it first: turning a wheel rolls the car,
    // rather than steering it (a steered wheel turns, too, as it swings round its pivot). Then
    // friction pins, then the deepest parts; but with drivenLast (see chooseDragHolds), what a
    // part a drag turns drives through its gears comes last.
    const steering = this.contactTreads.length > 0 ? this.steeringBodies() : new Set<number>();
    const steers = (body: number) => (steering.has(body) ? 1 : 0);
    const stiff = (body: number) => (this.mech.joints[this.parentJoint[body]].stiff ? 1 : 0);
    const driven = this.drag.drivenLast && this.drag.turning ? this.gearedTo(grabbed) : new Set<number>();
    const free = (body: number) => (driven.has(body) ? 0 : 1);
    candidates.sort((a, b) => steers(b) - steers(a) || stiff(b) - stiff(a) || free(b) - free(a) || depth(b) - depth(a) || a - b);
    const alone = this.standingAlone(grabbed);
    for (const body of candidates) {
      if (this.drag.held.has(body)) continue;
      // A body standing alone on what's still is held without asking: it can't be needed.
      const parent = this.parentLink(body)!.parent;
      if (alone.has(body) && (this.parentJoint[parent] < 0 || this.drag.held.has(parent) || this.frozen.has(parent))) {
        this.drag.held.add(body);
        continue;
      }
      // A hold mustn't carry along what the body turns on, if that could have stayed still:
      // locking a gear that freewheels on a shaft would turn the shaft.
      const link = this.parentLink(body)!;
      const shaft = link.parent;
      const shaftCouldStay = this.couldStayStill(shaft, stillPossible);
      // Nor carry the body round with the shaft it turns on, if that shaft has to turn (an
      // assembly hanging on a driven axle): hold it against the frame instead, if the drag
      // allows.
      if (!shaftCouldStay && this.sharesAxisWithShaft(body)) {
        this.drag.heldToFrame.add(body);
        if (stillPossible()) continue;
        this.drag.heldToFrame.delete(body);
      }
      // Parts of a closed loop aren't held: whether one is needed can't be told from this
      // instant alone (a steering tie rod doesn't turn at all at straight ahead, but must as
      // soon as the wheels do). But a motor's output is, if the drag allows: its axis stays put
      // in the motor, and its gearbox holds it (the 42129 Mercedes-Benz Zetros's two motors,
      // their axles through one beam, drive its centre differential's housing, which turns the
      // rear axles against the front ones only with the motors held).
      if (this.inLoop(link.joint) && !this.mech.joints[link.joint].motor) continue;
      this.drag.held.add(body);
      if (!stillPossible() || (shaftCouldStay && !this.couldStayStill(shaft, stillPossible))) this.drag.held.delete(body);
    }
    return [0, ...this.mounts.keys(), ...candidates];
  }

  // A quick stand-in for asking whether a drag that turns `joint` is still possible, for trying
  // holds one by one: the motions the model allows, its tyres' scrub aside, are worked out once,
  // in the tree's coordinates (see treeBasis), and each try only adds rows for what's been held
  // since. Scrub only rules motions out, so this may say yes where the full answer
  // (jointMotion) is no, but never the other way round; the holds it chooses are checked with
  // the full answer. Null for a joint that doesn't turn.
  //
  // In those motions' coordinates, the drag is possible if the way that turns the joint (its
  // rates) isn't all in the directions the holds rule out (the span of their rows). Those
  // directions are kept made orthonormal, with what's left of the rates once they're taken out.
  // Holds are tried one at a time, each kept or let go again, so each try starts from a recent
  // one whose holds it still has, and only takes out the rows of those it adds: on a model of
  // thousands of bodies (the 42131 Cat D11 Bulldozer), working out every hold's rows afresh for
  // each try took hours a drag.
  private quickTest(joint: number): (() => boolean) | null {
    const j = this.mech.joints[joint];
    if (j.kind !== 'revolute') return null;
    const basis = this.treeBasis();
    const dot = (a: number[], b: number[]) => {
      let sum = 0;
      for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
      return sum;
    };
    const slip: Slip<BodyRow> = { sideways: [], travel: [], lift: [], rise: [] };
    const free = orthonormalize(nullSpace(inBasis(this.buildEquations(null, slip, true), basis), basis[0].length));
    // How fast each free motion turns the joint (see jointRate).
    const d = axisOf(j.from, j.to).transformDirection(this.poses[j.bodyA]);
    const row = new BodyRow(6 * this.bodyCount);
    for (let k = 0; k < 3; k++) {
      row.add(6 * j.bodyB + k, d.getComponent(k));
      row.sub(6 * j.bodyA + k, d.getComponent(k));
    }
    const rate = inBasis([row], basis)[0];
    const rates = free.map((z) => dot(z, rate));
    const heldBefore = new Set(this.drag.held);
    const toFrameBefore = new Set(this.drag.heldToFrame);
    // Each hold's rows in the free motions' coordinates, by "held 12" or "to frame 12".
    const holdRowsOf = new Map<string, number[][]>();
    const rowsOf = (hold: string): number[][] => {
      let rows = holdRowsOf.get(hold);
      if (!rows) {
        const body = Number(hold.slice(hold.lastIndexOf(' ') + 1));
        const toFrame = hold.startsWith('to frame');
        rows = inBasis(holdRows(this, toFrame ? new Set() : new Set([body]), toFrame ? new Set([body]) : new Set()), basis).map((r) => free.map((z) => dot(r, z)));
        holdRowsOf.set(hold, rows);
      }
      return rows;
    };
    // A try: its holds, the directions they rule out that the try it started from didn't, and
    // what's left of the rates.
    interface Try {
      holds: Set<string>;
      from: Try | null;
      directions: number[][];
      left: number[];
    }
    const start: Try = { holds: new Set(), from: null, directions: [], left: rates };
    let recent: Try[] = [];
    return () => {
      const holds = new Set([...[...this.drag.held].filter((b) => !heldBefore.has(b)).map((b) => `held ${b}`), ...[...this.drag.heldToFrame].filter((b) => !toFrameBefore.has(b)).map((b) => `to frame ${b}`)]);
      // Of the recent tries with no holds this one hasn't, the one with the most.
      let from = start;
      for (const t of recent) if (t.holds.size > from.holds.size && [...t.holds].every((h) => holds.has(h))) from = t;
      const next: Try = { holds, from, directions: [], left: from.left.slice() };
      const before: number[][] = [];
      for (let t: Try | null = from; t; t = t.from) before.push(...t.directions);
      for (const hold of holds) {
        if (from.holds.has(hold)) continue;
        for (const r of rowsOf(hold)) {
          const u = r.slice();
          for (let pass = 0; pass < 2; pass++) {
            for (const e of before) {
              const x = dot(u, e);
              for (let i = 0; i < u.length; i++) u[i] -= x * e[i];
            }
          }
          const length = Math.sqrt(dot(u, u));
          if (length < RANK_TOLERANCE) continue;
          for (let i = 0; i < u.length; i++) u[i] /= length;
          before.push(u);
          next.directions.push(u);
          const x = dot(next.left, u);
          for (let i = 0; i < u.length; i++) next.left[i] -= x * u[i];
        }
      }
      recent = [next, ...recent.filter((t) => t !== from).slice(0, 6), ...(from === start ? [] : [from])];
      return dot(next.left, next.left) >= EPSILON;
    };
  }

  // The bodies a drag of `grabbed` can't reach, the frame held (see Options.reach): those no
  // chain of connections joins to it, or to a tyre on the ground, but through the frame. A tyre
  // on the ground is in reach, as the frame may move (rolling, or on its suspension) and its tyres
  // must keep to the ground. The rest only move as the frame does: the crane, the winch and the
  // stabiliser legs, for a truck's steering wheel.
  private outOfReach(grabbed: number): Set<number> {
    const mech = this.mech;
    const next: number[][] = Array.from({ length: this.bodyCount }, () => []);
    const tie = (bodies: number[]) => {
      const list = bodies.filter((b) => b !== 0);
      for (const b of list) for (const c of list) if (b !== c) next[b].push(c);
    };
    for (const j of mech.joints) tie([j.bodyA, j.bodyB]);
    for (const m of mech.meshes) tie([mech.gears[m.gearA].body, mech.gears[m.gearB].body]);
    for (const { shafts } of this.couplings) tie(shafts.flatMap((sh) => [sh.body, sh.mount]));
    for (const loop of mech.loops ?? []) tie([...loop.wheels.flatMap((w) => [w.body, w.mount]), ...(loop.hooks ?? []).flatMap((h) => [mech.joints[h.joint].bodyA, mech.joints[h.joint].bodyB])]);
    for (const s of mech.strings ?? []) tie([...[s.drum, ...s.pulleys].flatMap((w) => (w ? [w.body, w.mount] : [])), ...(s.start ? [s.start.body] : []), s.end.body, ...(s.hook ? [s.hook.body] : [])]);
    for (const screw of mech.screws ?? []) tie([screw.input, screw.piston]);
    for (const rest of mech.rests ?? []) tie([rest.body, ...rest.on.map((o) => o.body)]);
    const reached = new Set<number>([grabbed, ...this.drag.together, ...this.contactTreads.map((i) => mech.treads[i].body)]);
    const queue = [...reached];
    while (queue.length) {
      const b = queue.pop()!;
      for (const c of next[b]) {
        if (reached.has(c)) continue;
        reached.add(c);
        queue.push(c);
      }
    }
    const out = new Set<number>();
    for (let b = 1; b < this.bodyCount; b++) if (!reached.has(b) && !this.frozen.has(b)) out.add(b);
    return out;
  }

  // The bodies that stand alone: each with everything that hangs on it (its descendants in the
  // tree), joined to the rest of the model by nothing but its own joint. No other joint, gear
  // mesh, universal joint, chain, string or tyre on the ground ties them to anything else, and
  // none of them is frozen or grabbed. Holding one still on its joint can't stop anything else
  // moving (a half pin spinning in a hole, a fan on its axle), so a drag needn't ask whether it
  // can: it saves working out the free motions over again for each of them.
  private standingAlone(grabbed: number): Set<number> {
    const children = new Map<number, number[]>();
    for (const body of this.order) {
      const link = this.parentLink(body);
      if (link) children.set(link.parent, [...(children.get(link.parent) ?? []), body]);
    }
    // Groups of bodies something other than a joint ties together.
    const ties: number[][] = [];
    // Joints outside the tree, too: a body whose own joint is a bridge may still be joined to
    // the rest by others (the 8466 Off-Roader's steering arm, on ball joints to its tie rods, and
    // with the front axle, a body of its own, hanging on it).
    this.mech.joints.forEach((j, i) => {
      if (!this.inTree(i)) ties.push([j.bodyA, j.bodyB]);
    });
    for (const m of this.mech.meshes) ties.push([this.mech.gears[m.gearA].body, this.mech.gears[m.gearB].body]);
    for (const { shafts } of this.couplings) ties.push(shafts.flatMap((sh) => [sh.body, sh.mount]));
    for (const screw of this.mech.screws ?? []) ties.push([screw.input, screw.piston]);
    for (const rest of this.mech.rests ?? []) ties.push([rest.body, ...rest.on.map((c) => c.body)]);
    for (const loop of this.mech.loops ?? []) ties.push([...loop.wheels.flatMap((w) => [w.body, w.mount]), ...(loop.hooks ?? []).map((h) => this.mech.joints[h.joint].bodyB)]);
    for (const st of this.mech.strings ?? []) {
      const wheels = [...(st.drum ? [st.drum] : []), ...st.pulleys];
      ties.push([...wheels.flatMap((w) => [w.body, w.mount]), ...(st.start ? [st.start.body] : []), st.end.body, ...(st.hook ? [st.hook.body] : [])]);
    }
    const anchored = new Set([grabbed, this.fixedBody, ...this.frozen, ...this.drag.heldToFrame, ...this.mech.treads.map((t) => t.body)]);
    const alone = new Set<number>();
    const subtree = (body: number): Set<number> => {
      const all = new Set([body]);
      for (const b of all) for (const c of children.get(b) ?? []) all.add(c);
      return all;
    };
    for (const body of this.order) {
      const j = this.parentJoint[body];
      if (j < 0 || this.inLoop(j)) continue;
      const tree = subtree(body);
      if ([...tree].some((b) => anchored.has(b))) continue;
      if (ties.some((tie) => tie.some((b) => tree.has(b)) && tie.some((b) => !tree.has(b)))) continue;
      alone.add(body);
    }
    return alone;
  }

  // Whether a body turns on the same axis as the shaft it turns on turns on its own (an
  // assembly on a wheel's axle), so turning the shaft would carry the body round.
  private sharesAxisWithShaft(body: number): boolean {
    const link = this.parentLink(body)!;
    const shaftJoint = this.parentJoint[link.parent];
    return shaftJoint >= 0 && onOneLine(this.mech.joints[link.joint], this.mech.joints[shaftJoint]);
  }

  // Whether the drag could still happen with `body` not turning on its joint.
  private couldStayStill(body: number, stillPossible: () => boolean): boolean {
    if (this.parentJoint[body] < 0 || this.drag.held.has(body) || this.drag.heldToFrame.has(body) || this.frozen.has(body)) return true;
    this.drag.held.add(body);
    const possible = stillPossible();
    this.drag.held.delete(body);
    return possible;
  }

  // Whether, with a drag's holds in place (see holdWhatTheDragDoesntNeed), its joint can't turn
  // only because it would drive a worm from its gear's side: it could if those worms were let go.
  // (A drag holds every such worm in the model, wherever it is, so that a worm is held tells
  // nothing about this drag.)
  againstWorm(grabbed: number, joint: number): boolean {
    if (this.jointMotion(joint) !== null) return false;
    const worms = this.wormsAgainst(grabbed);
    if (worms.length === 0) return false;
    const held = this.drag.held;
    this.drag.held = new Set([...held].filter((b) => !worms.includes(b)));
    try {
      return this.jointMotion(joint) !== null;
    } finally {
      this.drag.held = held;
    }
  }

  // The worms that a drag of `grabbed` would drive from the gear side. The worm's side is
  // everything that turns the worm without going through its worm mesh, through gears,
  // universal joints or chains (a crank geared to the worm's axle, say, or a knob that turns it
  // through two universal joints: the 42049 Mine Loader's claw); a drag from anywhere else can
  // only reach the worm through its gear. A linear actuator's screw locks the same way: its
  // piston can't drive its input, which is held still unless the drag turns it.
  private wormsAgainst(grabbed: number): number[] {
    const worms: number[] = [];
    for (const mesh of this.mech.meshes) {
      if (mesh.kind !== 'worm') continue;
      const wormBody = this.mech.gears[mesh.gearA].body;
      if (!this.gearedTo(wormBody, true).has(grabbed)) worms.push(wormBody);
    }
    for (const screw of this.mech.screws ?? []) if (!this.gearedTo(screw.input, true).has(grabbed)) worms.push(screw.input);
    return worms;
  }

  // What a drag of `grabbed` would drive from the wrong end, if anything (see wormsAgainst): a worm
  // gear from its gear, or failing that, a linear actuator from its piston.
  lockedBy(grabbed: number): 'worm' | 'actuator' | null {
    if (this.mech.meshes.some((m) => m.kind === 'worm' && !this.gearedTo(this.mech.gears[m.gearA].body, true).has(grabbed))) return 'worm';
    return (this.mech.screws ?? []).some((screw) => !this.gearedTo(screw.input, true).has(grabbed)) ? 'actuator' : null;
  }

  // Bodies connected to `body` through gear meshes other than worm meshes, and with `turning`,
  // through universal joints and chains too (a linear actuator's input, on a shaft a universal
  // joint turns).
  private gearedTo(body: number, turning = false): Set<number> {
    const ties: [number, number][] = this.mech.meshes.filter((m) => m.kind !== 'worm').map((m) => [this.mech.gears[m.gearA].body, this.mech.gears[m.gearB].body]);
    if (turning) {
      for (const c of this.mech.couplings) ties.push([c.bodyA, c.bodyB]);
      for (const loop of this.mech.loops ?? []) for (const w of loop.wheels.slice(1)) ties.push([loop.wheels[0].body, w.body]);
    }
    const found = new Set([body]);
    const queue = [body];
    while (queue.length) {
      const b = queue.shift()!;
      for (const [x, y] of ties) {
        const other = x === b ? y : y === b ? x : -1;
        if (other >= 0 && !found.has(other)) {
          found.add(other);
          queue.push(other);
        }
      }
    }
    return found;
  }

  // How much a drag turning `joint` turns things, with what's held now: the length of the
  // joints' rates, for each radian of the joint (0 if it can't turn).
  private motionSize(joint: number): number {
    const motion = this.jointMotion(joint);
    if (!motion) return 0;
    let sum = 0;
    this.mech.joints.forEach((j, k) => {
      if (j.kind === 'revolute') sum += this.jointRate(motion, k) ** 2;
    });
    return Math.sqrt(sum);
  }

  // For the next drag of `grabbed`'s joint, `bodies` turn with it, each about the same axis and
  // as fast, against what its shaft turns in (see housing): a vehicle's wheels, as pushing it
  // along turns them, though nothing stands it on the ground (the 8258 Crane Truck, built
  // without its wheels, whose rear differential would otherwise turn one half shaft back as the
  // other turned). Until letGoAfterDrag.
  turnTogether(grabbed: number, bodies: number[]) {
    this.drag.together = [grabbed, ...bodies.filter((b) => b !== grabbed)];
  }

  // A drag ends: what it held and found is dropped.
  letGoAfterDrag() {
    if (FREE_COUNT()) this.countFreeDrag();
    this.drag = new Drag();
    this.syncHeldColumns();
  }

  // The basis's columns left out for the free-parts rule's held tree joints (see droppedColumns), set
  // afresh from the drag's held joints; the basis is made again where they changed. Called where a
  // step's motion is sought (jointMotion, freeMotions) and where a drag ends: the step that chose the
  // joints keeps its basis, and holds them by rows (see holds.ts).
  private syncHeldColumns() {
    const tree = [...this.drag.heldJoints].filter((j) => this.inTree(j)).sort((a, b) => a - b);
    const key = tree.join(',');
    if (key === this.droppedKey) return;
    this.droppedKey = key;
    this.droppedColumns = new Set(tree.map((j) => this.jointColumn[j]));
    this.basis = null;
    this.basisSmall = null;
    this.lastSearch = null;
  }

  // Whether a held joint is held by its column left out (see droppedColumns), so needs no row.
  heldByColumn(j: number): boolean {
    return this.jointColumn[j] >= 0 && this.droppedColumns.has(this.jointColumn[j]);
  }

  // The free-parts rule's classification (decision 295, step one: it changes no motion). At a drag's
  // first step, from the motions the model allows the drag (its holds and the tyres on the ground as
  // they are, the frame free), each joint of the mechanism, the tree's and those that close loops
  // alike, by its rate in each motion against the control's (`control`: the joint's rate for a turn,
  // the grabbed point's speed along the push for a push):
  //   driven: its rate is the same multiple of the control's in every motion (it turns as the
  //     control does, and only so);
  //   free and not driven: it turns in some motion that leaves the control still, so some motion
  //     turns the control and leaves it still;
  //   neither: it turns in no motion.
  // "The same" and "turns" are to 1e-6 of the fastest joint in any of the motions. A track holds to
  // the ground as a tyre does: each wheel in it is a tread (see trackTreads).
  classifyDrag(control: (m: number[]) => number, kind: Drag['kind'], found?: { basis: number[][]; motions: number[][]; slipRows: number[][] }) {
    const d = this.drag;
    const kept = [this.scrubNeeded, this.leastScrub, this.slipRows] as const;
    // Worked out where the model is, not moved to the origin as freeMotions does: that rounds the
    // frame's place in its last bits, and this must change nothing.
    // The motions the drag's own steps choose from (the free motions, the tyres scrubbing and lifting
    // within what's allowed): a joint that moves only as a tyre scrubs or lifts (a plate swinging as the
    // model rolls, the 8856) is a candidate too. The wheels on the ground are left out below.
    let motions: number[][];
    try {
      const basis = found ? found.basis : this.treeBasis();
      const inBasisAll = found ? found.motions : this.freeMotionsInBasis();
      // A motion that is one coordinate of the basis alone (a free hub spinning: on the 9397 Logging
      // Truck, most of them) is that coordinate's column, read off; the same numbers fromBasis gives.
      const toMotion = (z: number[]) => {
        let only = -1;
        for (let c = 0; c < z.length; c++) {
          if (z[c] === 0) continue;
          if (only >= 0) return fromBasis(z, basis);
          only = c;
        }
        return only < 0 ? fromBasis(z, basis) : basis.map((row) => row[only] * z[only]);
      };
      const all = inBasisAll.map(toMotion);
      motions = all;
    } finally {
      [this.scrubNeeded, this.leastScrub, this.slipRows] = kept;
    }
    const c = motions.map(control);
    const cc = c.reduce((sum, x) => sum + x * x, 0);
    // Each joint's axis (and a slide's point) where the model is, once: its rate in a motion is then
    // a few sums (see anyJointRate, which this works out the same way).
    const axes = this.mech.joints.map((joint) => ({ d: axisOf(joint.from, joint.to).transformDirection(this.poses[joint.bodyA]), p: joint.from.clone().applyMatrix4(this.poses[joint.bodyA]) }));
    const rates = this.mech.joints.map((joint, j) => {
      const { d, p } = axes[j];
      const [a, b] = [6 * joint.bodyA, 6 * joint.bodyB];
      return motions.map((m) => {
        if (joint.kind !== 'slide') return (m[b] - m[a]) * d.x + (m[b + 1] - m[a + 1]) * d.y + (m[b + 2] - m[a + 2]) * d.z;
        // A point's velocity on a body: the body's velocity at the origin plus its turning × the point.
        const v = (o: number) => [m[o + 3] + m[o + 1] * p.z - m[o + 2] * p.y, m[o + 4] + m[o + 2] * p.x - m[o] * p.z, m[o + 5] + m[o] * p.y - m[o + 1] * p.x];
        const [vb, va] = [v(b), v(a)];
        return (vb[0] - va[0]) * d.x + (vb[1] - va[1]) * d.y + (vb[2] - va[2]) * d.z;
      });
    });
    const size = (r: number[]) => Math.sqrt(r.reduce((sum, x) => sum + x * x, 0));
    const scale = Math.max(0, ...rates.map(size));
    const free = new Set<number>();
    const driven = new Set<number>();
    // A wheel on the ground (a tyre, or a track's wheel) is no free part: it rolls as the model goes.
    // Its joint is left out, neither free nor driven.
    const rolling = new Set(this.contactTreads.map((i) => this.mech.treads[i].body));
    // Each joint that turns in some motion that leaves the control still could, alone, stay still
    // while the control turns; together they may not (a steering linkage's joints, each of which some
    // motion keeps still, but not all at once). So: the motion that turns the control and keeps those
    // joints, all together, as still as it can (the least sum of their rates squared, as the rule's
    // tier would): the ones it keeps still are free and not driven; the ones it must move are driven,
    // with those whose rate is the control's in every motion.
    const candidates: number[] = [];
    rates.forEach((r, j) => {
      const { bodyA, bodyB } = this.mech.joints[j];
      if (rolling.has(bodyA) || rolling.has(bodyB)) return;
      if (size(r) <= 1e-6 * scale) return;
      const along = cc > 0 ? r.reduce((sum, x, i) => sum + x * c[i], 0) / cc : 0;
      const rest = size(r.map((x, i) => x - along * c[i]));
      if (rest <= 1e-6 * scale) driven.add(j);
      else candidates.push(j);
    });
    // A motion that turns one candidate alone and not the control can always undo that joint's turning
    // in any mix, touching nothing else: that joint is free, and it and the motion are left out of the
    // least squares (the same answer for the rest, from a far smaller problem: on the 9397, most).
    const tol = 1e-6 * scale;
    const privateOf = new Map<number, number>(); // candidate's place -> its motion
    const usedMotion = new Set<number>();
    for (let m = 0; m < motions.length; m++) {
      if (Math.abs(c[m]) > tol) continue;
      let only = -1;
      for (let k = 0; k < candidates.length; k++) {
        if (Math.abs(rates[candidates[k]][m]) <= tol) continue;
        if (only >= 0) { only = -2; break; }
        only = k;
      }
      if (only >= 0 && !privateOf.has(only)) { privateOf.set(only, m); usedMotion.add(m); }
    }
    const keepMotions = motions.map((_, m) => m).filter((m) => !usedMotion.has(m));
    const rest = candidates.map((_, k) => k).filter((k) => !privateOf.has(k));
    // First the cheap question, by the sparse null space: does some motion turn the control and leave
    // every one of them still? Then all are free. Only where none does, the least squares.
    const restRows = rest.map((k) => keepMotions.map((m) => rates[candidates[k]][m]));
    const keptC = keepMotions.map((m) => c[m]);
    let solved: number[] | null = null;
    if (cc > 0) {
      const none = restRows.length ? nullSpace(restRows, keepMotions.length) : keepMotions.map((_, i) => keepMotions.map((__, k) => (k === i ? 1 : 0)));
      const turns = none.some((v) => Math.abs(v.reduce((sum, x, i) => sum + x * keptC[i], 0)) > 1e-9 * Math.sqrt(v.reduce((sum, x) => sum + x * x, 0) * cc));
      solved = turns ? rest.map(() => 0) : this.stillestMix(restRows, keptC);
    }
    const still = solved ? candidates.map((_, k) => (privateOf.has(k) ? 0 : solved[rest.indexOf(k)])) : null;
    // The rule keeps still every joint the drag doesn't drive, not only those that move in the step's
    // first-order motions: closing the loops moves others (the 8856's plate, still in every free motion
    // but swung as the loops close).
    d.candidates = this.mech.joints.flatMap((joint, j) => (driven.has(j) || rolling.has(joint.bodyA) || rolling.has(joint.bodyB) || (this.drag.turning && j === this.drag.turning.joint) ? [] : [j]));
    for (const [k, j] of candidates.entries()) {
      if (!still) free.add(j);
      else if (Math.abs(still[k]) <= 1e-6) free.add(j);
      else driven.add(j);
    }
    d.free = free;
    d.driven = driven;
    d.kind = kind;
    if (setting('KINEBRICK_FREE_DEBUG')) console.error(`free parts, ${kind}: ${motions.length} motions; driven ${[...driven].join(' ')}; candidates ${candidates.join(' ')}; free ${[...free].join(' ')}; on ${this.freeRuleOn()}`);
  }

  // Of the mixes a of the motions with sum a·c = 1 (the control turning at rate 1), the one that keeps
  // the joints' rates (each row of `rows`, a joint's rate in each motion) least, summed squared; their
  // rates in it. Where some mix keeps them all still and turns the control, one of those.
  private stillestMix(rows: number[][], c: number[]): number[] {
    const k = c.length;
    const gram = Array.from({ length: k }, (_, a) => Array.from({ length: k }, (_, b) => rows.reduce((sum, r) => sum + r[a] * r[b], 0)));
    const { values, vectors } = symmetricEigen(gram);
    const top = Math.max(0, ...values);
    const tiny = 1e-12 * (top || 1);
    const onto = (v: number[]) => v.reduce((sum, x, i) => sum + x * c[i], 0);
    const nothing = vectors.filter((_, e) => values[e] <= tiny);
    const turnsNothing = nothing.reduce((sum, v) => sum + onto(v) ** 2, 0);
    let mix: number[];
    if (turnsNothing > 1e-12 * c.reduce((sum, x) => sum + x * x, 0)) {
      mix = new Array(k).fill(0);
      for (const v of nothing) v.forEach((x, i) => (mix[i] += (x * onto(v)) / turnsNothing));
    } else {
      const g = new Array(k).fill(0);
      vectors.forEach((v, e) => {
        if (values[e] <= tiny) return;
        v.forEach((x, i) => (g[i] += (x * onto(v)) / values[e]));
      });
      const cg = onto(g);
      mix = g.map((x) => x / cg);
    }
    return rows.map((r) => r.reduce((sum, x, i) => sum + x * mix[i], 0));
  }

  // The free-parts rule's choice (decisions 291, 295 and 309), made once, at a drag's first step, and kept
  // for the drag as its holds are: of the candidates (every joint the drag doesn't drive, but the wheels on
  // the ground and the control's), those that the motion turning the control with as few of them turning as
  // can (the least sum of their sizes, as static friction holds as many joints as it can), after the tiers
  // that come before turning, leaves still. Each weighs by the parts on its two bodies: of two equal answers,
  // the joint that carries fewer parts turns (an idle gear slips on its shaft rather than run a train of gears
  // and axles). Kept, the choice can't jump between equal answers from one step to the next.
  private chooseHeldJoints(joint: number, basis: number[][], motions: number[][]): number[] {
    const cands = this.drag.candidates;
    if (!cands.length || !motions.length) return [];
    const zs = orthonormalize(motions);
    const { turning, rateOf, rate, size } = this.measures(joint, basis);
    const partsOn = (this.bodyParts ??= this.mech.bodyOf.reduce((n, b) => ((n[b] = (n[b] ?? 0) + 1), n), new Array(this.bodyCount).fill(0)));
    const weight = cands.map((j) => partsOn[this.mech.joints[j].bodyA] + partsOn[this.mech.joints[j].bodyB]);
    const tier: Tier = { cost: (z) => cands.map((j, k) => weight[k] * this.basisJointRate(z, j, basis, rateOf)), sparse: true };
    // Before that, the tiers that come before turning in the drag's own choice (see leastTiers): what's mounted
    // on the car, its steering, friction pins, the housing, and a car on two tyres kept from turning. The rule
    // takes the place of the turning tiers only: else the 42123 McLaren Senna GTR, on two of its tyres, slid
    // and swung round on them, its drive train held, where rolling straight would turn it.
    const first = this.leastTiers(joint, turning, rateOf, size, basis).slice(0, 5);
    const z = leastTurning(zs, rate, [...first, tier, { cost: size, joints: true }]);
    if (!z) return [];
    const c = Math.abs(rate(z));
    if (!(c > 0)) return [];
    return cands.filter((j) => Math.abs(this.basisJointRate(z, j, basis, rateOf)) <= 1e-6 * c);
  }
  private bodyParts: number[] | null = null;

  // A joint's rate in a motion in the tree basis's coordinates: a turning joint's turning (rateOf), a
  // slide's sliding along its axis.
  private basisJointRate(z: number[], j: number, basis: number[][], rateOf: (z: number[], i: number) => number): number {
    const joint = this.mech.joints[j];
    if (joint.kind !== 'slide') return rateOf(z, j);
    const p = joint.from.clone().applyMatrix4(this.poses[joint.bodyA]);
    const d = axisOf(joint.from, joint.to).transformDirection(this.poses[joint.bodyA]);
    const twist = (b: number) => [0, 1, 2, 3, 4, 5].map((k) => dot(basis[6 * b + k], z));
    const at = (t: number[]) => new Vector3(t[3], t[4], t[5]).add(new Vector3(t[0], t[1], t[2]).cross(p));
    return at(twist(joint.bodyB)).sub(at(twist(joint.bodyA))).dot(d);
  }

  // The row that holds a joint still (see Drag.heldJoints and holds.ts): a turning joint's turning about
  // its axis, a slide's sliding.
  heldJointRow(j: number): BodyRow {
    const joint = this.mech.joints[j];
    if (joint.kind === 'slide') return this.slideRow(joint);
    const d = axisOf(joint.from, joint.to).transformDirection(this.poses[joint.bodyA]);
    const row = new BodyRow(6 * this.bodyCount);
    for (let k = 0; k < 3; k++) {
      row.add(6 * joint.bodyB + k, d.getComponent(k));
      row.sub(6 * joint.bodyA + k, d.getComponent(k));
    }
    return row;
  }

  // Whether the free-parts rule holds for this drag (see Options.freeParts): 'all', or 'wheels' and a
  // wheel on the ground.
  freeRuleOn(): boolean {
    const f = this.options.freeParts;
    return this.drag.free !== null && (f === 'all' || (f === 'wheels' && this.drag.kind === 'wheel'));
  }

  // The free-parts rule for a push that doesn't go by the tiers (see push.ts): of `motions` (motion
  // vectors), the mixes that leave every candidate joint still, if any; else `motions` as they are.
  // The push's first step chooses (all the candidates, if some motion leaves them all still, else none),
  // and the choice is kept for the push as holds (Drag.heldJoints): its later steps' motions have the rows.
  freeStill(motions: number[][]): number[][] {
    if (!this.freeRuleOn() || !this.drag.candidates.length || !motions.length) return motions;
    if (this.drag.heldJoints.size) return motions;
    const rows = this.drag.candidates.map((j) => motions.map((m) => this.anyJointRate(m, j)));
    const mix = nullSpace(rows, motions.length);
    if (!mix.length) return motions;
    this.drag.heldJoints = new Set(this.drag.candidates);
    return orthonormalize(mix.map((a) => combine(motions, a)));
  }

  // A joint's rate in a motion: a turning joint's turning about its axis, a slide's sliding along it.
  private anyJointRate(motion: number[], j: number): number {
    const joint = this.mech.joints[j];
    if (joint.kind !== 'slide') return this.jointRate(motion, j);
    const d = axisOf(joint.from, joint.to).transformDirection(this.poses[joint.bodyA]);
    const p = joint.from.clone().applyMatrix4(this.poses[joint.bodyA]);
    return this.pointVelocity(motion, joint.bodyB, p).sub(this.pointVelocity(motion, joint.bodyA, p)).dot(d);
  }

  // Whether a joint turns a wheel on the ground (a drag of it is a wheel drag for the free-parts rule):
  // one of its bodies carries a tread that touches the ground (a tyre, or a track's wheel), or is a wheel
  // of a track that does (a sprocket above the ground, driving a track whose run is on it).
  private wheelTurned(joint: number): boolean {
    const { bodyA, bodyB } = this.mech.joints[joint];
    const bodies = [bodyA, bodyB];
    if (this.contactTreads.some((i) => bodies.includes(this.mech.treads[i].body))) return true;
    const onGround = new Set(this.contactTreads.flatMap((i) => (this.mech.treads[i].track === undefined ? [] : [this.mech.treads[i].track])));
    return this.mech.treads.some((t) => t.track !== undefined && onGround.has(t.track) && bodies.includes(t.body));
  }

  // KINEBRICK_FREE_COUNT=1: how far each joint has moved since the count last looked (the turn
  // between its two bodies, or the slide), added up over the drag, and how far the control has.
  // Counted over every joint, the free ones picked out at the drag's end.
  // `start`: the drag's first step is about to be taken (before its classification is made).
  countFree(grabPoint: Vector3 | null = null, start = false) {
    const d = this.drag;
    if (!d.free && !start) return;
    const rel = this.mech.joints.map((j) => this.poses[j.bodyA].clone().invert().multiply(this.poses[j.bodyB]));
    if (!d.counted) {
      d.counted = { rel, moved: rel.map(() => 0), travel: 0, grab: grabPoint };
      return;
    }
    const q = new Quaternion();
    this.mech.joints.forEach((j, i) => {
      const step = d.counted!.rel[i].clone().invert().multiply(rel[i]);
      if (j.kind === 'slide') d.counted!.moved[i] += new Vector3().setFromMatrixPosition(step).length();
      else d.counted!.moved[i] += 2 * Math.acos(Math.min(1, Math.abs(q.setFromRotationMatrix(step).w)));
    });
    if (d.turning) d.counted.travel = d.counted.moved[d.turning.joint];
    else if (grabPoint && d.counted.grab) d.counted.travel += grabPoint.distanceTo(d.counted.grab);
    d.counted.rel = rel;
    if (grabPoint) d.counted.grab = grabPoint;
  }

  static freeCounts: { kind: Drag['kind']; free: number; driven: number; travel: number; most: number; mostJoint: number; over: number }[] = [];
  private countFreeDrag() {
    const d = this.drag;
    if (!d.free || !d.counted || !(d.counted.travel > 0)) return;
    let most = 0;
    let mostJoint = -1;
    let over = 0;
    for (const j of d.free) {
      const m = d.counted.moved[j];
      if (m > most) [most, mostJoint] = [m, j];
      if (m > 1e-6 * d.counted.travel) over++;
    }
    const moving = this.mech.joints.map((_, j) => [j, d.counted!.moved[j]] as [number, number]).filter(([, m]) => m > 1e-6 * d.counted!.travel).sort((x, y) => y[1] - x[1]);
    const cands = new Set(d.candidates);
    const topMoving = moving.slice(0, 8).map(([j, m]) => `${j}${cands.has(j) ? 'c' : d.driven!.has(j) ? 'd' : ''}:${m.toFixed(3)}`).join(' ');
    Kinematics.freeCounts.push({ kind: d.kind, free: d.free.size, driven: d.driven!.size, candidates: d.candidates.length, held: d.heldJoints.size, travel: d.counted.travel, most, mostJoint, over, topMoving } as never);
  }

  // ---------------------------------------------------------------------------
  // The equations

  private equations(): BodyRow[] {
    return this.buildEquations(null, null);
  }

  // The equations, as rows: each kind of connection's in turn (see CONNECTIONS). If `gaps` is given, it also gets, for each row, the value its
  // motion should take to close the gap in a joint the tree doesn't follow (how far the joint
  // has come apart), or 0 for every other row (see closeLoops).
  // If `slip` is given, it gets, for each tyre on the ground, a row for how fast it scrubs
  // sideways and one for how fast it travels.
  // With `skipTree`, the tree's joints are left out, for solving in the tree's coordinates
  // (see treeBasis), which keep them together anyway.
  // `weights`, if given, gets how much each row counts in closing loops (see DRIVE_WEIGHT).
  // `play`, if given, gets for each row of a joint that closes a loop how much it counts in
  // taking up play (1, or STUD for a turning row), and 0 for every other row (see playMotion).
  private buildEquations(gaps: number[] | null, slip: Slip<BodyRow> | null, skipTree = false, weights: number[] | null = null, play: number[] | null = null): BodyRow[] {
    const rows: BodyRow[] = [];
    // What a drag can't reach is held where it is on the frame (see holds), so a row on nothing
    // but those bodies and the frame has nothing left to say, but its rounding: left out, so that
    // can't hold back what the drag moves. (The 855 Mobile Crane's hook block hangs from the boom
    // on a string whose rows are a hundred-thousandth out when the whole crane moves as one. Held
    // with the boom, it turned the car a little as it rolled, until the rolling stopped.) Only
    // tyres touch the ground, and they're always in reach.
    const held = this.drag.outOfReach;
    let all = true; // whether every row is kept: the holds' own always are
    // (Over the row's places in order, passing 0s and the frame's, as it went over every number.)
    const onlyHeld = (row: BodyRow) => {
      let touches = false;
      for (const [i, x] of row.entries()) {
        const b = Math.floor(i / 6);
        if (b < 1 || x === 0) continue;
        if (!held.has(b)) return false;
        touches = true;
      }
      return touches;
    };
    const eq: Equations = {
      n: 6 * this.bodyCount,
      gaps: gaps !== null,
      skipTree,
      slip,
      add: (row: BodyRow, gap = 0, weight = 1, playScale = 0) => {
        if (!all && onlyHeld(row)) return;
        rows.push(row);
        this.traceNames?.push(this.traceName);
        gaps?.push(gap);
        weights?.push(weight);
        play?.push(playScale);
      },
    };
    for (const connection of CONNECTIONS) {
      if (this.traceNames) this.traceName = connection.name;
      all = connection === holds || held.size === 0;
      connection(this, eq);
    }
    // A slide held at an end of its travel slides no further (see endHeld). Closing the loops, one
    // past its end is brought back to it: a step's second-order drift may push it on (the 9397's
    // plough, 3.5×10⁻⁴ LDU). One within LIMIT_TOLERANCE of its end is left where it is: brought
    // back too, the 42079 Heavy Duty Forklift's mast, tilted on play, stopped at 0.07 radians of the
    // 0.21 asked (tests/keep-ahead.test.ts); why is not traced.
    all = true;
    if (this.traceNames) this.traceName = 'slide ends';
    for (const j of this.endHeld) {
      const joint = this.mech.joints[j];
      const offset = this.slideOffset(j);
      let gap = 0;
      if (gaps && joint.range && offset > joint.range[1] + LIMIT_TOLERANCE) gap = joint.range[1] - offset;
      if (gaps && joint.range && offset < joint.range[0] - LIMIT_TOLERANCE) gap = joint.range[0] - offset;
      eq.add(this.slideRow(joint), gap);
    }
    return rows;
  }

  // A string's layout where it is now, for drawing it (see stringLayout).
  stringPoints(string: number): Vector3[] {
    return this.stringNow(this.mech.strings[string]).layout.points;
  }

  // How far a loop (a chain or track, an index into Mechanism.loops) has moved round since the
  // start, in LDU, the way its path goes: as far as its first wheel's rim has turned.
  loopTravel(loop: number): number {
    const { path, wheels } = this.mech.loops[loop];
    return wheels[0] ? this.wheelTravel(path.points[wheels[0].point], wheels[0]) : 0;
  }

  // How far a wheel's rim has turned in what it turns in since the start, in LDU, the way a
  // path goes round its circle `point`.
  wheelTravel(point: { axis: Vector3; radius: number; turn: number }, w: { body: number; joint: number }): number {
    const j = this.mech.joints[w.joint];
    // The joint turns bodyB relative to bodyA about its own axis; the wheel turns about the
    // circle's.
    const angle = (j.bodyB === w.body ? 1 : -1) * Math.sign(axisOf(j.from, j.to).dot(point.axis)) * this.jointAngles[w.joint];
    return point.turn * point.radius * angle;
  }

  // After a step: pulls the joints the tree doesn't follow (one per closed loop, and every
  // slide and ball joint) back together. Small steps let them drift apart; this moves every
  // body by the smallest motion that closes the gaps while keeping every other equation, and
  // without turning `keep` (the joint a drag is turning, so it turns by exactly what the drag
  // asked). A few rounds, since each is only exact for small gaps; it stops early once a round
  // no longer halves the biggest gap (a model whose positions are rounded off, as LDraw files
  // are, can't always close its loops quite exactly), undoing that round if it made the gap
  // bigger.
  // Returns how far apart the joints still are (the largest gap, as at the start of the
  // last round): next to nothing, unless they can't come together (see turnJoint).
  private closeLoops(keep: number): number {
    if (this.mech.joints.every((_, j) => this.inTree(j)) && !this.mech.rests?.length && !this.mech.riders?.length) return 0;
    let last = 0;
    let previous = Infinity;
    let before: KinematicsState | null = null;
    // The tree's basis is kept from round to round while the gaps at least halve each round:
    // the bodies move only a little, and working it out afresh each round is most of the time
    // a big model's step takes. When they don't, it's worked out afresh where the bodies are,
    // and the round tried again.
    let basis = this.treeBasis();
    let fresh = true;
    // One problem: whether the last round mixed in the free motions the tiers chose, on a basis
    // worked out afresh, and whether the rest go without them (see below).
    let mixedFresh = false;
    let plain = false;
    let opened = Infinity; // how far apart the step left them
    for (let round = 0; round < 12; round++) {
      let gaps: number[] = [];
      let weights: number[] = [];
      const play: number[] = [];
      let rows = this.buildEquations(gaps, null, true, weights, play);
      // The second closing after a step on play (see turnJoint): only the rows that take no play
      // (gears, universal joints, tyres, holds), the loops left as the first closing left them.
      if (this.closingFirmOnly) {
        const firm = play.map((p) => !p);
        rows = rows.filter((_, i) => firm[i]);
        gaps = gaps.filter((_, i) => firm[i]);
        weights = weights.filter((_, i) => firm[i]);
      }
      const biggest = gaps.reduce((max, g) => Math.max(max, Math.abs(g)), 0);
      last = biggest;
      if (round === 0) opened = biggest;
      if (biggest < LOOP_TOLERANCE) return last;
      // One problem: a step that opened the loops more than a stud is no step to take, and is left
      // for turnJoint to refuse. The tiers' mix can close
      // what plain closing can't, and a wild step, closed so, kept what's free to go anywhere
      // (the 8448 Super Street Sensation's front wheels, spun 3.5 radians on their hubs by a step
      // that opened the loops 1,200 LDU, as the suspension took up its play).
      if (round === 0 && this.options.oneProblem && keep >= 0 && this.drag.turning?.joint === keep && this.stepByTiers && biggest > STUD) return last;
      if (biggest > previous / 2) {
        // A round that opened the gaps up, rather than closing them, is undone.
        if (before && biggest > previous) {
          this.restore(before);
          last = previous;
          // One problem: the free motions are free only to first order, and a mix of them may
          // open the gaps again even from a basis worked out afresh, round after round (the 8002
          // Destroyer Droid's back leg, which never moved): if that leaves them too far apart for
          // the step (see turnJoint), the rest of the rounds close them without it. Only then: a
          // step it leaves close enough goes as it is (the 8865 Test Car's crankshaft, whose
          // steps, closed without it, stopped it short of a turn). And only for a step that
          // opened them no more than a step moves a point a stud from a joint (the 42043
          // Mercedes-Benz Arocs 3245's rear wheels, 0.11 LDU): one that opened them far is no
          // step to take (the 42037 Formula Off-Roader's rear hub, whose first step back slid
          // the car 2,948 LDU, and closed without the mix, went).
          if (mixedFresh && last > DEAD_POINT_GAP && opened <= STUD * MAX_TURN_STEP) {
            plain = true;
            previous = Infinity;
            before = null;
            continue;
          }
        }
        if (fresh) return last;
        basis = this.treeBasis();
        fresh = true;
        previous = Infinity;
        before = null;
        continue;
      }
      previous = biggest;
      before = this.snapshot();
      // One problem (see docs/one-problem.md): the loops are closed as the tiers would have it,
      // by the gaps' least-squares closing plus the mix of free motions (which keep every
      // equation, and the dragged joint where it is) the tiers choose, rather than with what the
      // step left still weighted to stay so.
      const one = this.options.oneProblem && keep >= 0 && this.drag.turning?.joint === keep && this.stepByTiers;
      let keepRow: BodyRow | null = null;
      if (keep >= 0) {
        const row = new BodyRow(6 * this.bodyCount);
        keepRow = row;
        const j = this.mech.joints[keep];
        const d = axisOf(j.from, j.to).transformDirection(this.poses[j.bodyA]);
        // With one problem, the part grabbed is kept where the step left it against what its
        // shaft turns in (see housing), as the step's motion turned it: kept only on what it turns
        // on, a pin free to spin in its holes could turn it all the same (the 9394 Airliner's
        // control stick, on a long pin, and with it the tailplanes, left 2 LDU off there and back).
        const grabbed = this.drag.turning?.grabbed ?? -1;
        const [on, under] = one && grabbed >= 0 && this.parentJoint[grabbed] === keep ? [grabbed, this.housing(grabbed)] : [j.bodyB, j.bodyA];
        for (let k = 0; k < 3; k++) {
          row.add(6 * on + k, d.getComponent(k));
          row.sub(6 * under + k, d.getComponent(k));
        }
        rows.push(row);
        gaps.push(0);
        weights.push(1);
      }
      if (!one) for (const b of this.closingStill) {
        for (let k = 0; k < 6; k++) {
          const row = new BodyRow(6 * this.bodyCount);
          row.set(6 * b + k, 1);
          row.sub(k, 1);
          rows.push(row);
          gaps.push(0);
          weights.push(this.options.closeStill);
        }
      }
      let solution = dampedSolution(inBasis(rows, basis), gaps, this.basisOrders.get(basis), weights);
      if (!solution) return last;
      mixedFresh = one && !plain && fresh;
      if (one && !plain) {
        const { turning, rateOf, size } = this.measures(keep, basis);
        const tiers = this.leastTiers(keep, turning, rateOf, size, basis);
        // The free motions where the bodies are now: the step's own, from where it started, are
        // free only to first order here, and a mix of them can open the gaps again (the 42062
        // Container Yard's spreader, whose linkage fits only as it lies). Tyres may scrub and
        // lift a hair, as in choosing the step (see freeMotionsApart): kept on the ground
        // exactly, they couldn't steer back what closing the loops turned (the 956 Auto Chassis,
        // driven round a circle, drifting off it).
        const slip: Slip<BodyRow> = { sideways: [], travel: [], lift: [], rise: [] };
        const firm = this.buildEquations(null, slip, true);
        if (keepRow) firm.push(keepRow);
        const motions = orthonormalize(nullSpace(inBasis(firm, basis), basis[0].length));
        // A tyre scrubbing or lifting counts in the turning tier, each LDU as much as a body
        // turning a radian: else that tier, keeping bodies from turning, slid the whole model on
        // its tyres instead, which nothing after it costs (the 42029 Customized Pick up Truck,
        // pushed along by a rear wheel, went a quarter further than the wheel rolled). And its
        // bodies that turn only a little aren't held still first (see Options.stillness): in a
        // correction, all of them turn only a little, and held still, they slid it all the same.
        const slid = inBasis([...slip.sideways, ...slip.lift], basis);
        const corrections = tiers.map((t) => (t.bodies ? { cost: (z: number[]) => [...t.cost(z), ...slid.map((row) => dot(row, z))] } : t));
        // Before them all, what the step left still is kept as still as it can be: stillness
        // (see Options.stillness) held it for the step, but a correction's bodies all turn only a little,
        // so it doesn't hold them here, and the free motions it held were stirred, differently
        // there and back (the 42021 Snowmobile's steering, whose arm swivels as its skis toe in
        // or out, came back 2.5 LDU off). Only the bodies' coordinates some free motion moves
        // count: on a big model, the rest are most of them, and cost the tiers' time for nothing.
        if (this.closingStill.length && motions.length) {
          const coordinates = this.closingStill.flatMap((b) => [0, 1, 2, 3, 4, 5].map((k) => 6 * b + k));
          // The frame's six worked out once for each z, not again for each coordinate (the same sums:
          // the frame's rows reach every coordinate, and this was most of a step of the 9397 Logging
          // Truck rolled, 2026-11-20).
          // Each coordinate's row times z over z's places that are not 0 where they're fewer (see
          // rowsTimes): the same sums.
          const still = (list: number[], z: number[]) => {
            const frame = rowsTimes(basis, [0, 1, 2, 3, 4, 5], z);
            return rowsTimes(basis, list, z).map((x, l) => x - frame[list[l] % 6]);
          };
          const moved = motions.map((m) => still(coordinates, m));
          const most = moved.reduce((max, v) => v.reduce((m, x) => Math.max(m, Math.abs(x)), max), 0);
          const touched = coordinates.filter((_, r) => moved.some((v) => Math.abs(v[r]) > 1e-9 * most));
          if (touched.length) corrections.unshift({ cost: (z: number[]) => still(touched, z) });
        }
        solution = (motions.length ? leastTurning(motions, (z) => rateOf(z, keep), corrections, solution, 0) : null) ?? solution;
      }
      this.move(fromBasis(solution, basis), 1);
      fresh = false;
    }
    const gaps: number[] = [];
    this.buildEquations(gaps, null, true);
    return gaps.reduce((max, g) => Math.max(max, Math.abs(g)), 0);
  }

  // Where a tyre touches the ground now.
  // Where the track's centreline passes nearest a point (see Rail), with the track where the
  // frame now is: the direction along it there (`t`, level, either way along), the direction
  // across it to the left of `t` (`n`), how far the point is off it along `n` (`offset`) and how
  // sharply it bends there, turning towards `n` (`curvature`, 1 over the radius, 0 on a
  // straight). Null if the model has no track.
  nearestRail(point: Vector3): { t: Vector3; n: Vector3; offset: number; curvature: number } | null {
    let best: { t: Vector3; n: Vector3; offset: number; curvature: number; distance: number } | null = null;
    const frame = this.poses[0];
    for (const rail of this.mech.rails ?? []) {
      const from = rail.from.clone().applyMatrix4(frame);
      const to = rail.to.clone().applyMatrix4(frame);
      let t: Vector3;
      let q: Vector3;
      let curvature = 0;
      if (rail.center === undefined) {
        const d = new Vector3().subVectors(to, from);
        const length = d.length();
        d.divideScalar(length);
        const s = Math.max(0, Math.min(length, new Vector3().subVectors(point, from).dot(d)));
        q = from.clone().addScaledVector(d, s);
        t = d;
      } else {
        const center = rail.center.clone().applyMatrix4(frame);
        const level = (v: Vector3) => v.clone().addScaledVector(UP, -v.dot(UP));
        const r = level(new Vector3().subVectors(point, center));
        const a = level(new Vector3().subVectors(from, center));
        const b = level(new Vector3().subVectors(to, center));
        // Which way the arc turns about UP from `from` to `to`, and whether the point lies within
        // its sweep (else its nearer end stands in).
        const turn = Math.sign(new Vector3().crossVectors(a, b).dot(UP)) || 1;
        const angle = (u: Vector3, v: Vector3) => Math.atan2(new Vector3().crossVectors(u, v).dot(UP) * turn, u.dot(v));
        const sweep = angle(a, b);
        const at = angle(a, r);
        const radial = (at >= 0 && at <= sweep ? r : point.distanceTo(from) <= point.distanceTo(to) ? a : b).clone().normalize();
        q = center.clone().addScaledVector(radial, rail.radius!);
        q.y = from.y;
        t = new Vector3().crossVectors(UP, radial).multiplyScalar(turn).normalize();
        curvature = turn / rail.radius!;
      }
      const n = new Vector3().crossVectors(UP, t).normalize();
      // Measured level: the point may be above the rail heads (an axle's middle).
      const off = new Vector3().subVectors(point, q);
      off.addScaledVector(UP, -off.dot(UP));
      const distance = off.length();
      if (!best || distance < best.distance) best = { t, n, offset: off.dot(n), curvature, distance };
    }
    return best;
  }

  contactPoint(treadIndex: number): Vector3 | null {
    const t = this.mech.treads[treadIndex];
    const pose = this.poses[t.body];
    const axis = t.axis.clone().transformDirection(pose);
    return lowestPoint(this.onAxis(t.body, t.center.clone().applyMatrix4(pose), axis), axis, t.radius);
  }

  // With the centres option: a round part's centre (`c`, where it is now, a gear's or a tyre's
  // turning about `axis`) taken on the axis of the turning joint the part itself sits on: of its
  // body's turning joints along that axis, the one whose axis runs nearest `c`, if that is within
  // ON_AXIS LDU. A joint's axis comes from the axle and its hole, and the gear or tyre is a part of
  // its own, which may be placed a hair off it (a model's positions are rounded off). Off it, the
  // gear's teeth would be taken to go round a little faster on one side and slower on the other,
  // so two gears no longer turn in the ratio of their teeth, and a gear train that closes on itself
  // jams (the 858 Auto Engines' gears, every part nudged by up to 0.05 LDU). Not the joint the body
  // turns on in the tree: a body may turn on one axle and carry a gear on another (the 42066's spur
  // gear, 97 LDU from it). Without the option, or with no such joint, `c` as it is.
  onAxis(body: number, c: Vector3, axis: Vector3): Vector3 {
    if (!this.options.centres) return c;
    if (!this.turningJointsOf) {
      this.turningJointsOf = Array.from({ length: this.bodyCount }, () => [] as number[]);
      this.mech.joints.forEach((j, i) => {
        if (j.kind !== 'revolute') return;
        this.turningJointsOf![j.bodyA].push(i);
        if (j.bodyB !== j.bodyA) this.turningJointsOf![j.bodyB].push(i);
      });
    }
    let best: Vector3 | null = null;
    let nearest = ON_AXIS;
    for (const i of this.turningJointsOf[body]) {
      const j = this.mech.joints[i];
      const d = axisOf(j.from, j.to).transformDirection(this.poses[j.bodyA]);
      if (Math.abs(d.dot(axis)) < 0.999) continue;
      const from = j.from.clone().applyMatrix4(this.poses[j.bodyA]);
      const on = from.addScaledVector(d, new Vector3().subVectors(c, from).dot(d));
      const off = on.distanceTo(c);
      if (off < nearest) {
        nearest = off;
        best = on;
      }
    }
    return best ?? c;
  }

  // ---------------------------------------------------------------------------
  // Motions

  // The motions the mechanism allows right now, as motion vectors (6 numbers per body).
  // An empty list means it's jammed.
  // They're made orthonormal, so that mixing them by least squares gives the smallest overall
  // motion (turning the steering wheel shouldn't also roll the car).
  //
  // Tyres on the ground may scrub sideways a little: of the motions the equations allow, the
  // ones kept are those where the tyres scrub sideways by at most `scrub` of how fast they
  // travel (rolling straight, steering on its own, and a steered car turning round the centre
  // that needs the least scrub), and not, say, sliding the car across its length. Motions that
  // leave the frame where it is are kept however much the tyres scrub: steering a parked car
  // whose wheels sit off their pivots drags its tyres round, as on a real car.
  //
  // A tyre's contact point may also rise or sink, very little: by at most LIFT of how far it
  // moves across the ground, so a wheel steered on a leaning pivot can turn. Rolling the car
  // counts that against the scrub allowance; a parked car's motions (steering) have only it
  // to keep to.
  //
  // A car moving on its suspension (its frame rising, sinking or tipping over its tyres, which
  // rolling and steering hardly do, and sliding the car across doesn't at all) drags its tyres
  // sideways, as its suspension arms swing its wheels out and in, and as its frame tips: they
  // may scrub sideways as far as the frame rises or sinks over them, but not lift. At the moment
  // its arms swing its wheels straight up and down (as a model is often built) it needn't scrub
  // at all, but a step further on it does, the more the further: counted against how far the
  // tyres roll, next to nothing, its suspension locked after one step (the 42000 Grand Prix
  // Racer's wishbones).
  // Of `motions` (see freeMotions), those in which the frame of `body`'s model stays still: the
  // body's own motions against the model, not the whole model's. None if no such motion moves
  // `point` (on the body, where it is now), or if the body is that frame. A hand on a door opens
  // the door; the model rolls only where the part has no motion of its own (decision 155 of
  // 2026-11-17). A wheel of a car on the ground has none: its tyre can't turn in place while the
  // car stands still, so pushing it rolls the car.
  ownMotions(motions: number[][], body: number, point: Vector3): number[][] {
    const frame = this.frameOf[body];
    if (frame === body || motions.length === 0) return [];
    const rows = [0, 1, 2, 3, 4, 5].map((k) => motions.map((m) => m[6 * frame + k]));
    const own = mixes(motions, nullSpace(rows, motions.length));
    return own.some((m) => this.pointVelocity(m, body, point).length() > 1e-9) ? own : [];
  }

  freeMotions(): number[][] {
    this.syncHeldColumns();
    return this.nearOrigin((toModel) => {
      const basis = this.treeBasis();
      return this.freeMotionsInBasis().map((z) => toModel(fromBasis(z, basis)));
    });
  }

  // The free motions, in the tree basis's coordinates (see treeBasis), far fewer than a motion
  // vector's: the basis is orthonormal, so lengths and angles there are the motions' own, and
  // only the motions a caller ends up with need turning back into motion vectors.
  private freeMotionsInBasis(): number[][] {
    const [usual, suspension] = this.freeMotionsApart();
    return orthonormalize([...usual, ...suspension]);
  }

  // Each slide that a spring holds at rest (see Joint.springHeld) as a row: how fast it slides,
  // in LDU.
  springRows(): BodyRow[] {
    return this.mech.joints.flatMap((j) => (j.springHeld && j.kind === 'slide' ? [this.slideRow(j)] : []));
  }

  // How fast a slide slides (LDU), as a row.
  private slideRow(j: Joint): BodyRow {
    const p = j.from.clone().applyMatrix4(this.poses[j.bodyA]);
    const d = axisOf(j.from, j.to).transformDirection(this.poses[j.bodyA]);
    const row = new BodyRow(6 * this.bodyCount);
    for (let k = 0; k < 3; k++) {
      addPointVelocity(row, j.bodyB, p, k, d.getComponent(k));
      addPointVelocity(row, j.bodyA, p, k, -d.getComponent(k));
    }
    return row;
  }

  // The free motions (see freeMotionsInBasis) in two lots: the car moving on its suspension,
  // and all the others, orthogonal to those.
  // Worked out on the coordinates some row ties (decision 241 of 2026-11-19): a coordinate of the
  // tree basis that no row ties, every row's entry for it below RANK_TOLERANCE as the null space
  // has it, is free on its own whatever the rest do. Every lot below keeps it whole, as its own
  // motion, the rows (the equations, the tyres' slip, the springs, the frame kept still) being
  // nothing there, so the work is done without it and it is put back after, unchanged. On the
  // 9397 Logging Truck, 192 of 451 coordinates are such (free-spinning hubs, pins, hinges): the
  // work on the rest is a fraction, and the motions are the same, in another orthonormal basis of
  // the same space.
  private freeMotionsApart(): [number[][], number[][]] {
    const slip: Slip<BodyRow> = { sideways: [], travel: [], lift: [], rise: [] };
    const n = 6 * this.bodyCount;
    const basis = this.treeBasis();
    const q = basis[0].length;
    const rows = inBasis(this.buildEquations(null, slip, true), basis);
    this.scrubNeeded = null;
    this.leastScrub = 0;
    this.slipRows = [];
    const [sideways, travel, lift, rise] = [slip.sideways, slip.travel, slip.lift, slip.rise].map((r) => inBasis(r, basis));
    if (sideways.length) this.slipRows = [...sideways, ...lift];
    const frameStill = inBasis(
      Array.from({ length: 6 }, (_, k) => {
        const row = new BodyRow(n);
        row.set(k, 1);
        return row;
      }),
      basis,
    );
    const springs = sideways.length ? inBasis(this.springRows(), basis) : [];
    const every = sideways.length ? [...rows, ...sideways, ...travel, ...lift, ...rise, ...springs, ...frameStill] : rows;
    const tied: number[] = [];
    const free: number[] = [];
    for (let c = 0; c < q; c++) (every.some((row) => Math.abs(row[c]) >= RANK_TOLERANCE) ? tied : free).push(c);
    if (free.length === 0) return this.freeMotionsOf(rows, sideways, travel, lift, rise, springs, frameStill, q);
    const on = (list: number[][]) => list.map((row) => tied.map((c) => row[c]));
    const [usual, suspension] = this.freeMotionsOf(on(rows), on(sideways), on(travel), on(lift), on(rise), on(springs), on(frameStill), tied.length);
    const back = (z: number[]) => {
      const out = new Array(q).fill(0);
      tied.forEach((c, i) => (out[c] = z[i]));
      return out;
    };
    const units = free.map((c) => {
      const u = new Array(q).fill(0);
      u[c] = 1;
      return u;
    });
    return [[...usual.map(back), ...units], suspension.map(back)];
  }

  // freeMotionsApart's work, on the coordinates given (`q` of them): the rows, the tyres' slip,
  // the springs and the frame kept still, in those coordinates.
  private freeMotionsOf(rows: number[][], sideways: number[][], travel: number[][], lift: number[][], rise: number[][], springs: number[][], frameStill: number[][], q: number): [number[][], number[][]] {
    const motions = orthonormalize(nullSpace(rows, q));
    if (sideways.length === 0 || motions.length === 0) return [motions, []];
    // Parked and rolling, the car is on its springs (see Joint.springHeld): rolling is chosen as
    // the motion that scrubs least, and with its suspension free it mixed in the car sinking and
    // tipping to scrub a hair less (the 8880 Super Car, pushed along on sliding shock absorbers,
    // didn't come back). Moving on its suspension is left to the suspension's own motions, below.
    const onSprings = springs.length ? orthonormalize(nullSpace([...rows, ...springs], q)) : motions;
    const parked = orthonormalize(nullSpace([...rows, ...springs, ...frameStill], q));
    const keptParked = parked.length ? orthonormalize(leastScrub(parked, { sideways: lift, travel: [...travel, ...sideways], lift: [], rise: [] }, LIFT)) : [];
    // The rest of the motions, with the parked ones taken out, judged as rolling. Taking them
    // out first keeps the two sets apart: joined afterwards, a rolling motion that's nearly a
    // parked one would leave a sliver that, scaled up, is a bogus motion (lifting the car).
    const rest = orthonormalize(
      onSprings.map((m) => without(m, keptParked)),
      1e-6,
    );
    // Lift counts as scrub, LIFT of it as much as the usual allowance (however much more scrub
    // the model allows: that's for scrubbing sideways, not rising or sinking).
    const usual = Math.min(this.scrub, USUAL_SCRUB);
    const liftAsScrub = lift.map((row) => row.map((x) => (x * usual) / LIFT));
    const needs = { least: 0 };
    const scrubbing: Slip = { sideways: [...sideways, ...liftAsScrub], travel, lift: [], rise: [] };
    const rolling = rest.length ? leastScrub(rest, scrubbing, this.scrub, usual, needs) : [];
    // And of the rest of them (with those taken out, as the parked ones were), the car moving
    // on its suspension: those whose tyres rise or sink no more for how far they roll than
    // rolling allows (so not at all, if they don't roll), and of those, the ones whose tyres
    // scrub sideways no further than the frame rises or sinks over them (or than rolling
    // allows, for how far they roll).
    // (With springs held, `rest` left out the suspension; the rest of every motion, here.)
    const unparked = springs.length ? orthonormalize(motions.map((m) => without(m, keptParked)), 1e-6) : rest;
    const left = orthonormalize(unparked.map((m) => without(m, rolling)), 1e-6);
    const grounded = left.length ? leastScrub(left, { sideways: lift, travel, lift: [], rise: [] }, LIFT * Math.max(1, this.scrub / usual)) : [];
    const riseAsTravel = rise.map((row) => row.map((x) => x / usual));
    const suspension = grounded.length ? leastScrub(grounded, { ...scrubbing, travel: [...travel, ...riseAsTravel] }, this.scrub, usual, { least: 0 }, needs.least * needs.least) : [];
    this.leastScrub = needs.least;
    if (needs.least > this.scrub) this.scrubNeeded = needs.least;
    // Joined again, the rolling motions are judged once more with the parked ones in. A parked
    // motion may scrub (a car steered where it stands), so a rolling one, judged with the parked
    // ones taken out, could leave its scrub in them, and the two joined could scrub far more than
    // rolling allows: the 42081 Volvo wheel loader's chassis may slide sideways under its rear
    // body (the frame), and its lead screw ties that slide to the chassis going fore and aft, so
    // rolling a wheel slid the whole loader sideways, its tyres scrubbing 290 times as far as they
    // rolled. So of the joined motions, every one in which no tyre travels is kept, as before; of
    // those in which tyres travel, only those whose scrub, with the best of the others mixed in,
    // is within what rolling allows. Behind a switch, for now (see Options.scrubJoined).
    const joined = orthonormalize([...keptParked, ...rolling]);
    if (!this.options.scrubJoined) return [joined, suspension];
    return [leastScrub(joined, scrubbing, this.scrub, usual, { least: 0 }, needs.least * needs.least, true), suspension];
  }

  // How fast each body turns (3 numbers per body) under a motion in the tree basis's coordinates
  // (see freeMotionsInBasis), read off the basis's rows without making the whole motion vector.
  private turningIn(z: number[], basis: number[][]): Float64Array {
    // Each body's three turning rows, over z's places that are not 0 where they're fewer (see
    // rowsTimes).
    const rows = this.turningRows ??= Int32Array.from({ length: 3 * this.bodyCount }, (_, r) => 6 * Math.floor(r / 3) + (r % 3));
    return Float64Array.from(rowsTimes(basis, rows, z));
  }

  // How fast a joint turns, given how fast each body turns (see turningIn) and the joints' axes
  // where they are now (see jointAxes).
  private rateIn(w: Float64Array, axes: Vector3[], joint: number): number {
    const j = this.mech.joints[joint];
    const d = axes[joint];
    const [a, b] = [3 * j.bodyA, 3 * j.bodyB];
    return (w[b] - w[a]) * d.x + (w[b + 1] - w[a + 1]) * d.y + (w[b + 2] - w[a + 2]) * d.z;
  }

  // Each joint's axis where it is now.
  private jointAxes(): Vector3[] {
    return this.mech.joints.map((j) => axisOf(j.from, j.to).transformDirection(this.poses[j.bodyA]));
  }

  // How fast a point on a body moves under a motion vector.
  pointVelocity(motion: number[], body: number, point: Vector3): Vector3 {
    const w = new Vector3(motion[6 * body], motion[6 * body + 1], motion[6 * body + 2]);
    const v = new Vector3(motion[6 * body + 3], motion[6 * body + 4], motion[6 * body + 5]);
    return v.add(w.cross(point));
  }

  // How fast a joint turns under a motion vector: how much faster bodyB turns than bodyA
  // about the joint's axis.
  jointRate(motion: number[], joint: number): number {
    const j = this.mech.joints[joint];
    const d = axisOf(j.from, j.to).transformDirection(this.poses[j.bodyA]);
    const wA = new Vector3(motion[6 * j.bodyA], motion[6 * j.bodyA + 1], motion[6 * j.bodyA + 2]);
    const wB = new Vector3(motion[6 * j.bodyB], motion[6 * j.bodyB + 1], motion[6 * j.bodyB + 2]);
    return wB.sub(wA).dot(d);
  }

  // Turns a joint by `angle` radians (bodyB relative to bodyA), letting the rest of the
  // mechanism follow, in steps of at most `maxStep` (MAX_TURN_STEP unless given). Returns how
  // far it actually turned, which is less if the joint can't turn (jammed) or comes to a dead
  // point.
  //
  // If `allowed` is given, it's asked after each step whether the mechanism may be where it
  // now is (no parts passing through each other); if not, that step is undone and the turn
  // stops there.
  //
  // A dead point: a linkage at the end of its reach (a steering arm whose tie rod has come
  // into line with it, so the rack can't push it further round). A step past one can't be
  // followed: the loops can't be closed again (with gear teeth kept in mesh, a joint is left
  // apart), or closing them would wrench the joints far from where the step's motion had them
  // going, or flip the linkage over. Close to one, the linkage's joints turn faster and faster
  // for each turn of the joint being turned. So a step for which the fastest joint would turn
  // more than DEAD_POINT_RATE times as fast as in the step before (if it turned at most
  // DEAD_POINT_SAMPLE then) isn't taken; and a step after which a joint is left more than
  // DEAD_POINT_GAP apart, or any joint has turned more than DEAD_POINT of the step's largest
  // joint turn away from where its motion had it going, is undone (a step bigger than the usual
  // MAX_TURN_STEP, a motor's, is taken again in usual steps first), and the turn stops there,
  // short of the dead point, and won't turn further that way from there. (Creeping on in ever
  // smaller steps, it would slip across; and stopped right at the dead point, it couldn't turn
  // back.)
  // A drag's working set (Options.workingSet, decision 266 of 2026-11-20): the tree's columns a
  // full step of the drag turned (W) and those some row ties directly to them (the ring), for the
  // steps after it to be worked on alone, every other column fixed. Made from a full turn; kept
  // for the drag (the same Drag) and joint that made it.
  // A set is made from the drag's first two full turns (`confirmed` after the second): a part a
  // drag starts to move only to second order (a linkage at a dead point, whose rate is 0 where
  // the drag starts and grows with its turn) is still under the bound in the first, but not in the
  // second (the 42083 Bugatti Chiron's steering moves its body 159 so).
  ws: { drag: Drag; joint: number; columns: Set<number>; ring: Set<number>; turned: number; confirmed: boolean; w: Set<number> } | null = null;
  private wsActive = false;
  // The shadow mode (KINEBRICK_WORKING_SET_SHADOW=1): the same drag worked in full, beside the drag on
  // the set, from its own last state; and a number for each drag.
  private wsShadow: { drag: Drag; state: ReturnType<Kinematics['stepState']>; turned: number; id: number } | null = null;
  private static wsDrags = 0;
  // What the working set did, for the compare mode and the reports: turns worked on the set, and
  // those worked again in full, by why; and, in the compare mode, each turn both ways.
  // Kept for every Kinematics alike (a function check makes it afresh as the mechanism is read
  // again), and reset by whoever reads it (see check-functions.ts).
  get wsStats() {
    return Kinematics.wsShared;
  }
  static wsShared = {
    small: 0,
    made: 0,
    fallback: { short: 0, ring: 0, played: 0, holds: 0, audit: 0 } as Record<string, number>,
    excluded: 0,
    compared: [] as { joint: number; angle: number; small: number; full: number; pose: number; angle2: number; small_ok: boolean }[],
    // The shadow mode: after each turn of a drag, how far the drag on the set and the same drag in
    // full have come apart (see turnJoint).
    shadow: [] as { drag: number; at: number; ldu: number; rad: number; small: number; full: number; body?: number; radBody?: number }[],
  };

  // Turns a joint by `angle` (see turnJointPlain), on the drag's working set where it has one and
  // may use it, else in full. A turn on the set that doesn't go its whole way, plays, chooses the
  // holds afresh, or turns a column of the ring, is undone and worked again in full: the set must
  // never end, or bend, a motion the whole mechanism would make. A turn worked in full makes the
  // set afresh from what it turned.
  // A turn whose sums meet a value that is not finite (see NotFinite) is refused: undone, with
  // nothing turned (see refuseNotFinite).
  turnJoint(joint: number, angle: number, allowed?: () => boolean, maxStep = MAX_TURN_STEP): number {
    // The classification is made in the first step's own search for a motion (see jointMotionNearOrigin),
    // from the free motions it works out or reuses; here only if that search didn't run.
    const classify = this.drag.turning?.joint === joint && !this.drag.free && (FREE_COUNT() || this.options.freeParts === 'all' || (this.options.freeParts === 'wheels' && this.wheelTurned(joint)));
    if (classify) {
      this.classifyPending = joint;
      if (FREE_COUNT()) this.countFree(null, true);
    }
    try {
      return this.turnJointClassified(joint, angle, allowed, maxStep);
    } finally {
      if (classify && this.classifyPending === joint) {
        this.classifyPending = -1;
        this.classifyDrag((m) => this.jointRate(m, joint), this.wheelTurned(joint) ? 'wheel' : 'turn');
      }
    }
  }

  // The joint whose drag's first step is to classify the drag's joints (see classifyDrag), or -1.
  private classifyPending = -1;

  private turnJointClassified(joint: number, angle: number, allowed?: () => boolean, maxStep = MAX_TURN_STEP): number {
    try {
      return this.turnJointGivingWay(joint, angle, allowed, maxStep);
    } finally {
      if (FREE_COUNT()) this.countFree();
    }
  }

  // The free-parts rule's holds give way where they block (decision 319): a free part stays where it is
  // until the motion comes to need it, and then moves, as friction lets it. So where a turn ends short
  // with the rule's holds on, and not because `allowed` said no (a collision, an end of travel), the
  // held joints that the motion without the rule's holds turns are let go for the rest of the drag, and
  // the rest of the turn is taken again; and so on while any is let go. The choice made at the drag's
  // first step is only ever loosened, never made afresh, so it can't jump back. (The 9397 Logging
  // Truck, rolled by a rear wheel: its engine's pistons stand at their dead centres as built, still to
  // first order, so the choice held them; after 0.25 rad the wheels drove them, and held, they stopped
  // the truck at a dead point.)
  private turnJointGivingWay(joint: number, angle: number, allowed?: () => boolean, maxStep = MAX_TURN_STEP): number {
    let refused = false;
    const asked = allowed ? () => (allowed() ? true : ((refused = true), false)) : undefined;
    let turned = this.turnJointGuarded(joint, angle, asked, maxStep);
    while (!refused && this.drag.heldJoints.size && Math.abs(turned - angle) > 1e-12 && Math.sign(angle) * (angle - turned) > 0) {
      const state = this.stepState();
      const held = [...this.drag.heldJoints];
      this.drag.heldJoints = new Set();
      this.lastSearch = null;
      const m = this.jointMotion(joint);
      this.restoreStepState(state);
      this.lastSearch = null;
      if (!m) break;
      const c = this.anyJointRate(m, joint);
      let blocking = held.filter((j) => Math.abs(this.anyJointRate(m, j)) > 1e-6 * Math.abs(c));
      if (!blocking.length) {
        // None turns to first order: a part at a dead centre (a piston at the top of its stroke), which
        // the step needs to move only to second order, as the loops close. A step without the rule's
        // holds, from here, says which: those held joints that it moved (the turn between a joint's two
        // bodies, or the slide).
        const rel = () => this.mech.joints.map((j) => this.poses[j.bodyA].clone().invert().multiply(this.poses[j.bodyB]));
        const was = rel();
        const step = Math.sign(angle - turned) * Math.min(Math.abs(angle - turned), maxStep);
        this.drag.heldJoints = new Set();
        this.deadPoint = null;
        const went = this.turnJointGuarded(joint, step, asked, maxStep);
        const now = rel();
        this.restoreStepState(state);
        this.lastSearch = null;
        if (Math.abs(went) < 1e-12) break;
        const q = new Quaternion();
        const moved = (j: number) => {
          const d = was[j].clone().invert().multiply(now[j]);
          return this.mech.joints[j].kind === 'slide' ? new Vector3().setFromMatrixPosition(d).length() : 2 * Math.acos(Math.min(1, Math.abs(q.setFromRotationMatrix(d).w)));
        };
        blocking = held.filter((j) => moved(j) > 1e-6 * Math.abs(went));
        if (!blocking.length) break;
      }
      this.drag.heldJoints = new Set(held.filter((j) => !blocking.includes(j)));
      this.deadPoint = null;
      this.aheadKept = null;
      if (setting('KINEBRICK_FREE_DEBUG')) console.error(`free parts: ${blocking.length} held joints give way at ${turned.toFixed(4)} of ${angle}: ${blocking.join(' ')}`);
      const more = this.turnJointGuarded(joint, angle - turned, asked, maxStep);
      turned += more;
      if (Math.abs(more) < 1e-12) break;
    }
    return turned;
  }

  private turnJointGuarded(joint: number, angle: number, allowed?: () => boolean, maxStep = MAX_TURN_STEP): number {
    const before = this.stepState();
    try {
      return this.turnJointWhole(joint, angle, allowed, maxStep);
    } catch (err) {
      if (!(err instanceof NotFinite)) throw err;
      this.restoreStepState(before);
      this.aheadKept = null;
      this.refuseNotFinite(err);
      return 0;
    }
  }

  private turnJointWhole(joint: number, angle: number, allowed?: () => boolean, maxStep = MAX_TURN_STEP): number {
    if (!this.options.workingSet) return this.turnJointPlain(joint, angle, allowed, maxStep);
    if (setting('KINEBRICK_WORKING_SET_SHADOW') !== '1') return this.turnJointSet(joint, angle, allowed, maxStep);
    // The shadow: the same turn in full from the full drag's own state (or from here, at a drag's
    // start), then the turn on the set from here, kept; and how far apart they now are. The collision
    // test is asked in both: a stop it makes in one is a stop the other may not make.
    const mine = this.stepState();
    const fresh = !this.wsShadow || this.wsShadow.drag !== this.drag;
    if (!fresh) this.restoreStepState(this.wsShadow!.state);
    const full = this.turnJointPlain(joint, angle, allowed, maxStep);
    const shadow = { drag: this.drag, state: this.stepState(), turned: (fresh ? 0 : this.wsShadow!.turned) + full, id: fresh ? ++Kinematics.wsDrags : this.wsShadow!.id };
    this.restoreStepState(mine);
    const turned = this.turnJointSet(joint, angle, allowed, maxStep);
    this.wsShadow = shadow;
    const [ldu, rad, body, radBody] = this.apartFrom(shadow.state.state);
    this.wsStats.shadow.push({ drag: shadow.id, at: shadow.turned, ldu, rad, small: turned, full, body, radBody });
    return turned;
  }

  // How far each body is from where another state has it: the most any joint's point on it is apart
  // (LDU), and the most it is turned against it (rad).
  private apartFrom(other: KinematicsState): [number, number, number, number] {
    const here = this.poses.map((m) => m.clone());
    const now = this.snapshot();
    this.restore(other);
    const there = this.poses.map((m) => m.clone());
    this.restore(now);
    let ldu = 0;
    let rad = 0;
    let body = -1;
    let radBody = -1;
    const points: Vector3[][] = this.mech.bodies.map(() => []);
    for (const j of this.mech.joints) for (const b of [j.bodyA, j.bodyB]) points[b].push(j.from, j.to);
    here.forEach((m, b) => {
      for (const p of points[b]) { const d = p.clone().applyMatrix4(m).distanceTo(p.clone().applyMatrix4(there[b])); if (d > ldu) [ldu, body] = [d, b]; }
      const q = new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(there[b]).invert().multiply(new Matrix4().extractRotation(m)));
      const r = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
      if (r > rad) [rad, radBody] = [r, b];
    });
    return [ldu, rad, body, radBody];
  }

  private turnJointSet(joint: number, angle: number, allowed?: () => boolean, maxStep = MAX_TURN_STEP): number {
    const ws = this.ws;
    const ours = ws !== null && ws.drag === this.drag && ws.joint === joint;
    const usable = ours && ws!.confirmed && !this.wsExcluded(ws!);
    if (ours && ws!.confirmed && !usable) this.wsStats.excluded++;
    const audit = usable && this.options.workingSetAudit > 0 && ws!.turned + Math.abs(angle) > this.options.workingSetAudit;
    if (usable && audit) this.wsStats.fallback.audit++;
    let compared: { turned: number; state: KinematicsState } | null = null;
    if (usable && !audit) {
      const saved = this.stepState();
      // The motion the last turn kept for its next step (see turnJointPlain) is taken as the plain
      // path takes it, whether that turn was on the set or in full, and its own checks decide (decision
      // 278 of 2026-11-21). Worked out afresh instead, it could differ from the kept one at the same
      // state, and where a drag's motion turns on a near choice (the 42020 Twin-rotor Helicopter's
      // wheels, rolling and scrubbing, up to 3.4 apart in the motion vector), the drag went
      // elsewhere and came back out of place: 0.97 LDU against 0.26 in full.
      this.wsActive = true;
      this.basisSmall = null;
      let turned = 0;
      try {
        turned = this.turnJointPlain(joint, angle, allowed, maxStep);
      } finally {
        this.wsActive = false;
        this.basisSmall = null;
      }
      const why = Math.abs(turned - angle) > 1e-12 ? 'short' : this.onPlay > saved.onPlay ? 'played' : !this.sameHolds(saved.drag) ? 'holds' : this.ringTurned(ws!, saved.state, turned) ? 'ring' : null;
      if (!why && !this.options.workingSetCompare) {
        ws!.turned += Math.abs(angle);
        this.wsStats.small++;
        return turned;
      }
      if (why) this.wsStats.fallback[why]++;
      else compared = { turned, state: this.snapshot() };
      this.restoreStepState(saved);
    }
    const before = this.snapshot();
    const turned = this.turnJointPlain(joint, angle, allowed, maxStep);
    if (compared) {
      // Compare mode: the turn on the set against the turn in full, from the same state; the full
      // one is kept, and the set too, as the set would have gone on.
      const now = this.snapshot();
      let pose = 0;
      let where = '';
      for (const [root, m] of now.roots) m.elements.forEach((x, i) => { const d = Math.abs(x - compared!.state.roots.get(root)!.elements[i]); if (d > pose) [pose, where] = [d, `root ${root} element ${i}: full moved it ${(x - before.roots.get(root)!.elements[i]).toExponential(2)}, the set ${(compared!.state.roots.get(root)!.elements[i] - before.roots.get(root)!.elements[i]).toExponential(2)}, in the set ${this.ws?.columns.has(this.rootColumn.get(root)!) ?? false}`]; });
      let angle2 = 0;
      let which = -1;
      now.jointAngles.forEach((a, j) => { const d = Math.abs(a - compared!.state.jointAngles[j]); if (d > angle2) [angle2, which] = [d, j]; });
      this.wsStats.compared.push({ joint, angle, small: compared.turned, full: turned, pose, angle2, small_ok: true, where, which } as never);
      ws!.turned += Math.abs(angle);
      this.wsStats.small++;
      return turned;
    }
    this.ws = this.makeWorkingSet(joint, before, turned, ours && !ws!.confirmed ? ws!.w : null);
    return turned;
  }

  // A step whose sums met a value that is not finite (NaN or ±∞, see NotFinite) is refused as a step
  // that can't be taken is: undone, the drag going no further (decision 280 of 2026-11-21). No sum
  // makes sense of such a value, and on a NaN the null space never ended. Told in one line, once a drag.
  private notFiniteDrag: Drag | null = null;
  refuseNotFinite(err: NotFinite) {
    if (this.notFiniteDrag === this.drag) return;
    this.notFiniteDrag = this.drag;
    console.warn(`kinebrick: a step was refused: ${err.message}`);
  }

  // The state a turn changes, to undo a turn on the working set.
  private stepState() {
    const d = this.drag;
    return {
      state: this.snapshot(),
      deadPoint: this.deadPoint,
      lastStep: this.lastStep,
      onPlay: this.onPlay,
      aheadKept: this.aheadKept,
      played: this.played,
      gripped: this.gripped,
      stepByTiers: this.stepByTiers,
      endReached: this.endReached,
      scrub: [this.scrubNeeded, this.leastScrub, this.slipRows] as const,
      drag: { held: new Set(d.held), heldToFrame: new Set(d.heldToFrame), grip: d.grip, suspension: d.suspension, steering: d.steering, outOfReach: d.outOfReach, springs: d.springs, plainOnly: d.plainOnly, drivenLast: d.drivenLast, turning: d.turning },
    };
  }

  private restoreStepState(s: ReturnType<Kinematics['stepState']>) {
    this.restore(s.state);
    [this.deadPoint, this.lastStep, this.onPlay, this.aheadKept, this.played, this.gripped, this.stepByTiers, this.endReached] = [s.deadPoint, s.lastStep, s.onPlay, s.aheadKept, s.played, s.gripped, s.stepByTiers, s.endReached];
    [this.scrubNeeded, this.leastScrub, this.slipRows] = s.scrub;
    Object.assign(this.drag, { ...s.drag, held: new Set(s.drag.held), heldToFrame: new Set(s.drag.heldToFrame) });
  }

  private sameHolds(d: { held: Set<number>; heldToFrame: Set<number> }): boolean {
    const same = (a: Set<number>, b: Set<number>) => a.size === b.size && [...a].every((x) => b.has(x));
    return same(d.held, this.drag.held) && same(d.heldToFrame, this.drag.heldToFrame);
  }

  // Each body's columns from its root down: a root's six and the column of every joint on the way.
  private chainColumns(body: number): number[] {
    const out: number[] = [];
    for (let b = body; ; ) {
      const j = this.parentJoint[b];
      if (j < 0) {
        const first = this.rootColumn.get(b)!;
        out.push(first, first + 1, first + 2, first + 3, first + 4, first + 5);
        return out;
      }
      out.push(this.jointColumn[j]);
      const joint = this.mech.joints[j];
      b = joint.bodyA === b ? joint.bodyB : joint.bodyA;
    }
  }

  // The tree's columns a turn changed by more than EPSILON of its own turn: a joint's angle, a
  // root's pose (all six, if it moved at all). EPSILON is the solver's "counts as zero": the full
  // calculation's noise is about 1e-15 of a step, and the smallest real rate in the stored records
  // about 1e-6 (the 9395's winch drives p431 at 9.5e-7 of the control).
  private turnedColumns(before: KinematicsState, turned: number): Set<number> {
    const bound = EPSILON * Math.abs(turned);
    const out = new Set<number>();
    this.mech.joints.forEach((_, j) => {
      if (this.jointColumn[j] >= 0 && Math.abs(this.jointAngles[j] - before.jointAngles[j]) > bound) out.add(this.jointColumn[j]);
    });
    for (const [root, pose] of this.rootPoses) {
      const was = before.roots.get(root)!;
      if (pose.elements.some((x, i) => Math.abs(x - was.elements[i]) > bound)) {
        const first = this.rootColumn.get(root)!;
        for (let k = 0; k < 6; k++) out.add(first + k);
      }
    }
    return out;
  }

  // The working set a full turn makes: W, the columns it turned, and the ring, every column some
  // row ties to one of them (a row ties the columns of its bodies' chains: one of W's columns is on
  // a chain, so it moves that body). Rows: the equations without the tree's joints, the tyres'
  // rows and the springs. Null if the turn went nowhere.
  private makeWorkingSet(joint: number, before: KinematicsState, turned: number, first: Set<number> | null): Kinematics['ws'] {
    if (Math.abs(turned) < 1e-12) return null;
    const w = this.turnedColumns(before, turned);
    if (first) for (const c of first) w.add(c);
    const slip: Slip<BodyRow> = { sideways: [], travel: [], lift: [], rise: [] };
    const rows = [...this.buildEquations(null, slip, true), ...slip.sideways, ...slip.travel, ...slip.lift, ...slip.rise, ...this.springRows()];
    const ring = new Set<number>();
    const chains = new Map<number, number[]>();
    const chainOf = (b: number) => {
      let c = chains.get(b);
      if (!c) chains.set(b, (c = this.chainColumns(b)));
      return c;
    };
    // KINEBRICK_WORKING_SET_RINGS rings (1 unless set): each ring the columns tied to the last.
    const tiedOf = rows.map((row) => [...new Set(row.entries().flatMap(([i, x]) => (x !== 0 ? [Math.floor(i / 6)] : [])))].flatMap(chainOf));
    const inner = new Set(w);
    const rings = Number(setting('KINEBRICK_WORKING_SET_RINGS') ?? 1);
    for (let r = 0; r < rings; r++) {
      const next: number[] = [];
      for (const tied of tiedOf) if (tied.some((c) => inner.has(c))) for (const c of tied) if (!inner.has(c) && !ring.has(c)) next.push(c);
      for (const c of next) ring.add(c);
      if (r + 1 < rings) for (const c of next) inner.add(c);
    }
    this.wsStats.made++;
    return { drag: this.drag, joint, columns: new Set([...w, ...ring]), ring, turned: 0, confirmed: first !== null, w };
  }

  // Whether a turn on the set turned a column of its ring (see turnedColumns): its neighbours may
  // have had to move too, so it is worked again in full.
  private ringTurned(ws: NonNullable<Kinematics['ws']>, before: KinematicsState, turned: number): boolean {
    for (const c of this.turnedColumns(before, turned)) if (ws.ring.has(c)) return true;
    return false;
  }

  // Not on the working set (decision 266, iii): tyres near what they may scrub (a car that might
  // roll rather than scrub), or a car on the ground whose frame isn't in the set.
  private wsExcluded(ws: NonNullable<Kinematics['ws']>): boolean {
    if (this.scrubNeeded !== null || this.leastScrub > 0.9 * this.scrub) return true;
    if (this.contactTreads.length > 0) {
      for (const f of this.frames) {
        const first = this.rootColumn.get(f);
        if (first !== undefined && !ws.columns.has(first)) return true;
      }
    }
    return false;
  }

  private turnJointPlain(joint: number, angle: number, allowed?: () => boolean, maxStep = MAX_TURN_STEP): number {
    // The motion the last turn found for its next step, if this turn takes that step: the same
    // joint the same way, with everything where that turn left it, and the same holds, frozen
    // bodies and scrub. Anything else (a hold changed, a pin freed, a shift, the model read again)
    // and it's worked out afresh. A motion is kept in model coordinates (see nearOrigin).
    const k = this.aheadKept;
    this.aheadKept = null;
    const same = (a: KinematicsState, b: KinematicsState) =>
      a.jointAngles.length === b.jointAngles.length && a.jointAngles.every((x, i) => x === b.jointAngles[i]) && a.treadTravel.every((x, i) => x === b.treadTravel[i]) && a.treadScrub.every((x, i) => x === b.treadScrub[i]) && a.roots.size === b.roots.size && [...a.roots].every(([root, pose]) => b.roots.get(root)?.equals(pose) === true);
    const kept = k && k.joint === joint && k.way === Math.sign(angle) && k.drag === this.drag && k.frozen === [...this.frozen].join() && k.fixedBody === this.fixedBody && k.scrub === this.scrub && same(k.state, this.snapshot()) ? k : null;
    const found: { ahead: { motion: number[]; played: boolean; stepByTiers: boolean; gripped: boolean; endHeld: number[] } | null } = { ahead: null };
    this.turnWay = Math.sign(angle);
    this.turnHeld = new Set();
    this.endReached = false;
    // A kept motion was chosen with the slides it held at their ends: they hold for its step too.
    this.endHeld = new Set(kept?.endHeld ?? []);
    let turned: number;
    try {
      turned = this.nearOrigin((toModel, fromModel) =>
        this.turnJointNearOrigin(joint, angle, allowed, maxStep, kept ? { ...kept, motion: fromModel(kept.motion) } : null, (ahead) => {
          found.ahead = { motion: toModel(ahead), played: this.played, stepByTiers: this.stepByTiers, gripped: this.gripped, endHeld: [...this.endHeld] };
        }),
      );
    } finally {
      this.turnWay = 0;
      this.endHeld = new Set();
      this.turnHeld = new Set();
    }
    if (found.ahead && this.options.keepAhead) this.aheadKept = { ...found.ahead, joint, way: Math.sign(angle), state: this.snapshot(), drag: this.drag, frozen: [...this.frozen].join(), fixedBody: this.fixedBody, scrub: this.scrub };
    return turned;
  }

  // `kept`: the motion the last turn found for this one's first step (see turnJoint); `keep` hears
  // the motion found for the step after this turn's last, if it ends with one.
  private turnJointNearOrigin(joint: number, angle: number, allowed: (() => boolean) | undefined, maxStep: number, kept: { motion: number[]; played: boolean; stepByTiers: boolean; gripped: boolean } | null = null, keep: (ahead: number[]) => void = () => {}): number {
    // Stopped at a dead point already, and nothing has moved since: no further that way.
    const dead = this.deadPoint;
    if (dead && dead.joint === joint && dead.way === Math.sign(angle) && this.jointAngles.every((a, k) => a === dead.angles[k])) return 0;
    const stop = (turned: number) => {
      this.deadPoint = { joint, way: Math.sign(angle), angles: this.jointAngles.slice() };
      return turned;
    };
    let turned = 0;
    // The bodies gears tie to the joint being turned (see WILD_RATE).
    const turnedBody = this.parentJoint[this.mech.joints[joint].bodyB] === joint ? this.mech.joints[joint].bodyB : this.mech.joints[joint].bodyA;
    const geared = this.gearedTo(turnedBody, true);
    const steps = Math.ceil(Math.abs(angle) / maxStep);
    const full = angle / steps;
    // The motion found where the last step ended (see below), for the next step to take: for the
    // first step, the one the last turn found, if kept (see turnJoint), with what finding it set.
    let ahead: number[] | null = kept?.motion ?? null;
    if (kept) [this.played, this.stepByTiers, this.gripped] = [kept.played, kept.stepByTiers, kept.gripped];
    // How big a step may be: halved for each step undone (see below), down to LEAST_TURN_STEP.
    let most = Math.abs(full);
    while (Math.abs(angle - turned) > 1e-12) {
      let motion = ahead;
      ahead = null;
      if (!motion) {
        this.gripped = false;
        motion = this.jointMotion(joint);
      }
      // Held at the end of its travel by its slides: the turn ends there. Not with holds chosen
      // afresh, which let the joint go on by moving something else (the 42108 Mobile Crane's
      // knob, stopped at once before decision 192, turned 2.5 radians so and didn't come back).
      if (!motion && this.blockedByEnds) {
        this.endReached = true;
        break;
      }
      // Holds chosen where a drag started may not suit it further on (as a steered car's
      // wheels turn, they turn by more and more different angles, and its differential has to
      // turn a little too): stuck, the drag chooses them afresh where it now is.
      if (!motion && this.drag.turning?.joint === joint) {
        this.holdWhatTheDragDoesntNeed(this.drag.turning.grabbed, () => this.jointMotion(joint) !== null, joint);
        motion = this.jointMotion(joint);
      }
      if (!motion) {
        if (TRACE) trace({ event: 'stopped', joint, turned, why: 'no motion' });
        break;
      }
      const played = this.played;
      const before = this.snapshot();
      const step = Math.abs(angle - turned) < most ? angle - turned : Math.sign(angle) * most;
      // How far each joint should turn in the step, and how far it has. Not a resting body's
      // (see Rest): what it rests on may change in the step (a pin coming round under a push
      // rod), and with it how fast it goes, as a dead point wouldn't.
      const resting = new Set((this.mech.rests ?? []).map((r) => r.body));
      const predicted = this.mech.joints.map((j, k) => (j.kind === 'revolute' && !resting.has(j.bodyA) && !resting.has(j.bodyB) ? this.jointRate(motion, k) * step : 0));
      // Nor, once the step is taken, a pin's (see findPins): it turns as it may, which needn't be
      // as predicted.
      const pins = this.pins ??= this.findPins();
      // Nor a train coupling's swivel (see magnetCouplings): it turns as the magnets' meeting
      // asks, which closing the loops settles, not the step's first order.
      const couplings = this.couplingBodies ??= new Set(this.mech.roles.flatMap((r, i) => (r === 'coupling' ? [this.mech.bodyOf[i]] : [])));
      const checked = (j: Joint) => j.kind === 'revolute' && !resting.has(j.bodyA) && !resting.has(j.bodyB) && !pins.has(j.bodyA) && !pins.has(j.bodyB) && !couplings.has(j.bodyA) && !couplings.has(j.bodyB);
      const largest = Math.max(...predicted.map(Math.abs));
      // How fast the fastest joint in a closed loop turns, for each turn of this one (at least
      // 1: this one). Dead points are linkages', and other joints' rates may change from step
      // to step for other reasons (a steered tractor's front wheels, as it rolls and scrubs).
      const loops = this.loopJoints ??= this.findLoopJoints();
      // Not a train coupling's swivel either (see magnetCouplings): its rate changes as the
      // cars' headings do, from step to step as a bogie crosses from a straight to a curve.
      const ratio = Math.max(1, ...[...loops].filter((k) => !couplings.has(this.mech.joints[k].bodyA) && !couplings.has(this.mech.joints[k].bodyB)).map((k) => Math.abs(predicted[k] / step)));
      // A joint that gears don't tie to this one, turning more than WILD_RATE times as fast: a dead
      // point (the mechanism is near singular as read).
      if (this.mech.joints.some((j, k) => k !== joint && checked(j) && !geared.has(j.bodyA) && !geared.has(j.bodyB) && Math.abs(predicted[k] / step) > WILD_RATE)) {
        if (TRACE) trace({ event: 'stopped', joint, turned, why: 'wild' });
        return stop(turned);
      }
      // Not where this step or the last is on play (with loopPlay): a play motion is the one that
      // opens the loops least, and its rates, which change as the loops open, tell nothing of a
      // dead point (the 42079 Heavy Duty Forklift's mast tilt, stopped after one step).
      const last = this.lastStep;
      const onPlay = this.options.loopPlay && (played || last?.played === true);
      if (last && !onPlay && last.joint === joint && last.way === Math.sign(angle) && ratio > DEAD_POINT_RATE * last.ratio && last.ratio * Math.abs(step) <= DEAD_POINT_SAMPLE && this.jointAngles.every((a, k) => a === last.angles[k])) {
        if (TRACE) trace({ event: 'stopped', joint, turned, why: 'rate' });
        return stop(turned);
      }
      const gap = this.advance(motion, step, joint);
      if (this.options.loopPlay && played) this.closeFirmRows(joint);
      const strayed = this.mech.joints.flatMap((j, k) => (checked(j) && Math.abs(this.jointAngles[k] - before.jointAngles[k] - predicted[k]) > DEAD_POINT * largest ? [k] : []));
      // With loopPlay, a step taken on play is judged by the budgets, and other joints may stray:
      // its motion keeps the loops only to first order by design, so closing them always turns
      // some joints off where it had them going, and a linkage that flips opens its loops far past
      // any budget. But the dragged joint itself must turn at least half the step the way it's
      // turned: closing the loops may undo its turn, and then nothing turned (the 8272
      // Snowmobile's ski, whose joint turned 1e-14 radians a step while the loops closed exactly
      // and six other joints moved). Turned further than asked, it went, as near a dead point (a
      // parallelogram with a link too long, coming back from as far as its play took it).
      // So too a step from where the last step on play left the loops open: closing them turns
      // joints off where it had them going too (the 956 Auto Chassis's steering, taken a step
      // past its dead point on play, couldn't come back).
      const ownTurnLost = checked(this.mech.joints[joint]) && (this.jointAngles[joint] - before.jointAngles[joint]) * Math.sign(step) < Math.abs(step) / 2;
      // The last step counts only where it ended where this one starts: a drag before this one,
      // ended on play, says nothing of the loops here.
      const fromPlay = this.options.loopPlay && (played || (last?.played === true && last.angles.every((x, k) => x === before.jointAngles[k])));
      // But not a joint left more than PLAY_STRAY off its way: a linkage flipped, not play.
      const flipped = strayed.some((k) => Math.abs(this.jointAngles[k] - before.jointAngles[k] - predicted[k]) > PLAY_STRAY);
      if ((this.options.loopPlay ? !this.withinPlay() : gap > (played ? PLAY : DEAD_POINT_GAP)) || (strayed.length && !(fromPlay && !ownTurnLost && !flipped))) {
        if (TRACE) trace({ event: 'refused', joint, turned, played, gap, strayed: strayed.length, ownTurnLost });
        this.restore(before);
        // Least motion: a step that kept the tyres from scrubbing (see chooseMotion) may have
        // held only to first order (the 42037 Formula Off-Roader's front tyre, neither rolling
        // nor scrubbing); the drag goes on without that preference.
        if (this.options.leastMotion && this.drag.turning?.joint === joint && this.gripped && this.drag.grip) {
          this.drag.grip = false;
          if (this.jointMotion(joint)) continue;
        }
        // Least motion: joints that strayed from where the step had them going may have moved
        // only to first order, in a linkage that fits only as it is (the 42062 Container Yard's
        // spreader, whose linkage the turning tier would turn back, to keep it level, though it
        // lies flat). Held for the rest of the drag, the drag may go on another way; if it
        // can't, they're let go, and it's a dead point after all.
        if (this.options.leastMotion && this.drag.turning?.joint === joint && !played) {
          // Each strayed joint in the tree is held by holding the body it carries.
          const carried = (k: number) => (this.parentJoint[this.mech.joints[k].bodyB] === k ? this.mech.joints[k].bodyB : this.mech.joints[k].bodyA);
          const bodies = strayed.filter((k) => k !== joint && this.inTree(k)).map(carried).filter((b) => !this.drag.held.has(b) && b !== this.drag.turning!.grabbed);
          for (const b of bodies) this.drag.held.add(b);
          // An exact motion only: else play took the turn on past the dead point (the 956 Auto
          // Chassis's steering, a step past where its linkage nearly locks, then couldn't come back).
          if (bodies.length && this.jointMotion(joint, false)) continue;
          for (const b of bodies) this.drag.held.delete(b);
        }
        // A bigger step than usual (a motor's) may just be too big to follow: taken in the
        // usual steps, it may go. Only those can tell a dead point.
        // A step on play refused with slides held at their ends, where without them the joint
        // has an exact motion: they hold it at the end of its travel, not at a dead point (the
        // 42124 Off-Road Buggy's front suspension, its shock absorber at an end).
        if (played && this.endHeld.size) {
          const held = this.endHeld;
          this.endHeld = new Set();
          const free = this.jointMotionNearOrigin(joint, false) !== null;
          this.endHeld = held;
          if (free) {
            this.endReached = true;
            break;
          }
        }
        if (Math.abs(step) <= MAX_TURN_STEP + 1e-12) return stop(turned);
        const done = this.turnJointPlain(joint, step, allowed, MAX_TURN_STEP);
        turned += done;
        if (Math.abs(done - step) > 1e-12) return turned;
        continue;
      }
      // A step that left a slide past an end of its travel that its motion didn't push past it
      // (closing the loops did, to second order: the 9397's plough, 3.5×10⁻⁴ LDU): undone, the
      // slide held for the rest of the turn, and the step taken again (decision 192). A slide held
      // and still past its end stops the turn, as any end of travel does.
      // Only slides the step's own motion didn't push out: a slide it pushes past an end has
      // reached the end of its travel, and the step is refused below as any end is (atLimit, by
      // `allowed`). Held instead, the step was taken again with it held, and the joint went on by
      // another motion: eight suspensions whose shock absorbers had stopped them at an end turned
      // on to a dead point or a jam, and the 42037 Formula Off-Roader's came back 62 LDU off.
      const pushedOut = (j: number) => {
        const { range } = this.mech.joints[j];
        const row = this.slideRow(this.mech.joints[j]);
        let rate = row.dotDense(motion);
        rate *= Math.sign(step);
        const offset = this.slideOffset(j);
        return (offset > range![1] && rate > EPSILON) || (offset < range![0] && rate < -EPSILON);
      };
      const past = this.slidesPastEnds().filter((j) => !this.endHeld.has(j) && !pushedOut(j));
      if (past.length) {
        if (TRACE) trace({ event: 'undone', joint, turned, why: 'slide past its end' });
        this.restore(before);
        for (const j of past) this.turnHeld.add(j);
        ahead = null;
        continue;
      }
      if (allowed && !allowed()) {
        if (TRACE) trace({ event: 'stopped', joint, turned, why: 'not allowed' });
        this.restore(before);
        break;
      }
      if (TRACE && played) trace({ event: 'played', joint });
      if (played) this.onPlay += Math.abs(step);
      turned += step;
      const lastStep = this.lastStep;
      this.lastStep = { joint, way: Math.sign(angle), angles: this.jointAngles.slice(), ratio, played };
      // A step after which the joint has no motion, or another joint would turn wild, has gone
      // into a jam that no step can leave, back the way it came or on: those stops are the same
      // both ways. It is undone, and the drag stops before it, as a hand on the real model never
      // ends in a pose it can't leave (the 8826 ATX Sport Cycle's steering went one step, then
      // couldn't be turned back; decision 84 of 2026-11-15). The motion found is the next step's.
      this.gripped = false;
      ahead = this.jointMotion(joint);
      // The step reached the end of the joint's travel (see blockedByEnds): it stands, and the
      // turn ends there.
      if (!ahead && this.blockedByEnds) {
        this.endReached = true;
        break;
      }
      if (!ahead && this.drag.turning?.joint === joint) {
        this.holdWhatTheDragDoesntNeed(this.drag.turning.grabbed, () => this.jointMotion(joint) !== null, joint);
        this.gripped = false;
        ahead = this.jointMotion(joint);
      }
      const wild = (m: number[]) => this.mech.joints.some((j, k) => k !== joint && checked(j) && !geared.has(j.bodyA) && !geared.has(j.bodyB) && Math.abs(this.jointRate(m, k)) > WILD_RATE);
      if (!ahead || wild(ahead)) {
        if (TRACE) trace({ event: 'undone', joint, turned, why: ahead ? 'wild ahead' : 'no motion ahead' });
        this.restore(before);
        this.lastStep = lastStep;
        turned -= step;
        ahead = null;
        // A smaller step may leave it a way to go on (the 42082's steering, whose first whole
        // step from where it was built jammed).
        if (most / 2 >= LEAST_TURN_STEP) {
          most /= 2;
          continue;
        }
        return stop(turned);
      }
    }
    if (ahead) keep(ahead);
    return turned;
  }

  // Whether the last turn of `joint` stopped at a dead point (see turnJoint), and nothing has
  // moved since.
  atDeadPoint(joint: number): boolean {
    const dead = this.deadPoint;
    return dead !== null && dead.joint === joint && this.jointAngles.every((a, k) => a === dead.angles[k]);
  }

  // Where everything is, so it can be put back (to undo a step).
  snapshot(): KinematicsState {
    const roots = new Map<number, Matrix4>();
    for (const [root, pose] of this.rootPoses) roots.set(root, pose.clone());
    return { roots, jointAngles: this.jointAngles.slice(), treadTravel: this.treadTravel.slice(), treadScrub: this.treadScrub.slice() };
  }

  restore(state: KinematicsState) {
    for (const [root, pose] of state.roots) this.rootPoses.set(root, pose.clone());
    this.jointAngles = state.jointAngles.slice();
    this.treadTravel = state.treadTravel.slice();
    this.treadScrub = state.treadScrub.slice();
    this.updatePoses();
  }

  // Whether a push of `body` goes by least motion (see Options.leastPush): its holds were
  // chosen as a drag that turns the joint it hangs on (see holdWhatTheDragDoesntNeed).
  pushesByTiers(body: number): boolean {
    return this.options.leastPush && this.options.leastMotion && this.drag.turning?.grabbed === body && this.parentLink(body)?.joint === this.drag.turning.joint;
  }

  // One step of a push by least motion (see Options.leastPush, and pushStep in push.ts for the
  // other way): moves the mechanism so that the point `grab` of `body` (given on the body as
  // built) goes `step` LDU the way `dir` points, by the motion the tiers choose (see leastTiers),
  // with how fast the point goes sideways of `dir` a tier of its own before them, so it goes the
  // way it's pushed where it can. Then `dir` is turned to the way the point went, so steps one
  // after another follow a curve. The step is taken as a drag's step is (see turnJoint): its loops
  // closed by the tiers, and undone if that leaves the joints more than DEAD_POINT_GAP apart or
  // turned well off where the step had them going. Returns 'stuck', with nothing moved, if the
  // point has nowhere to go, or only well off `dir`, or the step was undone; and 'blocked', with
  // the step undone, if `allowed` says no to where it left the model.
  pushStepByTiers(body: number, grab: Vector3, dir: Vector3, step: number, allowed: () => boolean = () => true): 'moved' | 'stuck' | 'blocked' {
    const joint = this.drag.turning!.joint;
    const g = grab.clone().applyMatrix4(this.poses[body]);
    let played = false;
    const motion = this.nearOrigin((toModel) => {
      const basis = this.treeBasis();
      const [usual, suspension] = this.freeMotionsApart();
      const { turning, rateOf, size } = this.measures(joint, basis);
      // How fast the point goes: three rows, one for each way.
      const here = grab.clone().applyMatrix4(this.poses[body]);
      const n = 6 * this.bodyCount;
      const speed = inBasis(
        [0, 1, 2].map((k) => {
          const row = new BodyRow(n);
          addPointVelocity(row, body, here, k, 1);
          return row;
        }),
        basis,
      );
      const velocity = (z: number[]) => new Vector3(dot(speed[0], z), dot(speed[1], z), dot(speed[2], z));
      const along = (z: number[]) => velocity(z).dot(dir);
      const across = new Vector3(1, 0, 0).cross(dir).lengthSq() > 0.1 ? new Vector3(1, 0, 0).cross(dir).normalize() : new Vector3(0, 1, 0).cross(dir).normalize();
      const across2 = new Vector3().crossVectors(dir, across);
      const sideways: Tier = { cost: (z: number[]) => [velocity(z).dot(across), velocity(z).dot(across2)] };
      const tiers = [sideways, ...this.leastTiers(joint, turning, rateOf, size, basis)];
      const plain = this.chooseMotion(joint, usual, along, size, tiers);
      const any = suspension.length ? this.chooseMotion(joint, orthonormalize([...usual, ...suspension]), along, size, tiers) : plain;
      const length = (z: number[]) => Math.hypot(...size(z));
      let z = plain && (!any || length(plain) < SUSPENSION_GAIN * length(any)) ? plain : any;
      // chooseMotion keeps the frame still, and the tyres from scrubbing, if any motion that does
      // turns the joint, before the tiers choose: for a push, that may leave the point going well
      // off the way it's pushed (the 8049 Tractor's steering knob, a quarter of the way). Then
      // the tiers choose from every motion.
      const off = (m: number[] | null) => !m || velocity(m).length() < 1e-9 || velocity(m).normalize().dot(dir) < 0.5;
      if (off(z)) z = leastTurning(orthonormalize([...usual, ...suspension]), along, tiers) ?? z;
      // With loopPlay, a push takes play where nothing else goes, as a turn does (see jointMotion).
      if (!z && this.options.loopPlay) {
        z = this.playMotion(along, size);
        played = z !== null;
      }
      if (!z) {
        if (TRACE) trace({ event: 'push stuck', body, byTiers: true, why: 'no motion' });
        return null;
      }
      // Nowhere to go but well off the way it's pushed.
      const v = velocity(z);
      if (v.length() < 1e-9 || v.clone().normalize().dot(dir) < 0.5) {
        if (TRACE) trace({ event: 'push stuck', body, byTiers: true, why: 'off the way', along: v.length() > 1e-9 ? v.clone().normalize().dot(dir) : 0, motions: usual.length + suspension.length });
        return null;
      }
      return toModel(fromBasis(z, basis));
    });
    if (!motion) return 'stuck';
    // One problem: the step's loops are closed by the tiers too (see closeLoops).
    this.stepByTiers = this.options.oneProblem;
    this.played = false;
    const before = this.snapshot();
    const resting = new Set((this.mech.rests ?? []).map((r) => r.body));
    const pins = this.pins ??= this.findPins();
    const couplings = this.couplingBodies ??= new Set(this.mech.roles.flatMap((r, i) => (r === 'coupling' ? [this.mech.bodyOf[i]] : [])));
    const checked = (j: Joint) => j.kind === 'revolute' && !resting.has(j.bodyA) && !resting.has(j.bodyB) && !pins.has(j.bodyA) && !pins.has(j.bodyB) && !couplings.has(j.bodyA) && !couplings.has(j.bodyB);
    const predicted = this.mech.joints.map((j, k) => (j.kind === 'revolute' && !resting.has(j.bodyA) && !resting.has(j.bodyB) ? this.jointRate(motion, k) * step : 0));
    const largest = Math.max(...predicted.map(Math.abs));
    // A joint that gears don't tie to the part pushed, turning more than WILD_RATE drag steps for
    // each LDU of the push: the point pushed hardly moves in the motion chosen (the mechanism is
    // near singular as read), so it stops there, as a drag's step does (see turnJoint). Taken in
    // pieces small enough for a drag's step instead, a push of the 42125 Ferrari 488 GTE's rear
    // wheels, with its suspension's friction pins free, cut one step into 256,000.
    const geared = this.gearedTo(body, true);
    if (this.options.pushWild && this.mech.joints.some((j, k) => k !== joint && checked(j) && !geared.has(j.bodyA) && !geared.has(j.bodyB) && Math.abs(predicted[k]) > WILD_RATE * MAX_TURN_STEP * Math.abs(step))) {
      if (TRACE) trace({ event: 'push stuck', body, byTiers: true, why: 'wild' });
      return 'stuck';
    }
    // With loopPlay, an exact push step from where the loops are closed is judged as without play:
    // closed again as tightly. Judged by the budgets, the 42032 Front Loader's levers, pushed,
    // let an axle slide 130 LDU out of place. Only a step on play, or one from where play left
    // the loops open, is judged by the budgets.
    const openBefore = this.options.loopPlay && !played && this.loopsOpen();
    const gap = this.advance(motion, step, joint);
    if (this.options.loopPlay && played) this.closeFirmRows(joint);
    const strayed = this.mech.joints.flatMap((j, k) => (checked(j) && Math.abs(this.jointAngles[k] - before.jointAngles[k] - predicted[k]) > DEAD_POINT * largest ? [k] : []));
    // A step on play must still move the point pushed at least half the step the way pushed, as a
    // turn's must turn its joint (see turnJoint): closing the loops can undo it, and then nothing
    // the hand pushed moved (the 42055 Bucket Wheel Excavator's battery switch, whose pushes on
    // play left it where it was and moved the model round it 254 LDU).
    const pushLost = played && grab.clone().applyMatrix4(this.poses[body]).sub(g).dot(dir) * Math.sign(step) < Math.abs(step) / 2;
    if ((this.options.loopPlay && (played || openBefore) ? !this.withinPlay() : gap > DEAD_POINT_GAP) || (strayed.length && !played) || pushLost) {
      if (TRACE) trace({ event: 'push refused', body, gap, strayed: strayed.length });
      this.restore(before);
      // A step that turned a joint more than a drag's step does (MAX_TURN_STEP: a short lever
      // pushed a stud) may just be too big to follow: taken in pieces that don't, each chosen
      // afresh, it may go. All undone if one can't be taken.
      if (largest <= MAX_TURN_STEP + 1e-12) return 'stuck';
      const pieces = Math.ceil(largest / MAX_TURN_STEP);
      const way = dir.clone();
      for (let i = 0; i < pieces; i++) {
        const how = this.pushStepByTiers(body, grab, dir, step / pieces, allowed);
        if (how !== 'moved') {
          this.restore(before);
          dir.copy(way);
          return how;
        }
      }
      return 'moved';
    }
    if (!allowed()) {
      this.restore(before);
      return 'blocked';
    }
    const now = grab.clone().applyMatrix4(this.poses[body]).sub(g);
    if (now.length() > 1e-9) dir.copy(now.normalize());
    if (played) this.onPlay += Math.abs(step);
    return 'moved';
  }

  // The motion vector that turns a joint at rate 1 (one radian per unit), with the rest of
  // the mechanism following. If the joint can turn with the frame standing still, it does
  // (turning a steering wheel turns the front axle without rolling the car); otherwise the
  // frame moves too. A tyre on the ground turning on its axle rolls the car, though, rather than,
  // where the suspension lets it, steering its wheel round it with the car standing still (the
  // 8448 Super Car's front wheels, whose steering arms swing on their suspension, there being no
  // springs yet): if it could do that, that way is taken out of the motions it chooses from. Only
  // if that leaves none does it turn with the car standing still, as it may at a moment a steered
  // car can't roll on; and not at all while a drag's holds are being chosen, so that nothing the
  // car needs to roll gets held. Among the motions that qualify, it picks the smallest, measured by how
  // fast the joints turn, and nothing else: measured by how fast the bodies move, it would nudge
  // a linkage nobody asked to move (a bulldozer's bucket arm) against the way the whole model
  // turns, to make that a little smaller, and step after step the linkage would drift; and a
  // body with a position of its own (a crane's hook) moves only as it must, rather than other
  // joints turning (the crane slewing) to spare it. The pulleys a string turns don't count
  // either, for the same reason. Every joint's turning counts, a ball joint's (each way) and a
  // part's turning as it slides on an axle too: otherwise a part free to spin without moving
  // anything else (a steering rack in its round guide, its tie rods on their ball joints) would
  // cost nothing, and could be mixed in any amount, wrecking the loops over a step (the 8448
  // Super Car's steering, once its tyres stood on the ground). Null if the joint can't turn.
  // With `play` false, and with loopPlay, only an exact motion: for a test of whether a control
  // can move at all, before friction pins are freed for it (see playMotion).
  // Null too where its sums meet a value that is not finite (see refuseNotFinite).
  jointMotion(joint: number, play = true): number[] | null {
    this.syncHeldColumns();
    try {
      return this.jointMotionWhole(joint, play);
    } catch (err) {
      if (!(err instanceof NotFinite)) throw err;
      this.refuseNotFinite(err);
      return null;
    }
  }

  private jointMotionWhole(joint: number, play: boolean): number[] | null {
    return this.nearOrigin((toModel) => {
      this.endHeld = new Set(this.turnHeld);
      this.blockedByEnds = false;
      let motion = this.jointMotionNearOrigin(joint, play);
      // In a turn: a slide standing at an end of its travel, which the motion would push past it,
      // is held there and the motion chosen again, until none is pushed out (an active set; decision
      // 192 of 2026-11-18). Without it, the step went past the end and was undone (see atLimit), and
      // the turn stopped, though another motion would have turned the joint and left the slide at its
      // end (the 9397's plough, whose play pushed a slide on). A slide pulled back from its end isn't
      // held: the holds are found afresh for each motion. If the joint can't turn with them, that is
      // the end of the turn's travel.
      // One exception (decision 208): a screw's own slide (a linear actuator's piston in its body)
      // that its screw pushes on, turning, is the end of the turn's travel. A real actuator's clutch
      // slips there and nothing else moves; the solver has no clutch, and with the piston held it
      // found another motion the real model can't make (the 42055's crank turned 3.1 radians with
      // the boom still, the 42108's boom rose on play in the actuator's mounts).
      let screwEnd = false;
      while (motion && this.turnWay !== 0) {
        const out = this.pushedPastEnds(motion, this.turnWay).filter((j) => !this.endHeld.has(j));
        if (out.length === 0) break;
        if (out.some((j) => this.screwTurns(j, motion!))) {
          screwEnd = true;
          motion = null;
          break;
        }
        for (const j of out) this.endHeld.add(j);
        motion = this.jointMotionNearOrigin(joint, play);
      }
      if (screwEnd) this.blockedByEnds = true;
      // No motion with the slides held, but one without them: they hold the joint at the end of
      // its travel (an end, not a jam).
      else if (!motion && this.turnWay !== 0 && this.endHeld.size) {
        const held = this.endHeld;
        this.endHeld = new Set();
        this.blockedByEnds = this.jointMotionNearOrigin(joint, play) !== null;
        this.endHeld = held;
      }
      return motion && toModel(motion);
    });
  }

  // The slides past an end of their travel (see atLimit).
  private slidesPastEnds(): number[] {
    const out: number[] = [];
    this.mech.joints.forEach((j, i) => {
      if (j.kind !== 'slide' || !j.range || !j.sliding) return;
      const offset = this.slideOffset(i);
      if (offset < j.range[0] - LIMIT_TOLERANCE || offset > j.range[1] + LIMIT_TOLERANCE) out.push(i);
    });
    return out;
  }

  // The slides with an end of their travel that `motion`, turning its joint `way`, would push them
  // past in the smallest step a turn takes (LEAST_TURN_STEP; see turnJoint): those it can't move at
  // all without passing the end. Further from the end than that, a step that passes it is undone
  // and taken smaller, as for any other stop, until the slide is that close. And those standing at
  // an end that the motion doesn't pull back from it.
  // Whether `joint` is a screw's own slide (its piston's, see Mechanism.screws) and `motion` turns
  // that screw's input against its piston (see jointMotion, decision 208).
  private screwTurns(joint: number, motion: number[]): boolean {
    const { bodyA, bodyB, kind } = this.mech.joints[joint];
    if (kind !== 'slide') return false;
    return (this.mech.screws ?? []).some((screw) => {
      if (screw.piston !== bodyA && screw.piston !== bodyB) return false;
      const axis = screw.axis.clone().transformDirection(this.poses[screw.input]);
      let rate = 0;
      for (let k = 0; k < 3; k++) rate += (motion[6 * screw.input + k] - motion[6 * screw.piston + k]) * axis.getComponent(k);
      return Math.abs(rate) > EPSILON;
    });
  }

  private pushedPastEnds(motion: number[], way: number): number[] {
    const out: number[] = [];
    this.mech.joints.forEach((j, i) => {
      if (j.kind !== 'slide' || !j.range || !j.sliding) return;
      const row = this.slideRow(j);
      let rate = row.dotDense(motion);
      rate *= way;
      const offset = this.slideOffset(i);
      // Pushed out: past the end within the smallest step, or standing at the end (within
      // LIMIT_TOLERANCE). Only by the motion's own rate: a slide it doesn't move isn't held, though it
      // stands at an end (an axle built against its stop, in a connector it may slide in); held, it
      // changed which of two near-equal motions was chosen (the 9397's plough came back 68 degrees
      // off). A slide that closing the loops pushes on to second order, with no first-order rate (the
      // 9397's plough, on play), is caught after the step and held for the turn (see turnHeld).
      const atTop = offset >= j.range[1] - LIMIT_TOLERANCE;
      const atBottom = offset <= j.range[0] + LIMIT_TOLERANCE;
      if (rate > EPSILON && (atTop || offset + LEAST_TURN_STEP * rate > j.range[1] + LIMIT_TOLERANCE)) out.push(i);
      else if (rate < -EPSILON && (atBottom || offset + LEAST_TURN_STEP * rate < j.range[0] - LIMIT_TOLERANCE)) out.push(i);
    });
    return out;
  }

  // What a motion does, in the tree basis's coordinates (see freeMotionsInBasis), for choosing
  // the motion of a drag turning `joint`: each body's turning, a joint's rate, how fast the drag
  // turns its part (`rate`), and every joint's turning (`size`).
  private measures(joint: number, basis: number[][]) {
    const turnings = new WeakMap<number[], Float64Array>();
    const turning = (z: number[]) => {
      let w = turnings.get(z);
      if (!w) turnings.set(z, (w = this.turningIn(z, basis)));
      return w;
    };
    const axes = this.jointAxes();
    const rateOf = (z: number[], i: number) => this.rateIn(turning(z), axes, i);
    // Least motion: a part grabbed turns against what its shaft turns in (see housing), not
    // just against what it turns on, which a pin free to spin in its holes would be: the turn
    // would be taken by spinning the pin back under it, leaving the part where it was (the 9394
    // Airliner's control stick, on a long pin).
    const grabbed = this.options.leastMotion && this.drag.turning?.joint === joint ? this.drag.turning.grabbed : -1;
    const housing = grabbed >= 0 && this.parentJoint[grabbed] === joint ? this.housing(grabbed) : -1;
    const rate = (z: number[]) => {
      if (housing < 0) return rateOf(z, joint);
      const w = turning(z);
      const d = axes[joint];
      const way = this.mech.joints[joint].bodyB === grabbed ? 1 : -1;
      const [g, h] = [3 * grabbed, 3 * housing];
      return way * ((w[g] - w[h]) * d.x + (w[g + 1] - w[h + 1]) * d.y + (w[g + 2] - w[h + 2]) * d.z);
    };
    const pulleys = new Set((this.mech.strings ?? []).flatMap((s) => s.pulleys.flatMap((w) => (w.joint >= 0 ? [w.joint] : []))));
    const size = (z: number[]) =>
      this.mech.joints.flatMap((j, i) => {
        if (pulleys.has(i)) return [];
        if (j.kind === 'revolute' || (j.kind === 'slide' && j.turns)) return [rateOf(z, i)];
        if (j.kind !== 'ball') return [];
        const w = turning(z);
        const [a, b] = [3 * j.bodyA, 3 * j.bodyB];
        return [w[b] - w[a], w[b + 1] - w[a + 1], w[b + 2] - w[a + 2]];
      });
    return { turning, rateOf, rate, size };
  }

  // The last search for a turn's motion (see jointMotionNearOrigin and Options.reuseSearch): what
  // it depended on, and what it found. A drag tests its holds from where it starts (jointMotion,
  // through stillPossible), then its first step searches again from the same place with the same
  // holds: on the 9397 Logging Truck's steering, two searches of about 200 ms each for one answer.
  private lastSearch: {
    on: SearchInputs;
    basis: number[][];
    usual: number[][];
    suspension: number[][];
    plain: { motion: number[] | null; parked: number[] | null };
    any: { motion: number[] | null; parked: number[] | null };
    scrub: [number | null, number, number[][]];
    gripped: boolean;
  } | null = null;
  // How often a search was reused, worked out, and (with reuseSearchCheck) found to differ in a bit
  // from the one reused.
  searchStats = { reused: 0, worked: 0, differ: 0 };

  // What a search for joint's motion depends on besides the mechanism: the state (where every body
  // is, and the tyres' travel and scrub; see snapshot), the drag's holds and what it has found, the slides held at their ends, the tyres on the ground, the
  // scrub allowed, the working set in use, and the options. Compared exactly (see sameInputs).
  private searchInputs(joint: number, play: boolean): SearchInputs {
    const poses = new Float64Array(16 * this.poses.length);
    this.poses.forEach((m, b) => poses.set(m.elements, 16 * b));
    const d = this.drag;
    const list = (s: Iterable<number>) => [...s].sort((a, b) => a - b).join(',');
    return {
      angles: Float64Array.from([...this.jointAngles, ...this.treadTravel, ...this.treadScrub]),
      poses,
      rest: [joint, play, this.scrub, list(d.held), list(d.heldToFrame), list(d.outOfReach), list(d.heldJoints), d.together.join(','), d.turning ? `${d.turning.grabbed},${d.turning.joint}` : '', d.springs, d.grip, list(this.frozen), list(this.endHeld), list(this.turnHeld), this.contactTreads.join(','), this.springsHeld, this.wsActive, JSON.stringify(this.options)].join('|'),
      drag: d,
      ws: this.ws,
    };
  }

  private static sameInputs(a: SearchInputs, b: SearchInputs): boolean {
    if (a.drag !== b.drag || a.ws !== b.ws || a.rest !== b.rest || a.angles.length !== b.angles.length || a.poses.length !== b.poses.length) return false;
    for (let i = 0; i < a.angles.length; i++) if (!Object.is(a.angles[i], b.angles[i])) return false;
    for (let i = 0; i < a.poses.length; i++) if (!Object.is(a.poses[i], b.poses[i])) return false;
    return true;
  }

  private jointMotionNearOrigin(joint: number, play: boolean): number[] | null {
    // Chosen in the tree basis's coordinates (see freeMotionsInBasis), each motion's bodies'
    // turning read off the basis's rows as they're needed, and only the motion chosen turned
    // back into a motion vector: a big model has many free motions, most of them left out.
    // The free motions and the motions the tiers choose, from the last search if it was made from
    // the same inputs (see lastSearch), else worked out: with what working them out sets.
    const inputs = this.options.reuseSearch ? this.searchInputs(joint, play) : null;
    const last = inputs && this.lastSearch && Kinematics.sameInputs(this.lastSearch.on, inputs) ? this.lastSearch : null;
    const reuse = last !== null && !this.options.reuseSearchCheck;
    if (reuse) {
      this.searchStats.reused++;
      [this.scrubNeeded, this.leastScrub, this.slipRows] = last.scrub;
      if (last.gripped) this.gripped = true;
    }
    const basis = reuse ? last.basis : this.treeBasis();
    let [usual, suspension] = reuse ? [last.usual, last.suspension] : this.freeMotionsApart();
    // A drag's first step classifies its joints from these (see classifyDrag), where the model is now
    // (moved to the origin, as these were worked out).
    if (this.classifyPending === joint && !this.drag.choosingHolds) {
      this.classifyPending = -1;
      this.classifyDrag((m) => this.jointRate(m, joint), this.wheelTurned(joint) ? 'wheel' : 'turn', { basis, motions: orthonormalize([...usual, ...suspension]), slipRows: this.slipRows });
      // The free-parts rule: which of the candidates to hold for the drag, chosen here, once; and this
      // step's motions those that hold them (the later steps' have their rows).
      if (this.freeRuleOn()) {
        const held = this.chooseHeldJoints(joint, basis, [...usual, ...suspension]);
        if (held.length) {
          this.drag.heldJoints = new Set(held);
          const { rateOf } = this.measures(joint, basis);
          const keep = (motions: number[][]) => {
            if (!motions.length) return motions;
            const rows = held.map((j) => motions.map((z) => this.basisJointRate(z, j, basis, rateOf)));
            return orthonormalize(mixes(motions, nullSpace(rows, motions.length)));
          };
          [usual, suspension] = [keep(usual), keep(suspension)];
        }
      }
    }
    const { turning, rateOf, rate, size } = this.measures(joint, basis);
    // The car moves on its suspension only if nothing else turns the joint without turning the
    // joints SUSPENSION_GAIN times as fast or more (where the only way is a hair of rolling, scaled
    // up, as for the arm a wheel hangs on): rolling, it would mix in a little of its suspension
    // to turn the other joints a little less, a motion that, closing the loops, can jump far from
    // where it had them going (the 41999 Crawler's portal hubs, stopped as at a dead point).
    const tiers = this.options.leastMotion && this.drag.turning?.joint === joint ? this.leastTiers(joint, turning, rateOf, size) : undefined;
    let choices: { plain: { motion: number[] | null; parked: number[] | null }; any: { motion: number[] | null; parked: number[] | null } };
    if (reuse) choices = { plain: last.plain, any: last.any };
    else {
      const gripped = this.gripped;
      this.gripped = false;
      const plainChoices = this.motionChoices(joint, usual, rate, size, tiers);
      choices = { plain: plainChoices, any: suspension.length ? this.motionChoices(joint, orthonormalize([...usual, ...suspension]), rate, size, tiers) : plainChoices };
      const found = { scrub: [this.scrubNeeded, this.leastScrub, this.slipRows] as [number | null, number, number[][]], gripped: this.gripped };
      this.gripped = gripped || found.gripped;
      if (last) {
        const same = (a: number[] | null, b: number[] | null) => (a === null || b === null ? a === b : a.length === b.length && a.every((x, i) => Object.is(x, b[i])));
        const sameChoice = (a: { motion: number[] | null; parked: number[] | null }, b: { motion: number[] | null; parked: number[] | null }) => same(a.motion, b.motion) && same(a.parked, b.parked);
        if (!sameChoice(last.plain, choices.plain) || !sameChoice(last.any, choices.any) || last.gripped !== found.gripped || !Object.is(last.scrub[0], found.scrub[0]) || !Object.is(last.scrub[1], found.scrub[1])) this.searchStats.differ++;
      }
      if (inputs) {
        this.searchStats.worked++;
        this.lastSearch = { on: inputs, basis, usual, suspension, plain: choices.plain, any: choices.any, ...found };
      }
    }
    const plain = this.chosen(choices.plain);
    const any = this.chosen(choices.any);
    const length = (z: number[]) => Math.hypot(...size(z));
    let z = this.drag.choosingHolds && this.drag.plainOnly ? plain : plain && (!any || length(plain) < SUSPENSION_GAIN * length(any)) ? plain : any;
    // Least motion: a drag keeps to the choice its first step made, while it can, rather than
    // switching as the two come close: the 42056's rear suspension arm, at a third of its drag,
    // switched to rolling the car, swinging its front linkage fast enough to count as a dead
    // point. But a drag that chose the plain motion takes the suspension once the plain one
    // turns the joints SUSPENSION_GAIN² times as much, as it does where it held only to first
    // order (the 42096 Porsche 911 RSR's rear suspension arm, whose plain motion grew from 1.5 times
    // the suspension's to 90 times in two steps).
    if (tiers && !this.drag.choosingHolds && suspension.length) {
      if (this.drag.suspension === null) this.drag.suspension = z === any && z !== plain;
      else if (!this.drag.suspension && plain && any && length(plain) >= SUSPENSION_GAIN * SUSPENSION_GAIN * length(any)) this.drag.suspension = true;
      if (this.drag.suspension ? any : plain) z = this.drag.suspension ? any : plain;
    }
    // One problem: a step chosen by the tiers has its loops closed by them too (see closeLoops).
    this.stepByTiers = tiers !== undefined && this.options.oneProblem && z !== null;
    this.played = false;
    if (z) return fromBasis(z, basis);
    // Play only lets a drag go where nothing else would, not choose what it holds: a hold that
    // left the drag only play would be kept, and the drag would turn a joint it needn't (the
    // 42112 Concrete Mixer Truck's wheels, which stopped partway round).
    if (this.drag.choosingHolds) return null;
    // With loopPlay, play is the last resort (decision 121 of 2026-11-16): an exact motion first,
    // then friction pins freed for a control with none, and play only where neither gives a
    // motion. So only a drag of this very joint takes play, never a test of whether it can move
    // at all: a play motion found there would keep the pins (the 8081 Extreme Cruiser's bonnet,
    // which then went 5 radians on play and never lifted, where freeing two pins lifts it).
    if (this.options.loopPlay && (!play || this.drag.turning?.joint !== joint)) return null;
    if (TRACE) traceJam(this, joint, rate);
    const played = this.playMotion(rate, size);
    if (TRACE) trace({ event: 'play', joint, found: played !== null });
    this.played = played !== null;
    return played ? fromBasis(played, basis) : null;
  }

  // With loopPlay: how far each joint that closes a loop may open, in LDU. A loop may open as far
  // as its joints' clearances add up to, all round it: the joint that closes it and the tree's
  // joints between its two bodies. A turning joint (a pin or axle in a round hole) gives RADIAL
  // and AXIAL, a slide RADIAL, a ball BALL; gears, tyres, universal joints and holds none (they
  // aren't joints, or stay firm). Worked out once: the tree doesn't change.
  private loopBudgets(): Map<number, number> {
    if (this.budgets) return this.budgets;
    const clearance = (j: number) => {
      const kind = this.mech.joints[j].kind;
      return kind === 'revolute' ? RADIAL + AXIAL : kind === 'slide' ? RADIAL : kind === 'ball' ? BALL : 0;
    };
    // The joints from a body up the tree to the root, in order.
    const up = (body: number) => {
      const path: number[] = [];
      for (let link = this.parentLink(body); link; link = this.parentLink(link.parent)) path.push(link.joint);
      return path;
    };
    this.budgets = new Map();
    this.mech.joints.forEach((joint, j) => {
      if (this.inTree(j) || clearance(j) === 0) return;
      const a = up(joint.bodyA);
      const b = new Set(up(joint.bodyB));
      // The joints on one path and not the other: those between the two bodies.
      const between = [...a.filter((k) => !b.has(k)), ...[...b].filter((k) => !a.includes(k))];
      this.budgets!.set(j, clearance(j) + between.reduce((sum, k) => sum + clearance(k), 0));
    });
    return this.budgets;
  }

  // With loopPlay, after a step on play and the loops closed as far as they go: the rows that take
  // no play closed again on their own, the loops left as they are. Closed only with the loops,
  // which a step on play leaves open by design, what the loops can't close was shared out into
  // those rows, step after step (the 42079 Heavy Duty Forklift's mast drive, whose universal
  // joints came 0.0004 LDU further apart with each step on play, until the drive stopped).
  // Closing those rows alone, without closing the loops first, left the loops past their budgets
  // within a step (the 42037 Formula Off-Roader's rear suspension, which then never moved).
  private closeFirmRows(keep: number) {
    this.closingFirmOnly = true;
    try {
      this.closeLoops(keep);
    } finally {
      this.closingFirmOnly = false;
    }
  }

  // Whether any equation is further apart than DEAD_POINT_GAP where the bodies are now: the loops
  // a step on play left open.
  private loopsOpen(): boolean {
    const gaps: number[] = [];
    this.buildEquations(gaps, null, true);
    return gaps.some((g) => Math.abs(g) > DEAD_POINT_GAP);
  }

  // With loopPlay: whether every loop is closed within its budget (see loopBudgets), and every
  // other equation (gears, tyres, holds) as closely as without play (DEAD_POINT_GAP). How far a
  // joint has opened: how far apart its two halves are at its point (a slide's across its axis
  // only), and how far it's turned out of line, counted at a stud away.
  private withinPlay(): boolean {
    const budgets = this.loopBudgets();
    const gaps: number[] = [];
    const play: number[] = [];
    this.buildEquations(gaps, null, true, null, play);
    if (gaps.some((g, i) => !play[i] && Math.abs(g) > DEAD_POINT_GAP)) return false;
    for (const [j, budget] of budgets) {
      const joint = this.mech.joints[j];
      const pA = joint.from.clone().applyMatrix4(this.poses[joint.bodyA]);
      const apart = joint.from.clone().applyMatrix4(this.poses[joint.bodyB]).sub(pA);
      const d = axisOf(joint.from, joint.to).transformDirection(this.poses[joint.bodyA]);
      if (joint.kind === 'slide') apart.sub(d.clone().multiplyScalar(apart.dot(d)));
      let out = 0;
      if (joint.kind === 'revolute' || joint.kind === 'slide') {
        const dB = axisOf(joint.from, joint.to).transformDirection(this.poses[joint.bodyB]);
        out = new Vector3().crossVectors(dB, d).length() * STUD;
      }
      if (apart.length() + out > budget) return false;
    }
    return true;
  }

  // A motion that turns the joint (at rate 1, by `rate`) when none does exactly, taking up play
  // (see PLAY_RATE): of those that keep every other rule exactly (gears, tyres rolling and, more
  // strictly than usual, neither scrubbing nor lifting, holds, universal joints), the one that opens the loops least (by the length of the loops' rows
  // applied to it), the smallest (by `size`) only breaking ties, and taken only if it opens them
  // at most PLAY_RATE. Null if there's none. (A loop that fits only as built moves exactly for a
  // step, to first order, and not after: its rows, which repeat each other there, don't a hair
  // further on.)
  private playMotion(rate: (z: number[]) => number, size: (z: number[]) => number[]): number[] | null {
    const slip: Slip<BodyRow> = { sideways: [], travel: [], lift: [], rise: [] };
    const play: number[] = [];
    const basis = this.treeBasis();
    const rows = inBasis(this.buildEquations(null, slip, true, null, play), basis);
    const loops = rows.flatMap((row, i) => (play[i] ? [row.map((x) => x * play[i])] : []));
    if (loops.length === 0) return null;
    // Tyres on the ground neither scrub nor lift here, so taking up play never stands in for
    // scrubbing more than allowed (a steered car that can't roll).
    const firm = [...rows.filter((_, i) => !play[i]), ...inBasis([...slip.sideways, ...slip.lift], basis)];
    const apply = (z: number[]) => loops.map((row) => dot(row, z));
    const motions = orthonormalize(nullSpace(firm, basis[0].length));
    if (motions.length === 0) return null;
    // The mix a of the motions with Σ a_k rate_k = 1 that makes aᵀ G a least, G holding how much
    // each pair of them opens the loops together, and turns the joints together times TIE_BREAK²:
    // a = G⁻¹ rates / (ratesᵀ G⁻¹ rates). (Not smallestTurning, which leaves out as no motion at
    // all a way to move that costs next to nothing, as a loop that all but fits does.)
    const cost = motions.map((m) => [...apply(m), ...size(m).map((x) => x * TIE_BREAK)]);
    const gram = gramOf(cost, cost);
    const rates = motions.map(rate);
    const scale = Math.max(...gram.map((row, i) => row[i]));
    if (!(scale > 0)) return null;
    const mix = solveSymmetric(gram, rates, 1e-12 * scale);
    const turns = mix.reduce((sum, a, k) => sum + a * rates[k], 0);
    if (Math.abs(turns) < EPSILON) return null;
    const z = combine(motions, mix.map((a) => a / turns));
    // With loopPlay, at any rate: how far the loops may open is the budgets' to say (see
    // withinPlay), a step at a time.
    return this.options.loopPlay || Math.hypot(...apply(z)) <= PLAY_RATE * Math.abs(rate(z)) ? z : null;
  }

  // The motion jointMotion chooses from these (orthonormal, in the tree basis's coordinates), by
  // how fast each turns the joint (`rate`) and all the joints (`size`).
  // With `tiers` (least motion, see leastTiers), the motion is chosen by them rather than by
  // `size` alone.
  private chooseMotion(joint: number, all: number[][], rate: (z: number[]) => number, size: (z: number[]) => number[], tiers?: Tier[]): number[] | null {
    return this.chosen(this.motionChoices(joint, all, rate, size, tiers));
  }

  // chooseMotion's answer from motionChoices': while a drag's holds are chosen, a rolling tyre's
  // motion that only parks the car doesn't count (see the end of motionChoices).
  private chosen(c: { motion: number[] | null; parked: number[] | null }): number[] | null {
    return c.motion ?? (this.drag.choosingHolds ? null : c.parked);
  }

  // chooseMotion's work: the motion chosen, and, where only a motion that parks a rolling tyre's
  // car was found (the last line), that one as `parked`, for chosen to take or not. Kept apart so
  // that a search can be reused whether or not holds are being chosen (see jointMotionNearOrigin).
  private motionChoices(joint: number, all: number[][], rate: (z: number[]) => number, size: (z: number[]) => number[], tiers?: Tier[]): { motion: number[] | null; parked: number[] | null } {
    const basis = this.treeBasis();
    const smallest = (motions: number[][]) => (tiers ? leastTurning(motions, rate, tiers) : smallestTurning(motions, rate, size));
    // The motions that leave the frame (body 0) where it is: the mixes with no frame part.
    const frameRows = dotsWith(basis.slice(0, 6), all);
    const still = all.length ? orthonormalize(mixes(all, nullSpace(frameRows, all.length))) : [];
    // Least motion: of those, the ones in which no tyre on the ground scrubs or lifts, if any
    // turns the joint, as the frame is kept still if it can be: all or nothing. A motion that
    // leaves the frame still may still drag the tyres across the ground, and nothing in the
    // tiers costs that (see leastScrub): the 8837 Pneumatic Excavator, whose frame is its upper
    // body, slewed its chassis round under it, all four tyres scrubbing, rather than steer.
    let gripped: number[] | null = null;
    if (tiers && this.drag.grip && this.slipRows.length && still.length) {
      const slips = dotsWith(this.slipRows, still);
      const grip = orthonormalize(mixes(still, nullSpace(slips, still.length)));
      if (grip.length) gripped = smallest(grip);
    }
    if (gripped) this.gripped = true;
    const parked = gripped ?? smallest(still);
    if (!parked) return { motion: smallest(all), parked: null };
    const { bodyA, bodyB } = this.mech.joints[joint];
    if (!this.contactTreads.some((i) => [bodyA, bodyB].includes(this.mech.treads[i].body))) return { motion: parked, parked: null };
    // Least motion: the tyre's turning rolls the car, the tiers (what steers it among them) kept
    // still as they can be; taking the way that leaves the frame where it is out first, as below,
    // would leave the rest a hair of steering in each, and the tiers no way to keep it still.
    if (tiers) return { motion: smallest(all), parked: null };
    // The tyre's: of the motions that leave the frame where it is, the one way among them that
    // turns it is taken out (they're orthonormal, so that's the mix of them in proportion to how
    // fast each turns it), and the smallest of the rest that turns it, which rolls the car.
    const rates = still.map(rate);
    const turns = orthonormalize([combine(still, rates)]);
    const rest = orthonormalize(
      all.map((m) => {
        const u = m.slice();
        for (const g of turns) {
          let d = 0;
          for (let i = 0; i < u.length; i++) d += u[i] * g[i];
          for (let i = 0; i < u.length; i++) u[i] -= d * g[i];
        }
        return u;
      }),
      1e-6,
    );
    return { motion: smallest(rest), parked };
  }

  // Least motion's tiers, most important first, each saying how much a motion (in the tree
  // basis's coordinates) moves what it's about. A drag moves the first tier's as little as it
  // can, then of the motions that do that, the next tier's, and so on (see leastTurning): just as
  // holding things still keeps them still where the drag allows, but all of a tier at once, so
  // the order within it doesn't matter, and afresh each step, so nothing needs choosing again as
  // the model moves. (Before these, chooseMotion keeps the frame where it is, if it can be.)
  //   1. what slides or swivels on the car (a bumper on tiles, a gear lever on its ball)
  //   2. on a car on the ground, what steers it
  //   3. joints on friction pins, then what the grabbed part turns against
  //   4. every body's turning against the frame, but pulleys' (which a string turns): a gear
  //      freewheeling on a shaft turns on it rather than turning the shaft, and an assembly
  //      hanging on a turning axle stays level. Not the tyres' scrubbing, which the scrub rule
  //      already keeps within what's allowed (see leastScrub): weighed here too, a car would
  //      roll and swing round rather than let a tyre scrub a little (the 42037 Formula Off-Roader,
  //      rolling 41 LDU for each radian a suspension arm was raised)
  //   5. every joint's turning (`size`), which settles what's left
  //   6. every body's moving against the frame, for what no joint's turning settles
  // With SPARSE_FRICTION, tier 4 is friction instead, and sparse (see leastTurning: as few
  // things move as can, as static friction holds as many joints as it can rather than letting
  // each slip a little): every joint's turning; every body's turning against the frame, counted
  // by its parts, TURNING_WEIGHT as much (an assembly hanging on a turning axle, heavier than the
  // gears that would turn instead, stays level); and the tyres scrubbing sideways or lifting,
  // SCRUB_WEIGHT as much.
  private leastTiers(joint: number, turning: (z: number[]) => Float64Array, rateOf: (z: number[], i: number) => number, size: (z: number[]) => number[], basis = this.treeBasis()): Tier[] {
    const grabbed = this.drag.turning?.joint === joint ? this.drag.turning.grabbed : this.mech.joints[joint].bodyB;
    const dot = (row: number[], z: number[]) => {
      let sum = 0;
      for (let c = 0; c < z.length; c++) sum += row[c] * z[c];
      return sum;
    };
    // A resting body on something other than what it's mounted on (a push rod on its cam) goes as
    // that moves it, not as a mount: kept still on its mount, it would keep the cam still too, and
    // the drag would go another way (the 42112 Concrete Mixer Truck's front wheel, rolled, turned its
    // steering instead once a lobe began to lift a rod).
    const riding = new Set((this.mech.rests ?? []).flatMap((r) => { const on = restingOn(this, r); return on && on.body !== this.mounts.get(r.body) ? [r.body] : []; }));
    const mounts = [...this.mounts].filter(([b]) => b !== grabbed && !this.frozen.has(b) && !this.drag.held.has(b) && !this.closingFollowers.has(b) && !riding.has(b));
    const mounted = (z: number[]) => mounts.flatMap(([b, m]) => [0, 1, 2, 3, 4, 5].map((k) => dot(basis[6 * b + k], z) - dot(basis[6 * m + k], z)));
    // The steering is kept still on a car on its tyres, and lifted too: in the hand, nothing turns a
    // knuckle against its chassis but friction in the steering, which holds it there (the 42053
    // Volvo EW160E, slewed in the hand, steered its front wheels; decision 90 of 2026-11-15).
    const steers = this.contactTreads.length > 0 || (this.options.lifted && this.mech.treads.length > 0);
    if (steers && !this.drag.steering) this.drag.steering = this.steeringBodies();
    // A drag that drives the steering through its gears (a steering knob) is meant to steer, so
    // the steering isn't kept still for it: kept still, the 8837 Pneumatic Excavator's knob,
    // whose gear crosses the turntable, slewed the excavator round instead. Nor, lifted, for a
    // drag that rocks a body counted as steering, about a level axis: the 8849 Tractor's front
    // axle, rocking on its steering shaft, turns the steering gear in it a little, so it counts;
    // with the steering kept still, its steering shaft turned as the axle rocked, where the
    // function has it stay. A drag about the upright (the 42053's slewing, which turns all its
    // tyres round together) still keeps it.
    const rocks = steers && this.options.lifted && this.drag.steering!.has(grabbed) && Math.abs(axisOf(this.mech.joints[joint].from, this.mech.joints[joint].to).transformDirection(this.poses[this.mech.joints[joint].bodyA]).dot(DOWN)) < LEVEL_AXIS;
    const keepSteering = steers && !rocks && ![...this.gearedTo(grabbed, true)].some((b) => b !== grabbed && this.drag.steering!.has(b));
    const steering = keepSteering ? [...this.drag.steering!].filter((b) => b !== grabbed && this.parentJoint[b] >= 0).map((b) => this.parentJoint[b]) : [];
    const steered = (z: number[]) => steering.map((j) => rateOf(z, j));
    // Friction pins, and motors' outputs, which their gearboxes hold (see chooseHolds).
    const stiff = this.mech.joints.flatMap((j, i) => ((j.stiff || j.motor) && j.kind === 'revolute' && i !== joint ? [i] : []));
    // And slides that springs hold at rest (see Joint.springHeld), by how fast they slide: given
    // only where nothing else can move, as a friction pin gives.
    const springs = inBasis(this.springRows(), basis);
    const pins = (z: number[]) => [...stiff.map((j) => rateOf(z, j)), ...springs.map((row) => dot(row, z))];
    const pulleys = new Set((this.mech.strings ?? []).flatMap((s) => s.pulleys.map((w) => w.body)));
    const bodies = Array.from({ length: this.bodyCount }, (_, b) => b).filter((b) => b > 0 && b !== grabbed && !pulleys.has(b) && !this.closingFollowers.has(b));
    // With SPARSE_FRICTION, each body counts by how many parts it has: heavier.
    const mass = new Array(this.bodyCount).fill(SPARSE_FRICTION ? 0 : 1);
    if (SPARSE_FRICTION) for (const b of this.mech.bodyOf) if (b >= 0) mass[b]++;
    // A body balanced on the joint it turns on (its middle on the joint's axis: an
    // axle, a gear, a propeller) has its turning count against what it turns on (its parent in
    // the tree), which comes to how fast the joint turns, rather than against the frame: weight
    // keeps a part that hangs off its axle (a lever, a hook's block) level, but can't keep a
    // balanced one still, and what it turns on carries it round. The 855 Mobile Crane's boom
    // shafts, kept as still as they could be as the cab slewed, moved its boom extension out.
    // So does a train coupling's holder, which swivels about the upright: nothing keeps its
    // heading as its car rounds a curve, and its pin's friction carries it round.
    const centers = this.mech.centers;
    const couplings = this.couplingBodies ??= new Set(this.mech.roles.flatMap((r, i) => (r === 'coupling' ? [this.mech.bodyOf[i]] : [])));
    const against = bodies.map((b) => {
      const link = this.options.balanced && centers ? this.parentLink(b) : null;
      if (!link) return 0;
      const j = this.mech.joints[link.joint];
      if (j.kind !== 'revolute') return 0;
      if (couplings.has(b)) return link.parent;
      const from = j.from.clone().applyMatrix4(this.poses[j.bodyA]);
      const d = axisOf(j.from, j.to).transformDirection(this.poses[j.bodyA]);
      const off = centers![b].clone().applyMatrix4(this.poses[b]).sub(from);
      return off.sub(d.multiplyScalar(off.dot(d))).length() < BALANCE ? link.parent : 0;
    });
    // A clutch gear, turning on a body that carries a driving ring (see Options.freeClutch),
    // costs nothing: it's made to spin free on its shaft, which is what a gearbox in neutral
    // is. Counted, it and the other clutch gear on the shaft, each driven round at its own rate,
    // carried the free shaft round with them, two joints against one: the gearbox model's output
    // turned 0.44 radian for each radian of its input in neutral.
    const rings = this.ringBodies ??= new Set(this.mech.roles.flatMap((r, i) => (r === 'driving ring' ? [this.mech.bodyOf[i]] : [])));
    const free = bodies.map((b, i) => this.options.freeClutch && against[i] > 0 && rings.has(against[i]) && !rings.has(b) && this.mech.gears.some((g) => g.body === b));
    const turns = (z: number[]) => {
      const w = turning(z);
      return bodies.flatMap((b, i) => {
        const a = 3 * against[i];
        const m = free[i] ? 0 : mass[b];
        return [m * (w[3 * b] - w[a]), m * (w[3 * b + 1] - w[a + 1]), m * (w[3 * b + 2] - w[a + 2])];
      });
    };
    const slipRows = this.slipRows;
    const scrubs = (z: number[]) => slipRows.map((row) => SCRUB_WEIGHT * dot(row, z));
    // What the grabbed part turns against (see housing) is kept as still as it can be against
    // the frame: a drag turns the part, as a hand holding the model by its frame would, rather
    // than swinging what it turns on the other way round it (the 8862 Backhoe's dipper, whose
    // cylinder drag swung the boom and carried the dipper round level, every body on it costing
    // nothing more for turning that way). Before the turning tier, which would choose that.
    const housing = this.drag.turning?.joint === joint && this.parentJoint[grabbed] === joint ? this.housing(grabbed) : 0;
    const housed = (z: number[]) => {
      if (housing === 0) return [];
      const w = turning(z);
      return [0, 1, 2].map((d) => w[3 * housing + d] - w[d]);
    };
    const turning4 = SPARSE_FRICTION
      ? { cost: (z: number[]) => [...size(z), ...turns(z).map((x) => TURNING_WEIGHT * x), ...scrubs(z)], sparse: true }
      : { cost: turns, bodies: bodies.length, stillness: this.options.stillness };
    // Each body's moving against the frame, at a point in its middle (the middle of its joints):
    // what's still free once no joint turns any more than it must is a body moving without
    // turning anything (a piston on a connecting rod that reaches no crank, sliding in its
    // cylinder), which is kept still rather than left any amount, as it would run off its end.
    const middles = bodies.map((b) => {
      const at = new Vector3();
      let n = 0;
      for (const j of this.mech.joints) {
        if (j.bodyA !== b && j.bodyB !== b) continue;
        at.add(j.from.clone().applyMatrix4(this.poses[j.bodyA])).add(j.to.clone().applyMatrix4(this.poses[j.bodyA]));
        n += 2;
      }
      return n ? at.multiplyScalar(1 / n) : null;
    });
    const moves = (z: number[]) => {
      const twist = (b: number) => [0, 1, 2, 3, 4, 5].map((k) => dot(basis[6 * b + k], z));
      const frame = twist(0);
      return bodies.flatMap((b, i) => {
        const c = middles[i];
        if (!c) return [];
        const t = twist(b).map((x, k) => x - frame[k]);
        const w = new Vector3(t[0], t[1], t[2]);
        const v = new Vector3(t[3], t[4], t[5]).add(w.cross(c));
        return [v.x, v.y, v.z];
      });
    };
    // A car on fewer than three tyres, which don't stand it up, has its own turning kept as
    // still as it can be, as its weight would: else nothing costs it, every tier being measured
    // against it, and turning a rear wheel of the 8865 Test Car, its front tyres built clear of
    // the ground, swung it round the other rear wheel and tipped it forward.
    const tipping = this.contactTreads.length > 0 && this.contactTreads.length < 3;
    const frameTurning = (z: number[]) => (tipping ? [0, 1, 2].map((k) => dot(basis[k], z)) : []);
    // A resting body following its support as the loops close (see advance): its joints' turning costs
    // nothing either.
    const followed = this.closingFollowers;
    const pulleyJoints = new Set((this.mech.strings ?? []).flatMap((s) => s.pulleys.flatMap((w) => (w.joint >= 0 ? [w.joint] : []))));
    const sizeHere = followed.size
      ? (z: number[]) =>
          this.mech.joints.flatMap((j, i) => {
            if (pulleyJoints.has(i) || followed.has(j.bodyA) || followed.has(j.bodyB)) return [];
            if (j.kind === 'revolute' || (j.kind === 'slide' && j.turns)) return [rateOf(z, i)];
            if (j.kind !== 'ball') return [];
            const w = turning(z);
            const [a, b] = [3 * j.bodyA, 3 * j.bodyB];
            return [w[b] - w[a], w[b + 1] - w[a + 1], w[b + 2] - w[a + 2]];
          })
      : size;
    const list: Tier[] = [{ cost: mounted }, { cost: steered }, { cost: pins }, { cost: housed }, { cost: frameTurning }, turning4, { cost: sizeHere, joints: true }, { cost: moves }];
    return list;
  }

  // The radius of the circle the frame's origin is driving round right now, Infinity when
  // it's driving straight, or null if the frame can't move. (Only steering and rolling move a
  // car's frame, so this takes the free motion that moves the frame, if there's one.) It leaves
  // what working out the free motions sets as it was: the viewer's readout asks this between a
  // drag's steps, and the next step, or what the drag says when stuck, must not hear of it.
  frameTurningRadius(): number | null {
    const [scrubNeeded, leastScrub, slipRows] = [this.scrubNeeded, this.leastScrub, this.slipRows];
    try {
      return this.nearOrigin(() => this.frameTurningRadiusNearOrigin());
    } finally {
      [this.scrubNeeded, this.leastScrub, this.slipRows] = [scrubNeeded, leastScrub, slipRows];
    }
  }

  private frameTurningRadiusNearOrigin(): number | null {
    const all = this.freeMotions();
    const still = this.frameStill(all);
    let best: number[] | null = null;
    let bestSpeed = EPSILON;
    for (const m of all) {
      // Take out any part of it that leaves the frame where it is.
      const moving = m.slice();
      for (const b of still) {
        const d = moving.reduce((sum, x, i) => sum + x * b[i], 0);
        for (let i = 0; i < moving.length; i++) moving[i] -= d * b[i];
      }
      const speed = this.pointVelocity(moving, 0, new Vector3().applyMatrix4(this.poses[0])).length();
      if (speed > bestSpeed) {
        best = moving;
        bestSpeed = speed;
      }
    }
    if (!best) return null;
    const turnRate = new Vector3(best[0], best[1], best[2]).length();
    return turnRate < EPSILON ? Infinity : bestSpeed / turnRate;
  }

  // The free motions that leave the frame (body 0) where it is, made orthonormal.
  private frameStill(motions: number[][]): number[][] {
    if (motions.length === 0) return [];
    // Mixes a of the motions with  Σ a_k · (frame part of m_k) = 0.
    const rows: number[][] = [];
    for (let c = 0; c < 6; c++) rows.push(motions.map((m) => m[c]));
    const mixes = nullSpace(rows, motions.length);
    const combined = mixes.map((a) => {
      const v = new Array(motions[0].length).fill(0);
      a.forEach((ak, k) => motions[k].forEach((x, i) => (v[i] += ak * x)));
      return v;
    });
    return orthonormalize(combined);
  }

  // Moves the mechanism along a motion vector, scaled by `amount`, then closes any loops
  // (without turning the joint `keep`, if given). Keep steps small (a few LDU, a few
  // degrees): the motion is only exact at the start of the step.
  // Returns how far apart the joints are left (see closeLoops).
  advance(motion: number[], amount: number, keep = -1): number {
    this.notePivots(motion);
    // Least motion: a step that leaves the car where it is (steering it) keeps it there while the
    // loops are closed, and doesn't set it down again, as a car held still for a drag (see settle).
    // (Each model in the file by itself: see frames.)
    const parked = this.options.leastMotion && this.drag.turning !== null ? this.frames.filter((f) => !this.drag.held.has(f) && motion.slice(6 * f, 6 * f + 6).every((x) => Math.abs(x * amount) <= 1e-9)) : [];
    for (const f of parked) this.drag.held.add(f);
    try {
      return this.nearOrigin((_, fromModel) => {
        const m = fromModel(motion);
        // Least motion: the bodies the step leaves still against the frame are kept as still as
        // they can be while the loops are closed (see closeLoops). Not a body standing on its own
        // (a root other than the frame) that rests on nothing, held only by the loops: still in
        // the step only to first order, it's for closing them to move (the 8063 Tractor's
        // pistons, at top dead centre: kept still, closing the loops turned the crank back,
        // through the differential). A resting one is still kept still: the 858 Auto Engines'
        // crank jams a turn short if its push rods and rockers aren't.
        if (this.options.leastMotion && this.drag.turning !== null && this.options.closeStill > 0) {
          const most = Math.max(...m.map(Math.abs));
          const resting = new Set((this.mech.rests ?? []).map((r) => r.body));
          // A resting body follows what it stands on (decisions 317, 319 and 324): where the support it rests
          // on now moves in the step (a camshaft's lobe turning under a push rod at its top, still to
          // first order there), it isn't kept still, nor costs anything in closing's tiers (see
          // leastTiers), so closing the loops sets it on its support rather than turning the support
          // back (the 42112's camshaft, turned back through the open rear differentials until the step
          // was refused). Kept still, still, where its support is still too (the 858's push rods on
          // their plate, whose crank jams a turn short otherwise).
          const moving = (b: number) => [0, 1, 2, 3, 4, 5].some((k) => Math.abs(m[6 * b + k] - m[k]) > 1e-9 * most);
          this.closingFollowers = new Set((this.mech.rests ?? []).flatMap((r) => { const on = restingOn(this, r); return on && moving(on.body) ? [r.body] : []; }));
          this.closingStill = Array.from({ length: this.bodyCount }, (_, b) => b).filter((b) => b > 0 && (!this.rootPoses.has(b) || resting.has(b)) && !this.closingFollowers.has(b) && !moving(b));
        }
        // Least motion: what slides or swivels on the car (see findMounts) and the step leaves
        // still on it is held there while the loops are closed, as tier 1 kept it, but for
        // rounding (the 8865 Test Car's top axle, built at its end stop, slid a hair past it).
        // Not a resting body, which closing the loops sets down on what it rests on.
        const resting = new Set((this.mech.rests ?? []).map((r) => r.body));
        const scale = Math.max(1, ...m.map(Math.abs));
        const mountsHeld = this.options.leastMotion && !this.options.oneProblem && this.drag.turning !== null ? [...this.mounts].filter(([b, on]) => !resting.has(b) && !this.drag.held.has(b) && b !== this.drag.turning!.grabbed && [0, 1, 2, 3, 4, 5].every((k) => Math.abs(m[6 * b + k] - m[6 * on + k]) <= 1e-9 * scale)).map(([b]) => b) : [];
        for (const b of mountsHeld) this.drag.held.add(b);
        this.move(m, amount);
        // A support that arrives under a resting body in the step (a lobe coming round under a push
        // rod's foot that stood on the plate): where it rests on now, after the move, counts too.
        if (this.closingFollowers.size || this.mech.rests?.length) {
          const most = Math.max(...m.map(Math.abs));
          const moving = (b: number) => [0, 1, 2, 3, 4, 5].some((k) => Math.abs(m[6 * b + k] - m[k]) > 1e-9 * most);
          for (const r of this.mech.rests ?? []) {
            const on = restingOn(this, r);
            if (on && moving(on.body)) this.closingFollowers.add(r.body);
          }
          this.closingStill = this.closingStill.filter((b) => !this.closingFollowers.has(b));
        }
        let gap: number;
        try {
          gap = this.closeLoops(keep);
        } finally {
          this.closingStill = [];
          this.closingFollowers = new Set();
          for (const b of mountsHeld) this.drag.held.delete(b);
        }
        this.settle();
        return gap;
      });
    } finally {
      for (const f of parked) this.drag.held.delete(f);
    }
  }

  // Sets the model back down on its tyres. The solver lets a tyre rise or sink a very little
  // (see freeMotions), and a car's rolling makes use of that to scrub less; step after step,
  // that would add up, and a car driving round in circles would slowly tip over. So after each
  // step, the whole model is moved as one, up or down and tipped about level directions,
  // as little as puts its tyres on the ground back where they touched it at the start (least
  // squares, since four tyres on a frame that can't twist may not all fit). Moving it all as
  // one opens no joint. A car held still (steering it, or frozen) isn't moved.
  private settle() {
    for (const f of this.frames) this.settleFrame(f);
  }

  // Settles one model on its own tyres (see settle and frames), moving only the roots in it.
  private settleFrame(f: number) {
    const contacts = this.contactTreads.filter((i) => this.frameOf[this.mech.treads[i].body] === f);
    if (contacts.length < 3 || this.fixedBody === f || this.stillFrames.has(f) || this.frozen.has(f) || this.drag.held.has(f)) return;
    for (let round = 0; round < 3; round++) {
      // For each tyre, how its contact point would rise or sink (LDraw y) for each of: the
      // model moving down, turning about x, turning about z (about the origin); and how far it
      // has to go.
      const rows: number[][] = [];
      const wanted: number[] = [];
      for (const i of contacts) {
        const p = this.contactPoint(i);
        if (!p) continue;
        rows.push([1, -p.z, p.x]);
        wanted.push(this.contactHeights[i] - p.y);
      }
      if (Math.max(...wanted.map(Math.abs)) < LOOP_TOLERANCE) return;
      const gram = [0, 1, 2].map((a) => [0, 1, 2].map((b) => rows.reduce((sum, r) => sum + r[a] * r[b], 0)));
      const [down, tipX, tipZ] = solveSymmetric(gram, [0, 1, 2].map((a) => rows.reduce((sum, r, k) => sum + r[a] * wanted[k], 0)), EPSILON);
      const tip = screwMotion(new Vector3(tipX, 0, tipZ), new Vector3(0, down, 0));
      for (const [root, pose] of this.rootPoses) if (this.frameOf[root] === f) pose.premultiply(tip);
      this.updatePoses();
    }
  }

  private move(motion: number[], amount: number) {
    // Whether the model goes anywhere: steering a parked car drags its tyres round, but that
    // isn't rolling, and doesn't count towards their scrub rate (see freeMotions).
    const rolls = motion.slice(0, 6).some((x) => Math.abs(x * amount) > 1e-9);
    this.mech.treads.forEach((t, i) => {
      const pose = this.poses[t.body];
      const hub = t.center.clone().applyMatrix4(pose);
      // Turning positive about the axis a, with the ground below, carries the hub along down × a.
      const forward = new Vector3().crossVectors(DOWN, t.axis.clone().transformDirection(pose)).normalize();
      const rolled = this.pointVelocity(motion, t.body, hub).dot(forward) * amount;
      this.treadTravel[i] += rolled;
      const contact = this.contactTreads.includes(i) ? this.contactPoint(i) : null;
      if (contact) {
        const sideways = new Vector3().crossVectors(forward, DOWN).normalize();
        const scrubbed = Math.abs(this.pointVelocity(motion, t.body, contact).dot(sideways) * amount);
        this.treadScrub[i] += scrubbed;
        if (rolls && Math.abs(rolled) > MIN_ROLL) this.treadScrubRate[i] = scrubbed / Math.abs(rolled);
      }
    });
    this.mech.joints.forEach((joint, j) => {
      if (joint.kind === 'revolute') this.jointAngles[j] += this.jointRate(motion, j) * amount;
    });
    for (const [root, pose] of this.rootPoses) {
      const w = new Vector3(motion[6 * root], motion[6 * root + 1], motion[6 * root + 2]).multiplyScalar(amount);
      const v = new Vector3(motion[6 * root + 3], motion[6 * root + 4], motion[6 * root + 5]).multiplyScalar(amount);
      pose.premultiply(screwMotion(w, v));
    }
    this.updatePoses();
  }
}

// ---------------------------------------------------------------------------
// Helpers


// Whether two joints turn about one line (to within half a degree and an LDU, as built).
function onOneLine(a: Joint, b: Joint): boolean {
  const da = axisOf(a.from, a.to);
  const db = axisOf(b.from, b.to);
  if (new Vector3().crossVectors(da, db).length() > 0.01) return false;
  const offset = new Vector3().subVectors(b.from, a.from);
  return offset.addScaledVector(da, -offset.dot(da)).length() < 1;
}

// The lowest point of a circle (a tyre's tread at its middle), or null if the circle lies flat.
function lowestPoint(center: Vector3, axis: Vector3, radius: number): Vector3 | null {
  const down = DOWN.clone().addScaledVector(axis, -DOWN.dot(axis));
  if (down.length() < 0.01) return null;
  return center.clone().addScaledVector(down.normalize(), radius);
}



// Rotation by `angle` about the line through `point` along unit vector `axis`.
function rotationAbout(point: Vector3, axis: Vector3, angle: number): Matrix4 {
  const toOrigin = new Matrix4().makeTranslation(-point.x, -point.y, -point.z);
  const rotate = new Matrix4().makeRotationAxis(axis, angle);
  const back = new Matrix4().makeTranslation(point.x, point.y, point.z);
  return back.multiply(rotate).multiply(toOrigin);
}

// The rigid motion produced by keeping a twist (turn w, velocity v of the origin) for one
// unit of time: a turn about the twist's axis plus a slide along it.
function screwMotion(w: Vector3, v: Vector3): Matrix4 {
  const angle = w.length();
  if (angle === 0) return new Matrix4().makeTranslation(v.x, v.y, v.z);
  // A tiny turn: its axis can't be found accurately, but turning about the origin then moving
  // by v is the same to within angle². (Leaving out the turn would move a body far from the
  // origin by as much as angle × its distance, which closeLoops couldn't then close.)
  if (angle < EPSILON) return new Matrix4().makeTranslation(v.x, v.y, v.z).multiply(new Matrix4().makeRotationAxis(w.clone().divideScalar(angle), angle));
  const axis = w.clone().divideScalar(angle);
  const pointOnAxis = new Vector3().crossVectors(w, v).divideScalar(angle * angle);
  const slide = axis.clone().multiplyScalar(v.dot(axis));
  return new Matrix4().makeTranslation(slide.x, slide.y, slide.z).multiply(rotationAbout(pointOnAxis, axis, angle));
}

// Of orthonormal motions, the mixes in which the tyres scrub sideways by at most `limit` of how
// far they travel, as orthonormal motions. Worked out in the motions' own coordinates:
//   - mixes in which no tyre travels are kept only if no tyre scrubs (steering on its own);
//   - mixes in which tyres travel may add any of those, to scrub as little as they can; then
//     the directions whose scrub per unit of travel is at most `usual` are kept (rolling
//     straight, and a steered car turning round the centre that needs the least scrub). If
//     none is, but the one that scrubs least is within `limit`, that one alone is kept: a model
//     may allow its tyres more scrub (`limit`, more than `usual`) so that it can roll where it
//     otherwise couldn't, but not so that it may also roll in other ways that scrub more than
//     needed (a steered car scrubbing straight on, rather than following its steering).
// `needs.least` gets the least scrub any of them needs, as a fraction like `limit` (0 if none travels).
// Given `rolling`, the least scrub (squared) rolling needs, worked out already, that decides
// instead what's within `limit` (with the frame rising or sinking counted as travel, see
// freeMotions, a car moving on its suspension needs none): if rolling needs more, the
// directions within `usual` are kept all the same. With `keepStill`, the mixes in which no tyre
// travels are all kept, whether they scrub or not (a car steered where it stands, see
// freeMotionsApart).
function leastScrub(motions: number[][], slip: Slip, limit: number, usual = limit, needs = { least: 0 }, rolling?: number, keepStill = false): number[][] {
  const k = motions.length;
  const dot = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * b[i], 0);
  // Each row applied to each motion: rows × k.
  const scrub = slip.sideways.map((row) => motions.map((m) => dot(row, m)));
  const travel = slip.travel.map((row) => motions.map((m) => dot(row, m)));
  const gram = (a: number[][]) => Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => a.reduce((sum, row) => sum + row[i] * row[j], 0)));
  const travelGram = gram(travel);
  const scale = Math.max(1, ...travelGram.map((row, i) => row[i]), ...gram(scrub).map((row, i) => row[i]));
  const tiny = 1e-9 * scale;

  // Directions (in the motions' coordinates) with no travel, Z, and with unit travel, C.
  const { values: tv, vectors: tvecs } = symmetricEigen(travelGram);
  const still = tvecs.filter((_, e) => tv[e] <= tiny);
  const moving = tvecs.flatMap((v, e) => (tv[e] > tiny ? [v.map((x) => x / Math.sqrt(tv[e]))] : []));
  // How much each tyre scrubs under a direction (in the motions' coordinates).
  const scrubOf = (d: number[]) => scrub.map((row) => dot(row, d));
  const kept: number[][] = [];

  // Still directions that don't scrub.
  const stillScrub = still.map(scrubOf);
  const stillGram = still.map((_, i) => still.map((_, j) => dot(stillScrub[i], stillScrub[j])));
  const { values: sv, vectors: svecs } = symmetricEigen(stillGram);
  svecs.forEach((y, e) => {
    if (keepStill || sv[e] <= tiny) kept.push(combine(still, y));
  });

  // Moving directions, each with the still mix that cancels most of its scrub: z = -(YᵀY)⁻¹ Yᵀ x.
  const best = moving.map((c) => {
    if (still.length === 0) return c;
    const x = scrubOf(c);
    const z = combine(still, solveSymmetric(stillGram, still.map((_, i) => -dot(stillScrub[i], x)), tiny));
    return c.map((value, i) => value + z[i]);
  });
  const left = best.map(scrubOf);
  const leftGram = best.map((_, i) => best.map((_, j) => dot(left[i], left[j])));
  const { values: mv, vectors: mvecs } = symmetricEigen(leftGram);
  const least = Math.min(...mv);
  if (mv.length) needs.least = Math.sqrt(Math.max(0, least));
  const needed = rolling ?? least;
  const threshold = needed <= limit * limit ? Math.max(usual * usual, needed) : rolling === undefined ? -Infinity : usual * usual;
  mvecs.forEach((y, e) => {
    if (mv[e] <= threshold) kept.push(combine(best, y));
  });
  // With keepStill (the second pick, see freeMotionsApart), a direction that scrubs more than
  // that is dropped only for the travel a mix of the kept ones gives with less scrub: what's left
  // of it, once such a mix with the same travel is taken off, is kept if its tyres scrub no more
  // than `limit` for the travel that only it gives. Front wheels steered about their kingpins
  // travel a little, one forward and one back, which rolling can't give, and scrub a little for
  // it (the 8081 Extreme Cruiser); a chassis sliding sideways as it goes fore and aft travels
  // much as rolling does, and scrubs hundreds of times as far as the little travel only it gives
  // (the 42081 wheel loader).
  if (keepStill) {
    const travelOf = (d: number[]) => travel.map((row) => dot(row, d));
    const keptMoving = mvecs.filter((_, e) => mv[e] <= threshold).map((y) => combine(best, y));
    const over = mvecs.map((y, e) => ({ y, e })).filter(({ e }) => mv[e] > threshold).sort((a, b) => mv[a.e] - mv[b.e]);
    for (const { y } of over) {
      const c = combine(best, y);
      const tc = travelOf(c);
      const tk = keptMoving.map(travelOf);
      const a = tk.length ? solveSymmetric(tk.map((t) => tk.map((u) => dot(t, u))), tk.map((t) => dot(t, tc)), tiny) : [];
      const rest = c.map((x, i) => x - keptMoving.reduce((sum, d, j) => sum + a[j] * d[i], 0));
      const tr = travelOf(rest);
      const sr = scrubOf(rest);
      if (dot(tr, tr) > tiny && dot(sr, sr) <= limit * limit * dot(tr, tr)) {
        keptMoving.push(rest);
        kept.push(rest);
      }
    }
  }

  return orthonormalize(mixes(motions, kept));
}

