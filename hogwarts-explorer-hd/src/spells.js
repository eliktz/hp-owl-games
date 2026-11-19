// Spell challenge courses (brief 2026-11-15): each classroom teaches ONE spell, then a short
// challenge course uses only that spell. Inspired by the 2001 Philosopher's Stone game.
//
//   COURSES        data: the spell, the teacher, the room + lesson station, the lesson script
//                  (lines, targets) and the course (stations: walk path, camera, what to lift
//                  where, a little "after" effect). The props of a course are built by its
//                  build(kit) function from a tiny kit (one merged static mesh + a few movers).
//   the runner     one generic state machine: lesson -> course -> reward. start(key), quit(),
//                  state(), test hooks. It owns the hero + camera through main.js's takeover
//                  slot (like Quidditch), so the joystick / wand / other prompts never fight it.
//   verbs          a course's `verb` picks the gesture: 'lift' (Charms), 'push' (Defence) or 'light'
//                  (Astronomy). A push swipes along the thing's path as seen on screen (away from the
//                  hero), the ghost hand shows that direction; hold / tap / quick flick work the same for
//                  both. A light target stays put and its progress is how lit it is: touch it (keep the
//                  finger on it = brighter) or hold / tap the 🪄 button; let go and it fades slowly.
//                  A 'change' target (Transfiguration) also stays put; its progress is how far the
//                  change has gone: touch it and stir / scribble with the finger (accumulated finger
//                  travel, any direction), or keep the finger on it, or hold / tap the 🪄 button. It
//                  wobbles harder as it fills, sparkles spiral in; at the snap it pops (a puff) into its
//                  "after" shape (a second mover, or the same mesh with its geometry swapped). Let go
//                  early: it wobbles back down, never a drop. A glowing silhouette of the after shape
//                  floats above every open target (up to 3 ghosts) so the child knows what it becomes.
//                  A 'brew' target (Potions) is a cauldron and uses the change gesture code unchanged (stir,
//                  keep the finger on it, or the 🪄 button; CHANGE_* numbers); its look is the course's own:
//                  a ladle circles, the liquid blends from dull grey to the potion colour, two ingredients
//                  plop in at 1/3 and 2/3, bubbles rise; at the snap it puffs and glows (no outline, no ghost).
//                  A 'grow' target (Herbology) is a seedling that stays put: swipe UP from it (the lift drag: progress =
//                  pixels swiped up) and its plant (`to`) rises out of it following the finger; a tap = a third, holding the
//                  🪄 button grows it too. Let go early: it holds a moment, then sinks back slowly (no drop, no oops). At the
//                  snap the leaves pop, a sparkle, then the grown plant sways. A glowing silhouette shows the full plant.
//                  A 'pet' target (Creatures) is a creature: it uses the change gesture code unchanged (stroke it with the
//                  finger in any direction, keep the finger on it, or the 🪄 button; CHANGE_* numbers, PET_* settle-back). While
//                  its progress rises it leans into the finger and wiggles (posePet); its eyes, hearts and happy animation are
//                  the course's own (buildCreatures). No outline, no ghost. With a `to` shape (an egg) it hatches like a change.
//   outdoors       a course with `room: null` (Herbology) runs on the lawn by its teacher's outdoor station: the kit group
//                  sits in the scene at the station (worldOff = the station on the terrain), and every y in its data (lift
//                  paths, cameras) and its build (ctx.ground(x, z)) is height ABOVE THE TERRAIN at that x, z; the hero's
//                  auto-walk follows the terrain. It ends if the player goes indoors or is moved far away (> 60 m).
//   dim            a course with `dim: true` darkens the room through ONE reversible factor (dimApply)
//                  toward S.dimGoal (set by the course's tick), restored exactly on any leave.
//   the gesture    Wingardium Leviosa = "swish and flick": touch a glowing thing (or the big
//                  🪄 button) and swipe UP; or hold the 🪄 button; or tap it a few times. The
//                  thing rises along a path to a glowing outline and snaps when close. Let go
//                  too early and it hovers, then floats gently back down beside you: no fail.
//   reward         1-3 stars, house points through HPLessons.progress.bonus (the same pool the
//                  Entrance Hall hourglasses show), best stars saved in localStorage hpSpells1.
//
// Budget: everything a course draws is ~11 draw calls (Astronomy: 9) (one merged vertex-coloured static mesh,
// instanced feathers / blocks / rings, a handful of single movers, one outline, one sparkle
// instanced quad set with a 32 px canvas texture), built on start and disposed on leave or room exit.
// No per-frame allocations in update(): temp vectors and pre-sampled paths only.
import {
  Group, Mesh, InstancedMesh, BoxGeometry, CylinderGeometry, SphereGeometry, CircleGeometry, TorusGeometry, ConeGeometry, ShapeGeometry, Shape, PlaneGeometry, ExtrudeGeometry, TubeGeometry,
  MeshStandardMaterial, MeshBasicMaterial, BufferAttribute, CanvasTexture, SRGBColorSpace,
  Color, Vector3, Matrix4, Quaternion, Euler, CatmullRomCurve3, AdditiveBlending, NormalBlending, DoubleSide,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { animateChibi } from './chibi.js';
import * as fun from './fun.js';

const SAVE_KEY = 'hpSpells1';             // { charms: { stars, plays } } (new key; nothing else changes meaning)
const SNAP = 0.86;                        // lift progress at which the thing snaps into its outline
const HOVER = 1.1;                        // seconds a let-go thing hovers before it floats back down
const FALL = 0.4;                         // progress per second while floating back down
const HOLD = 1.0;                         // seconds of holding the 🪄 button for a full lift
const LIGHT_HOLD = 1.5, LIGHT_TAP = 0.4;   // Lumos: holding longer = brighter (full in 1.5 s); one tap = this much
const LIGHT_HOVER = 1.2, LIGHT_FALL = 0.22;   // a half-lit thing stays a moment, then fades slowly (retry any time)
const DIM_T = 1.5;                        // seconds for the room to dim / come back
const TAP = 0.34;                         // one tap on the 🪄 button lifts this much
const PUSH_HOVER = 0.6, PUSH_FALL = 0.55;  // a let-go push wobbles a moment, then slides back to its start
const CHANGE_HOLD = 1.6, CHANGE_TAP = 0.3;  // Vera Verto: a finger kept on the thing (or the 🪄 button) changes it in 1.6 s; a tap = this much
const CHANGE_STIR = 2.4;                  // ...or stir: this many gesture ranges of finger travel (any direction) for a full change
const CHANGE_HOVER = 0.8, CHANGE_FALL = 0.45;  // let go early: it wobbles a moment, then settles back (no penalty)
const GROW_HOLD = 1.3;                    // Herbivicus: holding the 🪄 button grows a plant in 1.3 s
const GROW_HOVER = 1.2, GROW_FALL = 0.3;  // let go early: the plant holds a moment, then sinks back slowly (no drop, no penalty)
const PET_HOVER = 1.0, PET_FALL = 0.25;   // Gentle care: let go early and the creature stays happy a moment, then settles back slowly
const POP = 0.5;                          // seconds of the pop: the before shape shrinks away, the after shape springs up
const HINT_AFTER = 4;                     // seconds of no input before the ghost hand shows
const WALK = 2.2;                         // auto-walk speed between stations (m/s)
const CREST = { gryf: '🦁', slyt: '🐍', rave: '🦅', huff: '🦡' };
// Difficulty levels (brief 2026-11-18). Level 1 is every course exactly as it was; levels 2 and 3 exist for a course
// once it has `levels: { 2: {...}, 3: {...} }` data (see COURSES.charms.levels for the shape). Every level-2/3 mechanic
// below is guarded on S.level > 1, never on the course.
const LEVELS = [null,
  { n: 1, he: 'שׁוּלְיָה', icon: '🪄', pts: 30 },
  { n: 2, he: 'תַּלְמִיד', icon: '📖', pts: 40 },
  { n: 3, he: 'קוֹסֵם', icon: '🧙‍♂️', pts: 50 }];
const RING_HOLD = 0.8;                     // level 3: seconds to hold a lifted thing inside its glowing ring
const RING_HALF = 0.125;                   // ...the ring window: +- this much of the path (a quarter of it)
const RING_OVER = 0.12;                    // ...pushed this far past the window: it slips and drifts back down
const MISS_GAP = 0.7;                      // seconds: a second wrong touch inside this counts once (a fumbling finger)
// levels 2-3: a timing gate. A target (or a station) with `gate: { period, open, lead?, R? }` is "ready" for `open` seconds
// of every `period` seconds of GAME time (S.clock, so _speed scales it too); the first window opens `lead` s after casting
// starts. Ready = its ring of beads turns green (a clock that fills while it waits), the thing glows green, a soft
// tick-tick-ding plays as the window opens; a course may add its own look from L.gateK (0 closed .. 1 open, eased).
// A push started while not ready fizzles softly: free twice per station, then a counted mistake. Once a push has started
// (p > 0.05) more touches on it are always fine, even if the window closes meanwhile (generous).
const GATE = { period: 3.2, open: 1.4, lead: 1.2, R: 0.42 };
const GATE_GREEN = 0x40ff70;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const starsOf = (v) => { v = Math.floor(Number(v)); return v >= 3 ? 3 : v >= 1 ? v : 0; };

// ---------------------------------------------------------------------------------------
// Course #1: Charms, Professor Flitwick, Wingardium Leviosa. Room-local metres (floor y 0)
// in the classroom wing (28 x 18 m, Charms corner x -9). Flitwick stands at (-9, -6.2);
// the course lives on the free floor south of the Charms desks (x -13.5..-4.5, z 0.5..8).
// ---------------------------------------------------------------------------------------
// Course #3 light targets ('bulbs', one instanced mesh) in the Astronomy tower (16 x 16 m, room-local,
// Sinistra at (-3.2, -4.6), the brass telescope at (4.6, -4.2)). The constellation's five stars hang in a
// plane square to the station-4 camera, so the cat they draw reads flat on screen.
const STAR_C = [0, 8.6, -4.2], STAR_V = [0, 0.814, 0.583], STAR_S = 1.5;
const starAt = (x, y) => [STAR_C[0] + x * STAR_S, STAR_C[1] + STAR_V[1] * y * STAR_S, STAR_C[2] + STAR_V[2] * y * STAR_S];
const CAT = [[-1.5, 1.3], [1.5, 1.3], [1.8, -0.5], [0, -1.6], [-1.8, -0.5]];   // ear, ear, cheek, chin, cheek
const ASTRO = {
  bulbs: [
    [-2.75, 0.94, -3.85, 1.0], [-2.2, 0.94, -3.85, 1.0], [-1.65, 0.94, -3.85, 1.0],       // 0-2 lesson lanterns on a low desk beside Sinistra
    [-7.22, 1.45, 1.2, 0.9], [-7.22, 1.95, -0.4, 0.9], [-7.22, 2.25, -2.0, 0.9],           // 3-5 sconces up the west stair
    [2.8, 1.4, -6.6, 1.1], [0.4, 1.4, -6.6, 1.1], [1.6, 1.75, -6.6, 1.1],                 // 6-8 star lamps (lit in this order)
    [6.75, 2.25, -6.75, 1.2],                                                             // 9 the lantern in the dark corner
    ...CAT.map(([x, y]) => [...starAt(x, y), 2.0]),                                       // 10-14 the constellation
    [6.0, 2.1, -3.2, 2.4],                                                                // 15 the big telescope lamp
    [0, 0, 0, 0.28], [0, 0, 0, 0.7], [0, 0, 0, 0.28],                                     // 16 hero wand tip, 17 the light orb, 18 Sinistra's wand tip
  ],
};
// Astronomy level 3 (brief 2026-11-18) adds two bulbs AFTER the tips (16-18), so levels 1-2 keep the very same set:
// 19 a fourth sconce at the foot of the stair, 20 a fourth star lamp east of the three
const ASTRO_X = [[-7.22, 1.2, 2.3, 0.9], [4.0, 1.75, -6.6, 1.1]];
const bulbAt = (i) => i < ASTRO.bulbs.length ? ASTRO.bulbs[i] : ASTRO_X[i - ASTRO.bulbs.length];
const bulbLift = (i) => ({ m: 'bulb' + i, path: [bulbAt(i).slice(0, 3)] });
// Course #4 places (classrooms, room-local): the book pile below the star shelf (west), the three pumpkins
// in the dim nook (east), the broken chair standing in the puddle (middle), the three pedestals by the
// south wall, the cat statue's plinth beside McGonagall (her desk at (0, -6.2)).
const TF = { pile: [-2.62, 0, 1.2], shelfX: -3.72, star: [-3.68, 1.98, 1.2], pumpkins: [[3.5, 0.55], [3.78, 1.3], [3.5, 2.05]],
  puddle: [0, 0, 3.6], peds: [-1.4, -2.6, -3.8], pedZ: 6.0, plinth: [-1.5, 0.5, -5.0], catSit: [-1.08, 0, -5.78] };
// Course #5 places (the Potions dungeon, 18 x 20 m room-local, Snape at (-2.6, -7.2) facing +z, his board behind him,
// the room's own domed cauldrons at (+-5, 3), (0, 3), (+-5, -2), (0, -2) and the big one at (0, -7), ingredient
// shelves along both side walls at z -5.2..-0.8, the doorway gap in the south wall at x -1.8..1.8). Every cauldron of
// the course is one instance of ONE pot mesh (index = POTS row): [x, y, z, scale, potion colour].
const PO_BIG = [-1.45, 0, -6.35];                      // Snape's own cauldron: his demo in the lesson, the finale
const POTS = [
  [-3.35, 0.42, -5.25, 0.7, 0xe8303a], [-2.7, 0.42, -5.25, 0.7, 0x3a72f0], [-2.05, 0.42, -5.25, 0.7, 0xf8d030],   // 0-2 the lesson bench: red, blue, yellow
  [PO_BIG[0], 0, PO_BIG[2], 1.7, 0x000000],                                                   // 3 the big one (rainbow at the finale)
  [-6.3, 0, -6.4, 1.0, 0x3ee05a],                                                             // 4 growing potion (green)
  [-8.05, 0, 7.0, 0.8, 0xffc830], [-7.55, 0, 8.15, 0.8, 0xffc830], [-6.55, 0, 8.85, 0.8, 0xffc830],   // 5-7 light potions -> lamps
  [-4.15, 0, 7.6, 1.0, 0xff7a1a],                                                             // 8 melting potion (warm orange)
  [3.3, 0, 9.0, 0.9, 0xe8303a], [4.5, 0, 9.0, 0.9, 0x3a72f0], [5.7, 0, 9.0, 0.9, 0xa040e8],   // 9-11 the colour match
];
const PO = { plant: [-7.15, 0, -6.4], ice: [-3.25, 0, 7.6], flagZ: 9.44, flagY: 1.8 };
const POT_R = 0.3, POT_C = 0.36, LIQ_Y = 0.486, RIM_Y = 0.536;   // the unit pot: bowl radius, bowl centre, liquid, rim heights
const brewLift = (i, o = {}) => { const P = POTS[i]; return { m: 'pot' + i, path: [[P[0], P[1], P[2]]], rot0: [0, 0, 0], rot1: [0, 0, 0], aimY: LIQ_Y * P[3], r: POT_R * P[3] * 1.15, ...o }; };

// Course #6 places: OUTDOORS on the lawn south of the greenhouse (the first outdoor course). Metres local to Sprout's
// lesson spot (her feet, STATIONS.herbology): x east, z south, away from the glass house (which spans x -3.5..3.5,
// z -6.1..-1.1); every y here, in the lift paths and in the cameras is height ABOVE THE TERRAIN at that x, z (the lawn
// falls ~1.5 cm per metre to the east, so beds and pots simply sit on it). Sprout stands at (0, 0) facing +z. The course
// goes out across the lawn (beanstalk, sunflowers, the stream and its vine bridge, the vegetable beds) and back to her.
const HB = {
  pots: [[-1.0, 0.5, 1.1, 0], [-0.45, 1.3, 0.62, 0.55], [0, 1.3, 0.62, 0.55], [0.45, 1.3, 0.62, 0.55], [1.5, 1.05, 1.7, 0]],   // x, z, scale, base height: Sprout's own pot, the 3 lesson pots (on the bench), the finale pot
  bench: [0, 1.3], bean: [-4.2, 4.5], post: [-4.85, 4.2, 2.6], sun: [[-5.3, 8.3], [-4.5, 8.3], [-3.7, 8.3]],
  stream: [0.7, 1.0, 6.5, 15.5], vine: [-0.3, 11.0], veg: [[3.1, 10.4], [4.4, 10.4], [5.7, 10.4]],
  stem: [1.461, 0.936], man: [1.552, 1.201],          // the finale pot: the giant flower's stem a little back, the mandrake in front (toward the camera)
};
const BED_SOIL = 0.17, POT_SOIL = 0.3, VINE_S = 1.95, BEAN_H = 2.6, GIANT_H = 2.0;
const archY = (u) => 0.3 * Math.pow(Math.max(0, Math.sin(Math.PI * u)), 0.7) - 0.09 * u;   // the vine bridge's deck, u 0..1 along its span
const potSoil = (i, x, z) => { const P = HB.pots[i]; return [x ?? P[0], P[3] + POT_SOIL * P[2], z ?? P[1]]; };
const growLift = (seed, to, at, o = {}) => ({ m: 'seed' + seed, to, path: [at], rot0: [0, seed * 1.3, 0], rot1: [0, 0, 0], aimY: 0.1, r: 0.22, ...o });

// Course #7 places: OUTDOORS round Hagrid's paddock (the pen of STATIONS.creatures: a fence ring r 3.2 at the origin, its own
// three critters are held out of the way while the course runs). Metres local to the pen centre: x east, z south, every y
// above the terrain (flat here: +-0.4 m over the whole course). Hagrid stands outside the fence at (-3, 2.4). The course goes
// west (the owl's post, the burrows), south (the stream bed, the egg nests) and back to Hagrid; nothing east of x 2 (where
// the hut stands when its model is present).
const CR = {
  hag: [-3, 2.4], bale: [-1.75, 4.95, 0.5], dog: [-4.35, 3.55, 0.75],
  puffs: [[-2.19, 5.19], [-1.75, 4.95], [-1.31, 4.71]],
  post: [-7.2, 3.6, 1.45], moles: [[-10.4, 6.6], [-9.4, 6.0], [-8.4, 6.6]],
  stream: [-12.6, 0.9, 5.5, 14.2], foal: [-11.6, 10.0],
  nests: [[-6.6, 12.0], [-5.6, 12.2], [-4.6, 12.0]], drag: [-0.7, 5.3], curl: [-1.5, 3.3],
  cams: { les: [0.5, 7.7], owl: [-6.2, 6.6], mole: [-10.0, 9.7], foal: [-12.2, 13.6], egg: [-5.2, 15.6], drag: [1.0, 7.8] },
};
const BALE_TOP = 0.42, MOUND_TOP = 0.136, NEST_Y = 0.09, MOLE_PEEK = -0.07;
const camYaw = (x, z, c) => Math.atan2(c[0] - x, c[1] - z);
const petLift = (m, x, y, z, yaw, o = {}) => ({ m, path: [[x, y, z]], rot0: [0, yaw, 0], rot1: [0, yaw, 0], aimY: 0.2, r: 0.26, ...o });

// Charms levels 2-3 (brief 2026-11-18). Level 3's shelf takes four books (four gaps), its bridge four blocks (four holes).
const CH3 = {
  gaps: [[1.405, 1.6], [1.405, 1.12], [0.745, 1.3], [0.745, 1.95]],         // shelf row, z: red, blue, green, gold
  bookHex: [0x2a5ad0, 0x2a9a3a, 0xe0a820],                                     // the xbook instances: blue, green, gold
  planks: [[-12.95, -12.842], [-12.402, -12.294], [-11.854, -11.746], [-11.306, -11.198], [-10.758, -10.65]],
  holes: [-12.622, -12.074, -11.526, -10.978],
};
const chBook = (m, z0, [y, g], o = {}) => ({ m, path: [[-12.5, 0.05, z0], [-12.75, y * 0.5 + 0.3, (z0 + g) / 2], [-13.0, y + 0.345, g], [-13.17, y + 0.155, g]], rot0: [Math.PI / 2, 0.3, 0], rot1: [0, 0, 0], ...o });
const CAT_SAY = 'שְׁשְׁשׁ... הֶחָתוּל יָשֵׁן!', CAUL_SAY = 'הַקַּלַּחַת כְּבֵדָה מִדַּי!';
const chCat = (i, x, z, cam) => ({ m: 'dcat' + i, at: [x, 0, z], ry: camYaw(x, z, cam), r: 0.3, aimY: 0.2, breathe: true, shakeMode: 'no', say: CAT_SAY });
const chCaul = (i, x, z) => ({ m: 'dcaul' + i, at: [x, 0, z], ry: 0, r: 0.3, aimY: 0.3, shakeMode: 'rattle', say: CAUL_SAY });
const CH_CAM = { shelf: [-8.4, -0.3], bridge: [-9.1, 8.5], arch: [-11.6, 8.7], chest: [-7.0, 8.6], rings: [-6.0, 5.6] };

// Defence levels 2-3 (brief 2026-11-18). The barrels station gets three free lanes (the south bale stands back, DF.bale2),
// painted barrels (red, blue, yellow, green) for the shown order; level 3 adds a fourth barrel in front of the middle one
// (so the blue one behind it must go first). The finish gets a round shield on a hinge post (DF.hinge) for the timing gate.
const DF = { bale2: 6.15, barrelHex: [0xc8503a, 0x3a78c8, 0xe0b030, 0x3aa050], hinge: [12.1, 3.0],
  cams: { gate: [6.0, -1.5], barrels: [11.4, 6.9], books: [10.0, 4.9], ball: [12.3, 8.4], finish: [10.5, 7.6] } };
const dfBarrel = (i, x0, x1, z) => ({ m: 'barrel' + i, path: [[x0, 0.3, z], [(x0 + x1) / 2, 0.3, z], [x1, 0.3, z]], rot0: [0, 0, 0], rot1: [0, 0, (x0 - x1) / 0.3] });
const FRIEND_SAY = 'אֲנִי חָבֵר!', CUPS_SAY = 'זְהִירוּת! הַסְּפָלִים יִשָּׁבְרוּ!', OWL_SAY = 'שְׁשְׁשׁ... הַיַּנְשׁוּף יָשֵׁן!';
const dfFriend = (i, x, z, cam) => ({ m: 'ddum' + i, at: [x, 0, z], ry: camYaw(x, z, cam), r: 0.3, aimY: 0.72, shakeMode: 'no', say: FRIEND_SAY });
const dfCups = (i, x, z) => ({ m: 'dcups' + i, at: [x, 0, z], ry: 0, r: 0.22, aimY: 0.6, shakeMode: 'rattle', say: CUPS_SAY });
const dfOwl = (i, x, z, cam, y = 0) => ({ m: 'dowl' + i, at: [x, y, z], ry: camYaw(x, z, cam), r: 0.25, aimY: 0.72, breathe: true, shakeMode: 'no', say: OWL_SAY });
const DF_HINTS = { decoy: 'לֹא אֶת זֶה! הַקְשֵׁב מָה לִדְחֹף!', slip: 'כִּמְעַט! עֲצֹר עַל הַסִּימָן!', slipMiss: 'לְאַט לְאַט... עֲצֹר עַל הַסִּימָן!' };
// Astronomy levels 2-3 (brief 2026-11-18). Decoys that fit a night tower and must NOT be lit: a sleeping bat hanging
// upside down from a little perch on a chain (lit: it squeaks, opens one eye, wraps its wings again; origin = the perch,
// the bat hangs below it, so aimY is negative) and a jar of moon-moths on a stool (they love the dark: it rattles).
// Both carry their own soft moonlit glow (the tower is dimmed). The sky's bats are big (scale 2.4: far up in the dome).
const AS_CAM = { stair: [-2.4, 3.4], lamps: [2.2, -1.2], corner: [3.2, -0.4], sky: [0, 6.6], telescope: [0.8, 0.9] };
const BAT_SAY = 'שְׁשְׁשׁ… הָעֲטַלֵּף יָשֵׁן!', MOTH_SAY = 'פַּרְפְּרֵי הַלַּיְלָה אוֹהֲבִים חֹשֶׁךְ!';
const asBat = (i, x, y, z, cam, s = 1.35) => ({ m: 'dbat' + i, at: [x, y, z], ry: camYaw(x, z, cam), r: 0.2 * s, aimY: -0.2 * s, breathe: true, shakeMode: 'no', say: BAT_SAY });
const asJar = (i, x, z, cam) => ({ m: 'djar' + i, at: [x, 0, z], ry: camYaw(x, z, cam), r: 0.22, aimY: 0.65, shakeMode: 'rattle', say: MOTH_SAY });
const AS_HINTS = { decoy: 'לֹא אֶת זֶה! רַק פָּנָסִים וְכוֹכָבִים!', order: 'לֹא בַּסֵּדֶר! מָה נִצְנֵץ קֹדֶם?' };
const AS_GATE = { period: 3.4, open: 1.6 };
// phone-height cameras (844x390): neighbouring targets / decoys >= ~70 px apart (iPad framing unchanged)
const DF_PHONE = { gate: { cam: { pos: [8.5, 1.8, 0.4], look: [10.3, 0.5, 1.5] } },
  barrels2: { cam: { pos: [10.9, 1.7, 5.1], look: [8.4, 0.4, 5.1] } }, barrels3: { cam: { pos: [10.5, 1.6, 3.6], look: [8.4, 0.4, 4.8] } } };

export const COURSES = {
  charms: {
    spell: { he: 'וִינְגַרְדְיוּם לֶבִיּוֹסָה', icon: '🪶', gesture: 'up' },
    title: 'אֶתְגַּר הַנּוֹצָה', name: 'אֶתְגָּר: לְחָשִׁים',
    teacher: 'flitwick', room: 'classrooms', station: 'charms',
    build: buildCharms,
    lesson: {
      stand: [-9, -3.55], face: [-9, -4.75],
      cam: { pos: [-5.6, 2.3, -2.9], look: [-9.3, 1.1, -5.0] },
      intro: [
        { pose: 'talk', line: 'שָׁלוֹם! הַיּוֹם נִלְמַד לְהָרִים דְּבָרִים בְּקֶסֶם!', t: 3.4 },
        { pose: 'cast', line: 'וִינְגַרְדְיוּם לֶבִיּוֹסָה!', t: 3.0, burst: [-9, 1.2, -4.75] },
        { pose: 'talk', line: 'עַכְשָׁו אַתָּה! גַּע בַּנּוֹצָה וְהַחְלֵק לְמַעְלָה!', t: 3.2 },
      ],
      lifts: [0, 1, 2].map(i => ({ m: 'feather' + i, flutter: true,
        path: [[-9.6 + i * 0.6, 0.8, -4.75], [-9.55 + i * 0.55, 1.4, -4.7], [-9.7 + i * 0.7, 2.2, -4.85]],
        rot0: [0, 0.3 - i * 0.3, 0], rot1: [0.2, 0.3 - i * 0.3, 0.5] })),
      outro: 'עַכְשָׁו — לָאֶתְגָּר!',
    },
    praise: ['יָפֶה מְאֹד!', 'מְצֻיָּן!', 'כָּל הַכָּבוֹד!', 'נִפְלָא!'],
    oops: 'אוּפְּס! נַסֵּה שׁוּב',
    finale: 'אַתָּה קוֹסֵם אֲמִתִּי!',
    course: {
      star3: 240,                         // seconds: 3 stars = finished within this with <= 2 drops
      stations: [
        { id: 'shelf', icon: '📚', say: 'הָרֵם אֶת הַסֵּפֶר לַמַּדָּף!',
          walk: [[-9.0, -2.4], [-9.3, 0.2], [-10.6, 1.6]], face: [-13, 1.6],
          cam: { pos: [-8.4, 2.3, -0.3], look: [-12.4, 1.1, 2.0] },
          lifts: [{ m: 'book', path: [[-11.9, 0.05, 1.6], [-12.3, 1.0, 1.75], [-13.0, 1.75, 1.7], [-13.17, 1.56, 1.6]], rot0: [Math.PI / 2, 0.3, 0], rot1: [0, 0, 0] }] },
        { id: 'bridge', icon: '🧱', say: 'בְּנֵה גֶּשֶׁר לַיַּנְשׁוּף!',
          walk: [[-9.6, 3.0], [-9.6, 6.0], [-11.8, 7.0]], face: [-11.8, 4.3],
          cam: { pos: [-9.1, 3.3, 8.5], look: [-11.8, 0.8, 4.6] },
          lifts: [0, 1, 2].map(i => ({ m: 'block' + i, path: [[-12.4 + i * 0.6, 0.2, 5.5], [-12.4 + i * 0.6, 1.5, 5.0], [-12.4 + i * 0.6, 0.79, 4.3]], rot0: [0, 0.35 - i * 0.3, 0], rot1: [0, 0, 0] })),
          after: 'owlCross' },
        { id: 'arch', icon: '🚪', say: 'הָרֵם אֶת הַכָּרִית מֵהַדֶּלֶת!',
          walk: [[-10.0, 6.7]], face: [-8, 6.7],
          cam: { pos: [-11.6, 2.5, 8.7], look: [-8.0, 1.5, 6.3] },
          lifts: [{ m: 'cushion', bob: true, path: [[-8.0, 1.0, 6.7], [-8.25, 2.1, 6.7], [-8.0, 2.95, 6.7], [-8.0, 2.47, 6.7]], rot0: [0, 0, 0], rot1: [0, 0.6, 0] }] },
        { id: 'chest', icon: '🔑', say: 'הָרֵם אֶת הַמַּפְתֵּחַ אֶל הַוָּו!',
          walk: [[-8.0, 6.7], [-6.6, 6.7], [-5.3, 6.1]], face: [-4.8, 3.6],
          cam: { pos: [-7.0, 2.3, 8.6], look: [-5.2, 1.5, 3.8] },
          lifts: [{ m: 'key', path: [[-5.0, 0.05, 4.9], [-5.1, 1.4, 4.4], [-4.6, 2.75, 3.75], [-4.5, 2.4, 3.6]], rot0: [Math.PI / 2, 0, 0.4], rot1: [0, 0, -Math.PI / 2] }],
          after: 'chestOpen' },
        { id: 'rings', icon: '🪶', say: 'הַעֲבֵר אֶת הַנּוֹצָה בַּטַּבָּעוֹת!',
          walk: [[-7.0, 5.0], [-7.2, 1.9]], face: [-8.4, -2],
          cam: { pos: [-6.0, 2.5, 5.6], look: [-8.8, 1.9, -1.4] },
          lifts: [{ m: 'feather3', flutter: true, rings: ['ring0', 'ring1', 'ring2'],
            path: [[-8.5, 0.87, 0.7], [-8.7, 1.3, 0.2], [-8.9, 1.8, -0.5], [-9.0, 2.5, -1.7], [-9.0, 3.1, -3.0], [-9.0, 3.3, -3.9]], rot0: [0, Math.PI / 2, 0], rot1: [0.1, Math.PI / 2, 0.35] }] },
      ],
    },
    // Difficulty levels. The data shape every course uses (level 1 = the course above, untouched):
    //   levels: { 2|3: { twist: the teacher's opening line, star3: seconds for 3 stars (with <= 2 mistakes),
    //     stations: { <station id>: { say?, lifts? (replaces the station's lifts), order?: [lift indices, shown first],
    //       decoys?: [{ m: mover, at: [x, y, z], ry, r, aimY, say, shakeMode: 'no'|'rattle', breathe }], hold?: ring centre 0..1 (level 3),
    //       gate?: { period, open, lead?, R? } (a timing gate on the station's things; a lift may carry its own `gate`), see GATE,
    //       phone?: { ...the same keys } (merged on top when the screen is phone-height, innerHeight < 500, at start) } },
    //     hints?: { <key>: line } (the teacher's level lines: decoy, order, again, go, slip, slipMiss, gate, gateMiss) } }
    // The decoy / extra movers come from the course's build(kit) when kit.level > 1.
    levels: {
      2: { twist: 'עַכְשָׁו בַּסֵּדֶר הַנָּכוֹן! שִׂים לֵב מָה מַבְהִיק!', star3: 300,
        stations: {
          shelf: { decoys: [chCat(0, -12.05, 0.75, CH_CAM.shelf), chCaul(0, -12.75, 0.35)] },
          bridge: { say: 'הָרֵם אֶת הַקֻּבִּיּוֹת בַּסֵּדֶר!', order: [1, 2, 0], decoys: [chCaul(1, -10.7, 4.95), chCat(1, -10.55, 6.0, CH_CAM.bridge)] },
          arch: { decoys: [chCat(2, -8.6, 7.95, CH_CAM.arch)] },
          chest: { decoys: [chCaul(2, -6.05, 5.0)] },
          rings: { decoys: [chCat(3, -9.35, 1.15, CH_CAM.rings), chCaul(3, -6.0, -0.9)] },
        } },
      3: { twist: 'עַכְשָׁו בְּזָהִירוּת: עֲצֹר בְּדִיּוּק בַּטַּבַּעַת!', star3: 420,
        stations: {
          shelf: { say: 'הַחְזֵר אֶת הַסְּפָרִים בַּסֵּדֶר!', hold: 0.42, ringR: 0.3,
            cam: { pos: [-9.9, 2.1, -0.1], look: [-12.6, 1.0, 1.3] },     // closer: four books on the floor need room on a phone
            lifts: [chBook('book', 0.8, CH3.gaps[0]), chBook('xbook0', 1.7, CH3.gaps[1]), chBook('xbook1', 0.35, CH3.gaps[2]), chBook('xbook2', 1.25, CH3.gaps[3])],
            order: [2, 0, 3, 1], decoys: [chCaul(0, -13.0, 0.25)],
            // phone-height screens: the books lie wider apart (0.65 m, same order along the floor) under a lower, closer camera
            phone: { cam: { pos: [-11.1, 2.1, 1.1], look: [-12.6, 1.2, 1.2] },
              lifts: [chBook('book', 0.55, CH3.gaps[0]), chBook('xbook0', 1.85, CH3.gaps[1]), chBook('xbook1', -0.1, CH3.gaps[2]), chBook('xbook2', 1.2, CH3.gaps[3])] } },
          bridge: { say: 'הָרֵם אֶת הַקֻּבִּיּוֹת בַּסֵּדֶר!', hold: 0.45, cam: { pos: [-9.9, 2.55, 7.35], look: [-11.8, 0.8, 4.6] },
            lifts: CH3.holes.map((x, i) => ({ m: 'block' + i, path: [[x, 0.2, 5.5], [x, 1.5, 5.0], [x, 0.79, 4.3]], rot0: [0, 0.35 - i * 0.25, 0], rot1: [0, 0, 0], ringR: 0.42 })),
            order: [3, 1, 0, 2], decoys: [chCat(0, -10.3, 6.05, CH_CAM.bridge), chCaul(1, -10.55, 4.95)],
            phone: { cam: { pos: [-12.4, 2.0, 6.6], look: [-11.8, 0.6, 4.6] } } },   // phone-height: from beside the hero, low over the blocks
          arch: { hold: 0.45, ringR: 0.55, decoys: [chCat(1, -8.6, 7.95, CH_CAM.arch), chCaul(2, -7.0, 7.9)] },
          chest: { hold: 0.45, ringR: 0.36, decoys: [chCaul(3, -6.05, 5.0), chCat(2, -4.05, 4.75, CH_CAM.chest)] },
          rings: { hold: 0.555, ringR: 0.64, decoys: [chCat(3, -9.35, 1.15, CH_CAM.rings), chCaul(4, -6.0, -0.9)] },   // the ring hold frames the middle ring
        } },
    },
  },
  // -------------------------------------------------------------------------------------
  // Course #2: Defence Against the Dark Arts, Tonks, Flipendo (a gentle push). Tonks stands at
  // (9, -6.2); the course lives on the free floor of the Defence corner (x 5.4..13.6, z 1..8.3)
  // and in the free east lane beside the desks (x 12..13.6) for the finish.
  // -------------------------------------------------------------------------------------
  defence: {
    spell: { he: 'פְלִיפֶּנְדוֹ', icon: '💨', gesture: 'push' },
    verb: 'push', who: '🧙‍♀️', pitch: 1.15, oneBubble: true,
    title: 'אֶתְגַּר הַדְּחִיפָה', name: 'אֶתְגָּר: הֲגַנָּה',
    teacher: 'defence', room: 'classrooms', station: 'spells',
    build: buildDefence,
    confetti: ['💨', '⭐', '✨', '🌟', '💚'],
    lesson: {
      stand: [9, -3.0], face: [9, -4.6], pip: '🎯',
      cam: { pos: [11.9, 3.3, -1.9], look: [8.8, 0.7, -5.0] },
      intro: [
        { pose: 'talk', line: 'שָׁלוֹם! הַיּוֹם נִלְמַד לִדְחֹף דְּבָרִים בְּקֶסֶם!', t: 3.4 },
        { pose: 'cast', line: 'פְלִיפֶּנְדוֹ!', t: 2.8, burst: [9, 1.0, -4.3] },
        { pose: 'talk', line: 'עַכְשָׁו אַתָּה! גַּע בַּבֻּבָּה וְהַחְלֵק קָדִימָה!', t: 3.2 },
      ],
      // three straw practice dummies topple softly back onto a blue mat
      lifts: [0, 1, 2].map(i => ({ m: 'dummy' + i, aimY: 0.7, dir: [0, 0, -1],
        path: [[8.2 + i * 0.8, 0, -4.2], [8.2 + i * 0.8, 0, -4.32], [8.2 + i * 0.8, 0.02, -4.45]], rot0: [0, 0, 0], rot1: [-1.25, 0.15 - i * 0.15, 0] })),
      outro: 'עַכְשָׁו — לָאֶתְגָּר!',
    },
    praise: ['יָפֶה מְאֹד!', 'מְצֻיָּן!', 'כָּל הַכָּבוֹד!', 'נִפְלָא!'],
    oops: 'אוּפְּס! נַסֵּה שׁוּב',
    finale: 'אַתָּה קוֹסֵם אַמִּיץ!',
    course: {
      star3: 240,
      stations: [
        { id: 'gate', icon: '📦', say: 'דְּחֹף אֶת הָאַרְגָּז מֵהַכַּפְתּוֹר!',
          walk: [[9.0, -2.2], [9.0, 0.4], [9.0, 1.6]], face: [12, 1.6],
          cam: { pos: [6.0, 3.6, -1.5], look: [10.3, 0.5, 2.1] },
          lifts: [{ m: 'crate', aimY: 0.4, path: [[10.1, 0.07, 1.6], [10.9, 0, 1.63], [11.7, 0, 1.6]], rot0: [0, 0, 0], rot1: [0, 0.3, 0] }],
          after: 'gateRise', afterSfx: 'chime' },
        { id: 'barrels', icon: '🛢️', say: 'פַּנֵּה אֶת הֶחָבִיּוֹת מֵהַדֶּרֶךְ!', inOrder: true,
          walk: [[9.0, 2.7], [10.3, 3.3], [10.6, 4.4]], face: [6, 4.4],
          cam: { pos: [11.4, 2.7, 6.9], look: [7.9, 0.5, 4.1] },
          lifts: [
            { m: 'barrel0', path: [[9.0, 0.81, 4.4], [8.4, 0.62, 4.4], [7.9, 0.3, 4.1], [6.95, 0.3, 3.55]], rot0: [0, 0, 0], rot1: [0, 0, 8.5] },
            { m: 'barrel1', path: [[8.68, 0.3, 4.4], [8.0, 0.3, 4.42], [7.6, 0.3, 4.45]], rot0: [0, 0, 0], rot1: [0, 0, 3.6] },
            { m: 'barrel2', path: [[9.32, 0.3, 4.4], [8.0, 0.3, 4.9], [6.95, 0.3, 5.35]], rot0: [0, 0, 0], rot1: [0, 0, 8.0] },
          ] },
        { id: 'books', icon: '📚', say: 'הַפֵּל אֶת הַסְּפָרִים עַד הַפַּעֲמוֹן!',
          walk: [[8.0, 4.4], [8.0, 6.6], [8.6, 7.6]], face: [12, 7.6],
          cam: { pos: [10.0, 2.3, 4.9], look: [10.5, 0.5, 7.6] },
          lifts: [{ m: 'domino0', aimY: 0.35, dir: [1, 0, 0], path: [[9.3, 0, 7.6], [9.33, 0, 7.6]], rot0: [0, 0, 0], rot1: [0, 0, -0.468] }],
          after: 'dominoes', afterT: 3.6, afterSfx: 'none' },
        { id: 'ball', icon: '🌉', say: 'גַּלְגֵּל אֶת הַכַּדּוּר אֶל הַקְּעָרָה!',
          walk: [[9.0, 8.2], [12.6, 8.3], [13.3, 8.3]], face: [13.3, 3],
          // behind the hero's left shoulder, looking down the groove: the ball big in front, the bowl
          // at the far end (from the old south-west view the far dummy sat mid-frame, the ball tiny)
          cam: { pos: [12.3, 2.6, 8.4], look: [13.3, 0.2, 6.0] },
          lifts: [{ m: 'ball', path: [[13.3, 0.17, 7.4], [13.3, 0.17, 5.5], [13.3, 0.15, 3.7], [13.3, 0.12, 3.45]], rot0: [0, 0, 0], rot1: [-23, 0, 0] }],
          after: 'bridgeDown', afterSfx: 'boing' },
        { id: 'finish', icon: '🏁', say: 'דְּחֹף אֶת הַבֻּבָּה אֶל קַו הַסִּיּוּם!',
          walk: [[12.75, 8.1], [12.75, 5.6]], face: [12.7, 0],
          cam: { pos: [10.5, 3.3, 7.6], look: [12.8, 0.6, 1.0] },
          lifts: [{ m: 'dummy3', aimY: 1.0, path: [[12.7, 0, 3.4], [12.7, 0.17, 2.5], [12.7, 0.17, 1.6], [12.7, 0, 0.6], [12.7, 0, -0.9]], rot0: [0, 0, 0], rot1: [0, 0, 0] }],
          after: 'bow', afterT: 2.6, afterSfx: 'tada', afterConfetti: ['🏁', '⭐', '✨'] },
      ],
    },
    // Difficulty levels (the shape: see COURSES.charms.levels). Level 2: the barrels in the shown order, a decoy or two at
    // every station. Level 3: four barrels (order shown once), push the crate and the ball onto a glowing mark and hold it
    // there, and the timing gate at the books and the finish (the shield swings aside).
    levels: {
      2: { twist: 'עַכְשָׁו בַּסֵּדֶר הַנָּכוֹן, וְרַק מָה שֶׁצָּרִיךְ!', star3: 300, hints: DF_HINTS,
        stations: {
          gate: { decoys: [dfFriend(0, 11.5, 0.5, DF.cams.gate), dfCups(0, 9.85, 0.45)], phone: DF_PHONE.gate },
          barrels: { say: 'דְּחֹף אֶת הֶחָבִיּוֹת בַּסֵּדֶר!', inOrder: false,
            lifts: [4.2, 4.85, 5.5].map((z, i) => dfBarrel(i, 9.0, 7.2, z)), order: [1, 2, 0],
            decoys: [dfOwl(0, 9.3, 3.55, DF.cams.barrels, 0.5), dfCups(1, 10.0, 5.6)], phone: DF_PHONE.barrels2 },
          books: { decoys: [dfFriend(1, 10.6, 8.45, DF.cams.books), dfCups(2, 9.25, 6.6)] },
          ball: { decoys: [dfCups(3, 12.55, 6.5)] },
          finish: { decoys: [dfFriend(2, 11.6, 3.7, DF.cams.finish), dfOwl(1, 11.35, 1.6, DF.cams.finish)] },
        } },
      3: { twist: 'עַכְשָׁו בְּדִיּוּק: דְּחֹף עַד הַסִּימָן וְחַכֵּה לָרֶגַע הַנָּכוֹן!', star3: 420, hints: DF_HINTS,
        stations: {
          gate: { say: 'דְּחֹף אֶת הָאַרְגָּז עַד הַסִּימָן וְחַכֵּה!', hold: 0.5, ringR: 0.5,
            decoys: [dfFriend(0, 11.5, 0.5, DF.cams.gate), dfCups(0, 9.85, 0.45)], phone: DF_PHONE.gate },
          barrels: { say: 'דְּחֹף אֶת הֶחָבִיּוֹת בַּסֵּדֶר!', inOrder: false,
            lifts: [...[4.2, 4.85, 5.5].map((z, i) => dfBarrel(i, 8.9, 7.2, z)), dfBarrel(3, 9.55, 7.85, 4.85)], order: [2, 1, 3, 0],
            decoys: [dfOwl(0, 9.3, 3.55, DF.cams.barrels, 0.5), dfCups(1, 10.0, 5.6)], phone: DF_PHONE.barrels3 },
          books: { say: 'חַכֵּה לַיָּרֹק... וְאָז דְּחֹף!', gate: { period: 3.2, open: 1.4 },
            decoys: [dfFriend(1, 10.6, 8.45, DF.cams.books), dfOwl(2, 11.9, 8.4, DF.cams.books)] },
          ball: { say: 'גַּלְגֵּל עַד הַסִּימָן וְחַכֵּה!', hold: 0.45, ringR: 0.32,
            decoys: [dfCups(3, 12.55, 6.5), dfFriend(3, 12.35, 5.2, DF.cams.ball)] },
          finish: { say: 'חַכֵּה שֶׁהַמָּגֵן יָזוּז... וְאָז דְּחֹף!', gate: { period: 3.2, open: 1.4, R: 0.5 },
            decoys: [dfFriend(2, 11.6, 3.7, DF.cams.finish), dfOwl(1, 11.35, 1.6, DF.cams.finish)] },
        } },
    },
  },
  // -------------------------------------------------------------------------------------
  // Course #3: Astronomy, Professor Sinistra (a code-drawn chibi), Lumos. The tower dims when the
  // course starts (one reversible `dim` factor, see dimApply) and every light the child makes brings
  // some of it back; the big telescope lamp brings it all back and fills the dome with stars.
  // -------------------------------------------------------------------------------------
  astronomy: {
    spell: { he: 'לוּמוֹס', icon: '🌟', gesture: 'light' },
    verb: 'light', who: '🧙🏾‍♀️', pitch: 1.2, oneBubble: true, dim: true,
    title: 'אֶתְגַּר הָאוֹר', name: 'אֶתְגָּר: כּוֹכָבִים',
    teacher: 'sinistra', room: 'tower', station: 'astronomy',
    build: buildAstronomy,
    confetti: ['🌟', '⭐', '✨', '💫', '💛'],
    lesson: {
      stand: [-1.5, -2.3], face: [-2.4, -4.2], pip: '🏮',
      cam: { pos: [-4.9, 2.1, -0.6], look: [-2.3, 1.0, -4.3] },
      intro: [
        { pose: 'talk', line: 'שָׁלוֹם! הַמִּגְדָּל חָשׁוּךְ הַלַּיְלָה.', t: 3.0 },
        { pose: 'talk', line: 'בּוֹא נִלְמַד לְהַדְלִיק אוֹר בְּקֶסֶם!', t: 3.0 },
        { pose: 'cast', line: 'לוּמוֹס!', t: 3.0 },
        { pose: 'talk', line: 'עַכְשָׁו אַתָּה! גַּע בַּפָּנָס וְהַחְזֵק!', t: 3.2 },
      ],
      lifts: [0, 1, 2].map(bulbLift),
      outro: 'עַכְשָׁו — לָאֶתְגָּר!',
    },
    praise: ['יָפֶה מְאֹד!', 'מְצֻיָּן!', 'כָּל הַכָּבוֹד!', 'נִפְלָא!'],
    oops: 'נַסֵּה שׁוּב',
    finale: 'הֵאַרְתָּ אֶת כָּל הַמִּגְדָּל!',
    course: {
      star3: 240,
      stations: [
        { id: 'stair', icon: '🕯️', say: 'הַדְלֵק אֶת הַפָּנָסִים בַּמַּדְרֵגוֹת!',
          walk: [[-3.6, -0.8], [-4.7, 0.8]], face: [-7.2, 0.0],
          cam: { pos: [-2.4, 2.4, 3.4], look: [-6.6, 1.6, -0.6] },
          lifts: [3, 4, 5].map(bulbLift), after: 'stairPath', afterT: 2.0, afterSfx: 'chime' },
        { id: 'lamps', icon: '⭐', say: 'הַדְלֵק אֶת הַכּוֹכָב שֶׁמְּנַצְנֵץ!', inOrder: true,
          walk: [[-2.5, -0.6], [-0.6, -2.6], [-0.5, -4.0]], face: [1.6, -6.6],
          cam: { pos: [2.2, 2.3, -1.2], look: [1.4, 1.35, -6.4] },
          lifts: [6, 7, 8].map(bulbLift), after: 'lampChord', afterT: 1.8, afterSfx: 'none' },
        { id: 'corner', icon: '🦉', say: 'הָאֵר אֶת הַפִּנָּה הַחֲשׁוּכָה!',
          walk: [[3.2, -2.4], [5.6, -2.0]], face: [6.75, -6.75],
          cam: { pos: [3.2, 2.3, -0.4], look: [6.6, 1.3, -6.4] },
          lifts: [bulbLift(9)], after: 'owlWake', afterT: 3.2, afterSfx: 'none' },
        { id: 'sky', icon: '🐱', say: 'הַדְלֵק אֶת הַכּוֹכָבִים בַּשָּׁמַיִם!',
          walk: [[3.0, -0.6], [0, -0.4]], face: [0, -4],
          cam: { pos: [0, 2.2, 6.6], look: [0, 6.8, -4.2] },     // Harry's head and shoulders at the bottom, the cat above
          lifts: [10, 11, 12, 13, 14].map(bulbLift), after: 'catShine', afterT: 2.6, afterSfx: 'none' },
        { id: 'telescope', icon: '🔭', say: 'הַדְלֵק אֶת הַמְּנוֹרָה הַגְּדוֹלָה!',
          walk: [[2.2, 0.2], [3.4, -1.2]], face: [6.0, -3.2],
          cam: { pos: [0.8, 2.3, 0.9], look: [5.4, 1.9, -3.6] },
          afterCam: { pos: [0.6, 1.8, 4.4], look: [0.8, 8.6, -3.8] },
          lifts: [bulbLift(15)], after: 'skyFill', afterT: 4.2, afterSfx: 'tada', afterConfetti: ['🌟', '⭐', '✨', '🔭'] },
      ],
    },
    // Difficulty levels (the shape: see COURSES.charms.levels; `pre`: lamps of the station already lit when it starts).
    // Level 2: the lamps in the order the stars show (each twinkles in turn), 3 at the stair and the star lamps, 4 at the
    // constellation (its chin star already shines); a bat / a moth jar or two at every station. Level 3: a fourth sconce
    // and a fourth star lamp, orders of 4 and 5 shown once, the constellation drawn line by line (the order traces the cat),
    // and the timing gate at the owl's lantern (a little cloud drifts over it) and at the big lamp (its shutter turns).
    levels: {
      2: { twist: 'עַכְשָׁו בַּסֵּדֶר שֶׁהַכּוֹכָבִים מַרְאִים!', star3: 300, hints: AS_HINTS,
        stations: {
          stair: { say: 'הַדְלֵק אֶת הַפָּנָסִים בַּסֵּדֶר!', order: [2, 0, 1],
            decoys: [asBat(0, -6.4, 3.3, 0.9, AS_CAM.stair), asJar(0, -5.9, 0.3, AS_CAM.stair)] },
          lamps: { say: 'הַדְלֵק אֶת הַמְּנוֹרוֹת בַּסֵּדֶר!', inOrder: false, order: [2, 0, 1],
            decoys: [asBat(1, -0.5, 2.8, -6.9, AS_CAM.lamps), asJar(1, 2.2, -5.3, AS_CAM.lamps)] },
          corner: { decoys: [asBat(2, 5.0, 3.0, -7.1, AS_CAM.corner)] },
          sky: { say: 'הַדְלֵק אֶת הַכּוֹכָבִים בַּסֵּדֶר!', pre: [3], order: [4, 0, 1, 2],
            decoys: [asBat(4, -5.6, 8.48, -3.8, AS_CAM.sky, 2.4)] },
          telescope: { decoys: [asJar(2, 2.6, -3.8, AS_CAM.telescope)] },
        } },
      3: { twist: 'עַכְשָׁו מֵהַזִּכָּרוֹן: צַיֵּר אֶת קְבוּצַת הַכּוֹכָבִים!', star3: 420, hints: AS_HINTS,
        stations: {
          stair: { say: 'זְכֹר אֶת הַסֵּדֶר וְהַדְלֵק!', lifts: [3, 4, 5, 19].map(bulbLift), order: [1, 3, 2, 0],
            decoys: [asBat(0, -6.4, 3.3, 0.9, AS_CAM.stair), asJar(0, -5.9, 0.3, AS_CAM.stair)] },
          lamps: { say: 'זְכֹר אֶת הַסֵּדֶר וְהַדְלֵק!', inOrder: false, lifts: [6, 7, 8, 20].map(bulbLift), order: [2, 3, 1, 0],
            decoys: [asBat(1, -0.5, 2.8, -6.9, AS_CAM.lamps), asJar(1, 2.2, -5.3, AS_CAM.lamps)] },
          corner: { say: 'חַכֵּה שֶׁהֶעָנָן יָזוּז... וְאָז הַדְלֵק!', gate: { ...AS_GATE, R: 0.55 },
            decoys: [asBat(2, 5.0, 3.0, -7.1, AS_CAM.corner), asJar(2, 7.1, -5.4, AS_CAM.corner)] },
          sky: { say: 'צַיֵּר אֶת הֶחָתוּל: כּוֹכָב אַחֲרֵי כּוֹכָב!', order: [1, 0, 4, 3, 2],
            decoys: [asBat(4, -5.6, 8.48, -3.8, AS_CAM.sky, 2.4), asBat(5, 5.6, 8.48, -3.8, AS_CAM.sky, 2.4)] },
          telescope: { say: 'חַכֵּה שֶׁהַתְּרִיס יִפָּתַח... וְאָז הַדְלֵק!', gate: { ...AS_GATE, R: 0.62 },
            decoys: [asBat(3, 4.6, 3.4, -5.2, AS_CAM.telescope), asJar(3, 2.6, -3.8, AS_CAM.telescope)] },
        } },
    },
  },
  // -------------------------------------------------------------------------------------
  // Course #4: Transfiguration, Professor McGonagall, Vera Verto (verb 'change'). McGonagall stands at
  // (0, -6.2) in the classrooms; the lesson table is in front of her, the course lives in the free centre
  // lane south of her desks (x -4..4, z 0.5..6.3: book stairs west, the dim nook east, the puddle in the
  // middle, three pedestals by the south wall) and the finale is back beside her (the statue plinth).
  // -------------------------------------------------------------------------------------
  transfiguration: {
    spell: { he: 'וֵרָה וֵרְטוֹ', icon: '🐱', gesture: 'change' },
    verb: 'change', who: '🧙‍♀️', pitch: 1.05, oneBubble: true,
    title: 'שִׁנּוּי צוּרָה', name: 'אֶתְגָּר: שִׁנּוּי צוּרָה',
    teacher: 'mcgon', room: 'classrooms', station: 'transfiguration',
    build: buildTransfiguration,
    confetti: ['🐱', '⭐', '✨', '🐭', '💛'],
    lesson: {
      stand: [0, -3.55], face: [0, -4.75], pip: '☕',
      cam: { pos: [1.75, 1.95, -2.45], look: [-0.05, 0.95, -5.25] },
      intro: [
        { pose: 'talk', line: 'שָׁלוֹם! הַיּוֹם נִלְמַד לְשַׁנּוֹת צוּרָה!', t: 3.2 },
        { pose: 'cast', line: 'וֵרָה וֵרְטוֹ!', t: 3.6, fx: 'demo' },
        { pose: 'talk', line: 'רָאִיתָ? הַגָּבִיעַ הָפַךְ לְצִפּוֹר!', t: 3.0 },
        { pose: 'talk', line: 'עַכְשָׁו אַתָּה! גַּע בַּסֵּפֶל וְסוֹבֵב בָּאֶצְבַּע!', t: 3.4 },
      ],
      // three teacups become three little mice that scurry in a circle and sit up
      lifts: [0, 1, 2].map(i => ({ m: 'cup' + i, to: 'mouse' + i, path: [[-0.5 + i * 0.45, 0.78, -4.72]], rot0: [0, 0.4, 0], rot1: [0, 0.25 - i * 0.25, 0],
        aimY: 0.12, hint: 0.42, r: 0.24, free: true })),
      outro: 'עַכְשָׁו — לָאֶתְגָּר!',
    },
    praise: ['יָפֶה מְאֹד!', 'מְצֻיָּן!', 'כָּל הַכָּבוֹד!', 'נִפְלָא!'],
    oops: 'נַסֵּה שׁוּב',
    finale: 'אַתָּה קוֹסֵם מֻפְלָא!',
    course: {
      star3: 240,
      stations: [
        { id: 'stairs', icon: '📚', say: 'הֲפֹךְ אֶת הַסְּפָרִים לְמַדְרֵגוֹת!',
          walk: [[0, -2.0], [0, 0.4], [-1.05, 1.35]], face: [-3.6, 1.2],
          cam: { pos: [0.9, 2.3, 3.9], look: [-2.7, 1.0, 1.0] },
          lifts: [{ m: 'books', to: 'steps', path: [TF.pile], rot0: [0, 0, 0], rot1: [0, 0, 0], aimY: 0.35, hint: 1.25, hs: 0.45, r: 0.6 }],
          after: 'starHop', afterT: 2.6, afterSfx: 'none' },
        { id: 'lanterns', icon: '🎃', say: 'הֲפֹךְ אֶת הַדְּלָעוֹת לְפָנָסִים!',
          walk: [[0.2, 1.4], [1.35, 1.3]], face: [3.7, 1.3],
          cam: { pos: [-0.5, 2.4, 3.9], look: [3.4, 0.6, 1.1] },
          lifts: TF.pumpkins.map(([x, z], i) => ({ m: 'pumpkin' + i, to: 'lantern' + i, path: [[x, 0, z]], rot0: [0, -1.2 + i * 0.5, 0], rot1: [0, -Math.PI / 2, 0],
            aimY: 0.2, hint: 0.85, r: 0.3 })),
          after: 'lampGlow', afterT: 2.0, afterSfx: 'none' },
        { id: 'bridge', icon: '🌉', say: 'הֲפֹךְ אֶת הַכִּסֵּא לְגֶשֶׁר!',
          walk: [[0.6, 1.7], [0, 2.1]], face: [0, 3.6],
          cam: { pos: [-1.35, 2.45, 0.7], look: [0.1, 0.2, 3.7] },
          lifts: [{ m: 'chair', to: 'bridge', path: [TF.puddle], rot0: [0, 0.5, 0.07], rot1: [0, 0, 0], aimY: 0.4, hint: 1.05, hs: 0.6, r: 0.45 }],
          after: 'bridgeSettle', afterT: 1.6, afterSfx: 'boing' },
        { id: 'shapes', icon: '🎩', say: 'הֲפֹךְ כָּל דָּבָר לַצּוּרָה שֶׁמֵּעָלָיו!',
          walk: [[0, 2.6], [0, 4.2], [-0.85, 4.35]], face: [-2.6, 6.0],
          cam: { pos: [0.7, 2.2, 4.2], look: [-2.5, 0.85, 6.1] },     // from the east: the three pedestals in a row against the wall, the hero at the side
          lifts: [
            { m: 'hat', to: 'rabbit', path: [[TF.peds[0], 0.78, TF.pedZ]], rot0: [0, 2.07, 0], rot1: [0, 1.9, 0], aimY: 0.16, hint: 0.66, r: 0.26, free: true },
            { m: 'feather', to: 'quill', path: [[TF.peds[1], 0.78, TF.pedZ]], rot0: [0, 2.07, 0], rot1: [0, 2.07, 0], aimY: 0.2, hint: 0.78, hs: 1.15, r: 0.26, free: true },
            { m: 'button', to: 'beetle', path: [[TF.peds[2], 0.78, TF.pedZ]], rot0: [0, 2.07, 0], rot1: [0, 2.4, 0], aimY: 0.15, hint: 0.62, r: 0.26, free: true },
          ],
          after: 'parade', afterT: 2.6, afterSfx: 'chime' },
        { id: 'cat', icon: '🐱', say: 'הֲפֹךְ אֶת הַפֶּסֶל לְחָתוּל!',
          walk: [[-0.3, 4.0], [0, 2.6], [0, 0.0], [0.2, -3.3]], face: [TF.plinth[0], TF.plinth[2]],
          cam: { pos: [-0.9, 2.3, -1.0], look: [-0.75, 0.85, -5.3] },        // the statue mid-frame, McGonagall beside it, the hero to the right
          afterCam: { pos: [-0.3, 1.8, -1.9], look: [-0.7, 0.75, -5.6] },
          lifts: [{ m: 'statue', to: 'tabby', path: [[TF.plinth[0], TF.plinth[1], TF.plinth[2]]], rot0: [0, 0.6, 0], rot1: [0, 0.6, 0], aimY: 0.45, hint: 1.25, hs: 0.6, r: 0.5, free: true }],
          after: 'catWake', afterT: 5.4, afterSfx: 'none', afterLine: 'אֵיזֶה חָתוּל נֶחְמָד!', afterLineT: 3.6 },
      ],
    },
  },
  // -------------------------------------------------------------------------------------
  // Course #5: Potions, Professor Snape, the dungeon (verb 'brew': stir a cauldron with the finger). The lesson
  // bench is in front of Snape, his own big cauldron at his side; the course goes round the cellar: the wilted
  // plant (north-west), the dark corner (south-west), the ice block (south), the pennants on the south wall
  // (south-east), and back to Snape's big cauldron for the finale.
  // -------------------------------------------------------------------------------------
  potions: {
    spell: { he: 'שִׁקּוּיִים', icon: '⚗️', gesture: 'brew' },
    verb: 'brew', who: '🧙‍♂️', pitch: 0.85, oneBubble: true,
    title: 'שִׁקּוּיִים', name: 'אֶתְגָּר: שִׁקּוּיִים',
    teacher: 'snape', room: 'dungeon', station: 'potions',
    build: buildPotions,
    confetti: ['⚗️', '⭐', '✨', '🐸', '💚'],
    lesson: {
      stand: [-2.7, -4.1], face: [-2.7, -5.3], pip: '🧪',
      cam: { pos: [-0.95, 1.95, -3.0], look: [-2.6, 0.95, -5.9] },
      intro: [
        { pose: 'talk', line: 'שָׁלוֹם. הַיּוֹם נִרְקַח שִׁקּוּיִים!', t: 3.0 },
        { pose: 'cast', line: 'בּוֹחֲשִׁים… בְּסַבְלָנוּת!', t: 3.6, fx: 'demo' },
        { pose: 'talk', line: 'רָאִיתָ? הַשִּׁקּוּי הָפַךְ לְיָרֹק!', t: 3.0 },
        { pose: 'talk', line: 'עַכְשָׁו אַתָּה! גַּע בַּקְּדֵרָה וּבְחֹשׁ בָּאֶצְבַּע!', t: 3.4 },
      ],
      // three little cauldrons on the bench brew red, blue and yellow
      lifts: [0, 1, 2].map(i => brewLift(i)),
      outro: 'עַכְשָׁו — לָאֶתְגָּר!',
    },
    praise: ['יָפֶה מְאֹד!', 'מְצֻיָּן!', 'כָּל הַכָּבוֹד!', 'נִפְלָא!'],
    oops: 'נַסֵּה שׁוּב',
    finale: 'אַתָּה רוֹקֵחַ שִׁקּוּיִים אֲמִתִּי!',
    course: {
      star3: 240,
      stations: [
        { id: 'grow', icon: '🌱', say: 'בְּחֹשׁ שִׁקּוּי לַפֶּרַח הַנָּבוּל!',
          walk: [[-4.2, -4.6], [-5.3, -5.9]], face: [-6.6, -6.4],
          cam: { pos: [-6.0, 2.3, -3.2], look: [-6.7, 0.95, -6.6] },
          lifts: [brewLift(4)], after: 'growPour', afterT: 5.0, afterSfx: 'none' },
        { id: 'lamps', icon: '🏮', say: 'בְּחֹשׁ שִׁקּוּי אוֹר לַפִּנָּה הַחֲשׁוּכָה!',
          walk: [[-6.3, -4.6], [-6.6, -1.0], [-6.6, 3.6], [-6.2, 5.2]], face: [-7.5, 8.0],
          cam: { pos: [-3.6, 2.3, 4.9], look: [-7.4, 0.8, 8.0] },
          lifts: [5, 6, 7].map((i, j) => brewLift(i, { to: 'jar' + j, rot1: [0, 0.6, 0] })), after: 'lampChord', afterT: 2.0, afterSfx: 'none' },
        { id: 'ice', icon: '🧊', say: 'בְּחֹשׁ שִׁקּוּי שֶׁמַּמִּיס אֶת הַקֶּרַח!',
          walk: [[-4.6, 5.6], [-3.0, 5.8]], face: [-3.6, 7.6],
          cam: { pos: [-1.4, 2.3, 4.6], look: [-3.5, 0.7, 7.7] },
          lifts: [brewLift(8)], after: 'meltPour', afterT: 4.6, afterSfx: 'none' },
        { id: 'colors', icon: '🎨', say: 'בְּחֹשׁ כָּל קְדֵרָה לַצֶּבַע שֶׁמֵּעָלֶיהָ!',
          walk: [[-1.0, 5.4], [2.0, 5.6], [5.9, 6.6]], face: [4.5, 8.8],
          cam: { pos: [4.6, 2.3, 4.4], look: [4.3, 1.1, 9.0] },
          lifts: [9, 10, 11].map(i => brewLift(i)), after: 'flagWave', afterT: 2.6, afterSfx: 'none' },
        { id: 'toad', icon: '🐸', say: 'בְּחֹשׁ אֶת הַקְּדֵרָה הַגְּדוֹלָה!',
          walk: [[2.6, 5.0], [2.5, 0.5], [1.6, -3.4], [-0.5, -5.2]], face: [PO_BIG[0], PO_BIG[2]],
          cam: { pos: [-3.4, 2.2, -2.6], look: [-1.4, 1.0, -6.4] },
          afterCam: { pos: [-3.9, 1.7, -1.9], look: [-1.5, 2.0, -6.6] },
          lifts: [brewLift(3)], after: 'toadHop', afterT: 5.4, afterSfx: 'none', afterLine: 'לֹא רַע… לֹא רַע בִּכְלָל.', afterLineT: 1.9 },
      ],
    },
  },
  // -------------------------------------------------------------------------------------
  // Course #6: Herbology, Professor Sprout, OUTDOORS by the greenhouse (verb 'grow': swipe up from a seedling and it
  // grows). room null = the course runs on the lawn at her outdoor station (see HB for the places).
  // -------------------------------------------------------------------------------------
  herbology: {
    spell: { he: 'הֶרְבִּיוִיקוּס', icon: '🌱', gesture: 'grow' },
    verb: 'grow', who: '🧙‍♀️', pitch: 1.15, oneBubble: true,
    title: 'תּוֹרַת הַצְּמָחִים', name: 'אֶתְגָּר: צְמָחִים',
    teacher: 'sprout', room: null, station: 'herbology',
    build: buildHerbology,
    confetti: ['🌱', '⭐', '🌻', '🌸', '💚'],
    lesson: {
      stand: [-0.55, 2.5], face: [-0.2, 1.3], pip: '🌱',
      cam: { pos: [2.5, 1.95, 4.8], look: [-0.25, 0.95, 0.7] },
      intro: [
        { pose: 'talk', line: 'שָׁלוֹם, יַקִּירִי! הַיּוֹם נְגַדֵּל צְמָחִים בְּקֶסֶם!', t: 3.4 },
        { pose: 'cast', line: 'הֶרְבִּיוִיקוּס!', t: 3.6, fx: 'demo' },
        { pose: 'talk', line: 'רָאִיתָ? הַנֶּבֶט גָּדַל לְחַמָּנִית!', t: 3.0 },
        { pose: 'talk', line: 'עַכְשָׁו אַתָּה! גַּע בַּנֶּבֶט וּמְשֹׁךְ לְמַעְלָה!', t: 3.4 },
      ],
      // three seedlings in little pots on the bench: a tulip, a daisy, a little fern
      lifts: ['tulip', 'daisy', 'fern'].map((to, j) => growLift(1 + j, to, potSoil(1 + j), { rot1: [0, 0.6, 0], top: 0.45, free: true })),
      outro: 'עַכְשָׁו — לָאֶתְגָּר!',
    },
    praise: ['יָפֶה מְאֹד!', 'מְצֻיָּן!', 'כָּל הַכָּבוֹד!', 'נִפְלָא!'],
    oops: 'נַסֵּה שׁוּב',
    finale: 'אַתָּה גַּנָּן קוֹסֵם!',
    course: {
      star3: 240,
      stations: [
        { id: 'bean', icon: '⭐', say: 'גַּדֵּל שְׁעוּעִית עַד הַכּוֹכָב!',
          walk: [[-1.5, 3.6], [-2.5, 4.45]], face: [HB.bean[0], HB.bean[1]],
          cam: { pos: [-1.5, 2.0, 8.7], look: [-4.3, 1.45, 4.3] },
          lifts: [growLift(4, 'bean', [HB.bean[0], BED_SOIL, HB.bean[1]], { top: BEAN_H, r: 0.3 })],
          after: 'starSlide', afterT: 4.6, afterSfx: 'none' },
        { id: 'sun', icon: '🌻', say: 'גַּדֵּל שָׁלוֹשׁ חַמָּנִיּוֹת!',
          walk: [[-2.3, 6.2], [-2.5, 9.6]], face: [-4.5, 8.3],
          cam: { pos: [-3.7, 2.3, 13.4], look: [-4.2, 1.0, 8.4] },
          lifts: HB.sun.map(([x, z], j) => growLift(5 + j, 'sunf' + (j + 1), [x, BED_SOIL, z], { rot1: [0, 0.6, 0], top: 1.55 })),
          after: 'sunTurn', afterT: 3.4, afterSfx: 'none' },
        { id: 'vine', icon: '🌉', say: 'גַּדֵּל גֶּשֶׁר מֵעַל הַנַּחַל!',
          walk: [[-2.4, 11.4], [-1.35, 11.9]], face: [HB.stream[0], HB.vine[1]],
          cam: { pos: [-0.1, 2.2, 15.5], look: [0.25, 0.6, 10.7] },     // from the south, up the stream: the bridge will span the view
          lifts: [growLift(8, 'vine', [HB.vine[0], 0.08, HB.vine[1]], { rot1: [0, 0, Math.PI / 2], top: VINE_S, r: 0.26 })],
          after: 'vineLay', afterT: 4.4, afterSfx: 'none' },
        { id: 'veg', icon: '🥕', say: 'גַּדֵּל כָּל יָרָק לְפִי הַשֶּׁלֶט!',
          walk: [[-0.9, 11.0], [2.1, 11.0], [3.7, 12.4], [6.6, 12.2]], face: [4.4, 10.4],
          cam: { pos: [3.0, 2.0, 14.9], look: [4.7, 0.6, 10.5] },
          lifts: ['carrot', 'pumpkin', 'berry'].map((to, j) => growLift(9 + j, to, [HB.veg[j][0], BED_SOIL, HB.veg[j][1]], { rot1: [0, -0.3, 0], top: 0.5, free: true })),
          after: 'vegBounce', afterT: 2.8, afterSfx: 'none' },
        { id: 'flower', icon: '🌸', say: 'גַּדֵּל אֶת הַפֶּרַח הַגָּדוֹל!',
          walk: [[5.2, 8.0], [3.6, 4.0], [2.9, 1.4]], face: [HB.pots[4][0], HB.pots[4][1]],
          cam: { pos: [3.3, 2.0, 5.9], look: [0.9, 1.4, 0.9] },
          afterCam: { pos: [3.4, 1.9, 5.5], look: [1.0, 1.5, 0.8] },
          lifts: [growLift(12, 'giant', potSoil(4, HB.stem[0], HB.stem[1]), { rot1: [0, 0.33, 0], top: GIANT_H + 0.3, r: 0.35, aimY: 0.12 })],
          after: 'mandrake', afterT: 5.8, afterSfx: 'none', afterLine: 'אֵיזֶה גַּן נִפְלָא!', afterLineT: 3.6 },
      ],
    },
  },
  // -------------------------------------------------------------------------------------
  // Course #7: Care of Magical Creatures, Hagrid, OUTDOORS by the paddock (verb 'pet': stroke a shy, sleepy or grumpy
  // creature with the finger until it is happy). No incantation: the 'spell' is gentle care. See CR for the places.
  // -------------------------------------------------------------------------------------
  creatures: {
    spell: { he: 'לְלַטֵּף בַּעֲדִינוּת', icon: '💛', gesture: 'pet' }, icon: '🐉',
    verb: 'pet', who: '🧔', pitch: 0.72, oneBubble: true, bubbleY: 3.72, bubbleYPhone: 1.9, back: 4.6,
    title: 'טִפּוּל בִּיצוּרֵי פֶּלֶא', name: 'אֶתְגָּר: יְצוּרִים',
    teacher: 'hagrid', room: null, station: 'creatures',
    build: buildCreatures,
    confetti: ['💛', '⭐', '🐾', '✨', '🐉'],
    lesson: {
      stand: [-0.25, 5.35], face: [-1.75, 4.95], pip: '🐾',
      cam: { pos: [0.5, 1.8, 7.7], look: [-1.9, 1.45, 3.3] },
      intro: [
        { pose: 'talk', line: 'שָׁלוֹם, חָבֵר! בּוֹא נַכִּיר אֶת הַיְּצוּרִים שֶׁלִּי!', t: 3.4 },
        { pose: 'talk', line: 'לְאַט… וּבַעֲדִינוּת!', t: 3.8, fx: 'demo' },
        { pose: 'cast', line: 'רָאִיתָ? הוּא מְכַשְׁכֵּשׁ בַּזָּנָב!', t: 3.0 },
        { pose: 'talk', line: 'עַכְשָׁו אַתָּה! גַּע בַּיְּצוּר וְלַטֵּף בָּאֶצְבַּע!', t: 3.4 },
      ],
      // three fluffy puffballs (pink, cream, lilac) on a hay bale in front of Hagrid
      lifts: CR.puffs.map(([x, z], i) => petLift('puff' + i, x, BALE_TOP, z, camYaw(x, z, CR.cams.les), { aimY: 0.2, r: 0.22 })),
      outro: 'עַכְשָׁו — לָאֶתְגָּר!',
    },
    praise: ['יָפֶה מְאֹד!', 'מְצֻיָּן!', 'כָּל הַכָּבוֹד!', 'נִפְלָא!'],
    oops: 'נַסֵּה שׁוּב',
    finale: 'אַתָּה חָבֵר שֶׁל כָּל הַיְּצוּרִים!',
    course: {
      star3: 240,
      stations: [
        { id: 'owl', icon: '🦉', say: 'לַטֵּף אֶת הַיַּנְשׁוּף הַיָּשֵׁן!',
          walk: [[-1.0, 6.3], [-3.2, 6.2], [-5.7, 4.3]], face: [CR.post[0], CR.post[1]],
          cam: { pos: [-6.2, 1.9, 6.6], look: [-6.8, 1.4, 3.4] },
          lifts: [petLift('owl', CR.post[0], CR.post[2] + 0.02, CR.post[1], camYaw(CR.post[0], CR.post[1], CR.cams.owl), { aimY: 0.25, r: 0.3 })],
          after: 'owlFly', afterT: 5.0, afterSfx: 'none' },
        { id: 'moles', icon: '🪙', say: 'לַטֵּף אֶת שָׁלוֹשׁ הַחֲפַרְפָּרוֹת!',
          walk: [[-6.6, 6.0], [-7.4, 7.7]], face: [CR.moles[1][0], CR.moles[1][1]],
          cam: { pos: [-10.0, 1.85, 9.7], look: [-9.25, 0.4, 6.3] },
          lifts: CR.moles.map(([x, z], i) => petLift('mole' + i, x, MOLE_PEEK, z, camYaw(x, z, CR.cams.mole), { aimY: 0.3, r: 0.24 })),
          after: 'coinSpin', afterT: 3.4, afterSfx: 'none' },
        { id: 'foal', icon: '🌉', say: 'לַטֵּף אֶת הַסְּיָח הַמְּכֻנָּף!',
          walk: [[-8.6, 9.2], [-10.4, 11.0]], face: [CR.foal[0], CR.foal[1]],
          cam: { pos: [-12.2, 1.75, 13.6], look: [-12.0, 0.55, 9.8] },
          lifts: [petLift('foal', CR.foal[0], 0, CR.foal[1], camYaw(CR.foal[0], CR.foal[1], CR.cams.foal), { aimY: 0.75, r: 0.45 })],
          after: 'foalBow', afterT: 5.4, afterSfx: 'none' },
        { id: 'eggs', icon: '🥚', say: 'לַטֵּף כָּל בֵּיצָה עַד שֶׁתִּבָּקַע!',
          walk: [[-9.4, 13.4], [-6.0, 13.8], [-3.7, 12.9]], face: [-5.6, 12.1],
          cam: { pos: [-5.2, 2.0, 15.6], look: [-5.4, 0.75, 11.8] },
          lifts: ['bdragon', 'owlet', 'turtle'].map((to, i) => { const [x, z] = CR.nests[i]; return petLift('egg' + i, x, NEST_Y, z, camYaw(x, z, CR.cams.egg), { to, aimY: 0.2, r: 0.22, free: true }); }),
          after: 'babyBounce', afterT: 2.8, afterSfx: 'none' },
        { id: 'dragon', icon: '🐉', say: 'לַטֵּף אֶת הַדְּרָקוֹן הַקָּטָן!',
          walk: [[-1.6, 10.6], [0.8, 7.4], [0.3, 5.0]], face: [CR.drag[0], CR.drag[1]],
          // the dragon sits in FRONT of the hay bale (from the camera), the hero to its right, Hagrid's face above them
          cam: { pos: [1.0, 1.9, 7.8], look: [-2.5, 1.2, 2.6] },
          afterCam: { pos: [0.9, 1.8, 7.4], look: [-2.3, 1.25, 2.8] },
          lifts: [petLift('drag', CR.drag[0], 0, CR.drag[1], camYaw(CR.drag[0], CR.drag[1], CR.cams.drag), { aimY: 0.35, r: 0.3 })],
          after: 'dragonCurl', afterT: 6.0, afterSfx: 'none', afterLine: 'אֵיזֶה יֹפִי! הוּא אוֹהֵב אוֹתְךָ!', afterLineT: 2.6 },
      ],
    },
  },
};

// ---- tiny geometry helpers (build time only) ----
const _m4 = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), _s = new Vector3(), _c = new Color();
function paint(geo, hex, hex2 = null, axis = 'y') {
  const n = geo.attributes.position.count, col = new Float32Array(n * 3), a = new Color(hex), b = new Color(hex2 ?? hex);
  geo.computeBoundingBox(); const bb = geo.boundingBox, lo = bb.min[axis], span = (bb.max[axis] - lo) || 1;
  for (let i = 0; i < n; i++) { const k = (geo.attributes.position.getComponent(i, axis === 'x' ? 0 : axis === 'y' ? 1 : 2) - lo) / span; _c.copy(a).lerp(b, k); col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new BufferAttribute(col, 3));
  return geo;
}
function place(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return geo.applyMatrix4(_m4.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)));
}
const merge = (parts) => { const g = mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p)); for (const p of parts) p.dispose(); return g; };

function featherGeo() {
  const s = new Shape(); s.moveTo(0, 0);
  s.quadraticCurveTo(0.16, 0.075, 0.44, 0.02); s.quadraticCurveTo(0.49, 0, 0.44, -0.015); s.quadraticCurveTo(0.17, -0.08, 0.04, -0.02); s.lineTo(0, 0);
  const vane = paint(new ShapeGeometry(s, 8), 0xf6f1e6, 0xd8ccff, 'x'); vane.rotateX(-Math.PI / 2);
  const quill = paint(place(new CylinderGeometry(0.006, 0.004, 0.54, 4), 0.22, 0.004, 0, 0, 0, Math.PI / 2), 0xd8c9a0);
  return merge([vane, quill]).translate(-0.22, 0, 0);
}
function owlGeo() {
  return merge([
    paint(place(new SphereGeometry(0.2, 12, 10), 0, 0.22, 0, 0, 0, 0, 1, 1.15, 0.95), 0x8a7a6c),
    paint(place(new SphereGeometry(0.15, 10, 8), 0, 0.19, 0.08), 0xd8ccb8),
    paint(place(new SphereGeometry(0.06, 8, 8), -0.08, 0.3, 0.16), 0xffb020), paint(place(new SphereGeometry(0.06, 8, 8), 0.08, 0.3, 0.16), 0xffb020),
    paint(place(new SphereGeometry(0.028, 6, 6), -0.08, 0.3, 0.21), 0x1a1420), paint(place(new SphereGeometry(0.028, 6, 6), 0.08, 0.3, 0.21), 0x1a1420),
    paint(place(new ConeGeometry(0.035, 0.08, 5), 0, 0.24, 0.21, Math.PI / 2), 0xff8a10),
    paint(place(new ConeGeometry(0.05, 0.12, 4), -0.12, 0.44, 0, 0, 0, 0.3), 0x6a5a4c), paint(place(new ConeGeometry(0.05, 0.12, 4), 0.12, 0.44, 0, 0, 0, -0.3), 0x6a5a4c),
  ]);
}

// Charms levels 2-3 decoys: a heavy iron cauldron (too heavy to lift: it rattles) and a ginger cat asleep on its
// cushion (it must stay: it shakes its head). Origin on the floor, the cat's face toward +z.
function cauldronGeo() {
  const IRON = 0x34303a, IRON2 = 0x5a5562;
  return merge([
    paint(place(new SphereGeometry(0.27, 16, 12), 0, 0.27, 0, 0, 0, 0, 1, 0.85, 1), IRON, IRON2),
    paint(place(new TorusGeometry(0.2, 0.035, 6, 18), 0, 0.47, 0, Math.PI / 2), IRON2),
    paint(place(new CircleGeometry(0.19, 16), 0, 0.455, 0, -Math.PI / 2), 0x2a6a3a, 0x2a6a3a),   // a dull green brew inside
    ...[0, 1, 2].map(i => paint(place(new CylinderGeometry(0.03, 0.025, 0.1, 6), Math.cos(i * 2.1) * 0.17, 0.05, Math.sin(i * 2.1) * 0.17), IRON)),
    ...[-1, 1].map(sx => paint(place(new TorusGeometry(0.05, 0.012, 5, 10), sx * 0.27, 0.36, 0, 0, Math.PI / 2, 0), IRON2)),
  ]);
}
function sleepCatGeo() {
  const A = 0xd8893a, B = 0xeaa458, CREAM = 0xf4e2bc;
  return merge([
    paint(place(new SphereGeometry(0.3, 14, 6), 0, 0.06, 0, 0, 0, 0, 1, 0.22, 0.82), 0x8a2a3a, 0xb04050),     // the cushion
    ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => paint(place(new SphereGeometry(0.035, 6, 5), a * 0.26, 0.06, b * 0.2), 0xffcf4a)),
    paint(place(new SphereGeometry(0.17, 14, 10), 0, 0.19, -0.02, 0, 0, 0, 1.15, 0.62, 1.0), A, B),           // the curled body
    paint(place(new SphereGeometry(0.1, 12, 9), 0.05, 0.2, 0.14, 0, 0, 0, 1.1, 0.9, 1), A, B),               // the head, resting
    paint(place(new SphereGeometry(0.045, 8, 6), 0.06, 0.18, 0.225, 0, 0, 0, 1.3, 0.8, 1), CREAM),
    ...[-1, 1].map(sx => paint(place(new ConeGeometry(0.035, 0.07, 4), 0.05 + sx * 0.055, 0.29, 0.13, 0, Math.PI / 4, -sx * 0.3), A)),
    ...[-1, 1].map(sx => paint(place(new BoxGeometry(0.035, 0.007, 0.01), 0.05 + sx * 0.035, 0.215, 0.235, 0, 0, sx * 0.15), 0x2a1a10)),   // eyes shut
    paint(place(new TorusGeometry(0.15, 0.03, 6, 12, Math.PI * 1.2), 0, 0.12, 0, -Math.PI / 2, 0, 0.6), A, B),   // the tail round the front
  ]);
}

// The Charms course props. kit.solid(geo) adds to the ONE merged static mesh; kit.mesh / kit.inst
// make movers (a lift target, an owl, a lid, rings) that the runner and the effects can pose.
function buildCharms(kit) {
  const WOOD = 0x6a4424, DARK = 0x3a2614, STONE = 0x7a6a56, STONE2 = 0x9a8a70, BRASS = 0xb98b2e;
  const BOOKS = [0x6a1e1e, 0x1f3b5e, 0x2c4a2a, 0x5a3a1e, 0x4a2a52, 0x7a5a1e];
  const { solid } = kit;
  // lesson bench in front of Flitwick with three feathers
  solid(paint(place(new BoxGeometry(1.9, 0.08, 0.52), -9, 0.74, -4.6), WOOD));
  for (const sx of [-0.85, 0.85]) solid(paint(place(new BoxGeometry(0.08, 0.7, 0.44), -9 + sx, 0.35, -4.6), DARK));
  // 1 bookshelf against the west wall, a gap on the middle shelf where the red book belongs
  const SX = -13.35, SZ = 1.6;
  solid(paint(place(new BoxGeometry(0.04, 2.25, 1.5), SX - 0.17, 1.125, SZ), DARK));
  for (const dz of [-0.75, 0.75]) solid(paint(place(new BoxGeometry(0.38, 2.25, 0.06), SX, 1.125, SZ + dz), WOOD));
  for (const y of [0.04, 0.72, 1.38, 2.22]) solid(paint(place(new BoxGeometry(0.38, 0.05, 1.5), SX, y, SZ), WOOD));
  let k = 0;
  const L3 = kit.level === 3;              // level 3: four gaps for four books (CH3.gaps), else the one gap for the red book
  for (const [y, gaps] of L3 ? [[0.745, CH3.gaps.filter(g => g[0] === 0.745).map(g => g[1])], [1.405, CH3.gaps.filter(g => g[0] === 1.405).map(g => g[1])]] : [[0.745, []], [1.405, [SZ]]]) {
    for (let z = SZ - 0.68; z < SZ + 0.66;) {
      const t = 0.07 + ((k * 37) % 5) * 0.012, h = 0.26 + ((k * 53) % 4) * 0.03;
      const g = gaps.find(c => z + t > c - 0.13 && z < c + 0.13);
      if (g != null) { z = g + 0.13; continue; }
      solid(paint(place(new BoxGeometry(0.24, h, t), SX + 0.03, y + h / 2, z + t / 2), BOOKS[k % BOOKS.length])); z += t + 0.006; k++;
    }
  }
  kit.mesh('book', merge([paint(new BoxGeometry(0.26, 0.34, 0.14), 0xb3262a), paint(place(new BoxGeometry(0.24, 0.32, 0.144), 0.016), 0xf0e4c0), paint(place(new BoxGeometry(0.02, 0.35, 0.15), -0.12), 0xd8a940)]), { glowHex: 0xff6a5a });
  if (L3) kit.inst('xbook', merge([paint(new BoxGeometry(0.26, 0.34, 0.14), 0xffffff), paint(place(new BoxGeometry(0.24, 0.32, 0.144), 0.016), 0xf4f0e8), paint(place(new BoxGeometry(0.02, 0.35, 0.15), -0.12), 0xfff0b0)]),
    3, CH3.bookHex, { glowHex: 0xffd27a });
  // 2 a toy bridge with three holes; the owl waits on the west tower
  for (const x of [-13.2, -10.4]) solid(paint(place(new BoxGeometry(0.5, 1.0, 0.62), x, 0.5, 4.3), STONE, STONE2));
  for (const dz of [-0.27, 0.27]) solid(paint(place(new BoxGeometry(2.3, 0.05, 0.05), -11.8, 0.975, 4.3 + dz), DARK));
  for (const [x0, x1] of L3 ? CH3.planks : [[-12.95, -12.61], [-12.19, -12.01], [-11.59, -11.41], [-10.99, -10.65]]) solid(paint(place(new BoxGeometry(x1 - x0, 0.1, 0.5), (x0 + x1) / 2, 0.95, 4.3), 0x8a6a40));
  kit.inst('block', paint(new BoxGeometry(0.4, 0.4, 0.5), 0xffffff, 0xd8d0c0), L3 ? 4 : 3, L3 ? [0xe8473a, 0x3a7ae8, 0xf2c230, 0x3ab84a] : [0xe8473a, 0x3a7ae8, 0xf2c230], { glowHex: 0xffd27a });
  kit.mesh('owl', owlGeo(), { glow: false });
  // 3 a little stone arch; a fat purple cushion floats in the doorway
  for (const z of [6.0, 7.4]) solid(paint(place(new BoxGeometry(0.32, 2.0, 0.32), -8.0, 1.0, z), STONE, STONE2));
  solid(paint(place(new BoxGeometry(0.44, 0.3, 1.86), -8.0, 2.15, 6.7), STONE2));
  solid(paint(place(new ConeGeometry(0.3, 0.35, 4), -8.0, 2.47, 6.7, 0, Math.PI / 4), STONE2));
  kit.mesh('cushion', merge([paint(place(new SphereGeometry(0.42, 16, 8), 0, 0, 0, 0, 0, 0, 1, 0.36, 0.8), 0x7a3a9a, 0x9a5ac0), ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => paint(place(new SphereGeometry(0.05, 6, 5), a * 0.36, 0, b * 0.26), 0xffcf4a))]), { glowHex: 0xc080ff });
  // 4 a hook on the column, a treasure chest by it
  solid(paint(place(new BoxGeometry(0.22, 0.22, 0.04), -4.5, 2.66, 3.43), BRASS));
  solid(paint(place(new TorusGeometry(0.06, 0.014, 6, 12, Math.PI * 1.3), -4.5, 2.56, 3.5, 0, 0, Math.PI * 0.85), 0xd8b04a));
  solid(paint(place(new BoxGeometry(0.84, 0.46, 0.52), -6.3, 0.23, 3.9), 0x6a4220, 0x7a5028));
  for (const dx of [-0.3, 0.3]) solid(paint(place(new BoxGeometry(0.07, 0.47, 0.53), -6.3 + dx, 0.235, 3.9), 0xd8b04a));
  solid(paint(place(new BoxGeometry(0.7, 0.06, 0.4), -6.3, 0.45, 3.9), 0xffd23f));                 // the gold inside
  kit.mesh('key', place(merge([paint(place(new TorusGeometry(0.055, 0.017, 6, 14), -0.15), 0xffd86a), paint(new BoxGeometry(0.24, 0.03, 0.03), 0xe8c050),
    paint(place(new BoxGeometry(0.03, 0.06, 0.02), 0.09, -0.04), 0xe8c050), paint(place(new BoxGeometry(0.03, 0.045, 0.02), 0.04, -0.035), 0xe8c050)]), 0, 0, 0, 0, 0, 0, 1.8), { glowHex: 0xffd86a });
  kit.mesh('lid', merge([paint(place(new BoxGeometry(0.86, 0.14, 0.54), 0, 0.07, 0.27), 0x7a5028, 0x8a5a2e), paint(place(new BoxGeometry(0.07, 0.15, 0.55), -0.3, 0.07, 0.27), 0xd8b04a), paint(place(new BoxGeometry(0.07, 0.15, 0.55), 0.3, 0.07, 0.27), 0xd8b04a)]), { glow: false });
  // 5 a brass pedestal with the big feather, and three floating rings
  solid(paint(place(new CylinderGeometry(0.16, 0.22, 0.8, 12), -8.5, 0.4, 0.7), BRASS, 0xd8b04a));
  kit.inst('feather', featherGeo(), 4, [0xffffff, 0xffffff, 0xffffff, 0xffffff], { glowHex: 0xffd27a, scales: [1.6, 1.6, 1.6, 2.4] });
  kit.inst('ring', new TorusGeometry(0.46, 0.05, 8, 28), 3, [0x8a6a30, 0x8a6a30, 0x8a6a30], { glow: false, emissive: 0xffb030, emissiveIntensity: 0.35 });
  const ringAt = [[-8.9, 1.8, -0.5, 0.15], [-9.0, 2.5, -1.7, -0.1], [-9.0, 3.1, -3.0, 0.12]];
  // levels 2-3: the decoys (posed by the runner from the level's data; spare ones stay hidden)
  const NDEC = 5;
  if (kit.level > 1) {
    kit.inst('dcaul', cauldronGeo(), NDEC, Array(NDEC).fill(0xffffff), { glowHex: 0x9a7a3a });   // (a softer glow: dark iron must not wash out to cream)
    kit.inst('dcat', sleepCatGeo(), NDEC, Array(NDEC).fill(0xffffff), { glowHex: 0xb08a4a });
  }

  const owlA = [-13.2, 1.0, 4.3], owlB = [-10.4, 1.0, 4.3];
  return {
    reset(M) {
      if (M.dcat0) for (let i = 0; i < NDEC; i++) { M['dcat' + i].pose(0, -50, 0, 0, 0, 0, 0); M['dcaul' + i].pose(0, -50, 0, 0, 0, 0, 0); }
      M.owl.pose(owlA[0], owlA[1], owlA[2], 0, Math.PI / 2, 0);
      M.lid.pose(-6.3, 0.46, 3.64, 0, 0, 0);
      ringAt.forEach(([x, y, z, ry], i) => { M['ring' + i].pose(x, y, z, 0, ry, 0); M['ring' + i].color(0x8a6a30); });
    },
    // idle life: the owl bobs, the rings drift. The rings only show from station 5 on (from the
    // station-1 camera they were a big yellow arc across the shelf)
    tick(M, t, st) {
      M.ring0.mesh.visible = st.phase === 'reward' || (st.phase === 'course' && st.step >= 4);
      ringAt.forEach(([x, y, z, ry], i) => M['ring' + i].pose(x, y + Math.sin(t * 1.3 + i * 2) * 0.05, z, 0, ry + Math.sin(t * 0.7 + i) * 0.08, 0, M['ring' + i].lit ? 1.12 : 1));
    },
    effects: {
      // the owl hops across the finished bridge (2.6 s)
      owlCross(M, t) {
        const k = Math.min(1, t / 2.4), x = owlA[0] + (owlB[0] - owlA[0]) * k;
        M.owl.pose(x, owlA[1] + Math.abs(Math.sin(k * Math.PI * 5)) * 0.18, owlA[2], 0, Math.PI / 2, Math.sin(t * 14) * 0.12);
        if (k >= 1) M.owl.pose(owlB[0], owlB[1], owlB[2], 0, -0.4, 0);
        return t < 2.6;
      },
      // the lid swings open (1.6 s)
      chestOpen(M, t) {
        const k = Math.min(1, t / 0.9), e = 1 - (1 - k) * (1 - k) * (1 - k);
        M.lid.pose(-6.3, 0.46, 3.64, -1.95 * e, 0, 0);
        return t < 1.6;
      },
    },
  };
}

// A friendly straw practice dummy on a little wheeled base, a painted target on its chest and
// button eyes (origin: floor centre, faces +z = toward the child). Used for the lesson and the finish.
function dummyGeo() {
  const STRAW = 0xb88a3a, STRAW2 = 0xcaa050, WOOD = 0x6a4424;
  const disc = (r, hex, z) => paint(place(new CylinderGeometry(r, r, 0.012, 20), 0, 0.82, z, Math.PI / 2), hex);
  return merge([
    paint(place(new BoxGeometry(0.5, 0.08, 0.46), 0, 0.15, 0), WOOD),
    ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => paint(place(new CylinderGeometry(0.075, 0.075, 0.05, 10), a * 0.22, 0.075, b * 0.17, 0, 0, Math.PI / 2), 0x2e2b30)),
    paint(place(new CylinderGeometry(0.035, 0.035, 0.3, 6), 0, 0.33, 0), WOOD),
    paint(place(new CylinderGeometry(0.2, 0.24, 0.62, 12), 0, 0.78, 0), STRAW, STRAW2),
    paint(place(new CylinderGeometry(0.21, 0.21, 0.04, 12), 0, 0.62, 0), 0x8a5a2e),                  // rope belt
    paint(place(new CylinderGeometry(0.05, 0.05, 0.84, 6), 0, 0.98, 0, 0, 0, Math.PI / 2), STRAW),      // arms
    paint(place(new SphereGeometry(0.17, 12, 10), 0, 1.27, 0), STRAW2, STRAW),
    disc(0.17, 0xd8382c, 0.235), disc(0.12, 0xf4eee0, 0.243), disc(0.065, 0xd8382c, 0.251),            // the painted target
    paint(place(new SphereGeometry(0.025, 6, 5), -0.06, 1.3, 0.155), 0x1a1420), paint(place(new SphereGeometry(0.025, 6, 5), 0.06, 1.3, 0.155), 0x1a1420),
    paint(place(new TorusGeometry(0.05, 0.012, 5, 10, Math.PI), 0, 1.23, 0.16, 0, 0, Math.PI), 0x8a3a2a),  // a smile
  ]);
}

// Defence levels 2-3 decoys (things that must NOT be pushed; origin on the floor, facing +z):
//   a friendly practice dummy: the same straw dummy, but a big pink heart on its chest, rosy cheeks and a green scarf
//   ("I'm a friend!": it shakes its head); a tower of teacups on saucers on a little stool (it rattles); a sleepy owl on a
//   short perch (it shakes its head)
function friendDummyGeo() {
  const STRAW = 0xb88a3a, STRAW2 = 0xcaa050, WOOD = 0x6a4424;
  return merge([
    paint(place(new BoxGeometry(0.5, 0.08, 0.46), 0, 0.15, 0), WOOD),
    ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => paint(place(new CylinderGeometry(0.075, 0.075, 0.05, 10), a * 0.22, 0.075, b * 0.17, 0, 0, Math.PI / 2), 0x2e2b30)),
    paint(place(new CylinderGeometry(0.035, 0.035, 0.3, 6), 0, 0.33, 0), WOOD),
    paint(place(new CylinderGeometry(0.2, 0.24, 0.62, 12), 0, 0.78, 0), STRAW, STRAW2),
    paint(place(new CylinderGeometry(0.05, 0.05, 0.84, 6), 0, 0.98, 0, 0, 0, Math.PI / 2), STRAW),
    paint(place(new TorusGeometry(0.15, 0.045, 6, 14), 0, 1.11, 0, Math.PI / 2), 0x2a9a4a, 0x48c068),        // the scarf
    paint(place(new BoxGeometry(0.08, 0.26, 0.03), 0.09, 0.98, 0.2, 0, 0, 0.15), 0x2a9a4a, 0x48c068),
    paint(place(new SphereGeometry(0.17, 12, 10), 0, 1.27, 0), STRAW2, STRAW),
    place(heartGeo(0.12), 0, 0.83, 0.238),                                                                 // the big heart
    paint(place(new SphereGeometry(0.025, 6, 5), -0.06, 1.3, 0.155), 0x1a1420), paint(place(new SphereGeometry(0.025, 6, 5), 0.06, 1.3, 0.155), 0x1a1420),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.03, 6, 5), s * 0.1, 1.24, 0.14, 0, 0, 0, 1, 0.7, 0.4), 0xf07a8a)),   // rosy cheeks
    paint(place(new TorusGeometry(0.055, 0.013, 5, 10, Math.PI), 0, 1.23, 0.16, 0, 0, Math.PI), 0x8a3a2a),
  ]);
}
function teacupsGeo() {
  const parts = [paint(place(new CylinderGeometry(0.2, 0.2, 0.05, 14), 0, 0.42, 0), 0x6a4424),
    ...[0, 1, 2].map(i => paint(place(new CylinderGeometry(0.025, 0.025, 0.4, 5), Math.cos(i * 2.1) * 0.14, 0.2, Math.sin(i * 2.1) * 0.14), 0x3a2614))];
  const CUP = [0xf0e6f4, 0xe8f0f8, 0xf8eadc, 0xf0e6f4];
  for (let i = 0; i < 4; i++) {
    const y = 0.45 + i * 0.13, ry = i * 0.9;
    parts.push(paint(place(new CylinderGeometry(0.11, 0.08, 0.018, 14), 0, y + 0.009, 0), 0xffffff, CUP[i]));                        // saucer
    parts.push(paint(place(new CylinderGeometry(0.075, 0.05, 0.09, 12), 0, y + 0.063, 0), CUP[i], 0xffffff));                       // cup
    parts.push(paint(place(new TorusGeometry(0.076, 0.008, 4, 14), 0, y + 0.1, 0, Math.PI / 2), 0xd8a940));                         // gold rim
    parts.push(paint(place(new TorusGeometry(0.028, 0.008, 4, 8), Math.cos(ry) * 0.085, y + 0.065, Math.sin(ry) * 0.085, 0, -ry, 0), CUP[i]));   // handle
    parts.push(paint(place(new SphereGeometry(0.014, 5, 4), Math.cos(ry + 1.6) * 0.07, y + 0.07, Math.sin(ry + 1.6) * 0.07), 0xe85a8a));   // a painted flower
  }
  return merge(parts);
}
function owlPerchGeo() {
  return merge([
    paint(place(new CylinderGeometry(0.03, 0.04, 0.5, 6), 0, 0.25, 0), 0x6a4424), paint(place(new CylinderGeometry(0.16, 0.18, 0.04, 10), 0, 0.02, 0), 0x3a2614),
    paint(place(new CylinderGeometry(0.025, 0.025, 0.36, 6), 0, 0.5, 0, 0, 0, Math.PI / 2), 0x6a4424),
    place(owlSleepyGeo(), 0, 0.5, 0),
  ]);
}

// The Defence course props (see COURSES.defence for where each station stands).
function buildDefence(kit) {
  const WOOD = 0x6a4424, DARK = 0x3a2614, STONE = 0x7a6a56, STONE2 = 0x9a8a70, BRASS = 0xb98b2e, GOLD = 0xffd23f, STRAW = 0xb88a3a;
  const BOOKS = [0xb3262a, 0x1f5e9e, 0x2c7a3a, 0xc88a1e, 0x6a3a92, 0xd0602a, 0x1e6a6a];
  const { solid } = kit;
  // lesson: a big soft blue mat behind the three dummies
  solid(paint(place(new BoxGeometry(3.0, 0.07, 1.6), 9, 0.035, -4.95), 0x3a5aa0, 0x4a6ab8));
  kit.inst('dummy', dummyGeo(), 4, [0xffffff, 0xffffff, 0xffffff, 0xffffff], { glowHex: 0xff9a40, scales: [0.85, 0.85, 0.85, 1.2] });
  // 1 a floor button under a crate; a golden line runs to a little portcullis in a low fence
  solid(paint(place(new CylinderGeometry(0.42, 0.46, 0.04, 20), 10.1, 0.02, 1.6), BRASS));
  solid(paint(place(new CylinderGeometry(0.3, 0.3, 0.05, 20), 10.1, 0.05, 1.6), 0xd8382c));
  solid(paint(place(new BoxGeometry(0.06, 0.01, 0.95), 10.05, 0.006, 2.38), GOLD));
  for (const x of [8.0, 10.0]) solid(paint(place(new BoxGeometry(0.2, 3.5, 0.2), x, 1.75, 2.9), WOOD, 0x8a5a30));
  solid(paint(place(new BoxGeometry(2.3, 0.2, 0.24), 9.0, 3.45, 2.9), DARK));
  for (const [x0, x1] of [[5.4, 7.9], [10.1, 12.1]]) {
    for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / Math.round((x1 - x0) / 0.8)) solid(paint(place(new BoxGeometry(0.1, 0.75, 0.1), x, 0.375, 2.9), DARK));
    for (const y of [0.32, 0.62]) solid(paint(place(new BoxGeometry(x1 - x0, 0.08, 0.06), (x0 + x1) / 2, y, 2.9), WOOD));
  }
  const gate = [paint(place(new BoxGeometry(1.8, 0.1, 0.08), 0, 0.95, 0), DARK), paint(place(new BoxGeometry(1.8, 0.1, 0.08), 0, 0.3, 0), DARK)];
  for (let i = 0; i < 9; i++) gate.push(paint(place(new BoxGeometry(0.06, 1.0, 0.06), -0.8 + i * 0.2, 0.5, 0), 0x4a4650, 0x6a6670));
  kit.mesh('gate', merge(gate), { glow: false });
  kit.mesh('crate', merge([paint(place(new BoxGeometry(0.66, 0.66, 0.66), 0, 0.33, 0), 0x9a6a36, 0xb07c40),
    ...[-1, 1].flatMap(s => [paint(place(new BoxGeometry(0.7, 0.08, 0.04), 0, 0.33, s * 0.33), DARK), paint(place(new BoxGeometry(0.04, 0.08, 0.7), s * 0.33, 0.33, 0), DARK),
      paint(place(new BoxGeometry(0.7, 0.05, 0.7), 0, s < 0 ? 0.03 : 0.64, 0), 0x7a4a22)])]), { glowHex: 0xffc070 });
  // 2 straw bales either side of a stacked-barrel plug; a low pen on the west where barrels go
  for (const z of [3.55, kit.level > 1 ? DF.bale2 : 5.25]) solid(paint(place(new BoxGeometry(1.2, 0.5, 0.6), 9.0, 0.25, z), 0x9a7030, 0xc89a48));   // (levels 2-3: the south bale stands back: three barrel lanes)
  for (let z = 3.3; z <= 5.71; z += 0.8) solid(paint(place(new BoxGeometry(0.1, 0.6, 0.1), 6.45, 0.3, z), DARK));
  solid(paint(place(new BoxGeometry(0.06, 0.08, 2.4), 6.45, 0.45, 4.5), WOOD));
  kit.inst('barrel', merge([paint(place(new CylinderGeometry(0.3, 0.3, 0.62, 14), 0, 0, 0, Math.PI / 2), 0xffffff, 0xd8d0c0, 'z'),
    paint(place(new CylinderGeometry(0.255, 0.255, 0.63, 14), 0, 0, 0, Math.PI / 2), 0x8a5a2e),
    ...[-0.2, 0.2].map(z => paint(place(new TorusGeometry(0.3, 0.018, 4, 18), 0, 0, z), 0x2e2b30))]),
    kit.level === 3 ? 4 : 3, kit.level > 1 ? DF.barrelHex.slice(0, kit.level === 3 ? 4 : 3) : [0xa8743e, 0x9a6a36, 0xb07c40], { glowHex: 0xffc070 });   // (levels 2-3: painted barrels, easy to tell apart in a shown order)
  // 3 a row of big standing books (dominoes; pivot on the +x bottom edge) and a bell on a gallows
  kit.inst('domino', merge([paint(place(new BoxGeometry(0.1, 0.62, 0.42), -0.05, 0.31, 0), 0xffffff),
    paint(place(new BoxGeometry(0.104, 0.58, 0.38), -0.05, 0.31, 0.025), 0xf0e4c0)]), 7, BOOKS, { glow: false });
  solid(paint(place(new BoxGeometry(0.1, 1.0, 0.1), 12.4, 0.5, 7.6), DARK));
  solid(paint(place(new BoxGeometry(0.45, 0.08, 0.08), 12.2, 0.94, 7.6), DARK));
  solid(paint(place(new BoxGeometry(0.4, 0.05, 0.4), 12.4, 0.025, 7.6), DARK));
  kit.mesh('bell', merge([paint(place(new CylinderGeometry(0.008, 0.008, 0.16, 4), 0, -0.08, 0), 0x2e2b30),
    paint(place(new CylinderGeometry(0.07, 0.15, 0.22, 14, 1, true), 0, -0.27, 0), 0xffd86a, 0xc89a30), paint(place(new SphereGeometry(0.07, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0, -0.16, 0), 0xffd86a),
    paint(place(new SphereGeometry(0.035, 6, 5), 0, -0.36, 0), 0x8a6a30)]), { glow: false });
  // 4 a wooden groove to a brass bowl; a golden line runs to the drawbridge over a little moat
  solid(paint(place(new BoxGeometry(0.5, 0.03, 4.1), 13.3, 0.015, 5.6), WOOD));
  for (const dx of [-0.2, 0.2]) solid(paint(place(new BoxGeometry(0.05, 0.1, 4.1), 13.3 + dx, 0.05, 5.6), DARK));
  solid(paint(place(new CylinderGeometry(0.27, 0.18, 0.22, 16, 1, true), 13.3, 0.11, 3.45), BRASS, 0xd8b04a));
  solid(paint(place(new CylinderGeometry(0.18, 0.18, 0.02, 16), 13.3, 0.01, 3.45), BRASS));
  solid(paint(place(new BoxGeometry(0.06, 0.01, 0.4), 13.25, 0.006, 3.08), GOLD));
  solid(paint(place(new BoxGeometry(1.6, 0.03, 0.9), 12.9, 0.015, 2.45), 0x2a6ac8, 0x5aa0e8, 'x'));
  for (const z of [1.94, 2.96]) solid(paint(place(new BoxGeometry(1.6, 0.12, 0.12), 12.9, 0.06, z), STONE, STONE2));
  for (const x of [12.15, 13.25]) solid(paint(place(new BoxGeometry(0.14, 1.3, 0.14), x, 0.65, 1.82), STONE, STONE2));
  kit.mesh('bridge', merge([paint(place(new BoxGeometry(0.9, 0.06, 1.12), 0, 0.03, 0.56), 0x8a5a30, 0xa06a38),
    ...[0.15, 0.45, 0.75, 1.0].map(z => paint(place(new BoxGeometry(0.92, 0.065, 0.04), 0, 0.03, z), DARK))]), { glow: false });
  // 5 the finish: a chequered line across the east lane, two little flags
  for (let i = 0; i < 10; i++) for (let j = 0; j < 2; j++) solid(paint(place(new BoxGeometry(0.2, 0.012, 0.2), 11.7 + i * 0.2, 0.006, -0.4 - j * 0.2), (i + j) % 2 ? 0x1a1420 : 0xf4eee0));
  for (const x of [11.5, 13.7]) {
    solid(paint(place(new CylinderGeometry(0.025, 0.025, 1.4, 6), x, 0.7, -0.5), DARK));
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) solid(paint(place(new BoxGeometry(0.012, 0.12, 0.12), x, 1.32 - j * 0.12, -0.5 + 0.06 + i * 0.12), (i + j) % 2 ? 0x1a1420 : 0xf4eee0));
  }
  // the ball: two-tone stripes so the roll reads
  kit.mesh('ball', paint(new SphereGeometry(0.17, 16, 12), 0xe8473a, 0xf2c230, 'z'), { glowHex: 0xffd27a });
  // levels 2-3: the decoys (posed by the runner from the level's data; spare ones stay hidden); level 3: a round practice
  // shield on a hinge post across the finish lane, swinging aside while the timing gate is open (it follows L.gateK)
  const NDEC = 5;
  if (kit.level > 1) {
    kit.inst('ddum', friendDummyGeo(), NDEC, Array(NDEC).fill(0xffffff), { glowHex: 0xff9ab0, scales: Array(NDEC).fill(0.85) });
    kit.inst('dcups', teacupsGeo(), NDEC, Array(NDEC).fill(0xffffff), { glowHex: 0xffd0e0 });
    kit.inst('dowl', owlPerchGeo(), NDEC, Array(NDEC).fill(0xffffff), { glowHex: 0xc0a070 });
  }
  if (kit.level === 3) {
    solid(paint(place(new CylinderGeometry(0.05, 0.06, 1.2, 8), DF.hinge[0], 0.6, DF.hinge[1]), DARK));
    solid(paint(place(new CylinderGeometry(0.16, 0.18, 0.05, 10), DF.hinge[0], 0.025, DF.hinge[1]), DARK));
    const disc = (r, hex, hex2, z) => paint(place(new CylinderGeometry(r, r, 0.04, 22), 0.52, 0.62, z, Math.PI / 2), hex, hex2);
    kit.mesh('shield', merge([disc(0.46, 0x2a4a8a, 0x3a5aa8, 0), disc(0.36, 0xd8b04a, 0xf0d070, 0.025), disc(0.26, 0x2a4a8a, 0x3a5aa8, 0.035), disc(0.1, 0xd8b04a, 0xf0d070, 0.045),
      paint(place(new BoxGeometry(0.5, 0.05, 0.04), 0.25, 0.62, 0), 0x6a6670), paint(place(new BoxGeometry(0.5, 0.05, 0.04), 0.25, 0.9, 0), 0x6a6670)]), { glow: false });
  }

  // fallen books rest on each other like shingles: each leans until its top corner meets the back of
  // the next (solved for 0.38 m spacing, 0.62 x 0.1 m books, the last one against the bell): first
  // a book tips to 0.468 rad (touching the upright next one), then settles as the next one falls
  const DX = (i) => 9.3 + i * 0.38, REST = [1.301, 1.296, 1.285, 1.257, 1.19, 1.041, 0.75], TOUCH = 0.468;
  const fallK = (t, i) => { const k = Math.max(0, Math.min(1, (t - i * 0.2) / 0.22)); return k * k; };
  const lean = (t, i) => -(Math.min(TOUCH, REST[i]) * (i ? fallK(t, i) : 1) + Math.max(0, REST[i] - TOUCH) * (i < 6 ? fallK(t, i + 1) : fallK(t, i)));
  let rang = 0, fell = 0;
  return {
    reset(M) {
      M.gate.pose(9.0, 0, 2.9, 0, 0, 0);
      for (let i = 1; i < 7; i++) M['domino' + i].pose(DX(i), 0, 7.6, 0, 0, 0);
      M.bell.pose(12.05, 0.9, 7.6, 0, 0, 0);
      M.bridge.pose(12.7, 0.12, 1.9, -Math.PI / 2, 0, 0);
      rang = 0; fell = 0;
      if (M.ddum0) for (let i = 0; i < NDEC; i++) for (const n of ['ddum', 'dcups', 'dowl']) M[n + i].pose(0, -50, 0, 0, 0, 0, 0);
      if (M.shield) { M.shield.pose(DF.hinge[0], 0, DF.hinge[1], 0, 0, 0); M.shield.mesh.visible = false; }
    },
    // once the row has fallen the first book (a lift: the runner re-poses it every frame) rests too
    tick(M, t, st) {
      if (fell >= 6) M.domino0.pose(DX(0), 0, 7.6, 0, 0, -REST[0]);
      if (M.shield) {                      // level 3: the shield shows from the finish on; it swings aside with the gate's rhythm
        const fin = st.phase === 'reward' || (st.phase === 'course' && st.step >= 4);
        M.shield.mesh.visible = fin;
        if (fin) { const L = st.lifts && st.lifts[0], k = st.phase === 'reward' || !L || !L.gate ? 1 : L.gateK, e = k * k * (3 - 2 * k);
          M.shield.pose(DF.hinge[0], 0, DF.hinge[1], 0, e * 1.75 + (1 - e) * Math.sin(t * 2.2) * 0.04, 0); }
      }
    },
    effects: {
      // the portcullis rises (1.4 s)
      gateRise(M, t) { const k = Math.min(1, t / 1.2), e = k * k * (3 - 2 * k); M.gate.pose(9.0, e * 2.4, 2.9, 0, 0, 0); return t < 1.4; },
      // the books fall one by one, the last taps the bell, which swings and rings (3.4 s)
      dominoes(M, t, quiet) {
        M.domino0.pose(DX(0), 0, 7.6, 0, 0, lean(t, 0));
        for (let i = 1; i < 7; i++) {
          M['domino' + i].pose(DX(i), 0, 7.6, 0, 0, lean(t, i));
          if (fallK(t, i) > 0 && fell < i) { fell = i; if (!quiet) fun.sfx.tink(1 + (i % 3)); }
        }
        const tb = 6 * 0.2 + 0.2;
        if (t >= tb) {
          const u = t - tb; M.bell.pose(12.05, 0.9, 7.6, 0, 0, quiet ? 0 : -0.5 * Math.sin(u * 9) * Math.exp(-u * 1.3));
          if (!rang) { rang = 1; if (!quiet) { fun.sfx.chime(); fun.sfx.tune([1568, 2093, 1568, 2093], 0.12, 'sine'); } }
        }
        return t < 3.4;
      },
      // the drawbridge lowers over the moat (1.6 s)
      bridgeDown(M, t) { const k = Math.min(1, t / 1.3), e = 1 - (1 - k) * (1 - k); M.bridge.pose(12.7, 0.12, 1.9, -Math.PI / 2 * (1 - e), 0, 0); return t < 1.6; },
      // the big dummy bows twice past the finish line (2.4 s)
      bow(M, t) { const k = Math.min(1, t / 2.0); M.dummy3.pose(12.7, 0, -0.9, Math.max(0, Math.sin(k * Math.PI * 2)) * 0.55, 0, 0); return t < 2.4; },
    },
  };
}

// A sleepy owl (eyes shut: two little lash arcs) for the dark corner; his open eyes are a separate
// mover (owlEyesGeo, centred on the eye line) that blinks by squashing.
function owlSleepyGeo() {
  return merge([
    paint(place(new SphereGeometry(0.2, 12, 10), 0, 0.22, 0, 0, 0, 0, 1, 1.15, 0.95), 0x8a7a6c),
    paint(place(new SphereGeometry(0.15, 10, 8), 0, 0.19, 0.08), 0xd8ccb8),
    paint(place(new TorusGeometry(0.04, 0.009, 4, 10, Math.PI), -0.08, 0.3, 0.205, 0, 0, Math.PI), 0x3a2a20),
    paint(place(new TorusGeometry(0.04, 0.009, 4, 10, Math.PI), 0.08, 0.3, 0.205, 0, 0, Math.PI), 0x3a2a20),
    paint(place(new ConeGeometry(0.035, 0.08, 5), 0, 0.24, 0.21, Math.PI / 2), 0xff8a10),
    paint(place(new ConeGeometry(0.05, 0.12, 4), -0.12, 0.44, 0, 0, 0, 0.3), 0x6a5a4c), paint(place(new ConeGeometry(0.05, 0.12, 4), 0.12, 0.44, 0, 0, 0, -0.3), 0x6a5a4c),
  ]);
}
function owlEyesGeo() {
  return merge([
    paint(place(new SphereGeometry(0.062, 10, 8), -0.08, 0, 0), 0xffc030), paint(place(new SphereGeometry(0.062, 10, 8), 0.08, 0, 0), 0xffc030),
    paint(place(new SphereGeometry(0.03, 8, 6), -0.08, 0, 0.045), 0x1a1420), paint(place(new SphereGeometry(0.03, 8, 6), 0.08, 0, 0.045), 0x1a1420),
    paint(place(new SphereGeometry(0.01, 4, 4), -0.07, 0.012, 0.072), 0xffffff), paint(place(new SphereGeometry(0.01, 4, 4), 0.09, 0.012, 0.072), 0xffffff),
  ]);
}

// Astronomy levels 2-3 decoys and level-3 gate props (see AS_CAM).
//   bat: hangs upside down from a little wooden perch on a chain (origin = the perch; faces +z; the head at the bottom,
//        ears pointing down, wings wrapped round it, eyes shut). Its open eye is a separate unlit dot (batEye).
//   jar: a frosted glass jar of pale moon-moths with a cork and a little crescent, on a three-legged stool (origin: floor).
//   cloud: a small fluffy night cloud (faces +z) that drifts over the owl's lantern; shutter: a brass half-shell round
//        the big lamp's globe (open side -z at rotation 0) that turns away while its timing gate is open.
function batGeo() {
  const FUR = 0x3a2c40, FUR2 = 0x5a4868, WING = 0x2e2236, WING2 = 0x4a3a58;
  return merge([
    paint(place(new CylinderGeometry(0.014, 0.014, 0.3, 6), 0, 0, 0, 0, 0, Math.PI / 2), 0x6a4424),                    // the perch
    paint(place(new CylinderGeometry(0.006, 0.006, 0.7, 4), 0, 0.35, 0), 0x2e2b30),                                    // its chain
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.018, 6, 4), s * 0.03, -0.015, 0), 0x2a2026)),                // feet
    paint(place(new SphereGeometry(0.1, 12, 10), 0, -0.17, 0, 0, 0, 0, 1, 1.55, 0.85), FUR2, FUR),                     // the body
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.075, 10, 8), s * 0.068, -0.16, 0.025, 0, 0, s * 0.12, 0.62, 1.75, 0.9), WING2, WING)),   // wrapped wings
    ...[-1, 1].map(s => paint(place(new ConeGeometry(0.018, 0.05, 4), s * 0.07, -0.02, 0.03, 0, 0, s * 0.3), WING)),   // the wing thumbs
    paint(place(new SphereGeometry(0.07, 12, 10), 0, -0.32, 0.025), 0x4a3a50, FUR2),                                  // the head
    ...[-1, 1].map(s => paint(place(new ConeGeometry(0.03, 0.08, 4), s * 0.042, -0.405, 0.02, Math.PI, 0, -s * 0.25), 0x4a3a50)),   // ears (down)
    ...[-1, 1].map(s => paint(place(new BoxGeometry(0.03, 0.006, 0.01), s * 0.026, -0.325, 0.09, 0, 0, -s * 0.15), 0x120c14)),     // eyes shut
    paint(place(new SphereGeometry(0.016, 6, 5), 0, -0.29, 0.09), 0xd88a9a),                                         // a pink nose
  ]);
}
const BAT_EYE = [0.026, -0.325, 0.088];
function mothJarGeo() {
  const parts = [
    paint(place(new CylinderGeometry(0.2, 0.2, 0.04, 14), 0, 0.5, 0), 0x6a4424),
    ...[0, 1, 2].map(i => paint(place(new CylinderGeometry(0.022, 0.022, 0.5, 5), Math.cos(i * 2.1) * 0.14, 0.25, Math.sin(i * 2.1) * 0.14), 0x3a2614)),
    paint(place(new CylinderGeometry(0.11, 0.105, 0.27, 16), 0, 0.655, 0), 0xa8c8d4, 0xd8eef0),                       // the frosted glass
    paint(place(new TorusGeometry(0.095, 0.012, 5, 16), 0, 0.79, 0, Math.PI / 2), 0x6a5a9a),                          // a ribbon at the neck
    paint(place(new CylinderGeometry(0.085, 0.08, 0.05, 12), 0, 0.815, 0), 0xa07a4a, 0xc09a6a),                       // the cork
    paint(place(new TorusGeometry(0.03, 0.008, 4, 10, Math.PI * 1.25), 0.05, 0.57, 0.108, 0, 0, 0.6), 0xf0e0a0),     // a little crescent moon
  ];
  for (const [x, y, a] of [[-0.035, 0.62, 0.3], [0.04, 0.7, -0.4], [-0.01, 0.75, 0.1]]) {   // three pale moths on the glass
    for (const s of [-1, 1]) parts.push(paint(place(new SphereGeometry(0.024, 6, 4), x + s * 0.02 * Math.cos(a), y + s * 0.02 * Math.sin(a), 0.11, 0, 0, a + s * 0.5, 1.2, 0.75, 0.25), 0xeef8d8));
    parts.push(paint(place(new SphereGeometry(0.008, 4, 3), x, y, 0.114, 0, 0, a, 1, 2.2, 1), 0x8a7a6a));
  }
  return merge(parts);
}
function cloudGeo() {
  return merge([[0, 0, 0.21], [-0.2, -0.03, 0.15], [0.21, -0.02, 0.16], [-0.08, 0.12, 0.15], [0.1, 0.1, 0.14], [0.33, -0.06, 0.1], [-0.32, -0.07, 0.1]]
    .map(([x, y, r]) => paint(place(new SphereGeometry(r, 12, 8), x, y, 0, 0, 0, 0, 1, 0.92, 0.7), 0x5a6284, 0x9aa2c4)));
}
function shutterGeo() {
  const R = 0.45, shell = paint(new SphereGeometry(R, 20, 12, 0, Math.PI, 0.32, Math.PI - 0.75), 0x8a6a2a, 0xc89a40);   // the +z half
  return merge([shell,
    ...[-0.95, 0, 0.95].map(a => paint(place(new TorusGeometry(R + 0.012, 0.014, 4, 16, Math.PI), 0, 0, 0, 0, a - Math.PI / 2, -Math.PI / 2), 0xd8b04a)),   // brass ribs (front meridians)
    paint(place(new TorusGeometry(R + 0.01, 0.02, 4, 20, Math.PI), 0, 0, 0, Math.PI / 2, 0, 0), 0xd8b04a)]);                                               // the rim round its middle
}

// The Astronomy course props and its light (see COURSES.astronomy). Everything that glows is one of:
//   bulbs   ONE instanced unlit sphere set (lanterns, sconces, star lamps, stars, the wand tips, the orb):
//           instance colour = brightness (above 1 blooms on HIGH)
//   light   ONE instanced additive quad set with a soft radial canvas: the pools each lit thing throws on
//           the floor / walls / desk, the halos, the hero's moonlight rim and wand pool
//   lines   the constellation (thin unlit bars that grow between lit stars), sky = the extra dome stars
// No real lights. tick() reads the lift levels (L.p, L.done) the runner keeps and paints all of it.
function buildAstronomy(kit) {
  const WOOD = 0x6a4424, DARK = 0x3a2614, STONE = 0x77707e, STONE2 = 0x938b98, BRASS = 0xb98b2e, GOLD = 0xd8b04a;
  const { solid, ctx } = kit;
  const L3 = kit.level === 3, LV = kit.level > 1;   // levels 2-3: decoys, the order preview; level 3: two more lamps, the cloud, the shutter
  const BL = L3 ? [...ASTRO.bulbs, ...ASTRO_X] : ASTRO.bulbs, NB = BL.length, WAND = 16, ORB = 17, PROF = 18, TELE = 15;
  const LIT = []; for (let i = 0; i <= TELE; i++) LIT.push(i); if (L3) LIT.push(19, 20);   // the bulbs a child lights (level 1: 0..15)
  const isLamp = (i) => (i >= 6 && i < 9) || (L3 && i === 20);
  const lantern = (x, y, z, s = 1) => {           // a little brass cage round a bulb at (x, y, z)
    solid(paint(place(new CylinderGeometry(0.1 * s, 0.11 * s, 0.035 * s, 10), x, y - 0.15 * s, z), BRASS));
    for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) solid(paint(place(new BoxGeometry(0.018 * s, 0.3 * s, 0.018 * s), x + a * 0.085 * s, y, z + b * 0.085 * s), BRASS));
    solid(paint(place(new ConeGeometry(0.13 * s, 0.12 * s, 4), x, y + 0.2 * s, z, 0, Math.PI / 4), DARK));
    solid(paint(place(new TorusGeometry(0.035 * s, 0.01 * s, 4, 10), x, y + 0.29 * s, z), BRASS));
  };
  // lesson: a little desk in front of Sinistra with three lanterns
  solid(paint(place(new BoxGeometry(1.6, 0.08, 0.5), -2.2, 0.72, -3.85), WOOD));
  for (const sx of [-0.7, 0.7]) solid(paint(place(new BoxGeometry(0.08, 0.7, 0.42), -2.2 + sx, 0.35, -3.85), DARK));
  for (let i = 0; i < 3; i++) lantern(BL[i][0], BL[i][1], BL[i][2]);
  // 1 a stone stair up the west wall to a landing, a sconce over the steps
  for (let k = 0; k < 4; k++) solid(paint(place(new BoxGeometry(1.2, 0.25 * (k + 1), 0.8), -6.9, 0.125 * (k + 1), 1.2 - 0.8 * k), STONE, STONE2));
  solid(paint(place(new BoxGeometry(1.2, 1.0, 1.6), -6.9, 0.5, -2.4), STONE, STONE2));
  for (const i of L3 ? [3, 4, 5, 19] : [3, 4, 5]) {
    const [x, y, z] = BL[i];
    solid(paint(place(new BoxGeometry(0.26, 0.05, 0.05), x - 0.11, y - 0.2, z), DARK));
    solid(paint(place(new CylinderGeometry(0.13, 0.06, 0.12, 10, 1, true), x, y - 0.13, z), BRASS, GOLD));
    solid(paint(place(new CylinderGeometry(0.06, 0.06, 0.02, 10), x, y - 0.19, z), BRASS));
  }
  // 2 three star lamps on brass posts along the north wall
  for (const i of L3 ? [6, 7, 8, 20] : [6, 7, 8]) {
    const [x, y, z] = BL[i];
    solid(paint(place(new CylinderGeometry(0.035, 0.045, y - 0.15, 6), x, (y - 0.15) / 2, z), BRASS, GOLD));
    solid(paint(place(new CylinderGeometry(0.2, 0.24, 0.05, 12), x, 0.025, z), DARK));
    for (let k = 0; k < 5; k++) {                  // a little gold star crown round the bulb (faces the room)
      const a = k / 5 * Math.PI * 2;
      solid(paint(place(new ConeGeometry(0.045, 0.14, 4), x + Math.sin(a) * 0.2, y + Math.cos(a) * 0.2, z, 0, 0, -a), GOLD));
    }
  }
  // 3 the dark corner: a stool with the sleepy owl and the telescope key, a lantern on a wall bracket
  const CX = 6.75, CZ = -6.75;
  solid(paint(place(new CylinderGeometry(0.32, 0.3, 0.07, 14), CX, 0.885, CZ), WOOD));
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.4; solid(paint(place(new CylinderGeometry(0.03, 0.035, 0.86, 5), CX + Math.cos(a) * 0.2, 0.43, CZ + Math.sin(a) * 0.2), DARK)); }
  solid(paint(place(new BoxGeometry(0.05, 0.05, 0.75), BL[9][0], BL[9][1] + 0.5, -7.1), DARK));
  solid(paint(place(new BoxGeometry(0.03, 0.2, 0.03), BL[9][0], BL[9][1] + 0.38, BL[9][2]), DARK));
  lantern(BL[9][0], BL[9][1], BL[9][2], 1.2);
  // 5 the big telescope lamp: a brass post with a ring round a big globe
  {
    const [x, y, z] = BL[TELE];
    solid(paint(place(new CylinderGeometry(0.05, 0.07, y - 0.25, 8), x, (y - 0.25) / 2, z), BRASS, GOLD));
    solid(paint(place(new CylinderGeometry(0.3, 0.36, 0.06, 14), x, 0.03, z), DARK));
    solid(paint(place(new TorusGeometry(0.33, 0.025, 6, 20), x, y, z, Math.PI / 2), GOLD));
    solid(paint(place(new CylinderGeometry(0.12, 0.2, 0.08, 12), x, y - 0.3, z), BRASS));
    solid(paint(place(new ConeGeometry(0.2, 0.16, 12), x, y + 0.36, z), BRASS));
  }

  // ---- the glowing things ----
  const bulbs = kit.inst('bulb', new SphereGeometry(0.12, 14, 10), NB, new Array(NB).fill(0x332a20), { basic: true, glow: false, scales: BL.map(b => b[3]) });
  const owl = kit.mesh('owl', owlSleepyGeo(), { glow: false }), eyes = kit.mesh('owlEyes', owlEyesGeo(), { glow: false });
  const key = kit.mesh('key', place(merge([paint(place(new TorusGeometry(0.055, 0.017, 6, 14), -0.15), 0xffd86a), paint(new BoxGeometry(0.24, 0.03, 0.03), 0xe8c050),
    paint(place(new BoxGeometry(0.03, 0.06, 0.02), 0.09, -0.04), 0xe8c050), paint(place(new BoxGeometry(0.03, 0.045, 0.02), 0.04, -0.035), 0xe8c050)]), 0, 0, 0, 0, 0, 0, 1.6), { glow: false, glowHex: 0xffd86a });
  key.mat.emissiveIntensity = 0.35;
  // levels 2-3: the decoys (posed by the runner from the level's data; spare ones stay hidden), each with its own soft
  // moonlit glow (the tower is dimmed): bats 0-3 hang in the room (scale 1.35), 4-5 are big ones up in the dome; a bat's open eye
  const NBAT = 6, NJAR = 4, BAT_S = [1.35, 1.35, 1.35, 1.35, 2.4, 2.4];
  let eyes2 = null, cloud = null, shutter = null;
  if (LV) {
    kit.inst('dbat', batGeo(), NBAT, Array(NBAT).fill(0xffffff), { glow: false, emissive: 0x6a5a9a, emissiveIntensity: 0.4, scales: BAT_S });
    kit.inst('djar', mothJarGeo(), NJAR, Array(NJAR).fill(0xffffff), { glow: false, emissive: 0x6a9a80, emissiveIntensity: 0.22 });
    eyes2 = kit.inst('dbeye', new SphereGeometry(0.02, 8, 6), NBAT, Array(NBAT).fill(0xffd040), { basic: true, glow: false, scales: BAT_S });
    eyes2.visible = false;
  }
  if (L3) {   // the timing gate's looks: a little cloud over the owl's lantern, a turning brass shutter round the big lamp
    cloud = kit.mesh('cloud', cloudGeo(), { glow: false }); cloud.mat.emissive.setHex(0x7a84b0); cloud.mat.emissiveIntensity = 0.35; cloud.mesh.visible = false;
    shutter = kit.mesh('shutter', shutterGeo(), { glow: false }); shutter.mat.emissive.setHex(0x8a6a30); shutter.mat.emissiveIntensity = 0.3; shutter.mesh.visible = false;
  }
  // the soft radial light texture (the course's one new canvas, 64 px)
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g2 = cv.getContext('2d'), gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.62)'); gr.addColorStop(0.55, 'rgba(255,255,255,.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64);
  const soft = kit.tex(new CanvasTexture(cv)); soft.colorSpace = SRGBColorSpace;
  // light quads: { b: bulb index or a channel, k: 'floor'|'wallX+'|'wallX-'|'wallZ'|'halo', p, r, c, a }
  const WARM = [1.0, 0.74, 0.42], COOL = [0.78, 0.84, 1.0], Q = [];
  const pool = (b, k, x, y, z, r, a, c = WARM) => Q.push({ b, k, p: [x, y, z], r, a, c });
  for (let i = 0; i < 3; i++) pool(i, 'floor', BL[i][0], 0.765, BL[i][2], 0.5, 0.55);
  pool(-1, 'floor', -2.2, 0.02, -3.2, 1.6, 0.32);                               // the lesson pool (all three)
  const STEP = [0.25, 0.75, 1.0];
  for (let i = 3; i < 6; i++) { pool(i, 'wallX+', -7.46, BL[i][1], BL[i][2], 1.15, 0.5); pool(i, 'floor', -6.9, STEP[i - 3] + 0.012, BL[i][2], 0.62, 0.55); }
  for (const [y, z] of [[0.5, 0.4], [1.0, -1.2], [0.0, 2.1]]) pool(-2, 'floor', y ? -6.9 : -6.4, y + 0.012, z, y ? 0.6 : 1.0, 0.5);   // the path: lit when the stair is done
  for (let i = 6; i < 9; i++) { pool(i, 'wallZ', BL[i][0], BL[i][1], -7.46, 1.0, 0.45); pool(i, 'floor', BL[i][0], 0.02, -6.3, 0.85, 0.4); }
  pool(9, 'floor', 6.5, 0.02, -6.5, 2.1, 0.6); pool(9, 'wallZ', 6.3, 1.7, -7.46, 1.8, 0.5); pool(9, 'wallX-', 7.46, 1.7, -6.3, 1.8, 0.5);
  pool(TELE, 'floor', BL[TELE][0], 0.02, BL[TELE][2], 3.4, 0.55); pool(TELE, 'wallX-', 7.46, 2.2, BL[TELE][2], 2.6, 0.4);
  if (L3) { pool(19, 'wallX+', -7.46, BL[19][1], BL[19][2], 1.15, 0.5); pool(19, 'floor', -6.9, 0.02, BL[19][2], 0.62, 0.55); pool(20, 'wallZ', BL[20][0], BL[20][1], -7.46, 1.0, 0.45); pool(20, 'floor', BL[20][0], 0.02, -6.3, 0.85, 0.4); }
  const NPOOL = Q.length;
  for (let i = 0; i < NB; i++) Q.push({ b: i, k: 'halo', p: [0, 0, 0], r: i >= 10 && i < 15 ? 0.75 : i === TELE ? 1.5 : i >= WAND ? (i === ORB ? 0.75 : 0.42) : 0.42, a: 1, c: i >= 10 && i < 15 ? COOL : WARM });
  const RIM = Q.length; Q.push({ b: -3, k: 'halo', p: [0, 0, 0], r: 1.25, a: 1, c: COOL });            // moonlight behind the hero (a rim round his silhouette)
  const HPOOL = Q.length; Q.push({ b: -3, k: 'floor', p: [0, 0.03, 0], r: 1.3, a: 1, c: WARM });          // the wand's pool at his feet
  const DH = Q.length, MINT = [0.72, 1.0, 0.82];                                                       // levels 2-3: a soft moonlit halo behind each decoy of the station
  if (LV) for (let j = 0; j < 2; j++) Q.push({ b: -5, k: 'halo', p: [0, 0, 0], r: 0.5, a: 1, c: COOL });
  const quads = kit.inst('light', new PlaneGeometry(1, 1), Q.length, new Array(Q.length).fill(0), { basic: true, additive: true, map: soft, glow: false });
  quads.renderOrder = 3;
  Q.forEach((q, i) => {
    if (q.k === 'halo') return;
    const ry = q.k === 'wallX+' ? Math.PI / 2 : q.k === 'wallX-' ? -Math.PI / 2 : 0, rx = q.k === 'floor' ? -Math.PI / 2 : 0;
    _m4.compose(_v.set(q.p[0], q.p[1], q.p[2]), _q.setFromEuler(_e.set(rx, ry, 0)), _s.set(q.r * 2, q.r * 2, 1)); quads.setMatrixAt(i, _m4);
  });
  // the constellation: 7 outline bars (ear notches between the ears) + the face that appears at the end
  const P = CAT, A = [-0.6, 0.45], Bn = [0.6, 0.45];
  const SEG = [[P[0], A, 0, 1], [A, Bn, 0, 1], [Bn, P[1], 0, 1], [P[1], P[2], 1, 2], [P[2], P[3], 2, 3], [P[3], P[4], 3, 4], [P[4], P[0], 4, 0]];
  for (const sx of [-1, 1]) { SEG.push([[sx * 0.62, -0.05], [sx * 0.62, 0.15], -1, -1]); SEG.push([[sx * 0.45, -0.78], [sx * 1.45, -0.55], -1, -1]); SEG.push([[sx * 0.45, -0.9], [sx * 1.45, -1.05], -1, -1]); }
  SEG.push([[-0.12, -0.6], [0.12, -0.6], -1, -1]);
  const lines = kit.inst('lines', new BoxGeometry(1, 0.07, 0.07), SEG.length, new Array(SEG.length).fill(0xffe9a0), { basic: true, glow: false });
  const segs = SEG.map(([a, b, i, j]) => {
    const A3 = new Vector3(...starAt(a[0], a[1])), B3 = new Vector3(...starAt(b[0], b[1])), d = B3.clone().sub(A3), len = d.length();
    return { A: A3, d: d.normalize(), len, q: new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), d), i: i + 10, j: j + 10, face: i < 0, k: 0 };
  });
  for (let i = 0; i < SEG.length; i++) lines.setColorAt(i, _c.setRGB(2.2, 1.9, 1.1));
  // the dome fills with stars at the end: 90 more, faded in by scale
  const NS = 90, sky = kit.inst('sky', new SphereGeometry(0.07, 6, 5), NS, new Array(NS).fill(0xffffff), { basic: true, glow: false });
  const skyAt = []; for (let i = 0; i < NS; i++) skyAt.push([Math.sin(i * 7.7 + 1) * 7.2, 12.75 - (i % 5) * 0.05, Math.cos(i * 3.1 + 2) * 7.2, 0.6 + ((i * 37) % 10) / 10, (i * 53 % 90) / 90]);
  for (let i = 0; i < NS; i++) sky.setColorAt(i, _c.setRGB(2.4, 2.3, 1.9));

  // ---- state the effects leave behind (put back by reset) ----
  let pathK = 0, flare = 0, awake = 0, keyK = 0, faceK = 0, skyK = 0, wandK = 0, profK = 0, orbT = -1, orbCool = 0, pb = 0, hooted = 0;
  const lev = new Float32Array(NB), lastP = new Map(), orbA = new Vector3(), orbB = new Vector3(), tip = new Vector3(), ptip = new Vector3(), vA = new Vector3(), vB = new Vector3(), cdir = new Vector3();
  let liftOf = null, hand = null, arm = null, heroObj = null, pwand = null, pfig = null;
  const OWL = [CX, 0.92, CZ, -Math.PI / 4, 1.5], KEY0 = [6.25, 0.04, -6.2], KEY1 = [4.6, 1.5, -4.2];
  const eyeAt = [CX + Math.sin(OWL[3]) * 0.16 * OWL[4], OWL[1] + 0.3 * OWL[4], CZ + Math.cos(OWL[3]) * 0.16 * OWL[4]];
  function poseOwl(t, open) {
    owl.pose(OWL[0], OWL[1] + (awake ? Math.max(0, Math.sin(t * 2.2)) * 0.02 : 0), OWL[2], awake ? 0 : 0.12, OWL[3] + (awake ? Math.sin(t * 0.9) * 0.15 : 0), awake ? 0 : Math.sin(t * 0.8) * 0.05, OWL[4]);
    eyes.pose(eyeAt[0], eyeAt[1], eyeAt[2], 0, OWL[3] + (awake ? Math.sin(t * 0.9) * 0.15 : 0), 0, OWL[4]);
    eyes.mesh.scale.y = OWL[4] * Math.max(0.02, open); eyes.mesh.visible = open > 0.03;
  }
  function poseKey(t, k) {
    const e = k * k * (3 - 2 * k), hop = Math.sin(Math.min(1, k * 1.4) * Math.PI) * 0.9;
    key.pose(KEY0[0] + (KEY1[0] - KEY0[0]) * e, KEY0[1] + (KEY1[1] - KEY0[1]) * e + hop + (k >= 1 ? Math.sin(t * 2) * 0.03 : 0), KEY0[2] + (KEY1[2] - KEY0[2]) * e,
      k > 0 ? 0 : Math.PI / 2, k >= 1 ? t * 0.8 : k * 6, k > 0 ? -Math.PI / 2 * e : 0.5);
  }
  const blinkOpen = (t) => { const u = t % 3.7; return u < 0.12 ? 0.1 : 1; };
  const setBulb = (i, x, y, z, s, r, g, b) => { _m4.compose(_v.set(x, y, z), _q.identity(), _s.setScalar(BL[i][3] * s)); bulbs.setMatrixAt(i, _m4); bulbs.setColorAt(i, _c.setRGB(r, g, b)); };

  return {
    reset(M) {
      pathK = 0; flare = 0; awake = 0; keyK = 0; faceK = 0; skyK = 0; orbT = -1; orbCool = 0; pb = 0; hooted = 0; lastP.clear();
      if (LV) for (let i = 0; i < NBAT; i++) { M['dbat' + i].pose(0, -50, 0, 0, 0, 0, 0); M['dbeye' + i].pose(0, -50, 0, 0, 0, 0, 0); if (i < NJAR) M['djar' + i].pose(0, -50, 0, 0, 0, 0, 0); }
      poseOwl(0, 0); poseKey(0, 0);
      for (const s of segs) s.k = 0;
    },
    tick(M, t, st, K, dt = 0.016) {
      if (!K) return;
      const { player, camera, worldOff } = ctx;
      if (!liftOf) { liftOf = new Array(NB).fill(null); for (const L of [...K.lesson, ...K.stations.flat()]) { L.bi = Number(L.mv.name.slice(4)); liftOf[L.bi] = L; } }
      // levels: a done thing is fully lit; the one being lit follows its p
      let rising = null, done = 0;
      for (const i of LIT) {
        const L = liftOf[i]; const want = L ? (L.done ? 1 : L.p) : 0;
        lev[i] += (want - lev[i]) * Math.min(1, dt * 8);
        if (L && L.done) done++;
        if (L && !L.done && st.sub === 'cast') { const lp = lastP.get(L) ?? 0; if (L.p > lp + 1e-4) rising = L; lastP.set(L, L.p); }
      }
      // the room dims while the course runs and each light gives some back; the big lamp gives it all
      st.dimGoal = (st.phase === 'reward' || (liftOf[TELE] && liftOf[TELE].done)) ? 0 : Math.max(0.35, 1 - done * 0.035);
      // the hero's wand tip: the hand_r bone of the rigged hero (pushed out along the forearm), else the chibi's hand
      const hero = player.hero && player.hero.obj;
      if (hero !== heroObj) { heroObj = hero; hand = hero ? hero.getObjectByName('hand_r') : null; arm = hero ? hero.getObjectByName('lowerarm_r') : null; }
      if (hand && arm) { hand.getWorldPosition(tip); arm.getWorldPosition(vA); tip.addScaledVector(vB.copy(tip).sub(vA).normalize(), 0.24); }
      else tip.set(player.pos.x + Math.sin(player.yaw) * 0.45, player.pos.y + 1.05, player.pos.z + Math.cos(player.yaw) * 0.45);
      tip.sub(worldOff);
      const wantW = rising || st.hold ? 1 : st.sub === 'cast' ? 0.3 : 0;
      wandK += (wantW - wandK) * Math.min(1, dt * 6);
      // a warm orb flies from the wand to the thing being lit, again every half second while it is fed
      orbCool -= dt;
      if (rising && orbCool <= 0 && orbT < 0) { const b = BL[rising.bi]; orbA.copy(tip); orbB.set(b[0], b[1], b[2]); orbT = 0; orbCool = 0.5; }
      let orbL = 0;
      if (orbT >= 0) {
        orbT += dt / Math.min(0.55, 0.2 + orbA.distanceTo(orbB) * 0.035); const k = Math.min(1, orbT);
        vA.lerpVectors(orbA, orbB, k); vA.y += Math.sin(k * Math.PI) * 0.35; orbL = 1;
        if (k >= 1) { orbT = -1; kit.burst(orbB.x, orbB.y, orbB.z, 4); }
      }
      // Sinistra's wand: raised while she says Lumos (the runner holds st.raise), its tip lit
      const f = ctx.prof();
      if (f !== pfig) { pfig = f; pwand = null; const rig = f && f.userData.rig; if (rig) for (const c of rig.armR.children) if (c.geometry && c.geometry.parameters && c.geometry.parameters.radiusTop === 0.012) pwand = c; }
      profK += ((st.raise > 0 ? 1 : 0) - profK) * Math.min(1, dt * 5);
      if (pwand && profK > 0.01) {
        pwand.updateWorldMatrix(true, false); pwand.localToWorld(ptip.set(0, 0.17, 0)); pwand.localToWorld(vB.set(0, -0.17, 0));
        f.userData.rig.armR.getWorldPosition(cdir); if (vB.distanceTo(cdir) > ptip.distanceTo(cdir)) ptip.copy(vB);
        ptip.sub(worldOff);
      }

      // bulbs
      let cur = null;
      if (st.sub === 'cast' && st.lifts) { if (st.sel && !st.sel.done) cur = st.sel; else for (const L of st.lifts) if (!L.done) { cur = L; break; } }
      for (const i of LIT) {
        const L = liftOf[i], b = BL[i], l = lev[i], star = i >= 10 && i < 15;
        const open = L && !L.done && st.sub === 'cast' && st.lifts && st.lifts.includes(L) && (!L.inOrder || L === cur);
        const tw = open ? 0.3 + 0.22 * Math.sin(t * 6 + i) : 0;
        const k = 0.5 + 2.6 * l + (isLamp(i) ? flare : 0) + (i === TELE ? skyK * 1.5 : 0);
        const base = star ? 0.25 : 0.2, cr = star ? 0.85 : 1, cg = star ? 0.9 : 0.8, cb = star ? 1 : 0.46;
        if (l > 0.02) setBulb(i, b[0], b[1], b[2], 1 + 0.12 * l + (star ? Math.sin(t * 3 + i) * 0.06 * l : 0), cr * k, cg * k, cb * k);
        else setBulb(i, b[0], b[1], b[2], 1 + tw * 0.25, base + tw * cr, base * 0.85 + tw * cg, base * 0.6 + tw * cb * 0.7);
        if (LV && L && (L.flash > 0 || L.shake > 0)) {   // levels 2-3: shown in the order preview (it blooms) / lit out of turn (a red flicker)
          const f = L.flash > 0 ? Math.sin(Math.min(1, L.flash / 0.75) * Math.PI) : 0, sh = L.shake > 0 ? Math.min(1, L.shake / 0.4) : 0, kk = 0.5 + 2.6 * l + 3 * f;
          setBulb(i, b[0] + Math.sin(t * 41) * 0.035 * sh, b[1] + Math.sin(t * 37) * 0.02 * sh, b[2], 1 + 0.12 * l + 0.8 * f, cr * kk + 0.7 * sh, cg * kk + 0.12 * sh, cb * kk + 0.08 * sh);
        }
      }
      setBulb(WAND, tip.x, tip.y, tip.z, wandK > 0.02 ? 1 + 0.2 * Math.sin(t * 9) * wandK : 0, 3 * wandK, 2.6 * wandK, 1.6 * wandK);
      setBulb(ORB, vA.x, vA.y, vA.z, orbL, 3.2, 2.6, 1.4);
      setBulb(PROF, ptip.x, ptip.y, ptip.z, profK > 0.02 ? 1 + 0.25 * Math.sin(t * 8) : 0, 3 * profK, 2.7 * profK, 1.8 * profK);
      bulbs.instanceMatrix.needsUpdate = true; bulbs.instanceColor.needsUpdate = true;

      // light quads: pools follow their bulb, halos face the camera
      const fl = 0.94 + 0.04 * Math.sin(t * 7.3) + 0.02 * Math.sin(t * 17.1), dimK = st.dim || 0;
      const lesson3 = (lev[0] + lev[1] + lev[2]) / 3;
      for (let i = 0; i < Q.length; i++) {
        const q = Q[i]; let a;
        if (i < NPOOL) a = q.b === -1 ? lesson3 : q.b === -2 ? pathK : lev[q.b];
        else if (i === RIM || i === HPOOL) a = i === RIM ? 0.05 + 0.13 * dimK : 0.15 * dimK + 0.45 * wandK;
        else if (q.b === -5) {   // levels 2-3: the halo behind decoy j of the station (cool for a bat, mint for the moth jar)
          const D = st.phase === 'course' && st.decoys ? st.decoys[i - DH] : null;
          if (D) {
            const bat = D.spec.m.startsWith('dbat'), sc = bat ? D.mv.scale : 1, at = D.spec.at;
            vB.set(at[0], at[1] + D.spec.aimY, at[2]); cdir.copy(camera.position).sub(worldOff).sub(vB).normalize(); vB.addScaledVector(cdir, -0.25 * sc);
            a = (bat ? 0.3 : 0.42) * (0.85 + 0.15 * Math.sin(t * 1.3 + i)); q.c = bat ? COOL : MINT;
            _m4.compose(vB, camera.quaternion, _s.setScalar((bat ? 0.75 : 0.95) * sc)); quads.setMatrixAt(i, _m4);
          } else a = 0;
        } else {
          a = q.b === WAND ? wandK * 0.8 : q.b === ORB ? orbL * 0.9 : q.b === PROF ? profK : lev[q.b] * 0.55 + (q.b === TELE ? skyK * 0.4 : 0);
          const open = liftOf[q.b] && !liftOf[q.b].done && cur && (cur === liftOf[q.b] || (!cur.inOrder && st.lifts.includes(liftOf[q.b])));
          if (open && lev[q.b] < 0.3) a += 0.18 + 0.12 * Math.sin(t * 6 + q.b);   // the unlit target twinkles
          if (LV && liftOf[q.b] && liftOf[q.b].flash > 0) a += 1.1 * Math.sin(Math.min(1, liftOf[q.b].flash / 0.75) * Math.PI);   // (levels 2-3: the order preview)
          const p = q.b === WAND ? tip : q.b === ORB ? vA : q.b === PROF ? ptip : vB.set(BL[q.b][0], BL[q.b][1], BL[q.b][2]);
          _m4.compose(p, camera.quaternion, _s.setScalar(q.r * 2 * (0.8 + 0.4 * Math.min(1, a)))); quads.setMatrixAt(i, _m4);
        }
        if (i === RIM) {        // behind the hero, away from the camera: his silhouette gets a soft moonlit edge
          vB.set(player.pos.x, player.pos.y + 0.95, player.pos.z); cdir.copy(vB).sub(camera.position).normalize();   // along the view ray: straight behind him on screen
          vB.addScaledVector(cdir, 0.45).sub(worldOff);
          _m4.compose(vB, camera.quaternion, _s.set(0.95, 2.0, 1)); quads.setMatrixAt(i, _m4);
        } else if (i === HPOOL) {
          _m4.compose(vB.set(player.pos.x - worldOff.x, 0.03, player.pos.z - worldOff.z), _q.setFromEuler(_e.set(-Math.PI / 2, 0, 0)), _s.set(2.6, 2.6, 1)); quads.setMatrixAt(i, _m4);
        }
        a *= q.a * (i < NPOOL ? fl : 1);
        quads.setColorAt(i, _c.setRGB(q.c[0] * a, q.c[1] * a, q.c[2] * a));
      }
      quads.instanceMatrix.needsUpdate = true; quads.instanceColor.needsUpdate = true;

      // the constellation grows between lit stars; the face comes with catShine
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i], want = s.face ? faceK : (liftOf[s.i].done && liftOf[s.j].done ? 1 : 0);
        s.k += (want - s.k) * Math.min(1, dt * 4);
        const L = s.len * s.k;
        _m4.compose(vB.copy(s.A).addScaledVector(s.d, L / 2), s.q, _s.set(Math.max(0.0001, L), s.k > 0.01 ? 1 : 0, s.k > 0.01 ? 1 : 0)); lines.setMatrixAt(i, _m4);
      }
      lines.instanceMatrix.needsUpdate = true;
      lines.visible = st.phase === 'reward' || (st.phase === 'course' && st.step >= 3);
      sky.visible = skyK > 0;
      if (sky.visible) {
        for (let i = 0; i < NS; i++) { const s = skyAt[i], k = Math.max(0, Math.min(1, (skyK - s[4] * 0.6) / 0.4)); _m4.compose(_v.set(s[0], s[1], s[2]), _q.identity(), _s.setScalar(k * s[3] * (0.85 + 0.25 * Math.sin(t * 3 + i)))); sky.setMatrixAt(i, _m4); }
        sky.instanceMatrix.needsUpdate = true;
      }
      if (!st.fx) { poseOwl(t, awake ? blinkOpen(t) : 0); poseKey(t, keyK); }
      if (LV) {
        // a lit decoy (the runner's shake): a bat squeaks softly and opens one eye a moment, the moon-moths flutter
        const ds = st.decoys || [];
        if (eyes2) for (let j = 0; j < NBAT; j++) M['dbeye' + j].pose(0, -50, 0, 0, 0, 0, 0);
        let eyeOn = false;
        for (const D of ds) {
          const sh = D.shake || 0, prev = D.sh0 || 0, bat = D.spec.m.startsWith('dbat'); D.sh0 = sh;
          if (sh > prev + 0.3) {
            if (bat) { fun.sfx.tone(2500, 0.07, 'triangle', 0.05, 0, 3300); fun.sfx.tone(2900, 0.06, 'triangle', 0.04, 0.1, 2200); }
            else for (let n = 0; n < 4; n++) fun.sfx.tone(480 + n * 70, 0.04, 'sine', 0.035, n * 0.06);
          }
          if (bat && sh > 0.1) {
            const j = Number(D.spec.m.slice(4)), s0 = D.mv.scale, a = D.spec.at, k = Math.min(1, sh / 0.4), ry = (D.spec.ry || 0) + Math.sin(t * 22) * 0.38 * k;
            const ex = BAT_EYE[0] * s0, ez = BAT_EYE[2] * s0;
            M['dbeye' + j].pose(a[0] + ex * Math.cos(ry) + ez * Math.sin(ry), a[1] + BAT_EYE[1] * s0, a[2] - ex * Math.sin(ry) + ez * Math.cos(ry), 0, 0, 0, 1); eyeOn = true;
          }
        }
        if (eyes2) eyes2.visible = eyeOn;
      }
      if (cloud) {             // level 3, the owl's corner: the little cloud covers the lantern, then drifts aside while the gate is open
        const Lc = liftOf[9], on = st.phase === 'course' && st.step === 2;
        cloud.mesh.visible = on;
        if (on) {
          const k = Lc && Lc.gate ? Lc.gateK : 1, e = k * k * (3 - 2 * k), b = BL[9];
          vA.set(camera.position.x - worldOff.x - b[0], 0, camera.position.z - worldOff.z - b[2]).normalize();
          cloud.pose(b[0] + vA.x * 0.5 + vA.z * e * 1.05 + Math.sin(t * 0.9) * 0.04, b[1] + 0.03 + e * 0.3 + Math.sin(t * 1.3) * 0.03, b[2] + vA.z * 0.5 - vA.x * e * 1.05,
            0, Math.atan2(vA.x, vA.z), Math.sin(t * 0.7) * 0.05, 1.3);
        }
      }
      if (shutter) {           // level 3, the big lamp: its brass shutter faces the camera (closed) and turns away while the gate is open
        const vis = st.phase === 'reward' || (st.phase === 'course' && st.step >= 3);
        shutter.mesh.visible = vis;
        if (vis) {
          const Lt = liftOf[TELE], k = st.phase === 'reward' || !Lt || !Lt.gate ? 1 : Lt.gateK, e = k * k * (3 - 2 * k), b = BL[TELE];
          shutter.pose(b[0], b[1], b[2], 0, Math.atan2(camera.position.x - worldOff.x - b[0], camera.position.z - worldOff.z - b[2]) + e * Math.PI * 0.92, 0);
        }
      }
    },
    effects: {
      // the stair path lights step by step (2 s)
      stairPath(M, t, quiet) {
        pathK = Math.min(1, t / 1.2);
        const n = Math.min(3, Math.floor(t / 0.35));
        while (pb < n) { const z = [2.1, 0.4, -1.2][pb], y = [0, 0.5, 1.0][pb]; pb++; if (!quiet) { kit.burst(-6.8, y + 0.2, z, 8); fun.sfx.tink(1 + pb); } }
        return t < 1.8;
      },
      // the three star lamps sing a little chord and flare together (1.6 s)
      lampChord(M, t, quiet) {
        if (!quiet && t < 0.05 && !hooted) { hooted = 1; fun.sfx.tune([1047, 1319, 1568, 2093], 0.12, 'sine'); for (const i of L3 ? [6, 7, 8, 20] : [6, 7, 8]) kit.burst(BL[i][0], BL[i][1], BL[i][2], 8); }
        flare = Math.max(0, Math.sin(Math.min(1, t / 1.4) * Math.PI)) * 2.2;
        if (t >= 1.6) { flare = 0; hooted = 0; }
        return t < 1.6;
      },
      // the sleepy owl blinks awake, hoots, and the key he was keeping hops over to the telescope (3 s)
      owlWake(M, t, quiet) {
        awake = 1;
        const open = t < 0.5 ? t / 0.5 : (t > 1.0 && t < 1.12) || (t > 1.4 && t < 1.52) ? 0.1 : 1;
        if (!quiet && t > 0.5 && hooted < 1) { hooted = 1; fun.sfx.hoot(); }
        if (!quiet && t > 1.3 && hooted < 2) { hooted = 2; fun.sfx.hoot(); }
        keyK = Math.max(0, Math.min(1, (t - 1.5) / 1.1));
        if (!quiet && keyK >= 1 && hooted < 3) { hooted = 3; kit.burst(KEY1[0], KEY1[1], KEY1[2], 12); fun.sfx.chime(); }
        poseOwl(t, open); poseKey(t, keyK);
        if (t >= 3.0) hooted = 0;
        return t < 3.0;
      },
      // the cat's face appears between the stars, it twinkles (2.4 s)
      catShine(M, t, quiet) {
        faceK = Math.min(1, t / 1.0);
        if (!quiet && !hooted && t > 0.05) { hooted = 1; fun.sfx.tune([784, 988, 1175, 1568], 0.14, 'sine'); kit.burst(STAR_C[0], STAR_C[1], STAR_C[2], 16); }
        if (t >= 2.4) hooted = 0;
        return t < 2.4;
      },
      // the big lamp blazes, the dome fills with stars and the tower is bright again (4 s)
      skyFill(M, t, quiet) {
        skyK = Math.min(1, t / 2.6);
        if (!quiet && Math.floor(t / 0.5) > hooted && t < 3) { hooted++; kit.burst(Math.sin(hooted * 2.3) * 5, 10.5, Math.cos(hooted * 1.7) * 5 - 1, 10); fun.sfx.tink(1 + (hooted % 3)); }
        if (t >= 4.0) hooted = 0;
        return t < 4.0;
      },
    },
  };
}

// A sitting cat (origin: floor centre, faces +z). tabby: warm orange with stripes, a cream chest and two
// little square "spectacle" marks round the eyes (a nod to Professor McGonagall); else a grey stone statue.
function catGeo(tabby) {
  const A = tabby ? 0xd8893a : 0x6e6b66, B = tabby ? 0xe8a050 : 0x8e8a82, CREAM = tabby ? 0xf4e2bc : 0x827e76, EAR = tabby ? 0xf0a0a0 : 0x6e6b66;
  const fur = (g) => tabby ? stripe(g, A, 0x9a5420, 'y', 34) : paint(g, A, B);
  const parts = [
    fur(place(new SphereGeometry(0.2, 14, 10), 0, 0.2, -0.03, 0, 0, 0, 0.85, 1.08, 1.0)),
    paint(place(new SphereGeometry(0.13, 12, 8), 0, 0.24, 0.09), CREAM),
    ...[-1, 1].map(s => fur(place(new SphereGeometry(0.11, 10, 8), s * 0.12, 0.1, -0.06))),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.05, 8, 6), s * 0.07, 0.035, 0.15, 0, 0, 0, 1, 0.7, 1.3), CREAM)),
    fur(place(new SphereGeometry(0.14, 14, 10), 0, 0.47, 0.06, 0, 0, 0, 1.1, 0.95, 1)),
    paint(place(new SphereGeometry(0.06, 10, 8), 0, 0.43, 0.165, 0, 0, 0, 1.3, 0.8, 1), CREAM),
    ...[-1, 1].map(s => paint(place(new ConeGeometry(0.055, 0.11, 4), s * 0.085, 0.6, 0.05, 0, Math.PI / 4, -s * 0.25), A)),
    ...[-1, 1].map(s => paint(place(new ConeGeometry(0.03, 0.06, 4), s * 0.085, 0.595, 0.062, 0, Math.PI / 4, -s * 0.25), EAR)),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.026, 8, 6), s * 0.052, 0.49, 0.178), tabby ? 0x7ac04a : 0x9a968e)),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.013, 6, 4), s * 0.052, 0.49, 0.2, 0, 0, 0, 0.6, 1.2, 1), tabby ? 0x141018 : 0x7a766e)),
    paint(place(new SphereGeometry(0.016, 6, 4), 0, 0.45, 0.225), tabby ? 0xe88a9a : 0x8a867e),
    fur(place(new TorusGeometry(0.15, 0.032, 6, 12, Math.PI * 1.1), 0.02, 0.03, -0.04, -Math.PI / 2, 0, -0.3)),
  ];
  if (tabby) for (const s of [-1, 1]) parts.push(paint(place(new TorusGeometry(0.036, 0.006, 4, 4), s * 0.052, 0.49, 0.183, 0, 0, Math.PI / 4), 0x3a2010));
  return merge(parts);
}
// stripes: hexB bands across `axis` (freq bands per metre), else hexA
function stripe(geo, hexA, hexB, axis = 'y', freq = 30) {
  const n = geo.attributes.position.count, col = new Float32Array(n * 3), a = new Color(hexA), b = new Color(hexB), ax = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  for (let i = 0; i < n; i++) { const v = geo.attributes.position.getComponent(i, ax), k = Math.sin(v * freq) > 0.45 ? 1 : 0; _c.copy(a).lerp(b, k * 0.75); col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new BufferAttribute(col, 3));
  return geo;
}
function starGeo(r = 0.16) {
  const s = new Shape();
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, rr = i % 2 ? r * 0.45 : r; const x = Math.sin(a) * rr, y = Math.cos(a) * rr; if (i) s.lineTo(x, y); else s.moveTo(x, y); }
  return paint(new ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 1 }).translate(0, 0, -0.02), 0xffe070, 0xffb020);
}

// The Transfiguration course props (see COURSES.transfiguration). Every change target is a pair of movers:
// the "before" shape (glows while it waits) and the "after" shape the runner pops in (scale 0 until then).
// A mesh (or an instanced set) is only drawn while its station is near and something of it is showing, so
// the course draws <= 12 meshes at any moment. Free "after" shapes (mice, rabbit, quill, beetle, the cat)
// are posed here once their pop has finished; the effects only advance timers that tick() reads.
function buildTransfiguration(kit) {
  const WOOD = 0x6a4424, DARK = 0x3a2614, STONE = 0x8a8478, STONE2 = 0xa8a294, BRASS = 0xb98b2e, GOLD = 0xd8b04a;
  const BOOKS = [0xb3262a, 0x1f5e9e, 0x2c7a3a, 0xc88a1e, 0x6a3a92, 0xd0602a, 0x1e6a6a];
  const { solid, ctx } = kit;
  const book = (x, y, z, w, h, d, ry, i, out) => {
    out.push(paint(place(new BoxGeometry(w, h, d), x, y + h / 2, z, 0, ry), BOOKS[i % BOOKS.length]));
    out.push(paint(place(new BoxGeometry(w - 0.03, h - 0.025, d + 0.006), x + 0.012, y + h / 2, z, 0, ry), 0xf0e4c0));
  };
  // ---- lesson: a table in front of McGonagall, a goblet, a brass perch; three teacups -> three mice ----
  solid(paint(place(new BoxGeometry(1.8, 0.08, 0.6), -0.05, 0.74, -4.72), WOOD, 0x7a5030));
  for (const sx of [-0.8, 0.7]) solid(paint(place(new BoxGeometry(0.08, 0.7, 0.5), sx, 0.35, -4.72), DARK));
  const PERCH = [1.3, 1.375, -5.0], GOB = [0.72, 0.78, -4.86];
  solid(paint(place(new CylinderGeometry(0.22, 0.26, 0.05, 14), PERCH[0], 0.025, PERCH[2]), DARK));
  solid(paint(place(new CylinderGeometry(0.025, 0.03, 1.36, 6), PERCH[0], 0.68, PERCH[2]), BRASS, GOLD));
  solid(paint(place(new CylinderGeometry(0.018, 0.018, 0.46, 6), PERCH[0], 1.36, PERCH[2], 0, 0, Math.PI / 2), GOLD));
  const cupGeo = merge([
    paint(place(new CylinderGeometry(0.085, 0.06, 0.1, 14, 1, true), 0, 0.075, 0), 0xf8f4ec, 0x4a7ad0),
    paint(place(new CylinderGeometry(0.06, 0.06, 0.01, 14), 0, 0.027, 0), 0xf8f4ec),
    paint(place(new CylinderGeometry(0.075, 0.08, 0.008, 12), 0, 0.12, 0), 0x6a3a1e),            // tea
    paint(place(new CylinderGeometry(0.12, 0.1, 0.022, 16), 0, 0.011, 0), 0xf8f4ec, 0xd8e4f8),   // saucer
    paint(place(new TorusGeometry(0.03, 0.009, 5, 10), 0.09, 0.08, 0, 0, 0, 0), 0xf8f4ec),
  ]);
  kit.inst('cup', place(cupGeo, 0, 0, 0, 0, 0, 0, 1.5), 3, [0xffffff, 0xffeef0, 0xfff6e0], { glowHex: 0xffe08a });
  const mouseGeo = merge([
    paint(place(new SphereGeometry(0.07, 12, 8), 0, 0.06, -0.01, 0, 0, 0, 0.85, 0.8, 1.25), 0xa89a90, 0xc8bab0),
    paint(place(new SphereGeometry(0.05, 10, 8), 0, 0.085, 0.085, 0, 0, 0, 0.9, 0.9, 1.1), 0xb8aaa0),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.03, 8, 6), s * 0.04, 0.135, 0.07, 0, 0, 0, 1, 1, 0.35), 0xf0b0b8)),
    paint(place(new SphereGeometry(0.012, 6, 4), 0, 0.085, 0.14), 0xe87a8a),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.009, 5, 4), s * 0.025, 0.1, 0.125), 0x141018)),
    paint(place(new TorusGeometry(0.06, 0.006, 4, 10, Math.PI), 0, 0.03, -0.1, Math.PI / 2, 0, Math.PI / 2), 0xe0a0a8),
  ]);
  kit.inst('mouse', place(mouseGeo, 0, 0, 0, 0, 0, 0, 1.6), 3, [0xffffff, 0xfff0e8, 0xf0f0ff], { glow: false });
  kit.mesh('goblet', merge([paint(place(new CylinderGeometry(0.07, 0.08, 0.02, 12), 0, 0.01, 0), BRASS), paint(place(new CylinderGeometry(0.014, 0.014, 0.1, 6), 0, 0.07, 0), GOLD),
    paint(place(new CylinderGeometry(0.075, 0.04, 0.12, 12, 1, true), 0, 0.18, 0), 0xffd86a, BRASS)]), { glow: false });
  kit.mesh('bird', merge([
    paint(place(new SphereGeometry(0.07, 10, 8), 0, 0.07, 0, 0, 0, 0, 0.9, 0.85, 1.2), 0x4a8ad8, 0x8ac0f0),
    paint(place(new SphereGeometry(0.05, 10, 8), 0, 0.13, 0.06), 0x5a9ae0),
    paint(place(new ConeGeometry(0.016, 0.04, 5), 0, 0.125, 0.115, Math.PI / 2), 0xffb020),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.008, 5, 4), s * 0.025, 0.145, 0.1), 0x141018)),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.05, 8, 6), s * 0.06, 0.08, -0.01, 0, 0, s * 0.5, 0.25, 0.7, 1.1), 0x3a6ac0)),
    paint(place(new BoxGeometry(0.06, 0.012, 0.09), 0, 0.06, -0.1, 0.4), 0x3a6ac0),
    paint(place(new SphereGeometry(0.04, 8, 6), 0, 0.05, 0.035, 0, 0, 0, 0.9, 0.7, 0.8), 0xf0d8a0),
  ]), { glow: false });

  // ---- 1 a bookcase with the star on top; a pile of big books -> three book steps up to it ----
  const SX = TF.shelfX, SZ = TF.pile[2];
  solid(paint(place(new BoxGeometry(0.04, 1.85, 1.0), SX - 0.2, 0.925, SZ), DARK));
  for (const dz of [-0.5, 0.5]) solid(paint(place(new BoxGeometry(0.4, 1.85, 0.05), SX, 0.925, SZ + dz), WOOD));
  for (const y of [0.04, 0.64, 1.24, 1.83]) solid(paint(place(new BoxGeometry(0.42, 0.045, 1.04), SX, y, SZ), WOOD, 0x7a5030));
  { const P = []; let k = 0; for (const y of [0.665, 1.265]) for (let z = SZ - 0.45; z < SZ + 0.42;) { const t = 0.07 + ((k * 37) % 5) * 0.012, h = 0.3 + ((k * 53) % 4) * 0.04; P.push(paint(place(new BoxGeometry(0.26, h, t), SX + 0.03, y + h / 2, z + t / 2), BOOKS[k % BOOKS.length])); z += t + 0.008; k++; } P.forEach(solid); }
  const pile = []; [[0.62, 0.13, 0.46, 0.1], [0.56, 0.12, 0.42, -0.25], [0.6, 0.14, 0.44, 0.3], [0.5, 0.11, 0.38, -0.1], [0.44, 0.1, 0.34, 0.45]].reduce((y, [w, h, d, ry], i) => { book(0, y, 0, w, h, d, ry, i, pile); return y + h; }, 0);
  kit.mesh('books', merge(pile), { glowHex: 0xffd27a });
  const steps = []; let si = 0;
  for (let k = 0; k < 3; k++) { const x = 0.28 - k * 0.45; let y = 0; for (let j = 0; j < (k + 1) * 3; j++) { const h = 0.35 / 3; book(x + ((j * 7) % 3 - 1) * 0.012, y, 0, 0.45, h, 0.8, ((j * 5) % 3 - 1) * 0.03, si++, steps); y += h; } }
  kit.mesh('steps', merge(steps), { glow: false });
  const star = kit.mesh('star', starGeo(), { glow: false, glowHex: 0xffc030 }); star.mat.emissiveIntensity = 0.9;

  // ---- 2 the dim nook (a dark drape and rug): three pumpkins -> three glowing lanterns ----
  solid(paint(place(new BoxGeometry(0.05, 2.6, 2.8), 4.2, 1.3, 1.2), 0x1a1830, 0x2c2646));
  solid(paint(place(new BoxGeometry(0.12, 0.12, 2.9), 4.18, 2.62, 1.2), DARK));
  solid(paint(place(new BoxGeometry(1.3, 0.012, 2.8), 3.6, 0.006, 1.2), 0x24202e, 0x302a3c, 'x'));
  const pumpGeo = merge([
    stripe(place(new SphereGeometry(0.26, 16, 10), 0, 0.2, 0, 0, 0, 0, 1, 0.78, 1), 0xf08a20, 0xc86010, 'x', 22),
    paint(place(new CylinderGeometry(0.025, 0.035, 0.1, 6), 0, 0.42, 0, 0, 0, 0.2), 0x4a6a2a),
    paint(place(new TorusGeometry(0.05, 0.012, 4, 8, Math.PI), 0.05, 0.42, 0, Math.PI / 2), 0x5a8a3a),
  ]);
  kit.inst('pumpkin', pumpGeo, 3, [0xffffff, 0xfff0e0, 0xffe8d0], { glowHex: 0xffa040 });
  const lanternGeo = merge([
    paint(place(new CylinderGeometry(0.16, 0.18, 0.05, 8), 0, 0.025, 0), 0x2e2b30),
    paint(place(new CylinderGeometry(0.12, 0.12, 0.3, 8), 0, 0.2, 0), 0xfff2b0, 0xffd870),
    ...[0, 1, 2, 3].map(i => paint(place(new BoxGeometry(0.025, 0.32, 0.025), Math.cos(i * Math.PI / 2 + Math.PI / 4) * 0.12, 0.2, Math.sin(i * Math.PI / 2 + Math.PI / 4) * 0.12), 0x2e2b30)),
    paint(place(new ConeGeometry(0.17, 0.14, 8), 0, 0.42, 0), 0x2e2b30, 0x4a4650),
    paint(place(new TorusGeometry(0.04, 0.01, 4, 10), 0, 0.53, 0), BRASS),
  ]);
  const lanterns = kit.inst('lantern', place(lanternGeo, 0, 0, 0, 0, 0, 0, 1.3), 3, [0xffffff, 0xffffff, 0xffffff], { glow: false, emissive: 0xffa030, emissiveIntensity: 0.3 });
  // the warm light of the lanterns: ONE instanced additive quad set with a soft canvas (the course's one new canvas)
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g2 = cv.getContext('2d'), gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.6)'); gr.addColorStop(0.6, 'rgba(255,255,255,.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64);
  const soft = kit.tex(new CanvasTexture(cv)); soft.colorSpace = SRGBColorSpace;
  const NQ = 7, glow = kit.inst('glow', new PlaneGeometry(1, 1), NQ, new Array(NQ).fill(0), { basic: true, additive: true, map: soft, glow: false });
  glow.renderOrder = 3;
  const LP = TF.pumpkins.map(([x, z]) => [x, 0, z]);
  for (let i = 0; i < 3; i++) { _m4.compose(_v.set(LP[i][0], 0.02, LP[i][2]), _q.setFromEuler(_e.set(-Math.PI / 2, 0, 0)), _s.set(1.7, 1.7, 1)); glow.setMatrixAt(3 + i, _m4); }
  _m4.compose(_v.set(4.17, 1.1, 1.2), _q.setFromEuler(_e.set(0, -Math.PI / 2, 0)), _s.set(3.4, 2.6, 1)); glow.setMatrixAt(6, _m4);

  // ---- 3 a puddle across the lane: a wobbly broken chair -> a little wooden bridge ----
  solid(paint(place(new CylinderGeometry(0.85, 0.85, 0.012, 24), TF.puddle[0], 0.007, TF.puddle[2], 0, 0, 0, 1.25, 1, 0.75), 0x173f7a, 0x2f6aae));
  for (const [x, z, r] of [[-0.75, 3.2, 0.12], [0.85, 3.95, 0.1], [0.6, 3.05, 0.08]]) solid(paint(place(new CylinderGeometry(r, r, 0.012, 10), x, 0.008, z), 0x1f4a88));
  kit.mesh('chair', merge([
    paint(place(new BoxGeometry(0.46, 0.05, 0.44), 0, 0.46, 0), 0x8a5a30, 0x9a6a38),
    ...[[-1, -1, 0.46], [1, -1, 0.46], [-1, 1, 0.46], [1, 1, 0.3]].map(([a, b, h]) => paint(place(new BoxGeometry(0.05, h, 0.05), a * 0.19, h / 2 + (0.46 - h), b * 0.18), WOOD)),
    ...[-1, 1].map(a => paint(place(new BoxGeometry(0.05, 0.55, 0.05), a * 0.19, 0.76, -0.19), WOOD)),
    paint(place(new BoxGeometry(0.44, 0.07, 0.04), 0, 1.0, -0.19, 0, 0, 0.12), 0x8a5a30),
    paint(place(new BoxGeometry(0.2, 0.06, 0.035), -0.08, 0.72, -0.19, 0, 0, -0.35), 0x8a5a30),
  ]), { glowHex: 0xffc070 });
  const br = [];
  for (let i = 0; i < 9; i++) { const z = -0.8 + i * 0.2, y = 0.06 + Math.sin((i / 8) * Math.PI) * 0.16; br.push(paint(place(new BoxGeometry(0.78, 0.05, 0.18), 0, y, z, Math.cos((i / 8) * Math.PI) * 0.3), 0x9a6a38, 0xb07c40)); }
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 5; i++) { const z = -0.8 + i * 0.4, y = 0.06 + Math.sin((i / 4) * Math.PI) * 0.16; br.push(paint(place(new BoxGeometry(0.05, 0.4, 0.05), sx * 0.37, y + 0.2, z), DARK)); }
    for (let i = 0; i < 4; i++) { const z0 = -0.8 + i * 0.4, y0 = 0.46 + Math.sin((i / 4) * Math.PI) * 0.16, y1 = 0.46 + Math.sin(((i + 1) / 4) * Math.PI) * 0.16; br.push(paint(place(new BoxGeometry(0.045, 0.045, 0.42), sx * 0.37, (y0 + y1) / 2, z0 + 0.2, -Math.atan2(y1 - y0, 0.4)), WOOD)); }
  }
  kit.mesh('bridge', merge(br), { glow: false });

  // ---- 4 three stone pedestals by the south wall: hat -> rabbit, feather -> quill, button -> beetle ----
  for (const x of TF.peds) {
    solid(paint(place(new BoxGeometry(0.5, 0.06, 0.5), x, 0.03, TF.pedZ), STONE));
    solid(paint(place(new CylinderGeometry(0.17, 0.2, 0.68, 10), x, 0.4, TF.pedZ), STONE, STONE2));
    solid(paint(place(new BoxGeometry(0.46, 0.05, 0.46), x, 0.755, TF.pedZ), STONE2));
  }
  kit.mesh('hat', merge([paint(place(new CylinderGeometry(0.2, 0.2, 0.018, 18), 0, 0.009, 0), 0x1a1420), paint(place(new CylinderGeometry(0.12, 0.13, 0.26, 16), 0, 0.14, 0), 0x241c2c, 0x1a1420),
    paint(place(new CylinderGeometry(0.133, 0.133, 0.05, 16), 0, 0.045, 0), 0xb3262a)]), { glowHex: 0xc080ff });
  kit.mesh('rabbit', place(merge([
    paint(place(new SphereGeometry(0.11, 12, 10), 0, 0.1, -0.02, 0, 0, 0, 0.9, 0.95, 1.1), 0xf4f0ea, 0xffffff),
    paint(place(new SphereGeometry(0.075, 12, 10), 0, 0.22, 0.06), 0xffffff),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.03, 8, 6), s * 0.03, 0.34, 0.04, 0, 0, s * -0.15, 0.7, 2.6, 0.5), 0xffffff)),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.018, 6, 5), s * 0.03, 0.34, 0.052, 0, 0, s * -0.15, 0.6, 2.3, 0.3), 0xf6b0c0)),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.012, 6, 4), s * 0.032, 0.235, 0.125), 0x141018)),
    paint(place(new SphereGeometry(0.012, 6, 4), 0, 0.21, 0.135), 0xf08aa0),
    paint(place(new SphereGeometry(0.04, 8, 6), 0, 0.08, -0.14), 0xffffff),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.035, 8, 6), s * 0.05, 0.02, 0.07, 0, 0, 0, 0.8, 0.5, 1.4), 0xf4f0ea)),
  ]), 0, 0, 0, 0, 0, 0, 1.3), { glow: false });
  kit.mesh('feather', place(featherGeo(), 0, 0.1, 0, 0, 0.5, 0.4, 1.35), { glowHex: 0xffd27a });
  kit.mesh('quill', place(merge([
    paint(place(new CylinderGeometry(0.07, 0.08, 0.1, 12), 0, 0.05, 0), 0x1a2a4a, 0x2a3a6a),
    paint(place(new CylinderGeometry(0.035, 0.05, 0.03, 10), 0, 0.11, 0), 0x2a3a6a),
    place(featherGeo(), 0.03, 0.33, 0, 0, Math.PI / 2, Math.PI / 2 - 0.25, 0.95),   // the vane faces +z (the child)
  ]), 0, 0, 0, 0, 0, 0, 1.2), { glow: false });
  kit.mesh('button', merge([paint(place(new CylinderGeometry(0.14, 0.14, 0.04, 20), 0, 0.02, 0, Math.PI / 2 * 0), 0xd8382c, 0xf05a4a),
    paint(place(new TorusGeometry(0.12, 0.014, 5, 20), 0, 0.042, 0, Math.PI / 2), 0xa82a20),
    ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => paint(place(new CylinderGeometry(0.016, 0.016, 0.01, 8), a * 0.035, 0.044, b * 0.035), 0x5a1410))]), { glowHex: 0xff8a6a });
  kit.mesh('beetle', place(merge([
    paint(place(new SphereGeometry(0.08, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.02, -0.01, 0, 0, 0, 0.9, 0.7, 1.15), 0x1a8a6a, 0x3ad0a0),
    paint(place(new BoxGeometry(0.004, 0.056, 0.17), 0, 0.05, -0.01), 0x0a3a2a),
    paint(place(new SphereGeometry(0.035, 8, 6), 0, 0.03, 0.09), 0x1a2a2a),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.01, 5, 4), s * 0.018, 0.045, 0.115), 0xffffff)),
    ...[-1, 0, 1].flatMap(k => [-1, 1].map(s => paint(place(new BoxGeometry(0.06, 0.008, 0.01), s * 0.085, 0.015, k * 0.045, 0, 0, s * -0.4), 0x1a2a2a))),
    ...[-1, 1].map(s => paint(place(new CylinderGeometry(0.004, 0.004, 0.06, 3), s * 0.02, 0.06, 0.13, 0.9, 0, s * -0.4), 0x1a2a2a)),
  ]), 0, 0, 0, 0, 0, 0, 1.6), { glow: false });

  // ---- 5 the finale: a stone plinth beside McGonagall, a big grey cat statue -> a friendly tabby ----
  solid(paint(place(new BoxGeometry(0.66, 0.46, 0.6), TF.plinth[0], 0.23, TF.plinth[2]), STONE, STONE2));
  solid(paint(place(new BoxGeometry(0.74, 0.05, 0.68), TF.plinth[0], 0.475, TF.plinth[2]), STONE2));
  kit.mesh('statue', merge([place(catGeo(false), 0, 0.04, 0, 0, 0, 0, 1.45), paint(place(new BoxGeometry(0.46, 0.05, 0.5), 0, 0.025, 0), 0x66625c)]), { glowHex: 0xffb840 });
  kit.mesh('tabby', place(catGeo(true), 0, 0, 0, 0, 0, 0, 1.1), { glow: false });

  // ---- state the effects leave behind (put back by reset) ----
  let demoT = 0, demoPop = 0, miceT0 = -1, starT = 0, flareT = 0, chord = 0, settle = 0, paradeT = 0, catT = 0, catSfx = 0;
  let Lof = null;
  const lev = new Float32Array(3);
  const popped = (L) => !!L && L.done && L.popT >= POP;
  const ease = (k) => k * k * (3 - 2 * k);
  const clamp01 = (k) => Math.max(0, Math.min(1, k));
  const STAR_HOPS = [[TF.star[0], TF.star[1], TF.star[2]], [-3.24, 1.21, 1.2], [-2.79, 0.86, 1.2], [-2.34, 0.51, 1.2], [-1.2, 1.25, 1.33]];
  const TABLE = [-0.05, 0.78, -4.72];
  // a mesh / instanced set is drawn only while it is showing something and its station is near
  const shows = (mv) => mv.s > 0.001;
  function vis(M, names, near) { let on = false; if (near) for (const n of names) if (M[n] && shows(M[n])) { on = true; break; } M[names[0]].mesh.visible = on; }
  return {
    reset(M) {
      demoT = 0; demoPop = 0; miceT0 = -1; starT = 0; flareT = 0; chord = 0; settle = 0; paradeT = 0; catT = 0; catSfx = 0; lev.fill(0);
      M.goblet.pose(GOB[0], GOB[1], GOB[2], 0, 0, 0, 1); M.bird.pose(GOB[0], GOB[1], GOB[2], 0, 0, 0, 0);
      M.star.pose(STAR_HOPS[0][0], STAR_HOPS[0][1], STAR_HOPS[0][2], 0, 1.04, 0, 1);
      for (let i = 0; i < 7; i++) glow.setColorAt(i, _c.setRGB(0, 0, 0));
    },
    tick(M, t, st, K, dt = 0.016) {
      if (!K) return;
      if (!Lof) { Lof = {}; for (const L of [...K.lesson, ...K.stations.flat()]) Lof[L.mv.name] = L; }
      const ph = st.phase, step = ph === 'course' ? st.step : ph === 'reward' ? 4 : -1;
      const near = (s) => step >= 0 && Math.abs(step - s) <= 1;
      // the goblet -> bird demo (McGonagall's Vera Verto): the goblet wobbles, pops, the bird flutters to the perch
      if (demoT <= 0) { M.goblet.pose(GOB[0], GOB[1], GOB[2], 0, 0, 0, 1); M.bird.pose(GOB[0], GOB[1], GOB[2], 0, 0, 0, 0); }
      else if (demoT < 0.9) { const k = demoT / 0.9; M.goblet.pose(GOB[0], GOB[1], GOB[2], 0, Math.sin(t * 9) * 0.3 * k, Math.sin(t * 17) * 0.15 * k, 1 + 0.1 * k); M.bird.pose(GOB[0], GOB[1], GOB[2], 0, 0, 0, 0); }
      else {
        M.goblet.pose(GOB[0], GOB[1], GOB[2], 0, 0, 0, 0);
        const u = clamp01((demoT - 0.9) / 1.8), e = ease(u), s = Math.min(1, (demoT - 0.9) / 0.25);
        const x = GOB[0] + (PERCH[0] - GOB[0]) * e, y = GOB[1] + 0.15 + (PERCH[1] - GOB[1] - 0.15) * e + Math.sin(u * Math.PI) * 0.45, z = GOB[2] + (PERCH[2] - GOB[2]) * e;
        if (u < 1) M.bird.pose(x, y + Math.sin(t * 30) * 0.02, z, 0, Math.atan2(PERCH[0] - GOB[0], PERCH[2] - GOB[2]), Math.sin(t * 34) * 0.25, s * 1.25);
        else M.bird.pose(PERCH[0], PERCH[1] + Math.max(0, Math.sin(t * 2.6)) * 0.015, PERCH[2], 0, 0.5 + Math.sin(t * 0.9) * 0.35, Math.sin(t * 1.7) * 0.06, 1.25);
      }
      // the mice: a sniff while they wait, then (all three changed) a scurry round the table and they sit up
      const mice = [0, 1, 2].map(i => Lof['cup' + i]);
      if (mice.every(popped)) { if (miceT0 < 0) miceT0 = t; } else miceT0 = -1;
      const mt = miceT0 < 0 ? -1 : t - miceT0;
      for (let i = 0; i < 3; i++) {
        const L = mice[i]; if (!popped(L)) continue;
        const hx = L.arr[0], hy = L.arr[1], hz = L.arr[2], r1 = L.rot1, mv = M['mouse' + i];
        if (mt < 0 || mt > 3.2) { const sit = mt > 3.2 ? Math.min(1, (mt - 3.2) / 0.3) : 0; mv.pose(hx, hy, hz, -0.5 * sit, r1[1] + Math.sin(t * 5 + i * 2) * 0.12, 0, 1 + Math.sin(t * 9 + i) * 0.02); continue; }
        const a = i * 2.1 + mt * 3.0, ex = TABLE[0] + Math.cos(a) * 0.62, ez = TABLE[2] + Math.sin(a) * 0.17;
        const kIn = ease(clamp01(mt / 0.35)), kOut = ease(clamp01((mt - 2.7) / 0.5)), k = kIn * (1 - kOut);
        const yaw = k > 0.5 ? Math.atan2(-Math.sin(a) * 0.62, Math.cos(a) * 0.17) : r1[1];
        mv.pose(hx + (ex - hx) * k, hy + Math.abs(Math.sin(mt * 22 + i)) * 0.012 * k, hz + (ez - hz) * k, 0, yaw, 0, 1);
      }
      // the star waits on the bookcase, then hops down the book steps to the hero and is gone in a sparkle
      if (starT <= 0) M.star.pose(STAR_HOPS[0][0], STAR_HOPS[0][1] + Math.sin(t * 2) * 0.03, STAR_HOPS[0][2], 0, 1.04 + Math.sin(t * 1.3) * 0.35, 0, 1);
      else {
        const seg = Math.min(3, Math.floor(starT / 0.5)), u = clamp01((starT - seg * 0.5) / 0.5), A = STAR_HOPS[seg], B = STAR_HOPS[seg + 1];
        const gone = starT > 2.25 ? clamp01((starT - 2.25) / 0.2) : 0;
        M.star.pose(A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u + Math.sin(u * Math.PI) * (seg < 3 ? 0.3 : 0.15), A[2] + (B[2] - A[2]) * u, 0, 1.04 + starT * 6, 0, (1 - gone) * (1 + gone * 0.5));
      }
      // the lanterns' light: each lit one glows (eased), the chord flares them together
      const flare = flareT > 0 && flareT < 1.6 ? Math.sin(flareT / 1.6 * Math.PI) * 0.8 : 0;
      for (let i = 0; i < 3; i++) { lev[i] += ((popped(Lof['pumpkin' + i]) ? 1 : 0) - lev[i]) * Math.min(1, dt * 3); }
      if (near(1) && (lev[0] + lev[1] + lev[2]) > 0.01) {
        const q = ctx.camera.quaternion, fl = 0.93 + 0.05 * Math.sin(t * 7.3) + 0.02 * Math.sin(t * 17.1);
        for (let i = 0; i < 3; i++) {
          const l = lev[i] * fl + flare * lev[i], P = LP[i];
          _m4.compose(_v.set(P[0], 0.3, P[2]), q, _s.setScalar(lev[i] > 0.01 ? 0.75 + 0.2 * l : 0)); glow.setMatrixAt(i, _m4);
          glow.setColorAt(i, _c.setRGB(2.0 * l, 1.45 * l, 0.75 * l)); glow.setColorAt(3 + i, _c.setRGB(0.75 * l, 0.52 * l, 0.26 * l));
        }
        const w = (lev[0] + lev[1] + lev[2]) / 3 * fl + flare * 0.3; glow.setColorAt(6, _c.setRGB(0.4 * w, 0.28 * w, 0.14 * w));
        glow.instanceMatrix.needsUpdate = true; glow.instanceColor.needsUpdate = true; glow.visible = true;
      } else glow.visible = false;
      lanterns.material.emissiveIntensity = 0.15 + 0.3 * Math.max(lev[0], lev[1], lev[2]) + flare * 0.4;
      // station 4: the rabbit hops, the quill writes, the beetle walks off the pedestal (all after the parade starts)
      const rab = Lof.hat, qu = Lof.feather, bt = Lof.button;
      if (popped(rab)) { const a = rab.arr, hop = paradeT > 0 && paradeT < 1.6 ? Math.abs(Math.sin(paradeT / 1.6 * Math.PI * 3)) * 0.2 : 0; M.rabbit.pose(a[0], a[1] + hop, a[2], Math.sin(t * 7) * 0.03, rab.rot1[1] + Math.sin(t * 0.8) * 0.2, 0, 1); }
      if (popped(qu)) { const a = qu.arr, w = paradeT > 0 && paradeT < 2.6 ? 1 : 0.25; M.quill.pose(a[0], a[1], a[2], Math.sin(t * 6) * 0.12 * w, qu.rot1[1] + Math.sin(t * 3) * 0.2 * w, Math.cos(t * 6) * 0.1 * w, 1); }
      if (popped(bt)) {
        const a = bt.arr, k = clamp01(paradeT / 2.6);
        let x = a[0], y = a[1], z = a[2], yaw = bt.rot1[1];
        if (k > 0) {
          const u1 = clamp01(k / 0.22), u2 = clamp01((k - 0.22) / 0.18), u3 = clamp01((k - 0.4) / 0.6);
          x = a[0] - 0.24 * u1 - 0.22 * u2 - 0.3 * u3; z = a[2] - 0.65 * u3; y = u2 > 0 ? a[1] * (1 - u2) + Math.sin(u2 * Math.PI) * 0.15 : a[1];
          yaw = u3 > 0 ? Math.atan2(-0.3, -0.65) : -Math.PI / 2;
        }
        M.beetle.pose(x, y + Math.abs(Math.sin(t * 18)) * 0.006 * (k > 0 && k < 1 ? 1 : 0), z, 0, yaw + Math.sin(t * 9) * 0.06, 0, 1);
      }
      // the finale cat: stretch, purr (a little shiver), hop down, trot to McGonagall's side and sit facing the child
      const cat = Lof.statue;
      if (popped(cat)) {
        const a = cat.arr, SIT = TF.catSit, k = catT;
        let x = a[0], y = a[1], z = a[2], yaw = cat.rot1[1], sx = 1, sy = 1, sz = 1, rx = 0;
        if (k > 0 && k < 1.4) { const s = Math.sin(k / 1.4 * Math.PI); sz = 1 + 0.2 * s; sy = 1 - 0.14 * s; rx = 0.22 * s; }
        else if (k >= 1.4 && k < 2.4) { x += Math.sin(t * 70) * 0.004; yaw = cat.rot1[1] - 0.3 * ease(clamp01((k - 1.4) / 0.4)); sy = 1 + Math.sin(t * 40) * 0.01; }
        else if (k >= 2.4 && k < 3.2) { const u = (k - 2.4) / 0.8; x = a[0] + (-1.35 - a[0]) * u; z = a[2] + (-5.42 - a[2]) * u; y = a[1] * (1 - u) + Math.sin(u * Math.PI) * 0.3; yaw = Math.atan2(-1.35 - a[0], -5.42 - a[2]); }
        else if (k >= 3.2 && k < 4.6) { const u = ease((k - 3.2) / 1.4); x = -1.35 + (SIT[0] + 1.35) * u; z = -5.42 + (SIT[2] + 5.42) * u; y = Math.abs(Math.sin(k * 11)) * 0.03; yaw = Math.atan2(SIT[0] + 1.35, SIT[2] + 5.42); }
        else if (k >= 4.6) { x = SIT[0]; y = 0; z = SIT[2]; yaw = 0.42 + Math.sin(t * 0.5) * 0.1; sy = 1 + Math.sin(t * 2.2) * 0.015; }
        M.tabby.pose(x, y, z, rx, yaw, 0, 1); M.tabby.mesh.scale.set(sx, sy, sz);
      }
      // what is drawn: the lesson things in the lesson; each station's things while it (or a neighbour) is on
      const les = ph === 'lesson';
      vis(M, ['cup0', 'cup1', 'cup2'], les); vis(M, ['mouse0', 'mouse1', 'mouse2'], les);
      M.goblet.mesh.visible = les && shows(M.goblet); M.bird.mesh.visible = les && shows(M.bird);
      vis(M, ['books'], near(0)); vis(M, ['steps'], near(0)); vis(M, ['star'], near(0));
      vis(M, ['pumpkin0', 'pumpkin1', 'pumpkin2'], near(1)); vis(M, ['lantern0', 'lantern1', 'lantern2'], near(1));
      vis(M, ['chair'], near(2)); vis(M, ['bridge'], near(2));
      for (const n of ['hat', 'rabbit', 'feather', 'quill', 'button', 'beetle']) vis(M, [n], near(3));
      vis(M, ['statue'], les || near(4)); vis(M, ['tabby'], les || near(4));
    },
    effects: {
      // McGonagall's Vera Verto in the lesson: the goblet wobbles, pops into a little bird that flutters to the perch (3 s)
      demo(M, t, quiet) {
        demoT = t;
        if (t > 0.9 && !demoPop) { demoPop = 1; if (!quiet) { kit.burst(GOB[0], GOB[1] + 0.15, GOB[2], 22); fun.sfx.poof(); fun.sfx.tweet(); } }
        if (!quiet && t > 2.7 && demoPop === 1) { demoPop = 2; fun.sfx.tweet(); }
        return t < 3.0;
      },
      // the star hops down the new book steps into the hero's hands (2.6 s)
      starHop(M, t, quiet) {
        const n = Math.min(5, Math.floor(t / 0.5));
        if (!quiet) while (chord < n) { chord++; if (chord <= 3) fun.sfx.tink(chord); else if (chord === 4) { kit.burst(STAR_HOPS[4][0], STAR_HOPS[4][1], STAR_HOPS[4][2], 18); fun.sfx.chime(); } }
        else chord = 5;
        starT = t; if (t >= 2.6) chord = 0;
        return t < 2.6;
      },
      // the three lanterns sing a little chord and flare together (2 s)
      lampGlow(M, t, quiet) {
        flareT = t;
        if (!quiet && !chord) { chord = 1; fun.sfx.tune([784, 988, 1175, 1568], 0.12, 'sine'); for (const P of LP) kit.burst(P[0], 0.4, P[2], 8); }
        if (t >= 2.0) chord = 0;
        return t < 2.0;
      },
      // a few sparkles run along the new bridge (1.6 s)
      bridgeSettle(M, t, quiet) {
        const n = Math.min(3, Math.floor(t / 0.3));
        if (!quiet) while (settle < n) { kit.burst(TF.puddle[0], 0.3, TF.puddle[2] - 0.6 + settle * 0.6, 8); fun.sfx.tink(settle); settle++; }
        else settle = 3;
        return t < 1.6;
      },
      // the rabbit hops, the quill writes, the beetle walks off (2.6 s)
      parade(M, t, quiet) {
        if (!quiet && paradeT < 0.01 && t > 0) fun.sfx.tune([659, 784, 988], 0.1, 'triangle');
        paradeT = t; return t < 2.6;
      },
      // the cat stretches, purrs, hops down and sits beside McGonagall (5.4 s)
      catWake(M, t, quiet) {
        catT = t;
        if (!quiet) {
          if (catSfx < 1 && t > 1.4) { catSfx = 1; for (let i = 0; i < 9; i++) fun.sfx.tone(70 + (i % 2) * 8, 0.09, 'triangle', 0.07, i * 0.1); }
          if (catSfx < 2 && t > 2.2) { catSfx = 2; fun.sfx.tone(620, 0.32, 'sine', 0.12, 0, 820); fun.sfx.tone(820, 0.25, 'sine', 0.1, 0.3, 560); }
          if (catSfx < 3 && t > 4.6) { catSfx = 3; kit.burst(TF.catSit[0], 0.5, TF.catSit[2], 14); fun.sfx.heart(); }
        } else catSfx = 3;
        return t < 5.4;
      },
    },
  };
}

// The Potions course props (see COURSES.potions). All cauldrons are ONE instanced pot mesh (POTS rows); their liquids
// ONE instanced unlit disc set (colour = progress: dull grey -> the potion colour, brighter = glowing); one ladle set,
// one ingredient set, one bubble pool, one soft additive glow-quad set. The station things (the plant, the lamps, the
// ice and key, the pennants, the toad, Snape's star cloud) are single movers drawn only while their station is on.
// No per-frame allocations: the temporaries below are made once here.
function buildPotions(kit) {
  const IRON = 0x2a2830, IRON2 = 0x55505e, BRASS = 0xc89a3a, WOOD = 0x6a4424, DARK = 0x3a2614;
  const { solid, ctx } = kit;
  const NP = POTS.length;
  // ---- the pot: an open round iron bowl on three stubby legs, a brass rim (it reads in the dark) and ring handles ----
  const potGeo = merge([
    paint(place(new SphereGeometry(POT_R, 18, 10, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.7), 0, POT_C, 0), IRON, IRON2),
    paint(place(new TorusGeometry(0.245, 0.034, 6, 20), 0, RIM_Y, 0, Math.PI / 2), BRASS, 0xe8c060),
    paint(place(new TorusGeometry(0.302, 0.012, 4, 20), 0, POT_C + 0.02, 0, Math.PI / 2), BRASS),
    ...[0, 1, 2].map(i => paint(place(new CylinderGeometry(0.03, 0.04, 0.09, 6), Math.cos(i * 2.09) * 0.18, 0.045, Math.sin(i * 2.09) * 0.18), IRON)),
    ...[-1, 1].map(s => paint(place(new TorusGeometry(0.045, 0.012, 4, 10), s * 0.29, 0.44, 0, 0, 0, 0), IRON2)),
  ]);
  const pots = kit.inst('pot', potGeo, NP, new Array(NP).fill(0xffffff), { glow: false, scales: POTS.map(P => P[3]) });
  // liquids (unlit: instance colour = brightness, above 1 blooms)
  const liq = kit.inst('liquid', new CircleGeometry(0.262, 20).rotateX(-Math.PI / 2), NP, new Array(NP).fill(0x6f6f66), { basic: true, glow: false });
  // the ladle: a wooden handle and a brass bowl (instance 0 = the cauldron being stirred, 1 = Snape's)
  const ladle = kit.inst('ladle', merge([
    paint(place(new CylinderGeometry(0.012, 0.016, 0.52, 6), 0, 0.27, 0), WOOD, 0x9a6a3a),
    paint(place(new SphereGeometry(0.05, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0, 0.02, 0), 0xb08a40, 0xe0c070),
  ]), 2, [0xffffff, 0xffffff], { glow: false });
  // ingredients: little magic crystals (a pink one at 1/3, a blue one at 2/3)
  const bits = kit.inst('bit', merge([paint(place(new ConeGeometry(0.045, 0.07, 5), 0, 0.035, 0), 0xffffff, 0xffffff), paint(place(new ConeGeometry(0.045, 0.05, 5), 0, -0.025, 0, Math.PI), 0xd8d8d8)]),
    4, [0xff6ad0, 0x6ad8ff, 0xff6ad0, 0x6ad8ff], { glow: false, emissive: 0xffffff, emissiveIntensity: 0.25 });
  const NB = 64, bub = kit.inst('bubble', new SphereGeometry(1, 8, 6), NB, new Array(NB).fill(0xffffff), { basic: true, glow: false });
  // the soft light (lamps, halos over finished potions, puffs): ONE additive instanced quad set with a soft canvas
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g2 = cv.getContext('2d'), gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.6)'); gr.addColorStop(0.6, 'rgba(255,255,255,.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64);
  const soft = kit.tex(new CanvasTexture(cv)); soft.colorSpace = SRGBColorSpace;
  const NQ = 12, glow = kit.inst('glow', new PlaneGeometry(1, 1), NQ, new Array(NQ).fill(0), { basic: true, additive: true, map: soft, glow: false });
  glow.renderOrder = 3;

  // ---- lesson: a low stone bench with the three little cauldrons; Snape's star-shaped puff ----
  solid(paint(place(new BoxGeometry(2.0, 0.08, 0.6), -2.7, 0.38, -5.25), 0x4a2e18, 0x6a4424));
  for (const sx of [-0.85, 0.85]) solid(paint(place(new BoxGeometry(0.12, 0.36, 0.5), -2.7 + sx, 0.18, -5.25), DARK));
  const starS = new Shape();
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, rr = i % 2 ? 0.17 : 0.38; const x = Math.sin(a) * rr, y = Math.cos(a) * rr; if (i) starS.lineTo(x, y); else starS.moveTo(x, y); }
  const cloud = kit.mesh('cloud', paint(new ExtrudeGeometry(starS, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 2 }).translate(0, 0, -0.06), 0x9af0a8, 0xe8ffe8), { glow: false });
  cloud.mat.emissive.setHex(0x5ae070); cloud.mat.emissiveIntensity = 0.6;

  // ---- 1 a terracotta pot with a wilted plant (the flower, short, brown and leaning); the star waits in its head ----
  solid(paint(place(new CylinderGeometry(0.2, 0.15, 0.3, 14), PO.plant[0], 0.15, PO.plant[2]), 0x9a4a28, 0xc8703a));
  solid(paint(place(new TorusGeometry(0.2, 0.025, 5, 16), PO.plant[0], 0.3, PO.plant[2], Math.PI / 2), 0xc8703a));
  solid(paint(place(new CylinderGeometry(0.19, 0.19, 0.02, 14), PO.plant[0], 0.29, PO.plant[2]), 0x3a2614));
  const PETAL = 0xff6aa8;
  const flower = kit.mesh('flower', merge([
    paint(place(new CylinderGeometry(0.02, 0.028, 1.5, 6), 0, 0.75, 0), 0x2f7a24, 0x5ab040),
    ...[[0.38, 1], [0.72, -1], [1.05, 1]].map(([y, s]) => paint(place(new SphereGeometry(0.12, 8, 6), s * 0.11, y, 0, 0, 0, s * 0.45, 1, 0.16, 0.45), 0x3a9a2a, 0x6ac050)),
    paint(place(new SphereGeometry(0.075, 10, 8), 0, 1.56, 0.03, 0, 0, 0, 1, 1, 0.6), 0xffd040, 0xffe890),
    ...[0, 1, 2, 3, 4, 5, 6].map(i => { const a = i / 7 * Math.PI * 2; return paint(place(new SphereGeometry(0.09, 8, 6), Math.cos(a) * 0.13, 1.56 + Math.sin(a) * 0.13, 0, 0, 0, a, 1, 0.42, 0.3), PETAL, 0xffb0d0); }),
  ]), { glow: false });
  const star = kit.mesh('star', starGeo(0.15), { glow: false, glowHex: 0xffc030 }); star.mat.emissiveIntensity = 0.9;
  // the pour: one stream shared by stations 1 and 3 (origin at its top; length = scale y)
  const stream = kit.mesh('stream', paint(new CylinderGeometry(0.045, 0.07, 1, 8, 1, true).translate(0, -0.5, 0), 0xffffff, 0xffffff), { glow: false });
  stream.mat.emissiveIntensity = 0.8;

  // ---- 2 the dark corner (a deep drape and rug): three cauldrons -> three glowing jars ----
  solid(paint(place(new BoxGeometry(0.05, 2.8, 3.6), -8.47, 1.4, 7.75), 0x14121e, 0x262034));
  solid(paint(place(new BoxGeometry(3.0, 2.8, 0.05), -7.0, 1.4, 9.47), 0x14121e, 0x262034));
  solid(paint(place(new BoxGeometry(2.6, 0.012, 2.6), -7.3, 0.006, 7.95), 0x1e1a28, 0x2a2436, 'x'));
  const jarGeo = merge([
    paint(place(new CylinderGeometry(0.13, 0.14, 0.04, 12), 0, 0.02, 0), BRASS),
    paint(place(new CylinderGeometry(0.12, 0.12, 0.26, 12), 0, 0.17, 0), 0xffe070, 0xfff4b8),
    paint(place(new TorusGeometry(0.1, 0.018, 5, 12), 0, 0.31, 0, Math.PI / 2), BRASS),
    paint(place(new CylinderGeometry(0.065, 0.08, 0.08, 10), 0, 0.35, 0), 0x8a5a30),
  ]);
  const jars = kit.inst('jar', place(jarGeo, 0, 0, 0, 0, 0, 0, 1.2), 3, [0xffffff, 0xffffff, 0xffffff], { glow: false, emissive: 0xffb030, emissiveIntensity: 0.6 });
  const LAMP = [5, 6, 7].map(i => POTS[i]);

  // ---- 3 a block of ice with a little golden key frozen inside ----
  const key = kit.mesh('key', place(merge([
    paint(place(new TorusGeometry(0.05, 0.016, 6, 14), -0.09, 0, 0), 0xffd040, 0xffb020),
    paint(place(new BoxGeometry(0.17, 0.026, 0.026), 0.03, 0, 0), 0xffd040),
    paint(place(new BoxGeometry(0.026, 0.055, 0.022), 0.1, -0.03, 0), 0xffc030),
    paint(place(new BoxGeometry(0.026, 0.04, 0.022), 0.06, -0.025, 0), 0xffc030),
  ]), 0, 0, 0, 0, 0, 0, 1.4), { glow: false, glowHex: 0xffb020 });
  key.mat.emissiveIntensity = 0.55;
  const ice = kit.mesh('ice', merge([
    paint(place(new BoxGeometry(0.62, 0.5, 0.52), 0, 0.25, 0, 0, 0.12, 0), 0x9ad4f4, 0xe0f6ff),
    paint(place(new BoxGeometry(0.3, 0.14, 0.28), -0.08, 0.56, 0.02, 0.1, 0.5, 0.08), 0xc8ecff, 0xf0fbff),
  ]), { glow: false, glowHex: 0x7ac8ff });
  ice.mat.transparent = true; ice.mat.opacity = 0.6; ice.mat.depthWrite = false; ice.mat.emissiveIntensity = 0.3; ice.mat.roughness = 0.15;
  ice.mesh.renderOrder = 2;

  // ---- 4 three pennants (red, blue, purple) hanging from a brass rod on the south wall over the three cauldrons ----
  solid(paint(place(new CylinderGeometry(0.025, 0.025, 3.4, 8), 4.5, PO.flagY + 0.03, PO.flagZ - 0.06, 0, 0, Math.PI / 2), BRASS, 0xe8c060));
  for (const x of [2.85, 6.15]) solid(paint(place(new BoxGeometry(0.06, 0.06, 0.12), x, PO.flagY + 0.03, PO.flagZ - 0.02), DARK));
  const flS = new Shape(); flS.moveTo(-0.26, 0); flS.lineTo(0.26, 0); flS.lineTo(0, -0.72); flS.lineTo(-0.26, 0);
  const flagGeo = merge([new ExtrudeGeometry(flS, { depth: 0.02, bevelEnabled: false }).translate(0, 0, -0.01), place(new SphereGeometry(0.035, 8, 6), 0, -0.72, 0)]);
  const FLAG = [9, 10, 11].map(i => POTS[i][4]);
  kit.inst('flag', flagGeo, 3, FLAG, { glow: false, basic: true });   // unlit: the colours read in the dark

  // ---- 5 the toad who hops out of the finale cauldron ----
  const toad = kit.mesh('toad', place(merge([
    paint(place(new SphereGeometry(0.12, 14, 10), 0, 0.09, 0, 0, 0, 0, 1.15, 0.75, 1.0), 0x3a8a30, 0x7ac050),
    paint(place(new SphereGeometry(0.1, 12, 8), 0, 0.07, 0.035, 0, 0, 0, 1, 0.6, 1), 0xe8d878),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.042, 10, 8), s * 0.062, 0.165, 0.055), 0x4a9a3a)),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.032, 10, 8), s * 0.064, 0.172, 0.078), 0xffffff)),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.017, 6, 5), s * 0.066, 0.176, 0.104), 0x141018)),
    paint(place(new TorusGeometry(0.055, 0.007, 4, 12, Math.PI), 0, 0.125, 0.105, 0, 0, Math.PI), 0x2a4a1a),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.018, 6, 5), s * 0.085, 0.12, 0.095), 0xf0a0a0)),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.04, 8, 6), s * 0.075, 0.02, 0.09, 0, 0, 0, 0.7, 0.4, 1.1), 0x3a8a30)),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.07, 8, 6), s * 0.12, 0.04, -0.05, 0, 0, 0, 0.6, 0.5, 1.25), 0x3a8a30, 0x5aa040)),
  ]), 0, 0, 0, 0, 0, 0, 1.35), { glow: false });

  // ---- state ----
  const BIG = POTS[3], GREY = new Color(0x6f6f66), GREEN = new Color(0x3ee05a), BROWN = new Color(0x9a8a50), WHITE = new Color(0xffffff);
  const TGT = POTS.map(P => new Color(P[4]));
  const m1 = new Matrix4(), m2 = new Matrix4(), v1 = new Vector3(), v2 = new Vector3(), q1 = new Quaternion(), q0 = new Quaternion(), e1 = new Euler(), s1 = new Vector3(), c1 = new Color(), c2 = new Color(), c3 = new Color();
  const LI = new Array(NP).fill(null);                   // the lift of each pot (filled on the first tick)
  const potSt = [-1, -1, -1, 4, 0, 1, 1, 1, 2, 3, 3, 3]; // the station each pot belongs to (-1: the lesson bench)
  const mask = new Uint8Array(NP), spawnAcc = new Float32Array(NP), splash = new Float32Array(NP), prevP = new Float32Array(NP);
  const B = []; for (let i = 0; i < NB; i++) B.push({ on: false, x: 0, y: 0, z: 0, vy: 0, life: 0, t0: 0, sz: 0, ph: 0, wob: 0, r: 0, g: 0, b: 0 });
  const BITS = []; for (let i = 0; i < 4; i++) BITS.push({ on: false, pot: 0, t: 0, kind: 0 });
  let demoT = 0, demoSfx = 0, growT = 0, growSfx = 0, chordT = 0, chord = 0, meltT = 0, meltSfx = 0, waveT = 0, waveSfx = 0, toadT = 0, toadSfx = 0, rainAcc = 0;
  let ladleA = 0, ladleV = 0, ladleK = 0;
  const ease = (k) => k * k * (3 - 2 * k);
  const clamp01 = (k) => Math.max(0, Math.min(1, k));
  const back = (k) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;   // ease-out with a little overshoot
  const shows = (mv) => mv.s > 0.001;
  function vis(M, names, on) { let v = false; if (on) for (const n of names) if (M[n] && shows(M[n])) { v = true; break; } M[names[0]].mesh.visible = v; }
  // the pour (stations 1 and 3): the cauldron hops up beside the target, tips toward it (dir -1: target to -x, +1: +x),
  // a stream of potion falls on it, the cauldron settles back. Returns the stream state for the frame.
  function pourPose(M, i, T, dir, t) {
    const P = POTS[i], up = ease(clamp01(t / 0.6)) * (1 - ease(clamp01((t - 1.7) / 0.6)));
    const tilt = up * 1.0, lipX = T[0] - dir * 0.04;
    const ox = P[0] + (lipX - dir * 0.58 - P[0]) * up, oy = P[1] + 1.2 * up;
    M['pot' + i].pose(ox, oy + Math.sin(t * 9) * 0.01 * up, P[2], 0, 0, -dir * tilt, 1);
    return up > 0.97 && t > 0.55 && t < 1.75 ? 1 : 0;
  }
  function pokeStream(M, x, yTop, z, yBot, col) {
    M.stream.pose(x, yTop, z, 0, 0, 0, 1); M.stream.mesh.scale.set(1, Math.max(0.01, yTop - yBot), 1);
    M.stream.mat.color.copy(col); M.stream.mat.emissive.copy(col);
  }
  let gq = 0;                                            // the next free glow quad this frame
  function quad(x, y, z, sx, sy, r, g, b, flat = 0) {    // flat: 0 faces the camera, 1 lies on the floor, 2 on the west wall
    if (gq >= NQ) return;
    if (flat === 1) q1.setFromEuler(e1.set(-Math.PI / 2, 0, 0)); else if (flat === 2) q1.setFromEuler(e1.set(0, Math.PI / 2, 0)); else q1.copy(ctx.camera.quaternion);
    m1.compose(v1.set(x, y, z), q1, s1.set(sx, sy, 1)); glow.setMatrixAt(gq, m1); glow.setColorAt(gq, c1.setRGB(r, g, b)); gq++;
  }
  function addBubble(x, y, z, sz, vy, life, col, wob = 0) {
    for (const b of B) if (!b.on) { b.on = true; b.x = x; b.y = y; b.z = z; b.sz = sz; b.vy = vy; b.life = life; b.t0 = life; b.ph = Math.random() * 6.3; b.wob = wob; b.r = col.r; b.g = col.g; b.b = col.b; return; }
  }
  // the liquid colour of pot i now (into out); k = how bright
  function liquidColor(i, L, t, st, out) {
    if (i === 3) {
      const fin = L && (L.p > 0.001 || L.done);
      if (!fin && st.phase === 'lesson' || (!fin && st.step < 4 && demoT > 0)) { const k = ease(clamp01((demoT - 0.4) / 1.8)); return out.copy(GREY).lerp(GREEN, k).multiplyScalar(0.85 + 0.6 * k); }
      c3.setHSL((t * 0.12) % 1, 0.85, 0.55);
      const k = L ? (L.done ? 1 : ease(L.p)) : 0; return out.copy(GREY).lerp(c3, k);
    }
    const k = L ? (L.done ? 1 : ease(L.p)) : 0; return out.copy(GREY).lerp(TGT[i], k);
  }
  return {
    reset(M) {
      demoT = 0; demoSfx = 0; growT = 0; growSfx = 0; chordT = 0; chord = 0; meltT = 0; meltSfx = 0; waveT = 0; waveSfx = 0; toadT = 0; toadSfx = 0; rainAcc = 0; ladleA = 0; ladleV = 0; ladleK = 0;
      mask.fill(0); spawnAcc.fill(0); splash.fill(0); prevP.fill(0);
      for (const b of B) b.on = false; for (const b of BITS) b.on = false;
      M.cloud.pose(BIG[0], 1.2, BIG[2], 0, 0, 0, 0); M.star.pose(PO.plant[0], 1.84, PO.plant[2], 0, 0, 0, 0); M.stream.pose(0, 0, 0, 0, 0, 0, 0);
      M.toad.pose(BIG[0], 0.8, BIG[2], 0, 0, 0, 0); M.key.pose(PO.ice[0], 0.26, PO.ice[2], 0.3, 0.5, 0.2, 1);
      M.ice.pose(PO.ice[0], 0, PO.ice[2], 0, 0, 0, 1); M.ice.mesh.scale.set(1, 1, 1);
      for (let i = 0; i < NQ; i++) { glow.setColorAt(i, c1.setRGB(0, 0, 0)); }
      for (let i = 0; i < 2; i++) M['ladle' + i].pose(0, -50, 0, 0, 0, 0, 0);
      for (let i = 0; i < 4; i++) M['bit' + i].pose(0, -50, 0, 0, 0, 0, 0);
      for (let i = 0; i < NB; i++) M['bubble' + i].pose(0, -50, 0, 0, 0, 0, 0);
      for (let i = 0; i < 3; i++) M['flag' + i].pose(POTS[9 + i][0], PO.flagY, PO.flagZ, 0, 0, 0, 1);
    },
    tick(M, t, st, K, dt = 0.016) {
      if (!K) return;
      if (!LI[0]) for (const L of [...K.lesson, ...K.stations.flat()]) LI[Number(L.mv.name.slice(3))] = L;
      const ph = st.phase, les = ph === 'lesson', step = ph === 'course' ? st.step : ph === 'reward' ? 4 : -1;
      const casting = st.sub === 'cast';
      const hx = ctx.player.pos.x - ctx.worldOff.x, hz = ctx.player.pos.z - ctx.worldOff.z;
      gq = 0;
      // ---- Snape's demo: his ladle circles, the brew turns green, a puff and a star-shaped cloud rises ----
      if (les && demoT > 0) {
        const a = demoT * 5.5, u = clamp01((demoT - 2.2) / 2.6), done = demoT > 2.2;
        if (!done) M.ladle1.pose(BIG[0] + Math.cos(a) * 0.12 * BIG[3], LIQ_Y * BIG[3] - 0.02, BIG[2] - Math.sin(a) * 0.12 * BIG[3], 0, a, -0.5, BIG[3] * 0.85);
        else M.ladle1.pose(0, -50, 0, 0, 0, 0, 0);
        if (demoT > 0.3 && demoT < 3.4 && Math.random() < dt * (3 + demoT * 5)) { const b = Math.random() * 6.3, rr = Math.random() * 0.28;
          addBubble(BIG[0] + Math.cos(b) * rr, LIQ_Y * BIG[3], BIG[2] + Math.sin(b) * rr, 0.035 + Math.random() * 0.03, 0.3 + Math.random() * 0.3, 0.7 + Math.random() * 0.5, liquidColor(3, null, t, st, c2).lerp(WHITE, 0.3)); }
        if (done) {
          const s = demoT < 4.6 ? back(clamp01(u / 0.25)) : Math.max(0, 1 - (demoT - 4.6) / 0.6);
          M.cloud.pose(BIG[0], 1.15 + u * 1.1, BIG[2], 0, 0.15 + Math.sin(demoT * 1.5) * 0.25, Math.sin(demoT * 1.1) * 0.1, s * 1.3);
          if (s > 0.01) quad(BIG[0], 1.15 + u * 1.1, BIG[2], 1.8 * s, 1.8 * s, 0.25 * s, 0.6 * s, 0.3 * s);
          const pf = clamp01((demoT - 2.2) / 0.6);
          if (pf < 1) quad(BIG[0], 1.0 + pf * 0.4, BIG[2], 0.6 + pf * 1.6, 0.6 + pf * 1.6, 0.6 * (1 - pf), 1.5 * (1 - pf), 0.7 * (1 - pf));
        } else M.cloud.pose(BIG[0], 1.2, BIG[2], 0, 0, 0, 0);
      } else { M.ladle1.pose(0, -50, 0, 0, 0, 0, 0); if (!les) M.cloud.pose(BIG[0], 1.2, BIG[2], 0, 0, 0, 0); }
      // ---- the pours (they override the cauldron's pose the runner set this frame) ----
      let streamOn = 0;
      if (growT > 0 && growT < 2.4) {
        const on = pourPose(M, 4, PO.plant, -1, growT);
        if (on) { streamOn = 1; pokeStream(M, PO.plant[0] + 0.04, 1.25, PO.plant[2], 0.3, TGT[4]); }
      }
      if (meltT > 0 && meltT < 2.4) {
        const on = pourPose(M, 8, PO.ice, 1, meltT);
        if (on) { streamOn = 1; pokeStream(M, PO.ice[0] - 0.04, 1.25, PO.ice[2], 0.5 * Math.max(0.1, 1 - clamp01((meltT - 0.9) / 1.6)), TGT[8]); }
      }
      if (!streamOn) M.stream.pose(0, 0, 0, 0, 0, 0, 0);
      // ---- liquids, ingredients, bubbles, halos ----
      const sel = casting ? (st.sel && !st.sel.done ? st.sel : null) : null;
      for (let i = 0; i < NP; i++) {
        const L = LI[i], sIdx = potSt[i], here = sIdx < 0 ? les : (i === 3 ? (les || step >= 3) : Math.abs(step - sIdx) <= 1);
        pots.getMatrixAt(i, m1);
        // drained after a pour; the lamps' liquid goes with the pot (its scale)
        let level = 1;
        if (i === 4 && growT > 0.6) level = Math.max(0, 1 - (growT - 0.6) / 1.0);
        if (i === 8 && meltT > 0.6) level = Math.max(0, 1 - (meltT - 0.6) / 1.1);
        if (splash[i] > 0) splash[i] = Math.max(0, splash[i] - dt);
        const sp = 1 + Math.sin(splash[i] * 30) * splash[i] * 0.5;
        m2.compose(v1.set(0, LIQ_Y - (1 - level) * 0.12, 0), q0, s1.set(level > 0.02 ? sp : 0, 1, level > 0.02 ? sp : 0)); m1.multiply(m2);
        liq.setMatrixAt(i, m1);
        liquidColor(i, L, t, st, c2);
        const open = L && !L.done && casting && st.lifts && st.lifts.indexOf(L) >= 0;
        const glowK = L && L.done ? 1.35 : open ? 0.85 + 0.22 * Math.sin(t * 5 + i) : 0.8;
        liq.setColorAt(i, c1.copy(c2).multiplyScalar(glowK));
        if (!L || !here) continue;
        const s0 = POTS[i][3], P = L.arr;
        // ingredients at 1/3 and 2/3 (once per try; a pot that settles back to 0 can have them again)
        if (!L.done) {
          if (L.p <= 0.001) mask[i] = 0;
          for (let k = 0; k < 2; k++) if (L.p >= (k ? 0.64 : 0.31) && !(mask[i] & (1 << k))) {
            mask[i] |= 1 << k;
            for (let j = 0; j < 4; j++) if (!BITS[j].on) { BITS[j].on = true; BITS[j].pot = i; BITS[j].t = 0; BITS[j].kind = k; M['bit' + j].color(k ? 0x6ad8ff : 0xff6ad0); break; }
          }
        }
        // bubbles: more as it fills; a finished potion keeps a gentle simmer
        const rate = L.done ? (i === 3 ? 0 : 1.6) : (L.p > 0.03 ? 2 + 10 * L.p : 0);
        if (rate > 0 && level > 0.1 && M['pot' + i].s > 0.3) {
          spawnAcc[i] += dt * rate;
          while (spawnAcc[i] >= 1) { spawnAcc[i] -= 1; const a = Math.random() * 6.3, rr = Math.random() * 0.17 * s0;
            addBubble(P[0] + Math.cos(a) * rr, P[1] + LIQ_Y * s0, P[2] + Math.sin(a) * rr, (0.022 + Math.random() * 0.025) * s0 * (L.done ? 0.8 : 1), 0.25 + Math.random() * 0.25, 0.6 + Math.random() * 0.5, c1.copy(c2).lerp(WHITE, 0.3)); }
        }
        // a halo over the finished potion; at the snap first a bright coloured puff
        if (L.done && level > 0.1 && M['pot' + i].s > 0.3) {
          const pf = L.popT >= 0 && L.popT < POP ? L.popT / POP : 1, y = P[1] + LIQ_Y * s0 + 0.2 * s0;
          if (pf < 1) quad(P[0], y + pf * 0.3, P[2], (0.5 + pf * 1.4) * s0, (0.5 + pf * 1.4) * s0, c2.r * 2.2 * (1.2 - pf), c2.g * 2.2 * (1.2 - pf), c2.b * 2.2 * (1.2 - pf));
          else if (i !== 4 && i !== 8) quad(P[0], y, P[2], 0.9 * s0, 0.7 * s0, c2.r * 0.45, c2.g * 0.45, c2.b * 0.45);
        }
      }
      liq.instanceMatrix.needsUpdate = true; liq.instanceColor.needsUpdate = true;
      // the ladle in the cauldron being stirred: it circles while the potion rises, rests leaning when it does not
      let cur = sel;
      if (!cur && casting && st.lifts) for (const L of st.lifts) if (!L.done) { cur = L; break; }
      if (cur && cur.brew) {
        const i = Number(cur.mv.name.slice(3)), s0 = POTS[i][3], P = cur.arr;
        const rising = cur.p > prevP[i] + 1e-5; prevP[i] = cur.p;
        ladleV += ((rising ? 7 : 0) - ladleV) * Math.min(1, dt * 6); ladleA += ladleV * dt;
        ladleK = Math.min(1, ladleK + dt * 4);
        M.ladle0.pose(P[0] + Math.cos(ladleA) * 0.1 * s0, P[1] + (LIQ_Y - 0.02) * s0, P[2] - Math.sin(ladleA) * 0.1 * s0, 0, ladleA, -0.5, Math.max(0.8, s0) * ladleK);
      } else { ladleK = 0; M.ladle0.pose(0, -50, 0, 0, 0, 0, 0); }
      // falling ingredients: a plop, a splash and a tink
      let bitsOn = false;
      for (let j = 0; j < 4; j++) {
        const b = BITS[j]; if (!b.on) continue;
        const P = POTS[b.pot], L = LI[b.pot], s0 = P[3], y0 = P[1] + LIQ_Y * s0;
        b.t += dt; const u = clamp01(b.t / 0.45), y = y0 + 0.8 * (1 - u * u);
        if (u >= 1 || !L) { b.on = false; M['bit' + j].pose(0, -50, 0, 0, 0, 0, 0); splash[b.pot] = 0.35; kit.burst(P[0], y0 + 0.05, P[2], 6);
          fun.sfx.tone(820, 0.13, 'sine', 0.13, 0, 240); fun.sfx.noise(0.12, 0.05, 0.02, 1400, 1.2); fun.sfx.tink(b.kind + 1); continue; }
        bitsOn = true; M['bit' + j].pose(P[0] + 0.03, y, P[2], t * 5, t * 7, 0.3, 1.3);
      }
      // the bubble pool
      let bubOn = false;
      for (let i = 0; i < NB; i++) {
        const b = B[i], mv = M['bubble' + i];
        if (!b.on) { if (mv.s !== 0) mv.pose(0, -50, 0, 0, 0, 0, 0); continue; }
        b.life -= dt; if (b.life <= 0) { b.on = false; mv.pose(0, -50, 0, 0, 0, 0, 0); continue; }
        b.y += b.vy * dt; const k = b.life / b.t0, grow = Math.min(1, (1 - k) * 6), pop = k < 0.12 ? k / 0.12 : 1;
        mv.pose(b.x + Math.sin(t * 2.2 + b.ph) * b.wob, b.y, b.z + Math.cos(t * 1.9 + b.ph) * b.wob, 0, 0, 0, b.sz * grow * pop);
        bub.setColorAt(i, c1.setRGB(b.r * 1.15, b.g * 1.15, b.b * 1.15)); bubOn = true;
      }
      bub.instanceColor.needsUpdate = true;
      // ---- 1 the plant: wilted (short, brown, leaning) until the pour, then it grows into a tall flower; the star ----
      {
        const g = clamp01((growT - 1.5) / 1.5), k = g > 0 ? back(g) : 0, yaw = 1.0;
        const sc = 0.42 + (1 - 0.42) * k, lean = 0.75 * (1 - Math.min(1, k)) + Math.sin(t * 1.3) * 0.03;
        M.flower.pose(PO.plant[0], 0.29, PO.plant[2], 0, yaw, lean, sc);
        M.flower.mat.color.copy(BROWN).lerp(WHITE, clamp01(g * 1.4));
        if (growT < 3.0) M.star.pose(PO.plant[0], 1.84, PO.plant[2], 0, 0, 0, 0);
        else {
          const v = clamp01((growT - 3.0) / 0.4), w = clamp01((growT - 3.6) / 1.2), e = ease(w);
          const sx = PO.plant[0] + 0.05, sy = 0.29 + 1.56 + 0.2, sz = PO.plant[2] + 0.12;
          const gone = growT > 4.6 ? clamp01((growT - 4.6) / 0.2) : 0;
          M.star.pose(sx + (hx - sx) * e, sy + (1.15 - sy) * e + Math.sin(w * Math.PI) * 0.35, sz + (hz - sz) * e, 0, 1.0 + t * 2.5, 0, back(v) * (1 - gone));
        }
      }
      // ---- 2 the lamps: each brewed jar glows; the chord flares them together; the corner fills with warm light ----
      if (step >= 1 && step <= 2) {
        const flare = chordT > 0 && chordT < 1.8 ? Math.sin(chordT / 1.8 * Math.PI) * 0.8 : 0;
        let lit = 0;
        for (let j = 0; j < 3; j++) {
          const L = LI[5 + j]; if (!(L && L.done && L.popT >= POP)) continue;
          lit++; const P = LAMP[j], fl = 0.93 + 0.05 * Math.sin(t * 7.3 + j) + flare;
          quad(P[0], 0.45, P[2], 0.9 + 0.2 * flare, 0.9 + 0.2 * flare, 2.0 * fl, 1.45 * fl, 0.7 * fl);
          quad(P[0], 0.02, P[2], 1.7, 1.7, 0.7 * fl, 0.5 * fl, 0.24 * fl, 1);
        }
        if (lit) { const w = lit / 3 + flare * 0.3; quad(-8.44, 1.1, 7.8, 3.4, 2.6, 0.4 * w, 0.28 * w, 0.14 * w, 2); }
        jars.material.emissiveIntensity = 0.45 + 0.35 * (lit / 3) + flare * 0.5;
      }
      // ---- 3 the ice melts away under the orange potion; the key hops out to the hero ----
      {
        const m = clamp01((meltT - 0.9) / 1.8), em = ease(m);
        M.ice.pose(PO.ice[0], 0, PO.ice[2], 0, 0, 0, m >= 1 ? 0 : 1); if (m < 1) M.ice.mesh.scale.set(1 - 0.45 * em, 1 - 0.97 * em, 1 - 0.45 * em);
        if (meltT > 0.9 && m < 1 && (step === 2)) {
          if (Math.random() < dt * 14) addBubble(PO.ice[0] + (Math.random() - 0.5) * 0.4, 0.5 * (1 - em) + 0.05, PO.ice[2] + (Math.random() - 0.5) * 0.4, 0.05, 0.5, 1.0, c1.setRGB(0.9, 0.95, 1.0), 0.04);
        }
        if (meltT > 0.9 && step >= 2 && step <= 3) { const pw = Math.min(1, m * 1.5); quad(PO.ice[0], 0.015, PO.ice[2], 0.6 + 0.9 * pw, 0.5 + 0.7 * pw, 0.12 * pw, 0.3 * pw, 0.45 * pw, 1); }
        const kt = meltT - 2.6;
        if (kt <= 0) M.key.pose(PO.ice[0], 0.26 * (1 - em) + 0.03 * em, PO.ice[2], em * Math.PI / 2 + (1 - em) * 0.3, 0.5, 0.2 * (1 - em), 1);
        else {
          const u = clamp01(kt / 0.8), w = clamp01((kt - 0.9) / 0.9), e = ease(w), mx = PO.ice[0] + (hx - PO.ice[0]) * 0.45, mz = PO.ice[2] + (hz - PO.ice[2]) * 0.45;
          const ax = PO.ice[0] + (mx - PO.ice[0]) * ease(u), az = PO.ice[2] + (mz - PO.ice[2]) * ease(u), ay = 0.03 + (1.1 - 0.03) * ease(u) + Math.sin(u * Math.PI) * 0.5;
          const gone = kt > 1.7 ? clamp01((kt - 1.7) / 0.2) : 0;
          M.key.pose(ax + (hx - ax) * e, ay + (1.15 - ay) * e, az + (hz - az) * e, 0, t * 4, 0.3, (1 + 0.2 * Math.sin(u * Math.PI)) * (1 - gone));
        }
      }
      // ---- 4 the pennants sway; when all three potions are done they wave and three coloured puffs rise ----
      for (let j = 0; j < 3; j++) {
        const w = waveT > 0 && waveT < 2.6 ? Math.sin(waveT / 2.6 * Math.PI) : 0;
        M['flag' + j].pose(POTS[9 + j][0], PO.flagY, PO.flagZ, Math.sin(t * 1.3 + j) * 0.05 - w * (0.3 + 0.15 * Math.sin(t * 9 + j * 2)), 0, Math.sin(t * 1.1 + j * 1.7) * 0.04 + w * Math.sin(t * 7 + j) * 0.18, 1);
        if (waveT > 0 && waveT < 2.6) {
          const u = clamp01(waveT / 2.4), P = POTS[9 + j], C = TGT[9 + j], f = Math.sin(u * Math.PI);
          quad(P[0], 0.6 + u * 1.6, P[2] - 0.1, 0.5 + u * 0.9, 0.5 + u * 0.9, C.r * 1.6 * f, C.g * 1.6 * f, C.b * 1.6 * f);
        }
      }
      // ---- 5 the toad hops out of the big cauldron and sits on its rim; rainbow bubbles float up through the dungeon ----
      {
        const dx = -3.4 - BIG[0], dz = -2.6 - BIG[2], dl = Math.hypot(dx, dz), ux = dx / dl, uz = dz / dl;   // toward the station camera
        const rimX = BIG[0] + ux * 0.4, rimZ = BIG[2] + uz * 0.4, rimY = RIM_Y * BIG[3] + 0.03, yaw = Math.atan2(ux, uz);
        if (toadT <= 0) M.toad.pose(BIG[0], LIQ_Y * BIG[3], BIG[2], 0, yaw, 0, 0);
        else {
          const u = clamp01(toadT / 0.45), v = clamp01((toadT - 0.45) / 0.6);
          let x = BIG[0], y = LIQ_Y * BIG[3] - 0.1 + u * 0.75, z = BIG[2], sq = 1;
          if (v > 0) { x = BIG[0] + (rimX - BIG[0]) * v; z = BIG[2] + (rimZ - BIG[2]) * v; y = (LIQ_Y * BIG[3] + 0.65) * (1 - v) + rimY * v + Math.sin(v * Math.PI) * 0.15; }
          if (toadT > 1.05) { x = rimX; z = rimZ; y = rimY; const k = toadT - 1.05; sq = 1 - 0.15 * Math.max(0, Math.sin(Math.min(1, k / 0.25) * Math.PI)); }
          M.toad.pose(x, y, z, 0, yaw + (toadT > 1.05 ? Math.sin(t * 0.7) * 0.15 : 0), 0, 1);
          M.toad.mesh.scale.set(1, sq * (1 + Math.max(0, Math.sin(t * 6)) * 0.03 * (toadT > 1.4 ? 1 : 0)), 1);
        }
        if (toadT > 0.3 && toadT < 5.0 || st.phase === 'reward') {
          rainAcc += dt * 13;
          while (rainAcc >= 1) { rainAcc -= 1; const a = Math.random() * 6.3, rr = Math.random() * 0.35;
            addBubble(BIG[0] + Math.cos(a) * rr, LIQ_Y * BIG[3] + 0.1, BIG[2] + Math.sin(a) * rr, 0.07 + Math.random() * 0.09, 0.6 + Math.random() * 0.5, 3.2 + Math.random() * 1.6, c1.setHSL(Math.random(), 0.95, 0.55), 0.25); }
        }
      }
      // what is drawn: the lesson things in the lesson; each station's things while it (or a neighbour) is on
      for (let i = gq; i < NQ; i++) { m1.compose(v1.set(0, -50, 0), q0, s1.set(0, 0, 0)); glow.setMatrixAt(i, m1); }
      glow.instanceMatrix.needsUpdate = true; glow.instanceColor.needsUpdate = true; glow.visible = gq > 0;
      pots.visible = true; liq.visible = true;
      M.ladle0.mesh.visible = M.ladle0.s > 0.001 || M.ladle1.s > 0.001;
      bits.visible = bitsOn; bub.visible = bubOn;
      vis(M, ['cloud'], les);
      vis(M, ['flower'], les || step === 0 || step === 1 || step === 4);   // (it is in the finale's view too)
      vis(M, ['star'], step === 0);
      vis(M, ['stream'], step === 0 || step === 2);
      vis(M, ['jar0', 'jar1', 'jar2'], step >= 1 && step <= 2);
      vis(M, ['ice'], step >= 2 && step <= 3); vis(M, ['key'], step >= 2 && step <= 3);
      vis(M, ['flag0', 'flag1', 'flag2'], step >= 2);
      vis(M, ['toad'], step >= 4);
    },
    effects: {
      // Snape's demo: he stirs his cauldron, it turns green and puffs a star-shaped cloud (5.2 s, the next line talks over it)
      demo(M, t, quiet) {
        demoT = t;
        if (!quiet && t > 0.3 && demoSfx < 1) { demoSfx = 1; fun.sfx.tone(300, 0.5, 'sine', 0.06, 0, 420); }
        if (!quiet && t > 2.2 && demoSfx < 2) { demoSfx = 2; fun.sfx.poof(); fun.sfx.sparkle(); kit.burst(BIG[0], 1.1, BIG[2], 20); }
        if (quiet) demoT = 99;
        return t < 5.2;
      },
      // the green potion hops up and pours onto the wilted plant, which grows into a tall flower; its star comes to the hero (5 s)
      growPour(M, t, quiet) {
        growT = t;
        if (!quiet) {
          if (growSfx < 1 && t > 0.1) { growSfx = 1; fun.sfx.whoosh(); }
          if (growSfx < 2 && t > 0.6) { growSfx = 2; fun.sfx.noise(1.0, 0.06, 0, 900, 0.8); }
          if (growSfx < 3 && t > 1.6) { growSfx = 3; fun.sfx.tone(300, 1.3, 'sine', 0.12, 0, 900); }
          if (growSfx < 4 && t > 3.0) { growSfx = 4; fun.sfx.chime(); kit.burst(PO.plant[0], 1.9, PO.plant[2], 14); }
          if (growSfx < 5 && t > 4.7) { growSfx = 5; kit.burst(hxOf(), 1.15, hzOf(), 14); fun.sfx.tune([784, 988, 1319], 0.1, 'sine'); }
        } else growT = 99;
        return t < 5.0;
      },
      // the three lamps sing a little chord and flare together (2 s)
      lampChord(M, t, quiet) {
        chordT = t;
        if (!quiet && !chord) { chord = 1; fun.sfx.tune([784, 988, 1175, 1568], 0.12, 'sine'); for (const P of LAMP) kit.burst(P[0], 0.5, P[2], 8); }
        if (t >= 2.0) chord = 0;
        return t < 2.0;
      },
      // the orange potion pours over the ice block, the ice melts away and the key hops out to the hero (4.6 s)
      meltPour(M, t, quiet) {
        meltT = t;
        if (!quiet) {
          if (meltSfx < 1 && t > 0.1) { meltSfx = 1; fun.sfx.whoosh(); }
          if (meltSfx < 2 && t > 0.6) { meltSfx = 2; fun.sfx.noise(1.6, 0.07, 0, 2600, 0.7); }
          if (meltSfx < 3 && t > 2.6) { meltSfx = 3; fun.sfx.boing(); kit.burst(PO.ice[0], 0.3, PO.ice[2], 12); }
          if (meltSfx < 4 && t > 4.3) { meltSfx = 4; fun.sfx.chime(); kit.burst(hxOf(), 1.15, hzOf(), 14); }
        } else meltT = 99;
        return t < 4.6;
      },
      // the pennants wave and three coloured puffs rise (2.6 s)
      flagWave(M, t, quiet) {
        if (!quiet && waveSfx < 1) { waveSfx = 1; fun.sfx.tune([659, 784, 988, 1319], 0.11, 'triangle'); for (let j = 0; j < 3; j++) kit.burst(POTS[9 + j][0], 0.8, POTS[9 + j][2], 8); }
        waveT = quiet ? 99 : t; if (t >= 2.6) waveSfx = 0;
        return t < 2.6;
      },
      // the toad hops out onto the rim, rainbow bubbles float up through the dungeon (5.4 s)
      toadHop(M, t, quiet) {
        toadT = quiet ? 99 : t;
        if (!quiet) {
          if (toadSfx < 1 && t > 0.05) { toadSfx = 1; fun.sfx.tone(500, 0.18, 'sine', 0.14, 0, 1200); }
          if (toadSfx < 2 && t > 1.05) { toadSfx = 2; fun.sfx.boing(); kit.burst(BIG[0], 1.0, BIG[2], 10); }
          if (toadSfx < 3 && t > 1.5) { toadSfx = 3; fun.sfx.ribbit(); }
          if (toadSfx < 4 && t > 3.6) { toadSfx = 4; fun.sfx.ribbit(0.8); fun.sfx.tune([523, 659, 784, 1047], 0.12, 'triangle'); }
        }
        return t < 5.4;
      },
    },
  };
  function hxOf() { return ctx.player.pos.x - ctx.worldOff.x; }
  function hzOf() { return ctx.player.pos.z - ctx.worldOff.z; }
}

// ---- Herbology geometry (build time only; every plant stands on its own origin = the soil, faces +z) ----
function radial(geo, hexIn, hexOut, r0, r1) {   // colour by distance from the origin in x/y (petals)
  const n = geo.attributes.position.count, col = new Float32Array(n * 3), a = new Color(hexIn), b = new Color(hexOut), P = geo.attributes.position;
  for (let i = 0; i < n; i++) { const k = Math.max(0, Math.min(1, (Math.hypot(P.getX(i), P.getY(i)) - r0) / (r1 - r0))); _c.copy(a).lerp(b, k); col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new BufferAttribute(col, 3)); return geo;
}
function ribs(geo, hexA, hexB, n) {               // pumpkin ribs: colour by the angle round y
  const m = geo.attributes.position.count, col = new Float32Array(m * 3), a = new Color(hexA), b = new Color(hexB), P = geo.attributes.position;
  for (let i = 0; i < m; i++) { const k = 0.5 + 0.5 * Math.cos(Math.atan2(P.getZ(i), P.getX(i)) * n); _c.copy(a).lerp(b, k); col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new BufferAttribute(col, 3)); return geo;
}
const leafG = (r, x, y, z, rx, ry, rz, sx, sy, sz, a = 0x3a9a2a, b = 0x7ac850) => paint(place(new SphereGeometry(r, 8, 6), x, y, z, rx, ry, rz, sx, sy, sz), a, b);
function seedGeo() {
  return place(merge([
    paint(place(new CylinderGeometry(0.012, 0.018, 0.12, 5), 0, 0.06, 0), 0x3a9a2a, 0x6ac050),
    leafG(0.05, -0.045, 0.125, 0, 0, 0, 0.55, 1, 0.32, 0.62, 0x5ac838, 0xa8f070),
    leafG(0.05, 0.045, 0.125, 0, 0, 0, -0.55, 1, 0.32, 0.62, 0x5ac838, 0xa8f070),
    paint(place(new SphereGeometry(0.022, 6, 5), 0, 0.14, 0), 0x8ae050),
  ]), 0, 0, 0, 0, 0, 0, 1.45);
}
function sunGeo() {
  const P = [];
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; P.push(paint(place(new SphereGeometry(0.075, 8, 6), Math.cos(a) * 0.19, 1.5 + Math.sin(a) * 0.19, 0.03, 0, 0, a, 1.25, 0.42, 0.25), 0xffb010, 0xffe050)); }
  return merge([
    paint(place(new CylinderGeometry(0.022, 0.034, 1.48, 6), 0, 0.74, 0), 0x2f7a24, 0x5ab040),
    leafG(0.13, 0.13, 0.55, 0, 0, 0, -0.5, 1, 0.16, 0.6), leafG(0.13, -0.13, 0.9, 0, 0, 0, 0.5, 1, 0.16, 0.6),
    paint(place(new CylinderGeometry(0.14, 0.12, 0.05, 16), 0, 1.5, -0.01, Math.PI / 2), 0x4a8a2a),
    paint(place(new SphereGeometry(0.125, 14, 10), 0, 1.5, 0.03, 0, 0, 0, 1, 1, 0.38), 0x4a2810, 0x7a4a1a),
    ...P,
  ]);
}
function tulipGeo() {
  const P = [];
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; P.push(paint(place(new SphereGeometry(0.06, 8, 6), Math.cos(a) * 0.03, 0.42, Math.sin(a) * 0.03, Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25, 0.75, 1.5, 0.75), 0xd8202a, 0xff7070)); }
  return place(merge([
    paint(place(new CylinderGeometry(0.011, 0.015, 0.38, 5), 0, 0.19, 0), 0x3a8a2a, 0x5ab040),
    leafG(0.05, 0.035, 0.13, 0, 0, 0, -0.35, 0.55, 2.4, 0.25), leafG(0.05, -0.035, 0.11, 0.01, 0, 0, 0.35, 0.55, 2.0, 0.25),
    ...P,
  ]), 0, 0, 0, 0, 0, 0, 1.2);
}
function daisyGeo() {
  const P = [];
  for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2; P.push(paint(place(new SphereGeometry(0.04, 6, 5), Math.cos(a) * 0.07, 0.38 + Math.sin(a) * 0.07, 0.01, 0, 0, a, 1.35, 0.42, 0.25), 0xf4f4ff, 0xffffff)); }
  return place(merge([
    paint(place(new CylinderGeometry(0.01, 0.014, 0.36, 5), 0, 0.18, 0), 0x3a8a2a, 0x5ab040),
    leafG(0.05, 0.04, 0.08, 0, 0, 0, -0.6, 1.2, 0.3, 0.5), leafG(0.05, -0.04, 0.15, 0, 0, 0, 0.6, 1.2, 0.3, 0.5),
    paint(place(new SphereGeometry(0.045, 10, 8), 0, 0.38, 0.025, 0, 0, 0, 1, 1, 0.5), 0xffb810, 0xffe060),
    ...P,
  ]), 0, 0, 0, 0, 0, 0, 1.2);
}
function fernGeo() {
  const F = [];
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.3; F.push(leafG(0.08, Math.cos(a) * 0.13, 0.1, Math.sin(a) * 0.13, 0, -a, 0.55 + (i % 2) * 0.3, 2.4, 0.22, 0.6, 0x2a7a2a, 0x6ac050)); }
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; F.push(leafG(0.07, Math.cos(a) * 0.06, 0.2, Math.sin(a) * 0.06, 0, -a, 1.15, 2.2, 0.22, 0.55, 0x3a8a2a, 0x8ad860)); }
  return place(merge(F), 0, 0, 0, 0, 0, 0, 1.25);
}
const BEAN_LEAVES = [];                            // [x, y, z] above each bean leaf, top first (the star's slide)
function beanGeo() {
  const strand = (r, ph, rad, n) => { const pts = []; for (let i = 0; i <= n; i++) { const y = i / n * BEAN_H; pts.push(new Vector3(Math.sin(y * 2.6 + ph) * r, y, Math.cos(y * 2.6 + ph) * r)); } return paint(new TubeGeometry(new CatmullRomCurve3(pts), 40, rad, 6), 0x2f7a24, 0x6ac050); };
  const parts = [strand(0.08, 0, 0.075, 24), strand(0.07, Math.PI, 0.05, 24)];
  BEAN_LEAVES.length = 0;
  for (let k = 0; k < 8; k++) {
    const y = 0.32 + k * 0.29, a = k * 2.1, c = Math.cos(a), s = Math.sin(a);
    parts.push(leafG(0.2, c * 0.24, y, s * 0.24, 0, -a, 0.25, 1.4, 0.22, 1.0, 0x3a9a2a, 0x8ad860));
    BEAN_LEAVES.unshift([c * 0.3, y + 0.07, s * 0.3]);
  }
  parts.push(paint(place(new TorusGeometry(0.08, 0.022, 5, 12, Math.PI * 1.5), 0.05, BEAN_H + 0.04, 0), 0x5ab040, 0x8ad860));
  parts.push(leafG(0.1, 0, BEAN_H - 0.05, 0.05, 0.3, 0, 0, 1.2, 0.25, 0.9, 0x5ab040, 0x9ae870));
  return merge(parts);
}
function vineGeo() {                               // the bridge: lying along +x from its root (0) to VINE_S, a leafy deck ~0.5 m wide
  const strand = (ph, rad) => { const pts = []; for (let i = 0; i <= 20; i++) { const u = i / 20; pts.push(new Vector3(u * VINE_S, archY(u), Math.sin(u * 9 + ph) * 0.07)); } return paint(new TubeGeometry(new CatmullRomCurve3(pts), 36, rad, 6), 0x2f6a1e, 0x4a9a2a); };
  const parts = [strand(0, 0.045), strand(Math.PI, 0.035)];
  for (let i = 0; i < 13; i++) {
    const u = 0.05 + i * 0.072, x = u * VINE_S, y = archY(u) + 0.035;
    for (const sd of [-1, 1]) parts.push(leafG(0.12, x, y, sd * 0.15, 0, sd * (0.3 + (i % 3) * 0.15), 0, 1.0, 0.18, 1.3, 0x3a9a2a, 0x8ad860));
  }
  for (let i = 0; i < 4; i++) { const u = 0.15 + i * 0.23; parts.push(paint(place(new SphereGeometry(0.04, 8, 6), u * VINE_S, archY(u) + 0.08, (i % 2 ? 1 : -1) * 0.22), i % 2 ? 0xffffff : 0xff8ac8)); }
  return merge(parts);
}
function carrotGeo() {
  const F = [];
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; F.push(leafG(0.05, Math.cos(a) * 0.03, 0.32, Math.sin(a) * 0.03, Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4, 0.55, 4.0, 0.35, 0x2a8a2a, 0x7ad850)); }
  return merge([paint(place(new ConeGeometry(0.12, 0.5, 12), 0, -0.12, 0, Math.PI), 0xd86a10, 0xff9a30), ...F]);
}
function pumpkinGeo() {
  return merge([
    ribs(place(new SphereGeometry(0.22, 18, 10), 0, 0.17, 0, 0, 0, 0, 1.3, 0.85, 1.3), 0xd85a08, 0xffa030, 8),
    paint(place(new CylinderGeometry(0.025, 0.035, 0.13, 6), 0, 0.39, 0, 0, 0, 0.2), 0x5a4a1a, 0x7a8a30),
    leafG(0.16, 0.3, 0.06, -0.12, 0, 0.4, -0.15, 1.3, 0.2, 1.0), leafG(0.14, -0.28, 0.05, -0.15, 0, -0.5, 0.15, 1.3, 0.2, 1.0),
    paint(place(new TorusGeometry(0.06, 0.012, 4, 12, Math.PI * 1.6), 0.08, 0.38, 0.05, 0, 0, 0.6), 0x5ab040),
  ]);
}
function berryGeo() {
  const P = [];
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + 0.4; P.push(leafG(0.12, Math.cos(a) * 0.13, 0.17, Math.sin(a) * 0.13, 0, -a, 0.35, 1.3, 0.25, 0.9)); }
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + 1.0, r = 0.2 + (i % 2) * 0.04, x = Math.cos(a) * r, z = Math.sin(a) * r, y = 0.1 + (i % 2) * 0.06;
    P.push(paint(place(new ConeGeometry(0.06, 0.12, 10), x, y, z, Math.PI), 0xd0101e, 0xff4a4a));
    P.push(paint(place(new SphereGeometry(0.035, 6, 4), x, y + 0.065, z, 0, 0, 0, 1, 0.35, 1), 0x3a9a2a));
  }
  for (const [x, z] of [[0.05, 0.12], [-0.1, -0.05]]) { P.push(paint(place(new SphereGeometry(0.035, 8, 6), x, 0.3, z, 0, 0, 0, 1, 0.4, 1), 0xffffff)); P.push(paint(place(new SphereGeometry(0.015, 6, 4), x, 0.315, z), 0xffd020)); }
  return merge(P);
}
function giantGeo() {                              // the stem, leaves and green cup; the bloom is its own mover (it opens)
  const parts = [paint(place(new CylinderGeometry(0.04, 0.075, GIANT_H, 8), 0, GIANT_H / 2, 0), 0x2f7a24, 0x6ac050)];
  [[0.45, 1, 0.4], [0.9, -1, 2.0], [1.35, 1, 3.6]].forEach(([y, sd, ry]) => parts.push(leafG(0.2, sd * 0.28, y, 0, 0, ry, sd * -0.35, 1.6, 0.18, 0.8)));
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; parts.push(paint(place(new ConeGeometry(0.05, 0.16, 5), Math.cos(a) * 0.07, GIANT_H - 0.04, Math.sin(a) * 0.07, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9), 0x3a9a2a, 0x6ac050)); }
  return merge(parts);
}
function bloomGeo() {                              // faces +z, centre at the origin, ~1 m across
  const parts = [];
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; parts.push(radial(place(new SphereGeometry(0.11, 10, 6), Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0, 0, 0, a, 2.1, 1.0, 0.3), 0xff4aa0, 0xffc0e0, 0.12, 0.52)); }
  for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; parts.push(radial(place(new SphereGeometry(0.08, 8, 6), Math.cos(a) * 0.18, Math.sin(a) * 0.18, 0.05, 0, 0, a, 1.8, 1.0, 0.3), 0xd02080, 0xff70b8, 0.08, 0.3)); }
  parts.push(paint(place(new SphereGeometry(0.13, 14, 10), 0, 0, 0.09, 0, 0, 0, 1, 1, 0.5), 0xff9a10, 0xffe040));
  return merge(parts);
}
function mandrakeGeo() {                           // a friendly baby mandrake: a round root with a face and a leafy tuft (faces +z)
  const L = [];
  for (let i = 0; i < 5; i++) { const k = i - 2; L.push(leafG(0.05, k * 0.03, 0.4, Math.abs(k) * -0.01, (i % 2 ? 0.2 : -0.15), 0, -k * 0.35, 0.75, 2.6, 0.3, 0x3aa02a, 0x8ae060)); }
  return merge([
    paint(place(new SphereGeometry(0.16, 16, 12), 0, 0.18, 0, 0, 0, 0, 1, 1.12, 0.95), 0xc08850, 0xecc898),
    paint(place(new ConeGeometry(0.05, 0.14, 6), 0, 0.0, 0, Math.PI), 0xa87040),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.045, 8, 6), s * 0.075, 0.04, 0.04, 0, 0, 0, 0.8, 0.7, 1.2), 0xc08850)),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.027, 8, 6), s * 0.056, 0.23, 0.138), 0x141018)),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.009, 5, 4), s * 0.05 + 0.006, 0.24, 0.162), 0xffffff)),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.03, 8, 5), s * 0.1, 0.18, 0.12, 0, 0, 0, 1, 0.7, 0.4), 0xff8a9a)),
    paint(place(new TorusGeometry(0.045, 0.01, 4, 12, Math.PI), 0, 0.185, 0.148, 0, 0, Math.PI), 0x6a2a1a),
    paint(place(new CylinderGeometry(0.02, 0.024, 0.12, 6), -0.17, 0.13, 0, 0, 0, -0.6), 0xc89060),
    ...L,
  ]);
}
function armGeo() {                                // the waving arm: pivot at the shoulder, along +y
  return merge([paint(place(new CylinderGeometry(0.02, 0.024, 0.13, 6), 0, 0.065, 0), 0xc89060), paint(place(new SphereGeometry(0.032, 8, 6), 0, 0.14, 0), 0xecc898)]);
}
function beeGeo() {
  return place(merge([
    stripe(place(new SphereGeometry(0.05, 12, 8), 0, 0, 0, 0, 0, 0, 0.8, 0.8, 1.2), 0xffd020, 0x1a1410, 'z', 60),
    paint(place(new SphereGeometry(0.03, 8, 6), 0, 0.005, 0.06), 0x1a1410),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.035, 8, 5), s * 0.035, 0.045, -0.005, 0, 0, s * -0.5, 1, 0.15, 0.6), 0xffffff, 0xe8f4ff)),
    paint(place(new ConeGeometry(0.012, 0.03, 5), 0, 0, -0.068, -Math.PI / 2), 0x1a1410),
  ]), 0, 0, 0, 0, 0, 0, 1.6);
}
function ladyGeo() {
  const sp = [[0.03, 0.045, 0.02], [-0.03, 0.045, 0.02], [0.035, 0.035, -0.03], [-0.035, 0.035, -0.03], [0, 0.06, -0.01]];
  return place(merge([
    paint(place(new SphereGeometry(0.07, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0, 0, 0, 0, 0, 1, 0.9, 1.15), 0xd01818, 0xff4a3a),
    ...sp.map(([x, y, z]) => paint(place(new SphereGeometry(0.016, 6, 4), x, y, z, 0, 0, 0, 1, 0.5, 1), 0x141018)),
    paint(place(new SphereGeometry(0.035, 10, 6), 0, 0.015, 0.075), 0x141018),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.009, 5, 4), s * 0.016, 0.03, 0.1), 0xffffff)),
  ]), 0, 0, 0, 0, 0, 0, 1.7);
}
function potGeo() {                                // a terracotta pot, soil top at POT_SOIL
  return merge([
    paint(place(new CylinderGeometry(0.2, 0.14, 0.28, 14), 0, 0.14, 0), 0xa04a24, 0xd0703a),
    paint(place(new TorusGeometry(0.2, 0.032, 5, 16), 0, 0.29, 0, Math.PI / 2), 0xd8803e),
    paint(place(new CylinderGeometry(0.185, 0.185, 0.02, 14), 0, POT_SOIL - 0.01, 0), 0x3e2a1a),
  ]);
}

// The Herbology course props (see COURSES.herbology and HB): OUTDOORS, so every prop sits on ctx.ground(x, z). Pots,
// bench, beds, the star post, the stream and the picture signs are the ONE merged static mesh; the seedlings are ONE
// instanced set (the grow targets: they glow while they wait); each grown plant is a mover the runner scales up with the
// progress (the four sunflowers, Sprout's and the three of station 2, are one instanced set); a bee set, a ladybird, the
// star, the giant flower's bloom, the mandrake and its waving arm; at dusk / night one soft additive quad set lays a pool
// of light at the station, a halo round the open seedling and fireflies. Once the lesson's three plants (and later the
// three vegetables) are done they swap to ONE merged copy, so the course draws <= 12 meshes at any moment.
// No per-frame allocations: the temporaries below are made once here.
function buildHerbology(kit) {
  const { solid, ctx } = kit;
  const G = ctx.ground, NK = ctx.night ? ctx.night() : 0;
  const WOOD = 0x7a5232, WOOD2 = 0xa0703e, DARK = 0x4a3020, SOIL = 0x3a2616, SOIL2 = 0x5e4028;
  // ---- static ----
  const pot = (x, z, s, y0) => solid(place(potGeo(), x, G(x, z) + y0, z, 0, 0, 0, s));
  HB.pots.forEach(([x, z, s, y0]) => pot(x, z, s, y0));
  const bed = (x, z, w, d) => {                    // a raised bed: a plank frame and dark soil (top = BED_SOIL above the ground at its centre)
    const b = G(x, z) - 0.04;
    solid(paint(place(new BoxGeometry(w - 0.06, 0.2, d - 0.06), x, b + 0.11, z), SOIL, SOIL2));
    for (const sd of [-1, 1]) {
      solid(paint(place(new BoxGeometry(w, 0.24, 0.06), x, b + 0.12, z + sd * (d / 2 - 0.03)), WOOD, WOOD2));
      solid(paint(place(new BoxGeometry(0.06, 0.24, d - 0.12), x + sd * (w / 2 - 0.03), b + 0.12, z), WOOD, WOOD2));
    }
  };
  // the potting bench in front of Sprout (top at 0.55), a watering can
  { const [x, z] = HB.bench, y = G(x, z);
    solid(paint(place(new BoxGeometry(1.7, 0.06, 0.5), x, y + 0.52, z), WOOD, WOOD2));
    for (const sx of [-0.75, 0.75]) for (const sz of [-0.18, 0.18]) solid(paint(place(new BoxGeometry(0.06, 0.52, 0.06), x + sx, y + 0.26, z + sz), DARK));
    const cx = 1.15, cz = 1.7, cy = G(cx, cz);
    solid(paint(place(new CylinderGeometry(0.11, 0.12, 0.22, 12), cx, cy + 0.11, cz), 0x3a8a6a, 0x5ab08a));
    solid(paint(place(new CylinderGeometry(0.015, 0.025, 0.28, 6), cx - 0.16, cy + 0.2, cz, 0, 0, 0.9), 0x3a8a6a));
    solid(paint(place(new TorusGeometry(0.08, 0.015, 4, 12, Math.PI), cx + 0.02, cy + 0.22, cz, 0, Math.PI / 2, 0), 0x2a6a50)); }
  // 1 the beanstalk bed and the tall garden post with its little platform (the star waits on top)
  bed(HB.bean[0], HB.bean[1], 0.9, 0.7);
  { const [x, z, h] = HB.post, y = G(x, z);
    solid(paint(place(new CylinderGeometry(0.05, 0.065, h, 8), x, y + h / 2, z), DARK, WOOD2));
    solid(paint(place(new BoxGeometry(0.34, 0.05, 0.34), x, y + h + 0.025, z), WOOD, WOOD2));
    for (const ry of [0, Math.PI / 2]) solid(paint(place(new BoxGeometry(0.04, 0.04, 0.4), x, y + h - 0.22, z, 0, ry, 0), WOOD));
    solid(paint(place(new CylinderGeometry(0.12, 0.14, 0.08, 10), x, y + 0.03, z), 0x8a8478, 0xa8a294)); }
  // 2 the long sunflower bed
  bed(-4.5, 8.3, 2.6, 0.7);
  // 3 the little stream (a blue strip on the lawn between two muddy banks, a few stones) and the seedling's mound
  { const [sx, w, z0, z1] = HB.stream;
    const strip = (cx, ww, segX, lift, colAt) => {
      const g = new PlaneGeometry(ww, z1 - z0, segX, 18).rotateX(-Math.PI / 2).translate(cx, 0, (z0 + z1) / 2), P = g.attributes.position, col = new Float32Array(P.count * 3);
      for (let i = 0; i < P.count; i++) { P.setY(i, G(P.getX(i), P.getZ(i)) + lift); colAt(P.getX(i), _c); col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
      g.setAttribute('color', new BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
    };
    const deep = new Color(0x2a6ad8), edge = new Color(0x8ad8ff);
    solid(strip(sx, w, 4, 0.025, (x, c) => c.copy(deep).lerp(edge, Math.min(1, Math.abs(x - sx) / (w / 2)) ** 2)));
    const mud = new Color(0x5e4028), grass = new Color(0x5a7a30);
    for (const sd of [-1, 1]) solid(strip(sx + sd * (w / 2 + 0.15), 0.34, 1, 0.04, (x, c) => c.copy(mud).lerp(grass, Math.min(1, Math.abs(x - sx) - w / 2) / 0.34)));
    for (let i = 0; i < 8; i++) { const sd = i % 2 ? 1 : -1, z = z0 + 0.6 + i * 1.08, x = sx + sd * (w / 2 + 0.2 + (i % 3) * 0.04);
      if (Math.abs(z - HB.vine[1]) < 0.6) continue;
      solid(paint(place(new SphereGeometry(0.09 + (i % 3) * 0.03, 8, 5), x, G(x, z) + 0.04, z, 0, i, 0, 1.3, 0.55, 1), 0x8a8478, 0xb0aa9a)); }
    for (let i = 0; i < 6; i++) { const z = z0 + 1.0 + i * 1.35, x = sx + ((i % 3) - 1) * 0.2;
      solid(paint(place(new SphereGeometry(0.1, 8, 4), x, G(x, z) + 0.032, z, 0, 0, 0, 1.4, 0.05, 0.2), 0xd8f4ff)); }
    const [vx, vz] = HB.vine;
    solid(paint(place(new SphereGeometry(0.32, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), vx, G(vx, vz) - 0.01, vz, 0, 0, 0, 1, 0.3, 1), SOIL, SOIL2)); }
  // 4 three vegetable beds, each with a picture sign behind it (the pictures are little painted reliefs: carrot, pumpkin, strawberry)
  HB.veg.forEach(([x, z], j) => {
    bed(x, z, 0.9, 0.7);
    const sz = z - 0.5, y = G(x, sz);
    solid(paint(place(new BoxGeometry(0.06, 0.8, 0.06), x, y + 0.4, sz - 0.02), DARK));
    solid(paint(place(new BoxGeometry(0.56, 0.46, 0.04), x, y + 0.9, sz), WOOD, WOOD2));
    solid(paint(place(new BoxGeometry(0.48, 0.38, 0.02), x, y + 0.9, sz + 0.02), 0xf4e8c8));
    const fz = sz + 0.04, fy = y + 0.9;
    if (j === 0) {
      solid(paint(place(new ConeGeometry(0.06, 0.24, 8), x, fy - 0.03, fz, 0, 0, Math.PI - 0.5, 1, 1, 0.45), 0xe06a10, 0xff9a30));
      for (const k of [-1, 0, 1]) solid(leafG(0.03, x - 0.06 + k * 0.02, fy + 0.1, fz, 0, 0, 0.5 + k * 0.4, 0.6, 2.4, 0.4, 0x2a8a2a, 0x6ac050));
    } else if (j === 1) {
      solid(ribs(place(new SphereGeometry(0.13, 12, 8), x, fy - 0.02, fz, 0, 0, 0, 1.3, 0.95, 0.4), 0xd85a08, 0xffa030, 6));
      solid(paint(place(new CylinderGeometry(0.018, 0.024, 0.08, 5), x, fy + 0.13, fz), 0x5a6a20));
    } else {
      solid(paint(place(new ConeGeometry(0.08, 0.17, 10), x, fy - 0.02, fz, Math.PI, 0, 0, 1, 1, 0.45), 0xd0101e, 0xff4a4a));
      for (const k of [-1, 0, 1]) solid(leafG(0.03, x + k * 0.035, fy + 0.07, fz + 0.01, 0, 0, k * 0.6, 1.4, 0.5, 0.4, 0x2a8a2a, 0x6ac050));
    }
  });

  // ---- movers ----
  const NS = 13, SEEDS = [];                       // seed 0 = Sprout's demo, 1-3 the lesson, 4 bean, 5-7 sunflowers, 8 vine, 9-11 vegetables, 12 the finale
  for (let i = 0; i < NS; i++) SEEDS.push('seed' + i);
  kit.inst('seed', seedGeo(), NS, new Array(NS).fill(0xffffff), { glowHex: 0xfff0a0 });
  kit.mesh('tulip', tulipGeo(), { glow: false }); kit.mesh('daisy', daisyGeo(), { glow: false }); kit.mesh('fern', fernGeo(), { glow: false });
  const trioAt = (i) => potSoil(1 + i);
  kit.mesh('trio', merge([tulipGeo(), daisyGeo(), fernGeo()].map((g, i) => { const P = trioAt(i); return place(g, P[0], P[1] + G(P[0], P[2]), P[2], 0, 0.6, 0); })), { glow: false });
  kit.inst('sunf', sunGeo(), 4, [0xffffff, 0xffffff, 0xffffff, 0xffffff], { glow: false });
  kit.mesh('bean', beanGeo(), { glow: false });
  kit.mesh('vine', vineGeo(), { glow: false });
  const VEG = ['carrot', 'pumpkin', 'berry'], vegG = [carrotGeo, pumpkinGeo, berryGeo];
  VEG.forEach((n, j) => kit.mesh(n, vegG[j](), { glow: false }));
  kit.mesh('vegAll', merge(vegG.map((f, j) => { const [x, z] = HB.veg[j]; return place(f(), x, G(x, z) + BED_SOIL, z, 0, -0.3, 0); })), { glow: false });
  kit.mesh('giant', giantGeo(), { glow: false });
  kit.mesh('bloom', bloomGeo(), { glow: false });
  kit.mesh('mandrake', mandrakeGeo(), { glow: false }); kit.mesh('arm', armGeo(), { glow: false });
  kit.inst('bee', beeGeo(), 3, [0xffffff, 0xffffff, 0xffffff], { glow: false });
  kit.mesh('bug', ladyGeo(), { glow: false });
  const star = kit.mesh('star', starGeo(0.17), { glow: false, glowHex: 0xffc030 }); star.mat.emissiveIntensity = 0.9;
  // the soft light (night only): ONE additive instanced quad set with a soft canvas
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g2 = cv.getContext('2d'), gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.6)'); gr.addColorStop(0.6, 'rgba(255,255,255,.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64);
  const soft = kit.tex(new CanvasTexture(cv)); soft.colorSpace = SRGBColorSpace;
  const NQ = 10, glow = kit.inst('glow', new PlaneGeometry(1, 1), NQ, new Array(NQ).fill(0), { basic: true, additive: true, map: soft, glow: false });
  glow.renderOrder = 3;

  // ---- places and state ----
  const D0 = potSoil(0), D0y = D0[1] + G(D0[0], D0[2]);           // Sprout's own pot (the demo)
  const [PX, PZ, PH] = HB.post, STAR_Y = G(PX, PZ) + PH + 0.22;
  const BX = HB.bean[0], BZ = HB.bean[1], BY = G(BX, BZ) + BED_SOIL;
  const SLIDE = new Float32Array((BEAN_LEAVES.length + 1) * 3);    // the star's way down: the stalk's top, then each leaf
  SLIDE[0] = BX + 0.05; SLIDE[1] = BY + BEAN_H + 0.18; SLIDE[2] = BZ;
  BEAN_LEAVES.forEach((p, k) => { SLIDE[3 + k * 3] = BX + p[0]; SLIDE[4 + k * 3] = BY + p[1]; SLIDE[5 + k * 3] = BZ + p[2]; });
  const NSL = BEAN_LEAVES.length + 1;
  const [VX, VZ] = HB.vine, VY = G(VX, VZ) + 0.08;
  const MP = HB.pots[4], MX = HB.man[0], MZ = HB.man[1], MY = G(MP[0], MP[1]) + POT_SOIL * MP[2], MYAW = Math.atan2(3.0 - MX, 5.4 - MZ), MS = 1.15;
  const CEN = [[0, 1.4], [-3.9, 5.0], [-4.1, 8.9], [0.0, 11.3], [4.6, 11.2], [1.8, 1.6]].map(([x, z]) => [x, G(x, z), z]);
  const m1 = new Matrix4(), v1 = new Vector3(), q1 = new Quaternion(), q0 = new Quaternion(), e1 = new Euler(), s1 = new Vector3(), c1 = new Color();
  const syaw = new Float32Array(4);
  let LI = null, lastStep = -9, stepT = 0, yaw0 = -1.2;
  let demoT = 0, demoSfx = 0, starT = 0, starSfx = 0, sunT = 0, sunSfx = 0, layT = 0, laySfx = 0, vegT = 0, vegSfx = 0, manT = 0, manSfx = 0;
  let trioMerged = false, vegMerged = false;
  const ease = (k) => k * k * (3 - 2 * k);
  const clamp01 = (k) => Math.max(0, Math.min(1, k));
  const back = (k) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;
  const bounce = (k) => { const n = 7.5625, d = 2.75; if (k < 1 / d) return n * k * k; if (k < 2 / d) { k -= 1.5 / d; return n * k * k + 0.75; } if (k < 2.5 / d) { k -= 2.25 / d; return n * k * k + 0.9375; } k -= 2.625 / d; return n * k * k + 0.984375; };
  const turnTo = (cur, want, k) => { let d = want - cur; d = Math.atan2(Math.sin(d), Math.cos(d)); return cur + d * k; };
  const shows = (mv) => mv.s > 0.001;
  function vis(M, names, on) { let v = false; if (on) for (const n of names) if (M[n] && shows(M[n])) { v = true; break; } M[names[0]].mesh.visible = v; }
  let gq = 0;
  function quad(x, y, z, sx, sy, r, g, b, flat = 0) {   // flat: 0 faces the camera, 1 lies on the ground
    if (gq >= NQ) return;
    if (flat === 1) q1.setFromEuler(e1.set(-Math.PI / 2, 0, 0)); else q1.copy(ctx.camera.quaternion);
    m1.compose(v1.set(x, y, z), q1, s1.set(sx, sy, 1)); glow.setMatrixAt(gq, m1); glow.setColorAt(gq, c1.setRGB(r, g, b)); gq++;
  }
  const hum = () => { for (let i = 0; i < 7; i++) fun.sfx.tone(205 + (i % 2) * 14, 0.3, 'sawtooth', 0.022, i * 0.24, 215 - (i % 2) * 10); };
  function poseFree(M, n, L, t, j) {               // a done 'free' plant: full size, swaying, or hidden once merged
    const a = L.arr;
    M[n].poseS(a[0], a[1], a[2], 0, L.rot1[1], Math.sin(t * 1.6 + j) * 0.05, 1, 1, 1);
  }
  return {
    reset(M) {
      demoT = 0; demoSfx = 0; starT = 0; starSfx = 0; sunT = 0; sunSfx = 0; layT = 0; laySfx = 0; vegT = 0; vegSfx = 0; manT = 0; manSfx = 0;
      trioMerged = false; vegMerged = false; yaw0 = -1.2; syaw.fill(0.6); lastStep = -9; stepT = 0;
      M.seed0.pose(D0[0], D0y, D0[2], 0, 0.6, 0, 1); M.sunf0.pose(D0[0], D0y, D0[2], 0, 0, 0, 0);
      for (const n of ['trio', 'vegAll', 'bloom', 'mandrake', 'arm']) M[n].pose(0, 0, 0, 0, 0, 0, 0);
      for (let i = 0; i < 3; i++) M['bee' + i].pose(0, -50, 0, 0, 0, 0, 0);
      M.bug.pose(VX - 0.4, G(VX - 0.4, VZ + 0.35) + 0.01, VZ + 0.35, 0, Math.PI / 2, 0, 1);
      M.star.pose(PX, STAR_Y, PZ, 0, 0, 0, 1);
      for (let i = 0; i < NQ; i++) { m1.compose(v1.set(0, -50, 0), q0, s1.set(0, 0, 0)); glow.setMatrixAt(i, m1); glow.setColorAt(i, c1.setRGB(0, 0, 0)); }
    },
    tick(M, t, st, K, dt = 0.016) {
      if (!K) return;
      if (!LI) { LI = {}; for (const L of [...K.lesson, ...K.stations.flat()]) LI[L.mv.name] = L; }
      const les = st.phase === 'lesson', step = st.phase === 'course' ? st.step : st.phase === 'reward' ? 4 : -1;
      if (step !== lastStep) { lastStep = step; stepT = 0; } else stepT += dt;
      const P = ctx.player.pos, hx = P.x - ctx.worldOff.x, hz = P.z - ctx.worldOff.z, hy = P.y - ctx.worldOff.y;
      gq = 0;
      if (!les && demoT <= 0.2) demoT = 99;        // a replay (🔁) starts at station 1: her sunflower has long grown
      // ---- Sprout's demo: her seedling shoots up into a sunflower, which then turns to the child (and keeps following him) ----
      if (demoT > 0.2) {
        const g = clamp01((demoT - 0.2) / 1.4), pop = clamp01((demoT - 1.6) / 0.5), b = Math.sin(pop * Math.PI) * (1 - 0.4 * pop);
        const sy = g < 1 ? 0.1 + 0.9 * ease(g) : 1 + 0.16 * b, sx = g < 1 ? sy * (0.6 + 0.4 * ease(g)) : 1 + 0.28 * b;
        if (demoT < 2.2) yaw0 = -1.2; else yaw0 = turnTo(yaw0, Math.atan2(hx - D0[0], hz - D0[2]), Math.min(1, dt * 2.2));
        M.seed0.pose(D0[0], D0y, D0[2], 0, 0.6, Math.sin(t * 14) * 0.12 * (1 - g), Math.max(0, 1 - g / 0.3) * 1.2);
        M.sunf0.poseS(D0[0], D0y, D0[2], 0, yaw0, Math.sin(t * 1.6) * 0.04 + (g < 1 ? Math.sin(t * 8) * 0.06 * (1 - g) : 0), sx, sy, sx);
      }
      // ---- the lesson's three plants: free once popped; one merged copy once all three are done ----
      let lesDone = true;
      for (let j = 0; j < 3; j++) { const L = LI['seed' + (1 + j)]; if (!L || !L.done || L.popT < POP) { lesDone = false; continue; } if (!trioMerged) poseFree(M, ['tulip', 'daisy', 'fern'][j], L, t, j); }
      if (lesDone && !trioMerged) { trioMerged = true; M.trio.pose(0, 0, 0, 0, 0, 0, 1); for (const n of ['tulip', 'daisy', 'fern']) M[n].pose(0, 0, 0, 0, 0, 0, 0); }
      // ---- 1 the star waits on the post; after the beanstalk grows it hops onto the top and slides down leaf by leaf to the hero ----
      if (starT <= 0) M.star.pose(PX, STAR_Y + Math.sin(t * 2) * 0.03, PZ, 0, t * 1.2, 0, 1);
      else {
        let x, y, z, s = 1;
        if (starT < 0.6) { const u = ease(starT / 0.6); x = PX + (SLIDE[0] - PX) * u; z = PZ + (SLIDE[2] - PZ) * u; y = STAR_Y + (SLIDE[1] - STAR_Y) * u + Math.sin(u * Math.PI) * 0.3; }
        else if (starT < 3.4) {
          const f = (starT - 0.6) / 2.8 * (NSL - 1), k = Math.min(NSL - 2, f | 0), u = ease(f - k), i0 = k * 3, i1 = i0 + 3;
          x = SLIDE[i0] + (SLIDE[i1] - SLIDE[i0]) * u; y = SLIDE[i0 + 1] + (SLIDE[i1 + 1] - SLIDE[i0 + 1]) * u + Math.sin(u * Math.PI) * 0.06; z = SLIDE[i0 + 2] + (SLIDE[i1 + 2] - SLIDE[i0 + 2]) * u;
          if (starSfx < 10 + k && starT < 99) { starSfx = 10 + k; fun.sfx.tink(k % 4); }
        } else {
          const u = ease(clamp01((starT - 3.4) / 0.8)), n = (NSL - 1) * 3;
          x = SLIDE[n] + (hx - SLIDE[n]) * u; z = SLIDE[n + 2] + (hz - SLIDE[n + 2]) * u; y = SLIDE[n + 1] + (hy + 1.15 - SLIDE[n + 1]) * u + Math.sin(u * Math.PI) * 0.4;
          s = 1 - clamp01((starT - 4.25) / 0.2);
        }
        M.star.pose(x, y, z, 0, t * 3, 0, s);
      }
      // ---- 2 the sunflowers turn to the hero together (and keep following him); three bees circle their heads ----
      for (let j = 1; j <= 3; j++) {
        const L = LI['seed' + (4 + j)]; if (!L || !L.done || L.popT < POP) continue;
        const a = L.arr;
        if (sunT > 0) syaw[j] = turnTo(syaw[j], Math.atan2(hx - a[0], hz - a[2]), Math.min(1, dt * (sunT >= 99 ? 99 : 2.6)));
        M['sunf' + j].poseS(a[0], a[1], a[2], 0, syaw[j], Math.sin(t * 1.6 + j) * 0.05, 1, 1, 1);
        const bee = M['bee' + (j - 1)];
        if (sunT > 0.2) {
          const e = ease(clamp01((sunT - 0.2) / 0.9)), ang = t * 3.2 + j * 2.1, r = 0.34 + (1 - e) * 1.4, cx = a[0] + Math.sin(syaw[j]) * 0.05, cz = a[2] + Math.cos(syaw[j]) * 0.05;
          bee.pose(cx + Math.cos(ang) * r, a[1] + 1.55 + Math.sin(t * 5 + j) * 0.08 + (1 - e) * 1.0, cz + Math.sin(ang) * r, 0, Math.atan2(-Math.sin(ang), Math.cos(ang)), Math.sin(t * 9 + j) * 0.2, e);
        } else bee.pose(0, -50, 0, 0, 0, 0, 0);
      }
      // ---- 3 the vine lays itself across the stream; the ladybird walks over it; the hero walks across it too ----
      { const L = LI.seed8;
        if (L && L.done && L.popT >= POP && layT > 0) {
          const u = clamp01(layT / 1.2), a = L.arr;
          M.vine.poseS(a[0], a[1], a[2], 0, 0, Math.PI / 2 * (1 - bounce(u)), 1, 1, 1);
        }
        const bt = layT;
        if (bt < 1.3) M.bug.pose(VX - 0.4, G(VX - 0.4, VZ + 0.35) + 0.01 + Math.abs(Math.sin(t * 3)) * 0.01, VZ + 0.35, 0, Math.PI / 2 + Math.sin(t * 1.3) * 0.3, 0, 1);
        else if (bt < 1.7) { const u = ease((bt - 1.3) / 0.4); M.bug.pose(VX - 0.4 + 0.4 * u, VY - 0.07 + 0.08 * u, VZ + 0.35 * (1 - u), 0, Math.PI / 2 - 0.6 * (1 - u), 0, 1); }
        else if (bt < 3.7) { const u = (bt - 1.7) / 2.0, du = 0.01, sl = (archY(Math.min(1, u + du)) - archY(Math.max(0, u - du))) / (2 * du * VINE_S);
          M.bug.pose(VX + u * VINE_S, VY + archY(u) + 0.045, VZ + Math.sin(u * 20) * 0.02, 0, Math.PI / 2, Math.atan(sl), 1); }
        else { const u = ease(clamp01((bt - 3.7) / 0.4)), ex = VX + VINE_S, ey = VY + archY(1) + 0.045, tx = ex + 0.35, tz = VZ + 0.4;
          M.bug.pose(ex + (tx - ex) * u, ey + (G(tx, tz) + 0.01 - ey) * u, VZ + (tz - VZ) * u, 0, Math.PI / 2 - 0.8 * u, 0, 1); }
        if (layT >= 1.0) {                         // walking over the bridge: the hero rides its deck
          const u = (hx - VX) / VINE_S;
          if (u > 0 && u < 1 && Math.abs(hz - VZ) < 0.5) { const yw = ctx.worldOff.y + VY + archY(u) + 0.05; if (yw > P.y) { P.y = yw; ctx.player.model.position.y = yw; } }
        } }
      // ---- 4 the vegetables: free once popped, a little bounce together, then one merged copy ----
      for (let j = 0; j < 3; j++) {
        const L = LI['seed' + (9 + j)]; if (!L || !L.done || L.popT < POP || vegMerged) continue;
        const k = vegT - j * 0.22, hop = k > 0 && k < 2.0 ? Math.abs(Math.sin(k * 5.2)) * 0.13 * (1 - k / 2.0) : 0, sq = k > 0 && k < 2.0 ? Math.sin(k * 10.4) * 0.07 * (1 - k / 2.0) : 0;
        if (vegT > 0) { const a = L.arr; M[VEG[j]].poseS(a[0], a[1] + hop, a[2], 0, L.rot1[1], 0, 1 + sq, 1 - sq, 1 + sq); }
        else poseFree(M, VEG[j], L, t, j);
      }
      if (vegT >= 2.6 && !vegMerged) { vegMerged = true; M.vegAll.pose(0, 0, 0, 0, 0, 0, 1); for (const n of VEG) M[n].pose(0, 0, 0, 0, 0, 0, 0); }
      // ---- 5 the giant flower: its bloom rides the top of the stem (a closed bud until it opens); the baby mandrake ----
      { const gm = M.giant.mesh;
        if (shows(M.giant)) {
          const sy = gm.scale.y, rz = gm.rotation.z, ry = gm.rotation.y, lx = -Math.sin(rz) * GIANT_H * sy;
          const open = manT > 0 ? back(clamp01(manT / 1.2)) : 0, bs = sy * (0.32 + 0.68 * open);
          M.bloom.poseS(gm.position.x + Math.cos(ry) * lx, gm.position.y + Math.cos(rz) * GIANT_H * sy + 0.04, gm.position.z - Math.sin(ry) * lx, 0, ry, (1 - open) * 1.4 + t * 0.15 * open, bs, bs, sy * (0.9 - 0.1 * open));
        } else M.bloom.pose(0, 0, 0, 0, 0, 0, 0);
        if (manT > 1.2) {
          let y = MY - 0.04, sq = 0;
          if (manT < 1.5) y = MY - 0.3 + (manT - 1.2) / 0.3 * 0.12 + Math.sin(t * 40) * 0.01;
          else if (manT < 2.0) { const u = (manT - 1.5) / 0.5; y = MY - 0.18 + u * (0.14) + Math.sin(u * Math.PI) * 0.55; }
          else { const k = manT - 2.0; sq = k < 0.3 ? Math.sin(k / 0.3 * Math.PI) * 0.15 : 0; y = MY - 0.04 + Math.abs(Math.sin(t * 4)) * 0.03; }
          const rock = manT >= 2.0 ? Math.sin(t * 3) * 0.1 : 0, s = MS;
          M.mandrake.poseS(MX, y, MZ, 0, MYAW, rock, s * (1 + sq), s * (1 - sq), s * (1 + sq));
          if (manT >= 2.0) {
            const c = Math.cos(MYAW), sn = Math.sin(MYAW), ox = 0.15 * s, oy = 0.2 * s;
            M.arm.pose(MX + c * ox, y + oy * (1 - sq), MZ - sn * ox, 0, MYAW, -(0.75 + 0.42 * Math.sin(t * 10)), s);
          } else M.arm.pose(0, 0, 0, 0, 0, 0, 0);
        } else { M.mandrake.pose(0, 0, 0, 0, 0, 0, 0); M.arm.pose(0, 0, 0, 0, 0, 0, 0); } }
      // ---- night: a soft pool of light at the station, a halo round the open seedling, fireflies ----
      if (NK > 0) {
        const C = CEN[les ? 0 : Math.min(5, step + 1)];
        quad(C[0], C[1] + 0.08, C[2], 6, 6, 0.3 * NK, 0.27 * NK, 0.15 * NK, 1);
        if (st.sub === 'cast' && st.lifts) for (const L of st.lifts) { if (L.done) continue; const a = L.arr, pu = 0.8 + 0.2 * Math.sin(t * 5);
          quad(a[0], a[1] + 0.15, a[2], 0.9, 0.9, 0.5 * NK * pu, 0.8 * NK * pu, 0.25 * NK * pu); }
        for (let i = 0; i < 6; i++) {
          const a = t * 0.35 * (1 + i * 0.13) + i * 0.9, r = 1.4 + (i % 3) * 0.5, fl = 0.6 + 0.4 * Math.sin(t * 7 + i * 2.3);
          quad(C[0] + Math.cos(a) * r, C[1] + 0.6 + 0.9 * (0.5 + 0.5 * Math.sin(t * 0.9 + i * 1.7)), C[2] + Math.sin(a * 1.3) * r * 0.7, 0.14, 0.14, 1.3 * fl * NK, 1.6 * fl * NK, 0.5 * fl * NK);
        }
      }
      for (let i = gq; i < NQ; i++) { m1.compose(v1.set(0, -50, 0), q0, s1.set(0, 0, 0)); glow.setMatrixAt(i, m1); }
      glow.instanceMatrix.needsUpdate = true; if (glow.instanceColor) glow.instanceColor.needsUpdate = true; glow.visible = gq > 0;
      // ---- what is drawn: a thing only while it shows and its station (or the one just left, for a moment) is near ----
      const left = (s) => step === s || (step === s + 1 && stepT < 2.5);
      vis(M, SEEDS, true);
      vis(M, ['tulip'], !trioMerged); vis(M, ['daisy'], !trioMerged); vis(M, ['fern'], !trioMerged); vis(M, ['trio'], trioMerged);
      vis(M, ['sunf0', 'sunf1', 'sunf2', 'sunf3'], true);
      vis(M, ['bean'], step <= 2 || left(2));
      vis(M, ['star'], step <= 1);
      vis(M, ['bee0', 'bee1', 'bee2'], sunT > 0.2 && left(1));
      vis(M, ['vine'], step === 2 || step === 3 || left(3));
      M.bug.mesh.visible = step === 2 || step === 3 || left(3);
      vis(M, ['carrot'], !vegMerged); vis(M, ['pumpkin'], !vegMerged); vis(M, ['berry'], !vegMerged);
      vis(M, ['vegAll'], vegMerged && left(3));
      vis(M, ['giant'], true); vis(M, ['bloom'], true); vis(M, ['mandrake'], true); vis(M, ['arm'], true);
    },
    effects: {
      // Sprout's demo: her seedling shoots up into a sunflower, which turns to face the child (3.6 s, the next line talks over its end)
      demo(M, t, quiet) {
        demoT = quiet ? 99 : t;
        if (!quiet) {
          if (demoSfx < 1 && t > 0.2) { demoSfx = 1; fun.sfx.sparkle(); fun.sfx.tone(260, 1.4, 'sine', 0.1, 0, 780); }
          if (demoSfx < 2 && t > 1.6) { demoSfx = 2; fun.sfx.pop(); kit.burst(D0[0], D0y + 1.5, D0[2], 18); }
          if (demoSfx < 3 && t > 2.4) { demoSfx = 3; fun.sfx.chime(); }
        }
        return t < 3.6;
      },
      // the star hops onto the beanstalk's top and slides down its leaves to the hero (4.6 s)
      starSlide(M, t, quiet) {
        starT = quiet ? 99 : t;
        if (!quiet) {
          if (starSfx < 1 && t > 0.05) { starSfx = 1; fun.sfx.boing(); }
          if (starSfx < 30 && t > 4.2) { starSfx = 30; kit.burst(hx(), 1.15, hz(), 14); fun.sfx.tune([784, 988, 1319], 0.1, 'sine'); }
        }
        return t < 4.6;
      },
      // the three sunflowers turn to the hero together, three bees come to circle them, a soft hum (3.4 s)
      sunTurn(M, t, quiet) {
        sunT = quiet ? 99 : t;
        if (!quiet) {
          if (sunSfx < 1) { sunSfx = 1; fun.sfx.tune([523, 659, 784], 0.12, 'triangle'); }
          if (sunSfx < 2 && t > 0.4) { sunSfx = 2; hum(); }
          if (sunSfx < 3 && t > 2.2) { sunSfx = 3; hum(); }
        }
        return t < 3.4;
      },
      // the vine lays itself across the stream (a bouncy fall), the ladybird walks over it (4.4 s)
      vineLay(M, t, quiet) {
        layT = quiet ? 99 : t;
        if (!quiet) {
          if (laySfx < 1) { laySfx = 1; fun.sfx.whoosh(); }
          if (laySfx < 2 && t > 0.45) { laySfx = 2; fun.sfx.boing(); kit.burst(VX + VINE_S * 0.5, VY + 0.3, VZ, 14); }
          if (laySfx < 3 && t > 1.3) { laySfx = 3; fun.sfx.squeak(); }
          if (laySfx < 4 && t > 3.75) { laySfx = 4; fun.sfx.tune([659, 784, 988], 0.1, 'triangle'); kit.burst(VX + VINE_S, VY + 0.2, VZ, 8); }
        }
        return t < 4.4;
      },
      // the carrot, the pumpkin and the strawberry plant do a little bounce together (2.8 s)
      vegBounce(M, t, quiet) {
        vegT = quiet ? 99 : t;
        if (!quiet) {
          if (vegSfx < 1) { vegSfx = 1; fun.sfx.tune([523, 659, 784, 1047], 0.11, 'triangle'); }
          for (let j = 0; j < 3; j++) if (vegSfx < 2 + j && t > 0.05 + j * 0.22) { vegSfx = 2 + j; fun.sfx.boing(); kit.burst(HB.veg[j][0], 0.6, HB.veg[j][1], 6); }
        }
        return t < 2.8;
      },
      // the giant bloom opens; a happy baby mandrake pops out of the pot, waves and giggles (5.8 s)
      mandrake(M, t, quiet) {
        manT = quiet ? 99 : t;
        if (!quiet) {
          if (manSfx < 1 && t > 0.05) { manSfx = 1; fun.sfx.sparkle(); fun.sfx.tone(392, 1.0, 'sine', 0.1, 0, 784); }
          if (manSfx < 2 && t > 1.0) { manSfx = 2; fun.sfx.chime(); kit.burst(HB.stem[0], 2.6, HB.stem[1], 18); }
          if (manSfx < 3 && t > 1.5) { manSfx = 3; fun.sfx.pop(); fun.sfx.boing(); kit.burst(MX, MY + 0.3, MZ, 14); }
          if (manSfx < 4 && t > 2.1) { manSfx = 4; fun.sfx.giggle(true); }
          if (manSfx < 5 && t > 3.9) { manSfx = 5; fun.sfx.giggle(true); fun.sfx.heart(); }
        }
        return t < 5.8;
      },
    },
  };
  function hx() { return ctx.player.pos.x - ctx.worldOff.x; }
  function hz() { return ctx.player.pos.z - ctx.worldOff.z; }
}

// ---- Course #7 geometry: chunky, round, friendly animals (front = +z, origin at the feet unless noted). The eyes of the
// creatures that wake up are NOT in these meshes: they are one shared instanced set (eyeGeo) that opens by scaling in y.
function speckle(geo, hexA, hexB, k = 0.2) {     // speckled shell: a few vertices take the dot colour
  const P = geo.attributes.position, n = P.count, col = new Float32Array(n * 3), a = new Color(hexA), b = new Color(hexB);
  for (let i = 0; i < n; i++) { const h = Math.abs(Math.sin(P.getX(i) * 127.1 + P.getY(i) * 311.7 + P.getZ(i) * 74.7) * 43758.5) % 1; _c.copy(h < k ? b : a); col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new BufferAttribute(col, 3)); return geo;
}
const ball = (r, x, y, z, hex, hex2 = null, sx = 1, sy = sx, sz = sx, ws = 12, hs = 9) => paint(place(new SphereGeometry(r, ws, hs), x, y, z, 0, 0, 0, sx, sy, sz), hex, hex2);
function eyeGeo() {                                // a big shiny black eye (r 0.05) with two glints, facing +z
  return merge([
    paint(place(new SphereGeometry(0.05, 12, 9), 0, 0, 0, 0, 0, 0, 1, 1.1, 0.55), 0x16101c),
    paint(place(new SphereGeometry(0.016, 6, 5), 0.015, 0.022, 0.026), 0xffffff),
    paint(place(new SphereGeometry(0.008, 5, 4), -0.016, -0.016, 0.027), 0xffffff),
  ]);
}
function heartGeo(s = 0.07) {
  const h = new Shape();
  h.moveTo(0, -0.9 * s); h.bezierCurveTo(-0.5 * s, -0.4 * s, -1.0 * s, -0.1 * s, -1.0 * s, 0.35 * s); h.bezierCurveTo(-1.0 * s, 0.85 * s, -0.3 * s, 1.0 * s, 0, 0.55 * s);
  h.bezierCurveTo(0.3 * s, 1.0 * s, 1.0 * s, 0.85 * s, 1.0 * s, 0.35 * s); h.bezierCurveTo(1.0 * s, -0.1 * s, 0.5 * s, -0.4 * s, 0, -0.9 * s);
  return paint(new ShapeGeometry(h, 8), 0xff3a7a, 0xff9ac0);
}
function heartRingGeo() {                          // the baby dragon's heart-shaped smoke ring (~0.4 m across, faces +z)
  const pts = []; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, s = Math.sin(a); pts.push(new Vector3(16 * s * s * s * 0.012, (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * 0.012, 0)); }
  return paint(new TubeGeometry(new CatmullRomCurve3(pts, true), 60, 0.035, 6, true), 0xe8e4f0, 0xffffff);
}
function puffGeo() {                               // white-ish; the instance colour makes it pink / cream / lilac
  const P = [ball(0.2, 0, 0.2, 0, 0xd8d0d8, 0xffffff)];
  for (let i = 0; i < 18; i++) {
    const y = 1 - (i + 0.5) / 18 * 2, rr = Math.sqrt(1 - y * y), a = i * 2.4, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (z > 0.45 && y > -0.5) continue;            // keep the face clear
    P.push(ball(0.075, x * 0.19, 0.2 + y * 0.19, z * 0.19, 0xe0d8e0, 0xffffff, 1, 1, 1, 8, 6));
  }
  for (const s of [-1, 1]) {
    P.push(paint(place(new ConeGeometry(0.04, 0.09, 7), s * 0.09, 0.39, -0.01, 0, 0, -s * 0.35), 0xe8e0e8, 0xffffff));
    P.push(ball(0.045, s * 0.08, 0.025, 0.11, 0xd8d0d8, null, 1, 0.6, 1.3, 8, 6));
    P.push(ball(0.032, s * 0.115, 0.19, 0.165, 0xff8aa8, null, 1, 0.7, 0.4, 8, 6));
  }
  P.push(paint(place(new TorusGeometry(0.028, 0.008, 4, 10, Math.PI), 0, 0.19, 0.192, 0, 0, Math.PI), 0x4a2030));
  return merge(P);
}
function dogGeo() {                                // a big friendly hound lying down (Fang-ish, softer), head toward +z
  const B = 0x4e3628, B2 = 0x6e4e38, L = 0xb48e6c;
  return merge([
    paint(place(new SphereGeometry(0.36, 16, 12), 0, 0.29, -0.05, 0, 0, 0, 1.05, 0.78, 1.6), L, B2),
    ball(0.26, 0, 0.52, 0.6, B, B2), ball(0.14, 0, 0.44, 0.8, L, 0xd0a888, 1, 0.8, 1.25),
    ball(0.05, 0, 0.49, 0.96, 0x18121a), paint(place(new TorusGeometry(0.035, 0.01, 4, 10, Math.PI), 0, 0.4, 0.93, 0, 0, Math.PI), 0x3a2018),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.13, 10, 8), s * 0.22, 0.44, 0.58, 0, 0, s * 0.45, 0.42, 1.15, 0.8), 0x3a2820)),
    ...[-1, 1].map(s => ball(0.09, s * 0.16, 0.07, 0.72, L, null, 1, 0.7, 1.45)),
    ...[-1, 1].map(s => ball(0.11, s * 0.3, 0.09, -0.4, B2, null, 1, 0.75, 1.3)),
    paint(place(new TorusGeometry(0.2, 0.035, 5, 16), 0, 0.42, 0.42, Math.PI / 2 - 0.4, 0, 0), 0xd83a3a),
    ball(0.04, 0, 0.27, 0.52, 0xffd040),
  ]);
}
function tailGeo() { return merge([paint(place(new CylinderGeometry(0.03, 0.055, 0.42, 7), 0, 0.21, 0), 0x6e4e38, 0x4e3628), ball(0.04, 0, 0.42, 0, 0x6e4e38)]); }
function owl2Geo() {                               // a round sleepy owl (no wings: they are their own pair)
  return merge([
    ball(0.21, 0, 0.23, 0, 0x8a6a50, 0x6a4e3a, 1, 1.1, 0.95), ball(0.15, 0, 0.18, 0.08, 0xf0e2c8, 0xd8c4a4),
    paint(place(new SphereGeometry(0.15, 12, 9), 0, 0.3, 0.09, 0, 0, 0, 1.05, 0.75, 0.45), 0xf4ead8),
    paint(place(new ConeGeometry(0.03, 0.07, 6), 0, 0.25, 0.2, Math.PI / 2), 0xff9a20),
    ...[-1, 1].map(s => paint(place(new ConeGeometry(0.045, 0.11, 5), s * 0.12, 0.45, 0, 0, 0, -s * 0.35), 0x6a4e3a)),
    ...[-1, 1].map(s => ball(0.035, s * 0.07, 0.015, 0.1, 0xffa030, null, 1.2, 0.5, 1.1, 8, 6)),
  ]);
}
function owlWingGeo() { return paint(place(new SphereGeometry(0.12, 10, 8), 0.02, -0.1, -0.01, 0, 0, 0, 0.32, 1.0, 0.75), 0x7a5a42, 0x5a3e2c); }   // pivot at the shoulder
function moleGeo() {                               // a round shy burrower with a big shiny pink nose
  return merge([
    ball(0.17, 0, 0.18, 0, 0x8a7a72, 0x5e5050, 1, 1.12, 0.95), ball(0.12, 0, 0.14, 0.07, 0xc8b8a8, 0xa89888),
    ball(0.075, 0, 0.21, 0.14, 0xd8b0a0, null, 1.1, 0.85, 1.0), ball(0.048, 0, 0.215, 0.215, 0xff5a8a), ball(0.014, 0.014, 0.235, 0.255, 0xffffff, null, 1, 1, 1, 6, 4),
    ...[-1, 1].map(s => ball(0.045, s * 0.1, 0.08, 0.14, 0xffb0b8, null, 1.15, 0.7, 1, 8, 6)),
    ...[-1, 1].map(s => ball(0.03, s * 0.12, 0.31, 0.0, 0x6e5e58, null, 1, 1, 0.6, 8, 6)),
  ]);
}
function coinGeo() { return merge([paint(place(new CylinderGeometry(0.085, 0.085, 0.022, 18), 0, 0.011, 0), 0xd89a10, 0xffe060), paint(place(new TorusGeometry(0.07, 0.008, 4, 18), 0, 0.023, 0, Math.PI / 2), 0xfff0a0), paint(place(starGeo(0.035), 0, 0.024, 0, -Math.PI / 2), 0xfff4b0)]); }
function foalGeo() {                               // a proud little winged horse-bird foal: feathered white front, cream body, hooves (whites kept <= 0.84 so the sun does not bloom them)
  const P = [
    ball(0.3, 0, 0.6, -0.08, 0xb8946a, 0xd8b890, 0.82, 0.78, 1.3), ball(0.22, 0, 0.66, 0.24, 0xa8a094, 0xbcb4a6, 1, 1.05, 0.9),
    paint(place(new CylinderGeometry(0.1, 0.13, 0.32, 10), 0, 0.84, 0.32, 0.45), 0xa8a094, 0xbcb4a6),
    ball(0.17, 0, 1.02, 0.42, 0xb0a89c, 0xc2baac), ball(0.07, 0, 0.97, 0.58, 0xffc850, 0xffe080, 1, 0.75, 1.1),
    ...[0, 1, 2].map(k => paint(place(new ConeGeometry(0.035, 0.12, 6), (k - 1) * 0.05, 1.18, 0.38 - k * 0.04, -0.3, 0, (k - 1) * -0.3), 0x9a8ed0, 0xb4a8e0)),
    ...[-1, 1].map(s => paint(place(new ConeGeometry(0.04, 0.1, 6), s * 0.11, 1.15, 0.36, 0, 0, -s * 0.5), 0xa8a094)),
    ...[-1, 1].map(s => ball(0.03, s * 0.115, 0.98, 0.535, 0xffa0b0, null, 1, 0.7, 0.4, 8, 6)),
    ball(0.09, 0, 0.62, -0.5, 0x8a6a48, 0xb8946a, 0.8, 1.2, 1.1),
  ];
  for (const [x, z] of [[-0.14, 0.22], [0.14, 0.22], [-0.15, -0.34], [0.15, -0.34]]) {
    P.push(paint(place(new CylinderGeometry(0.045, 0.05, 0.42, 8), x, 0.25, z), 0xc8a478, 0xb8946a));
    P.push(paint(place(new CylinderGeometry(0.06, 0.06, 0.06, 8), x, 0.03, z), 0x6a5a4c));
  }
  for (let k = 0; k < 6; k++) P.push(paint(place(new SphereGeometry(0.07, 8, 5), (k % 3 - 1) * 0.09, 0.78 - Math.floor(k / 3) * 0.1, 0.42, 0.5, 0, 0, 1, 0.5, 0.35), 0x8e88b8, 0xa8a2cc));
  return merge(P);
}
function foalWingGeo() {                           // spans +x from the shoulder (1.25 m), flat in y: folded or a bridge
  const P = [];
  for (let k = 0; k < 7; k++) { const u = k / 6, x = 0.1 + u * 1.05, w = 0.2 - u * 0.06; P.push(paint(place(new SphereGeometry(w, 10, 6), x, 0, -u * 0.04, 0, 0.25 * u, 0, 1.1, 0.16, 1.0), 0x9aa2cc, 0xb2b0d0)); }
  for (let k = 0; k < 5; k++) { const x = 0.25 + k * 0.22; P.push(paint(place(new SphereGeometry(0.08, 8, 5), x, 0.02, -0.17 + k * 0.01, 0, 0, 0, 1.3, 0.2, 1.6), 0x8a9ad8, 0xb8c4f4)); }
  return merge(P);
}
function duckGeo() {
  return merge([
    ball(0.075, 0, 0.075, -0.01, 0xffd030, 0xfff070, 1, 0.9, 1.2), ball(0.055, 0, 0.16, 0.05, 0xffd838, 0xfff070),
    paint(place(new ConeGeometry(0.022, 0.05, 6), 0, 0.15, 0.115, Math.PI / 2, 0, 0, 1.4, 1, 0.6), 0xff8a10),
    ...[-1, 1].map(s => ball(0.012, s * 0.026, 0.175, 0.095, 0x141018, null, 1, 1, 1, 6, 5)),
    ...[-1, 1].map(s => ball(0.04, s * 0.06, 0.085, -0.02, 0xf0c020, null, 0.4, 0.8, 1.1, 8, 6)),
  ]);
}
function eggGeo() { return speckle(place(new SphereGeometry(0.14, 18, 14), 0, 0.17, 0, 0, 0, 0, 1, 1.3, 1), 0xffffff, 0x6a5a4a, 0.22); }
function shellGeo() { return speckle(place(new SphereGeometry(0.142, 14, 6, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48), 0, 0.17, 0, 0, 0, 0, 1, 1.3, 1), 0xffffff, 0x6a5a4a, 0.22); }   // the bottom half; the top is the same, flipped
function eyesOn(parts, x, y, z, r = 0.03, gap) { for (const s of [-1, 1]) { parts.push(ball(r, s * gap + x, y, z, 0x16101c, null, 1, 1.1, 0.6, 8, 6)); parts.push(ball(r * 0.32, s * gap + x + r * 0.3, y + r * 0.4, z + r * 0.45, 0xffffff, null, 1, 1, 1, 5, 4)); } }
function bdragonGeo() {                            // a hatchling dragon (the egg's baby): round, green, tiny wings
  const P = [ball(0.12, 0, 0.12, 0, 0x4ab04a, 0x7ad070), ball(0.085, 0, 0.1, 0.06, 0xf4e080, null, 1, 1, 0.6), ball(0.1, 0, 0.27, 0.03, 0x5ac05a, 0x8ae080),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.06, 8, 6), s * 0.12, 0.17, -0.06, 0, s * 0.4, -s * 0.5, 0.25, 1, 0.8), 0xa070e0, 0xd0b0ff)),
    ...[-1, 1].map(s => paint(place(new ConeGeometry(0.02, 0.05, 6), s * 0.045, 0.37, 0.0), 0xfff0c0)),
    ...[-1, 1].map(s => ball(0.022, s * 0.065, 0.25, 0.1, 0xff9ab0, null, 1, 0.7, 0.4, 6, 5)),
    paint(place(new TorusGeometry(0.02, 0.006, 4, 8, Math.PI), 0, 0.235, 0.115, 0, 0, Math.PI), 0x204a20)];
  eyesOn(P, 0, 0.29, 0.1, 0.024, 0.042); return merge(P);
}
function owletGeo() {
  const P = [ball(0.12, 0, 0.13, 0, 0xc8c0b8, 0xe8e2dc), ball(0.085, 0, 0.12, 0.06, 0xf4f0ea, null, 1, 1, 0.6),
    ...[-1, 1].map(s => paint(place(new ConeGeometry(0.025, 0.06, 5), s * 0.06, 0.25, 0, 0, 0, -s * 0.35), 0xb0a89e)),
    paint(place(new ConeGeometry(0.018, 0.04, 6), 0, 0.14, 0.12, Math.PI / 2), 0xff9a20)];
  eyesOn(P, 0, 0.17, 0.095, 0.03, 0.045); return merge(P);
}
function turtleGeo() {
  const P = [ribs(place(new SphereGeometry(0.14, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.04, 0, 0, 0, 0, 1, 0.75, 1.1), 0x3a8a3a, 0x6ac060, 6),
    paint(place(new CylinderGeometry(0.14, 0.13, 0.04, 14), 0, 0.03, 0, 0, 0, 0, 1, 1, 1.1), 0xd8c070), ball(0.065, 0, 0.1, 0.17, 0x8ad070, 0xa8e090),
    ...[[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => ball(0.04, sx * 0.11, 0.03, sz * 0.1, 0x8ad070, null, 1, 0.6, 1.2, 8, 6)),
    paint(place(new TorusGeometry(0.018, 0.005, 4, 8, Math.PI), 0, 0.085, 0.228, 0, 0, Math.PI), 0x204a20)];
  eyesOn(P, 0, 0.12, 0.215, 0.019, 0.03); return merge(P);
}
function dragonGeo(happy) {                        // the finale's baby dragon: grumpy (brows down, a pout) or happy (brows up, a smile)
  const G1 = 0x3aa040, G2 = 0x6ad060, P = [
    ball(0.21, 0, 0.22, 0, G1, G2, 1, 1.05, 0.95), ball(0.15, 0, 0.2, 0.09, 0xf0d870, 0xfff0a0, 1, 1.05, 0.6),
    ball(0.17, 0, 0.5, 0.04, G1, G2), ball(0.1, 0, 0.43, 0.17, 0x7ad870, 0x9ae890, 1.15, 0.8, 0.9),
    ...[-1, 1].map(s => ball(0.014, s * 0.035, 0.45, 0.255, 0x1a3a1a, null, 1, 1, 1, 6, 4)),
    ...[-1, 1].map(s => paint(place(new ConeGeometry(0.032, 0.09, 7), s * 0.085, 0.66, -0.01, 0, 0, -s * 0.25), 0xfff0c8, 0xffffff)),
    ...[-1, 1].map(s => paint(place(new SphereGeometry(0.1, 9, 7), s * 0.19, 0.36, -0.12, 0, s * 0.5, -s * 0.6, 0.22, 1, 0.75), 0x9a60d8, 0xd0a8ff)),
    ...[-1, 1].map(s => ball(0.06, s * 0.11, 0.04, 0.08, G1, null, 1, 0.6, 1.25, 8, 6)),
    paint(place(new ConeGeometry(0.07, 0.34, 8), 0, 0.1, -0.3, -Math.PI / 2 - 0.25), G1, G2),
    paint(place(new ConeGeometry(0.05, 0.07, 4), 0, 0.03, -0.48, -Math.PI / 2 - 0.25, 0, 0, 1.4, 1, 0.5), 0x9a60d8),
  ];
  for (const s of [-1, 1]) P.push(paint(place(new BoxGeometry(0.07, 0.016, 0.02), s * 0.068, happy ? 0.61 : 0.585, 0.19, 0, 0, happy ? s * 0.25 : -s * 0.45), 0x1e3a1e));
  if (happy) { P.push(paint(place(new TorusGeometry(0.04, 0.01, 4, 10, Math.PI), 0, 0.42, 0.262, 0, 0, Math.PI), 0x1e3a1e)); for (const s of [-1, 1]) P.push(ball(0.032, s * 0.12, 0.45, 0.17, 0xff8aa0, null, 1, 0.7, 0.45, 8, 6)); }
  else P.push(paint(place(new TorusGeometry(0.03, 0.009, 4, 10, Math.PI), 0, 0.37, 0.25), 0x1e3a1e));
  return merge(P);
}

// The Creatures course props (see COURSES.creatures and CR): OUTDOORS round the paddock, so every prop sits on ctx.ground.
// Static (ONE merged mesh): the hay bale, the dog's blanket, the owl's post, three burrow mounds, the stream bed, three nests
// with picture signs. Movers: the three puffballs (one instanced set), the dog and its tail, the owl and its wing pair, the
// star, the three burrowers and their coins (two instanced sets), the foal and its wing pair, the duckling, the three eggs,
// their shells (one set of six) and the three babies, the finale dragon (grumpy and happy meshes, one shown) and its heart
// ring. Shared by every creature: ONE instanced eye set (eyes open by scaling in y), ONE instanced heart set (hearts float up
// while a creature is stroked, a puff of bigger ones when it is happy), ONE additive soft-quad set (an egg's warmth by day; a
// pool of light, halos and fireflies at dusk / night). vis() keeps <= 12 course meshes drawn at any station.
// No per-frame allocations: every temporary is made here once.
function buildCreatures(kit) {
  const { solid, ctx } = kit;
  const G = ctx.ground, NK = ctx.night ? ctx.night() : 0;
  const WOOD = 0x7a5232, WOOD2 = 0xa0703e, DARK = 0x4a3020, STRAW = 0xa88438, STRAW2 = 0xc8a04c, SOIL = 0x5a3c24, SOIL2 = 0x7a5634;
  // ---- static ----
  { const [x, z, ry] = CR.bale, y = G(x, z);                     // the hay bale (the puffballs sit on it)
    solid(paint(place(new BoxGeometry(1.5, BALE_TOP, 0.56), x, y + BALE_TOP / 2 - 0.01, z, 0, ry, 0), STRAW, STRAW2));
    for (const k of [-0.4, 0.4]) solid(paint(place(new BoxGeometry(0.05, BALE_TOP + 0.02, 0.58), x + Math.cos(ry) * k, y + BALE_TOP / 2, z - Math.sin(ry) * k, 0, ry, 0), 0x9a6a2a));
    for (let i = 0; i < 7; i++) { const k = -0.6 + i * 0.2; solid(paint(place(new ConeGeometry(0.03, 0.12, 4), x + Math.cos(ry) * k, y + BALE_TOP + 0.02, z - Math.sin(ry) * k + (i % 2 ? 0.2 : -0.2), 0.5, i, 0.4), STRAW2)); } }
  { const [x, z] = CR.dog;                                         // the dog's red blanket
    solid(paint(place(new CylinderGeometry(0.62, 0.62, 0.03, 18), x, G(x, z) + 0.012, z, 0, CR.dog[2], 0, 0.85, 1, 1.25), 0x7a3a5a, 0x9a4a6a)); }
  { const [x, z, h] = CR.post, y = G(x, z);                       // the owl's post, a little perch on top
    solid(paint(place(new CylinderGeometry(0.075, 0.095, h, 8), x, y + h / 2, z), DARK, WOOD2));
    solid(paint(place(new CylinderGeometry(0.17, 0.17, 0.05, 12), x, y + h - 0.01, z), WOOD, WOOD2));
    solid(paint(place(new CylinderGeometry(0.15, 0.17, 0.08, 10), x, y + 0.03, z), 0x8a8478, 0xa8a294)); }
  for (const [x, z] of CR.moles) { const y = G(x, z);              // burrow mounds: a dirt dome with a dark hole on top
    solid(paint(place(new SphereGeometry(0.38, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), x, y - 0.005, z, 0, 0, 0, 1, 0.35, 1), SOIL, SOIL2));
    solid(paint(place(new CircleGeometry(0.17, 14), x, y + MOUND_TOP, z, -Math.PI / 2), 0x1a120a));
    for (let i = 0; i < 4; i++) { const a = i * 1.7 + x; solid(paint(place(new SphereGeometry(0.06, 6, 4), x + Math.cos(a) * 0.45, G(x + Math.cos(a) * 0.45, z + Math.sin(a) * 0.45) + 0.01, z + Math.sin(a) * 0.45, 0, 0, 0, 1, 0.5, 1), SOIL2)); } }
  { const [sx, w, z0, z1] = CR.stream;                            // the stream bed (as Herbology's): water, muddy banks, stones, reeds
    const strip = (cx, ww, segX, lift, colAt) => {
      const g = new PlaneGeometry(ww, z1 - z0, segX, 16).rotateX(-Math.PI / 2).translate(cx, 0, (z0 + z1) / 2), P = g.attributes.position, col = new Float32Array(P.count * 3);
      for (let i = 0; i < P.count; i++) { P.setY(i, G(P.getX(i), P.getZ(i)) + lift); colAt(P.getX(i), _c); col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
      g.setAttribute('color', new BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
    };
    const deep = new Color(0x2a6ad8), edge = new Color(0x8ad8ff), mud = new Color(0x5e4028), grass = new Color(0x5a7a30);
    solid(strip(sx, w, 4, 0.025, (x, c) => c.copy(deep).lerp(edge, Math.min(1, Math.abs(x - sx) / (w / 2)) ** 2)));
    for (const sd of [-1, 1]) solid(strip(sx + sd * (w / 2 + 0.15), 0.34, 1, 0.04, (x, c) => c.copy(mud).lerp(grass, Math.min(1, Math.abs(x - sx) - w / 2) / 0.34)));
    for (let i = 0; i < 8; i++) { const sd = i % 2 ? 1 : -1, z = z0 + 0.5 + i * 1.1, x = sx + sd * (w / 2 + 0.2 + (i % 3) * 0.04);
      if (Math.abs(z - CR.foal[1]) < 0.7) continue;
      solid(paint(place(new SphereGeometry(0.09 + (i % 3) * 0.03, 8, 5), x, G(x, z) + 0.04, z, 0, i, 0, 1.3, 0.55, 1), 0x8a8478, 0xb0aa9a)); }
    for (let i = 0; i < 6; i++) { const z = z0 + 0.9 + i * 1.4, x = sx + ((i % 3) - 1) * 0.2;
      solid(paint(place(new SphereGeometry(0.1, 8, 4), x, G(x, z) + 0.032, z, 0, 0, 0, 1.4, 0.05, 0.2), 0xd8f4ff)); }
    for (const [x, z] of [[sx - w / 2 - 0.45, CR.foal[1] + 0.6], [sx - w / 2 - 0.35, CR.foal[1] - 0.8], [sx + w / 2 + 0.3, CR.foal[1] - 1.2]])
      for (let k = 0; k < 4; k++) solid(paint(place(new CylinderGeometry(0.012, 0.018, 0.5 + k * 0.08, 4), x + (k - 1.5) * 0.06, G(x, z) + 0.25 + k * 0.04, z + (k % 2) * 0.05, (k - 1.5) * 0.12, 0, (k - 1.5) * 0.1), 0x3a7a2a, 0x8ac050)); }
  CR.nests.forEach(([x, z], j) => {                               // nests of straw, each with its picture sign behind
    const y = G(x, z);
    solid(paint(place(new TorusGeometry(0.19, 0.075, 6, 16), x, y + 0.06, z, Math.PI / 2, 0, 0, 1, 1, 0.9), 0xa07a3a, STRAW));
    solid(paint(place(new CylinderGeometry(0.17, 0.12, 0.05, 12), x, y + 0.04, z), 0x7a5a2a));
    for (let i = 0; i < 6; i++) { const a = i * 1.05 + j; solid(paint(place(new CylinderGeometry(0.008, 0.008, 0.2, 3), x + Math.cos(a) * 0.2, y + 0.1, z + Math.sin(a) * 0.2, 1.2, a, 0), STRAW2)); }
    const sz = z - 0.55, sy = G(x, sz);
    solid(paint(place(new BoxGeometry(0.06, 0.8, 0.06), x, sy + 0.4, sz - 0.02), DARK));
    solid(paint(place(new BoxGeometry(0.56, 0.46, 0.04), x, sy + 0.9, sz), WOOD, WOOD2));
    solid(paint(place(new BoxGeometry(0.48, 0.38, 0.02), x, sy + 0.9, sz + 0.02), 0xf4e8c8));
    const fz = sz + 0.04, fy = sy + 0.88;
    if (j === 0) {                                                 // a baby dragon
      solid(paint(place(new SphereGeometry(0.1, 12, 8), x, fy, fz, 0, 0, 0, 1, 1, 0.35), 0x4ab04a, 0x7ad070));
      solid(paint(place(new SphereGeometry(0.075, 10, 8), x, fy + 0.12, fz + 0.005, 0, 0, 0, 1, 1, 0.35), 0x5ac05a));
      for (const s of [-1, 1]) solid(paint(place(new SphereGeometry(0.06, 8, 6), x + s * 0.12, fy + 0.05, fz - 0.005, 0, 0, -s * 0.6, 1, 0.45, 0.25), 0xa070e0));
      for (const s of [-1, 1]) solid(paint(place(new SphereGeometry(0.016, 6, 4), x + s * 0.03, fy + 0.13, fz + 0.03), 0x141018));
    } else if (j === 1) {                                          // an owl chick
      solid(paint(place(new SphereGeometry(0.12, 12, 8), x, fy, fz, 0, 0, 0, 1, 1, 0.35), 0xc8c0b8, 0xe8e2dc));
      for (const s of [-1, 1]) { solid(paint(place(new SphereGeometry(0.03, 8, 6), x + s * 0.045, fy + 0.04, fz + 0.04), 0x141018)); solid(paint(place(new ConeGeometry(0.02, 0.05, 5), x + s * 0.06, fy + 0.13, fz, 0, 0, -s * 0.35), 0xb0a89e)); }
      solid(paint(place(new ConeGeometry(0.015, 0.035, 5), x, fy + 0.0, fz + 0.05, Math.PI), 0xff9a20));
    } else {                                                       // a turtle
      solid(ribs(place(new SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), x, fy - 0.04, fz, Math.PI / 2, 0, 0, 1.2, 0.35, 0.85), 0x3a8a3a, 0x6ac060, 6));
      solid(paint(place(new SphereGeometry(0.05, 8, 6), x + 0.17, fy - 0.03, fz + 0.01, 0, 0, 0, 1, 0.9, 0.4), 0x8ad070));
      for (const s of [-1, 1]) solid(paint(place(new SphereGeometry(0.03, 6, 5), x + s * 0.1, fy - 0.08, fz, 0, 0, 0, 1, 0.7, 0.35), 0x8ad070));
      solid(paint(place(new SphereGeometry(0.012, 5, 4), x + 0.18, fy - 0.015, fz + 0.03), 0x141018));
    }
  });

  // ---- movers ----
  const pet = { glowHex: 0x7a3a5a };   // the runner's 'touch me' pulse, soft (white fur / feathers / shells must not wash out)
  kit.inst('puff', puffGeo(), 3, [0xffb4d4, 0xfff0c4, 0xd0b8ff], pet);
  const dog = kit.mesh('dog', dogGeo(), { glow: false }); dog.mesh.rotation.order = 'YXZ';
  kit.mesh('tail', tailGeo(), { glow: false });
  kit.mesh('owl', owl2Geo(), pet);
  const owlWings = kit.inst('owlWing', owlWingGeo(), 2, [0xffffff, 0xffffff], { glow: false });
  const star = kit.mesh('star', starGeo(0.13), { glow: false, glowHex: 0xffc030 }); star.mat.emissiveIntensity = 0.9;
  kit.inst('mole', moleGeo(), 3, [0xffffff, 0xffffff, 0xffffff], pet);
  kit.inst('coin', coinGeo(), 3, [0xffffff, 0xffffff, 0xffffff], { glow: false, emissive: 0xffc030, emissiveIntensity: 0.25 });
  kit.mesh('foal', foalGeo(), pet);
  const fWings = kit.inst('fWing', foalWingGeo(), 2, [0xffffff, 0xffffff], { glow: false });
  kit.mesh('duck', duckGeo(), { glow: false });
  const EGG_C = [0xd8f4c8, 0xfff0d0, 0xc8e4ff], WARM = new Color(0xffb070);
  const eggs = kit.inst('egg', eggGeo(), 3, EGG_C, pet);
  const shells = kit.inst('shell', shellGeo(), 6, [...EGG_C, ...EGG_C], { glow: false });
  kit.mesh('bdragon', bdragonGeo(), { glow: false }); kit.mesh('owlet', owletGeo(), { glow: false }); kit.mesh('turtle', turtleGeo(), { glow: false });
  kit.mesh('drag', dragonGeo(false), pet); kit.mesh('dragHappy', dragonGeo(true), { glow: false });
  kit.mesh('ring', heartRingGeo(), { glow: false, glowHex: 0xffffff }).mat.emissiveIntensity = 0.35;
  const NE = 20, eyes = kit.inst('eye', eyeGeo(), NE, new Array(NE).fill(0xffffff), { glow: false });
  const NH = 18, hearts = kit.inst('heart', heartGeo(), NH, new Array(NH).fill(0xffffff), { glow: false, emissive: 0xff4a8a, emissiveIntensity: 0.55 });
  hearts.renderOrder = 4;
  // the soft light: ONE additive instanced quad set with a soft canvas (an egg's warmth; at night a pool, halos, fireflies)
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g2 = cv.getContext('2d'), gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.6)'); gr.addColorStop(0.6, 'rgba(255,255,255,.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64);
  const soft = kit.tex(new CanvasTexture(cv)); soft.colorSpace = SRGBColorSpace;
  const NQ = 10, glow = kit.inst('glow', new PlaneGeometry(1, 1), NQ, new Array(NQ).fill(0), { basic: true, additive: true, map: soft, glow: false });
  glow.renderOrder = 3;

  // ---- places and state ----
  const m1 = new Matrix4(), m2 = new Matrix4(), m3 = new Matrix4(), v1 = new Vector3(), v2 = new Vector3(), q1 = new Quaternion(), q0 = new Quaternion(), e1 = new Euler(), s1 = new Vector3(), c1 = new Color(), sv = new Vector3();
  const PU = CR.puffs.map(([x, z]) => [x, G(x, z) + BALE_TOP, z]);
  const [DX, DZ, DYAW] = CR.dog, DY = G(DX, DZ) + 0.03;
  const [OX, OZ, OH] = CR.post, OY = G(OX, OZ) + OH + 0.02, OYAW = camYaw(OX, OZ, CR.cams.owl);
  const MO = CR.moles.map(([x, z]) => { const y = G(x, z), yaw = camYaw(x, z, CR.cams.mole), cx = x + Math.sin(yaw) * 0.55, cz = z + Math.cos(yaw) * 0.55; return { x, z, y, yaw, cx, cz, cy: G(cx, cz) }; });
  const [FX, FZ] = CR.foal, FY = G(FX, FZ), FYAW = camYaw(FX, FZ, CR.cams.foal);
  const DUCK0 = [CR.stream[0] - 0.95, CR.foal[1] + 0.25], DUCK1 = [FX + 0.55, FZ + 0.85];
  const NS = CR.nests.map(([x, z]) => [x, G(x, z) + NEST_Y, z, camYaw(x, z, CR.cams.egg)]);
  const [RX, RZ] = CR.drag, RY = G(RX, RZ), RYAW = camYaw(RX, RZ, CR.cams.drag), [CX, CZ] = CR.curl, CY = G(CX, CZ);
  const CEN = [[-2.0, 4.6], [-6.6, 4.1], [-9.2, 7.0], [-11.8, 10.6], [-5.3, 12.6], [-1.8, 3.8]].map(([x, z]) => [x, G(x, z), z]);
  const EYE = [];                                  // shared eye slots: { mv (a mover), x, y, z (in its parent's frame), s, open }
  const eyesFor = (mv, x, y, z, gap, s) => { const k = EYE.length; for (const sd of [-1, 1]) EYE.push({ mv, x: x + sd * gap, y, z, s, open: 0 }); return k; };
  let LI = null, lastStep = -9, stepT = 0, eyesBuilt = false;
  let starGiven = false, dogT = -1, dogSfx = 0, owlT = 0, owlSfx = 0, coinT = 0, coinSfx = 0, foalT = 0, foalSfx = 0, babyT = 0, babySfx = 0, dragT = 0, dragSfx = 0;
  const pdone = new Float32Array(3), mdone = new Float32Array(3), hatchT = new Float32Array(3);
  const lastP = new Map();
  const ease = (k) => k * k * (3 - 2 * k);
  const clamp01 = (k) => Math.max(0, Math.min(1, k));
  const shows = (mv) => mv.s > 0.001;
  function vis(M, names, on) { let v = false; if (on) for (const n of names) if (M[n] && shows(M[n])) { v = true; break; } M[names[0]].mesh.visible = v; }
  // hearts: a tiny particle set (camera-facing), no allocation
  const HP = []; for (let i = 0; i < NH; i++) HP.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 1, ph: i * 1.3 });
  let hi = 0, nh = 0;
  function heart(x, y, z, big = false) {
    const p = HP[hi]; hi = (hi + 1) % NH;
    p.life = big ? 1.5 : 1.25; p.x = x + (Math.random() - 0.5) * 0.15; p.y = y; p.z = z + (Math.random() - 0.5) * 0.15;
    const a = Math.random() * 6.3, sp = big ? 0.55 : 0.12; p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp; p.vy = big ? 0.75 + Math.random() * 0.4 : 0.45 + Math.random() * 0.2; p.s = big ? 1.7 : 1;
  }
  function hearts1(x, y, z, n, big) { for (let i = 0; i < n; i++) heart(x, y, z, big); }
  let gq = 0;
  function quad(x, y, z, sx, sy, r, g, b, flat = 0) {
    if (gq >= NQ) return;
    if (flat === 1) q1.setFromEuler(e1.set(-Math.PI / 2, 0, 0)); else q1.copy(ctx.camera.quaternion);
    m1.compose(v1.set(x, y, z), q1, s1.set(sx, sy, 1)); glow.setMatrixAt(gq, m1); glow.setColorAt(gq, c1.setRGB(r, g, b)); gq++;
  }
  // a child's pose in its parent's frame: parent matrix (a mesh, or an instance) x local T R S
  function parentM(mv, out) { const mh = mv.mesh; if (mh.isInstancedMesh) mh.getMatrixAt(+mv.name.replace(/\D/g, ''), out); else { mh.updateMatrix(); out.copy(mh.matrix); } return out; }
  function attach(im, i, par, lx, ly, lz, rx, ry, rz, sx, sy, sz) {
    parentM(par, m2); m3.compose(v2.set(lx, ly, lz), q1.setFromEuler(e1.set(rx, ry, rz)), sv.set(sx, sy, sz));
    m2.multiply(m3); if (im.isInstancedMesh) { im.setMatrixAt(i, m2); im.instanceMatrix.needsUpdate = true; } else { m2.decompose(im.position, im.quaternion, im.scale); }
  }
  const wpt = (sp) => v2.set(sp, 0.04, 0).applyMatrix4(m1);   // a point on the foal's bridge wing (m1 = its matrix)
  const eY = new Euler(0, 0, 0, 'YXZ'), eX = new Euler();
  const yxz = (rx, ry, rz) => { eY.set(rx, ry, rz); q1.setFromEuler(eY); return eX.setFromQuaternion(q1, 'XYZ'); };   // stand up, then turn about the vertical
  const hide = (im, i) => { m1.compose(v1.set(0, -50, 0), q0, s1.set(0, 0, 0)); im.setMatrixAt(i, m1); im.instanceMatrix.needsUpdate = true; };
  const purr = () => { for (let i = 0; i < 8; i++) fun.sfx.tone(72 + (i % 2) * 8, 0.12, 'triangle', 0.05, i * 0.11, 64); };
  const woof = () => { fun.sfx.tone(300, 0.13, 'triangle', 0.16, 0, 210); fun.sfx.tone(280, 0.15, 'triangle', 0.14, 0.2, 190); };
  const peep = () => fun.sfx.tone(1700, 0.08, 'sine', 0.08, 0, 2300);
  const hx = () => ctx.player.pos.x - ctx.worldOff.x, hz = () => ctx.player.pos.z - ctx.worldOff.z, hy = () => ctx.player.pos.y - ctx.worldOff.y;
  function owlWing(M, j, up, flap) {               // j 0 = the wing over the star (its left, local +x), 1 = the right
    const sd = j ? -1 : 1, a = up + flap;
    attach(owlWings, j, M.owl, sd * 0.19, 0.33, -0.01, 0, 0, sd * a, 1, 1, 1);
  }
  function foalWing(M, j, k) {                     // k 0 folded along the body, 1 stretched out sideways as a bridge
    const sd = j ? -1 : 1, e = ease(k);
    attach(fWings, j, M.foal, sd * 0.24, 0.76, 0.06, 0, sd * (1 - e) * 1.5, -sd * (-0.35 * (1 - e) + 0.42 * e), sd * (0.42 + 0.58 * e), 1, 0.75 + 0.25 * e);
  }
  return {
    reset(M) {
      starGiven = false; dogT = -1; dogSfx = 0; owlT = 0; owlSfx = 0; coinT = 0; coinSfx = 0; foalT = 0; foalSfx = 0; babyT = 0; babySfx = 0; dragT = 0; dragSfx = 0;
      mdone.fill(0); hatchT.fill(0); lastStep = -9; stepT = 0; lastP.clear();
      for (const p of HP) p.life = 0;
      M.star.pose(0, -50, 0, 0, 0, 0, 1);
      for (let i = 0; i < 3; i++) M['coin' + i].pose(0, -50, 0, 0, 0, 0, 0);
      for (let i = 0; i < 6; i++) M['shell' + i].pose(0, -50, 0, 0, 0, 0, 0);
      for (const n of ['bdragon', 'owlet', 'turtle', 'ring', 'dragHappy']) M[n].pose(0, 0, 0, 0, 0, 0, 0);
      M.duck.pose(DUCK0[0], G(DUCK0[0], DUCK0[1]), DUCK0[1], 0, Math.PI / 2, 0, 1);
      M.dog.pose(DX, DY, DZ, 0, DYAW, 0, 1);
      for (let i = 0; i < NQ; i++) { m1.compose(v1.set(0, -50, 0), q0, s1.set(0, 0, 0)); glow.setMatrixAt(i, m1); glow.setColorAt(i, c1.setRGB(0, 0, 0)); }
      if (!eyesBuilt) {
        eyesBuilt = true;
        eyesFor(M.dog, 0, 0.58, 0.845, 0.1, 1.15);                                     // 0-1
        for (let i = 0; i < 3; i++) eyesFor(M['puff' + i], 0, 0.25, 0.18, 0.068, 0.95); // 2-7
        eyesFor(M.owl, 0, 0.31, 0.19, 0.068, 1.05);                                   // 8-9
        for (let i = 0; i < 3; i++) eyesFor(M['mole' + i], 0, 0.285, 0.13, 0.06, 0.75); // 10-15
        eyesFor(M.foal, 0, 1.06, 0.575, 0.075, 0.9);                                    // 16-17
        eyesFor(M.drag, 0, 0.53, 0.2, 0.066, 0.95); EYE[18].alt = EYE[19].alt = M.dragHappy;   // 18-19 (also while the happy mesh is the one drawn)
      }
    },
    tick(M, t, st, K, dt = 0.016) {
      if (!K) return;
      if (!LI) { LI = {}; for (const L of [...K.lesson, ...K.stations.flat()]) LI[L.mv.name] = L; }
      const les = st.phase === 'lesson', step = st.phase === 'course' ? st.step : st.phase === 'reward' ? 4 : -1;
      if (step !== lastStep) { lastStep = step; stepT = 0; } else stepT += dt;
      gq = 0;
      if (!les && dogT < 0) dogT = 99;             // a replay (🔁) starts at station 1: the dog has long woken up
      if (dogT >= 0 && dogT < 99) dogT += dt;
      // ---- hearts while a creature is stroked (its progress rises), a big puff when it is happy ----
      if (st.sub === 'cast' && st.lifts) for (const L of st.lifts) {
        const lp = lastP.get(L) ?? 0;
        if (!L.done && L.p > lp + 0.002) { L._hAcc = (L._hAcc || 0) + dt; if (L._hAcc > 0.2) { L._hAcc = 0; const a = L.arr; heart(a[0], a[1] + L.aimY + 0.15, a[2]); } }
        lastP.set(L, L.p);
      }
      for (let s = -1; s < K.stations.length; s++) { const set = s < 0 ? K.lesson : K.stations[s]; for (const L of set) { if (L.done && !L._big) { L._big = true; const a = L.arr; hearts1(a[0], a[1] + L.aimY + 0.2, a[2], 7, true); } else if (!L.done) L._big = false; } }
      // ---- the dog: asleep; Hagrid's demo (the ghost hand strokes him, he wakes, wags, rolls onto his back); then awake ----
      { let open = 0.1, roll = 0, wag = 0.12, lift = 0;
        const d = dogT;
        if (d >= 0) {
          open = d >= 99 ? 1 : 0.1 + 0.9 * clamp01((d - 0.6) / 1.4);
          if (d < 2.6) { kit.hand(DX + 0.1 + Math.sin(d * 5) * 0.25, DY + 0.75, DZ - 0.1 + Math.cos(d * 5) * 0.08); if ((d % 0.3) < dt && d > 0.3) heart(DX + 0.2, DY + 0.75, DZ + 0.1); }
          else kit.hand(null);
          wag = d >= 99 ? 0.35 : d > 2.0 ? 1 : 0.12 + 0.4 * clamp01(d / 2);
          if (d > 3.0 && d < 99) { const r = d < 3.6 ? ease((d - 3.0) / 0.6) : d < 5.2 ? 1 : 1 - ease(clamp01((d - 5.2) / 0.6)); roll = 2.5 * r; if (d > 3.6 && d < 5.2 && (d % 0.45) < dt) heart(DX, DY + 0.8, DZ); }
          lift = d < 3 ? 0.12 * open : 0;
          if (d > 0.5 && dogSfx < 1) { dogSfx = 1; fun.sfx.heart(); }
          if (d > 2.9 && dogSfx < 2 && d < 99) { dogSfx = 2; woof(); }
          if (d > 3.7 && dogSfx < 3 && d < 99) { dogSfx = 3; fun.sfx.giggle(); }
        }
        const br = 1 + Math.sin(t * (open > 0.5 ? 2.4 : 1.4)) * 0.025, sr = Math.sin(roll), cr = Math.cos(roll), cs = Math.cos(DYAW), sn = Math.sin(DYAW);
        const ox = 0.3 * sr, oy = 0.3 * (1 - cr);   // roll about the body's long axis (z) through its middle (0.3 up)
        M.dog.poseS(DX + ox * cs, DY + oy, DZ - ox * sn, -lift, DYAW, roll, 1, br, 1);
        attach(M.tail.mesh, 0, M.dog, 0, 0.32, -0.6, -1.1 + 0.25 * open, 0, Math.sin(t * (6 + 8 * wag)) * 0.7 * wag, 1, 1, 1);
        M.tail.s = 1;
        EYE[0].open = EYE[1].open = open > 0.9 && (t % 4.1) < 0.12 ? 0.15 : open; }
      // ---- the lesson's puffballs: sleepy, wake with the stroking; happy = a bouncy purr, then a gentle hop now and then ----
      for (let i = 0; i < 3; i++) {
        const L = LI['puff' + i]; if (!L) continue;
        if (L.done) {
          if (pdone[i] === 0) purr();
          pdone[i] += dt; const k = pdone[i], a = PU[i];
          const hop = k < 2.2 ? Math.abs(Math.sin(k * 6.5)) * 0.16 * (1 - k / 2.2) : Math.max(0, Math.sin((t + i) * 2.4)) ** 6 * 0.08, sq = k < 2.2 ? Math.sin(k * 13) * 0.08 * (1 - k / 2.2) : 0;
          M['puff' + i].poseS(a[0], a[1] + hop, a[2], 0, L.rot0[1] + Math.sin(t * 1.3 + i) * 0.2, Math.sin(t * 2 + i) * 0.06, 1 + sq, 1 - sq, 1 + sq);
        }
        const o = L.done ? ((t + i * 1.3) % 3.7 < 0.12 ? 0.15 : 1) : 0.12 + 0.88 * L.p;
        EYE[2 + i * 2].open = EYE[3 + i * 2].open = o;
      }
      // ---- 1 the owl: asleep on its post, the star tucked under its wing; stroked, it wakes and lifts the wing; happy, it hoots,
      //        flies the star down to the hero and comes back to its perch ----
      { const L = LI.owl, p = L ? (L.done ? 1 : L.p) : 0;
        let up = 0.05 + 0.5 * p, flap = 0, sX = 0.18, sY = 0.15, sZ = 0.07, starOn = true, sfree = false;
        if (owlT > 0) {
          const o = owlT, P0x = OX, P0y = OY, P0z = OZ, Tx = hx() + 0.35, Ty = hy() + 2.1, Tz = hz() - 0.2;
          let x = P0x, y = P0y, z = P0z;
          if (o < 0.5) flap = Math.sin(o * 30) * 0.4;
          else if (o < 2.1) { const u = ease((o - 0.5) / 1.6); x = P0x + (Tx - P0x) * u; z = P0z + (Tz - P0z) * u; y = P0y + (Ty - P0y) * u + Math.sin(u * Math.PI) * 0.7; flap = Math.sin(o * 26) * 0.9; up = 1.0; }
          else if (o < 2.7) { x = Tx; y = Ty + Math.sin(o * 4) * 0.05; z = Tz; flap = Math.sin(o * 26) * 0.9; up = 1.0; }
          else if (o < 4.3) { const u = ease((o - 2.7) / 1.6); x = Tx + (P0x - Tx) * u; z = Tz + (P0z - Tz) * u; y = Ty + (P0y - Ty) * u + Math.sin(u * Math.PI) * 0.6; flap = Math.sin(o * 26) * 0.9; up = 1.0; }
          else { const u = clamp01((o - 4.3) / 0.5); up = 1 - 0.95 * u; flap = Math.sin(o * 20) * 0.3 * (1 - u); }
          const yaw = o > 0.5 && o < 4.3 ? Math.atan2((o < 2.7 ? Tx - P0x : P0x - Tx), (o < 2.7 ? Tz - P0z : P0z - Tz)) : OYAW + (o > 4.3 ? Math.sin(t * 1.5) * 0.15 : 0);
          M.owl.pose(x, y, z, 0, yaw, 0, 1);
          if (o > 0.5) {                           // the star rides below the owl, then drops into the hero's hands
            sfree = true;
            if (o < 2.2) M.star.pose(x, y - 0.12, z, 0, t * 3, 0, 1);
            else if (o < 2.9) { const u = ease((o - 2.2) / 0.7), ex = hx(), ey = hy() + 1.15, ez = hz(); M.star.pose(Tx + (ex - Tx) * u, Ty - 0.12 + (ey - Ty + 0.12) * u, Tz + (ez - Tz) * u, 0, t * 4, 0, 1 - clamp01((o - 2.75) / 0.15)); }
            else { M.star.pose(0, -50, 0, 0, 0, 0, 0); starGiven = true; }   // given to the hero: it never comes back under the wing
          }
        } else if (L && L.done) M.owl.pose(OX, OY, OZ, 0, OYAW, 0, 1);
        owlWing(M, 0, up, flap); owlWing(M, 1, owlT > 0.5 && owlT < 4.6 ? up : 0.05 + 0.1 * p, flap);
        if (!sfree && starOn && !starGiven) { attach(M.star.mesh, 0, M.owl, sX, sY + 0.06 * p, sZ, 0, t * 0.6, 0.3, 1, 1, 1); M.star.s = 1; }
        else if (!sfree && starGiven) M.star.pose(0, -50, 0, 0, 0, 0, 0);
        const o = L && L.done ? 1 : 0.1 + 0.9 * p;
        EYE[8].open = EYE[9].open = o; }
      // ---- 2 the burrowers: peek from their holes, rise as they are stroked; happy, each pops out, hops forward and lays a
      //        gold coin on the grass; all three out: the coins rise and spin together, then fly to the hero ----
      for (let i = 0; i < 3; i++) {
        const L = LI['mole' + i]; if (!L) continue;
        const m = MO[i], mv = M['mole' + i];
        if (!L.done) { const a = L.arr, rise = 0.1 * L.p; const lp = mv.mesh; mv.mesh.getMatrixAt(i, m1); m1.decompose(v1, q1, s1); v1.y = a[1] + rise + Math.sin(t * 3 + i) * 0.012; m1.compose(v1, q1, s1); lp.setMatrixAt(i, m1); lp.instanceMatrix.needsUpdate = true; }
        else {
          mdone[i] += dt; const k = mdone[i];
          let x = m.x, z = m.z, y = m.y + MOLE_PEEK + 0.1;
          if (k < 0.45) { const u = ease(k / 0.45); y = m.y + MOLE_PEEK + 0.1 + (MOUND_TOP + 0.02 - MOLE_PEEK - 0.1) * u + Math.sin(u * Math.PI) * 0.25; }
          else if (k < 0.95) { const u = ease((k - 0.45) / 0.5); x = m.x + Math.sin(m.yaw) * 0.3 * u; z = m.z + Math.cos(m.yaw) * 0.3 * u; y = m.y + MOUND_TOP + 0.02 + (G(x, z) - m.y - MOUND_TOP) * u + Math.sin(u * Math.PI) * 0.18; }
          else { x = m.x + Math.sin(m.yaw) * 0.3; z = m.z + Math.cos(m.yaw) * 0.3; y = G(x, z) + (coinT > 0 && coinT < 2.8 ? Math.abs(Math.sin(coinT * 7 + i)) * 0.1 : Math.max(0, Math.sin(t * 2.6 + i)) ** 6 * 0.06); }
          mv.pose(x, y, z, 0, m.yaw + (k > 0.95 ? Math.sin(t * 1.7 + i) * 0.2 : 0), 0, 1);
          // the coin: from its paws onto the grass, then (all three out) the spin together and the flight to the hero
          const c = M['coin' + i];
          if (k < 0.85) c.pose(0, -50, 0, 0, 0, 0, 0);
          else if (coinT <= 0) { const u = clamp01((k - 0.85) / 0.35); c.pose(m.cx, m.cy + 0.18 * (1 - u) + 0.005, m.cz, 0, i, 0, ease(u)); }
          else if (coinT < 2.0) { const u = ease(clamp01(coinT / 0.5)), E = yxz(Math.PI / 2 * u, coinT * 12 * u, 0); c.pose(m.cx, m.cy + 0.005 + 0.5 * u, m.cz, E.x, E.y, E.z, 1 + 0.3 * u); }
          else { const u = ease(clamp01((coinT - 2.0) / 0.8)), ex = hx(), ey = hy() + 1.1, ez = hz(); const E = yxz(Math.PI / 2, coinT * 12, 0); c.pose(m.cx + (ex - m.cx) * u, m.cy + 0.505 + (ey - m.cy - 0.505) * u + Math.sin(u * Math.PI) * 0.4, m.cz + (ez - m.cz) * u, E.x, E.y, E.z, 1.3 * (1 - clamp01((coinT - 2.6) / 0.2))); }
        }
        const o = L.done ? 1 : (0.45 + 0.15 * Math.sin(t * 2 + i)) + 0.55 * L.p;
        EYE[10 + i * 2].open = EYE[11 + i * 2].open = (t + i) % 2.9 < 0.1 ? 0.15 : Math.min(1, o);
      }
      // ---- 3 the foal: proud by the stream bed; happy, it bows and stretches out a wing across the stream; a duckling walks over ----
      { const L = LI.foal, p = L ? (L.done ? 1 : L.p) : 0;
        let wk = 0;
        if (foalT > 0) {
          const f = foalT, bow = f < 0.8 ? ease(f / 0.8) : f < 4.4 ? 1 : 1 - ease(clamp01((f - 4.4) / 0.6));
          wk = f < 0.4 ? 0 : f < 1.4 ? (f - 0.4) : f < 4.4 ? 1 : 1 - clamp01((f - 4.4) / 0.6);
          M.foal.pose(FX, FY - 0.22 * bow, FZ, 0.28 * bow - (f > 5.0 ? 0.08 * Math.sin((f - 5.0) * 8) : 0), FYAW, 0, 1);
          // the duckling: waits on the far bank, steps onto the wing tip, waddles over it and hops down by the foal, then by the hero
          const d = f - 1.5;
          if (d > 0 && d < 99) {
            fWings.getMatrixAt(1, m1);                                        // points on the bridge wing: its own frame (span 0.3..1.15)
            let x, y, z, yaw = Math.PI / 2;
            if (d < 0.5) { const u = d / 0.5; wpt(1.15); x = DUCK0[0] + (v2.x - DUCK0[0]) * u; z = DUCK0[1] + (v2.z - DUCK0[1]) * u; y = G(DUCK0[0], DUCK0[1]) + (v2.y - G(DUCK0[0], DUCK0[1])) * u + Math.sin(u * Math.PI) * 0.12; }
            else if (d < 2.2) { wpt(1.15 - 0.85 * ((d - 0.5) / 1.7)); x = v2.x; y = v2.y; z = v2.z; }
            else if (d < 2.7) { const u = ease((d - 2.2) / 0.5); wpt(0.3); yaw = Math.atan2(DUCK1[0] - v2.x, DUCK1[1] - v2.z); x = v2.x + (DUCK1[0] - v2.x) * u; z = v2.z + (DUCK1[1] - v2.z) * u; y = v2.y + (G(DUCK1[0], DUCK1[1]) - v2.y) * u + Math.sin(u * Math.PI) * 0.15; }
            else { x = DUCK1[0]; z = DUCK1[1]; y = G(x, z); yaw = Math.atan2(hx() - x, hz() - z); }
            M.duck.pose(x, y + Math.abs(Math.sin(t * 12)) * 0.015, z, 0, yaw + Math.sin(t * 12) * 0.12, 0, 1.6);
            if (d < 2.7 && (d % 0.55) < dt) peep();
          }
        } else if (L && L.done) M.foal.pose(FX, FY, FZ, 0, FYAW, 0, 1);
        if (foalT <= 1.5) M.duck.pose(DUCK0[0], G(DUCK0[0], DUCK0[1]) + Math.abs(Math.sin(t * 2)) * 0.01, DUCK0[1], 0, Math.PI / 2 + Math.sin(t * 0.9) * 0.4, 0, 1.6);
        foalWing(M, 0, 0); foalWing(M, 1, wk);
        EYE[16].open = EYE[17].open = (t % 3.3) < 0.1 ? 0.15 : L && L.done ? 1 : 0.6 + 0.4 * p; }
      // ---- 4 the eggs: warm up (colour, a soft glow), wobble and hatch into the animal on the sign; the shells break open ----
      for (let j = 0; j < 3; j++) {
        const L = LI['egg' + j]; if (!L) continue;
        const N = NS[j];
        if (!L.done) { c1.setHex(EGG_C[j]).lerp(WARM, L.p * 0.85); eggs.setColorAt(j, c1); eggs.instanceColor.needsUpdate = true;
          if (L.p > 0.02) quad(N[0], N[1] + 0.22, N[2], 0.5 + 0.5 * L.p, 0.5 + 0.5 * L.p, 0.6 * L.p, 0.35 * L.p, 0.12 * L.p); continue; }
        hatchT[j] += dt; const k = hatchT[j];
        M['shell' + j].pose(N[0], N[1] - 0.06, N[2], 0, N[3], 0, 1);
        { const u = clamp01(k / 0.6), x = N[0] + Math.sin(N[3] + 1.6) * 0.32 * u, z = N[2] + Math.cos(N[3] + 1.6) * 0.32 * u, y = N[1] + 0.08 + Math.sin(u * Math.PI) * 0.35 + (G(x, z) + 0.12 - N[1] - 0.08) * u;
          M['shell' + (3 + j)].pose(x, y, z, Math.PI + 0.6 * u, N[3], 0.5 * u, 1); }
        if (L.popT >= POP) {                       // the baby is the course's now: it sits in its half shell and sways (a bounce together)
          const b = M[L.spec.to], kb = babyT - j * 0.22, hop = kb > 0 && kb < 2.0 ? Math.abs(Math.sin(kb * 5.2)) * 0.13 * (1 - kb / 2.0) : 0, sq = kb > 0 && kb < 2.0 ? Math.sin(kb * 10.4) * 0.07 * (1 - kb / 2.0) : 0;
          b.poseS(N[0], N[1] + hop, N[2], 0, N[3] + Math.sin(t * 1.4 + j) * 0.25, Math.sin(t * 2 + j) * 0.05, 1 + sq, 1 - sq, 1 + sq);
        }
      }
      // ---- 5 the baby dragon: grumpy until stroked (a smile at half way); happy, it puffs a heart-shaped smoke ring, hops to
      //        Hagrid's feet and curls up there ----
      { const L = LI.drag, p = L ? (L.done ? 1 : L.p) : 0, happy = p > 0.55;
        let open = 0.55 + 0.45 * p;
        if (dragT > 0) {
          const d = dragT;
          let x = RX, z = RZ, y = RY, yaw = RYAW, sx = 1, sy = 1;
          if (d > 2.4 && d < 3.5) { const u = (d - 2.4) / 1.1, e = ease(u); x = RX + (CX - RX) * e; z = RZ + (CZ - RZ) * e; y = G(x, z) + Math.abs(Math.sin(u * Math.PI * 3)) * 0.22; yaw = Math.atan2(CX - RX, CZ - RZ); if ((d % 0.367) < dt) fun.sfx.tone(420, 0.1, 'sine', 0.1, 0, 640); }
          else if (d >= 3.5) { const u = ease(clamp01((d - 3.5) / 0.6)); x = CX; z = CZ; y = CY; yaw = Math.atan2(CX - RX, CZ - RZ) + (RYAW + 0.9 - Math.atan2(CX - RX, CZ - RZ)) * u; sx = 1 + 0.15 * u; sy = 1 - 0.28 * u + Math.sin(t * 2) * 0.02 * u; open = 1 - 0.88 * u; if (u >= 1 && (d % 1.3) < dt) heart(CX, CY + 0.45, CZ); }
          else open = 1;
          M.drag.poseS(x, y, z, 0, yaw, d >= 3.5 ? 0.12 * clamp01((d - 3.5) / 0.6) : 0, sx, sy, sx);
          // the smoke ring: out of the snout, up and wider, then gone
          if (d > 0.3 && d < 2.6) { const u = (d - 0.3) / 2.3, s = 0.35 + 1.1 * ease(clamp01(u * 1.4)); M.ring.pose(RX + Math.sin(RYAW) * 0.25, RY + 0.5 + 1.5 * ease(u), RZ + Math.cos(RYAW) * 0.25, 0, RYAW + Math.sin(d * 2) * 0.2, Math.sin(d * 3) * 0.08, s * (1 - clamp01((u - 0.85) / 0.15))); }
          else M.ring.pose(0, 0, 0, 0, 0, 0, 0);
        } else M.ring.pose(0, 0, 0, 0, 0, 0, 0);
        const dm = M.drag.mesh, hm = M.dragHappy.mesh;
        hm.position.copy(dm.position); hm.quaternion.copy(dm.quaternion); hm.scale.copy(dm.scale); M.dragHappy.s = happy ? M.drag.s : 0;
        EYE[18].open = EYE[19].open = open; }
      // ---- hearts, eyes ----
      { const q = ctx.camera.quaternion;
        nh = 0;
        for (let i = 0; i < NH; i++) {
          const h = HP[i];
          if (h.life <= 0) { hide(hearts, i); continue; }
          nh++;
          h.life -= dt; h.x += h.vx * dt; h.y += h.vy * dt; h.z += h.vz * dt; h.vx *= 0.97; h.vz *= 0.97;
          const s = h.s * Math.min(1, h.life * 2.2) * Math.min(1, (1.6 - h.life) * 6) * (1 + 0.08 * Math.sin(t * 9 + h.ph));
          q1.copy(q); m1.compose(v1.set(h.x + Math.sin(t * 3 + h.ph) * 0.04, h.y, h.z), q1, s1.set(s, s, s)); hearts.setMatrixAt(i, m1);
        }
        hearts.instanceMatrix.needsUpdate = true;
        for (let i = 0; i < NE; i++) {
          const E = EYE[i];
          if (!E || !(E.mv.mesh.visible || (E.alt && E.alt.mesh.visible)) || E.mv.s < 0.05) { hide(eyes, i); continue; }
          attach(eyes, i, E.mv, E.x, E.y, E.z, 0, 0, 0, E.s, E.s * Math.max(0.12, Math.min(1, E.open)), E.s);
        } }
      // ---- night: a soft pool of light at the station, a halo round the open creature, fireflies ----
      if (NK > 0) {
        const C = CEN[les ? 0 : Math.min(5, step + 1)];
        quad(C[0], C[1] + 0.08, C[2], 6, 6, 0.3 * NK, 0.27 * NK, 0.15 * NK, 1);
        if (st.sub === 'cast' && st.lifts) for (const L of st.lifts) { if (L.done || L.spec.to) continue; const a = L.arr, pu = 0.8 + 0.2 * Math.sin(t * 5);
          quad(a[0], a[1] + L.aimY, a[2], 0.9, 0.9, 0.6 * NK * pu, 0.4 * NK * pu, 0.5 * NK * pu); }
        for (let i = 0; i < 6; i++) {
          const a = t * 0.35 * (1 + i * 0.13) + i * 0.9, r = 1.4 + (i % 3) * 0.5, fl = 0.6 + 0.4 * Math.sin(t * 7 + i * 2.3);
          quad(C[0] + Math.cos(a) * r, C[1] + 0.6 + 0.9 * (0.5 + 0.5 * Math.sin(t * 0.9 + i * 1.7)), C[2] + Math.sin(a * 1.3) * r * 0.7, 0.14, 0.14, 1.3 * fl * NK, 1.6 * fl * NK, 0.5 * fl * NK);
        }
      }
      for (let i = gq; i < NQ; i++) { m1.compose(v1.set(0, -50, 0), q0, s1.set(0, 0, 0)); glow.setMatrixAt(i, m1); }
      glow.instanceMatrix.needsUpdate = true; if (glow.instanceColor) glow.instanceColor.needsUpdate = true; glow.visible = gq > 0;
      // ---- what is drawn: a thing only while it shows and its station (or the one just left, for a moment) is near ----
      const left = (s) => step === s || (step === s + 1 && stepT < 2.5);
      const atHag = les || step >= 4 || (step === 0 && stepT < 2.5);
      vis(M, ['puff0', 'puff1', 'puff2'], atHag); vis(M, ['dog'], atHag); vis(M, ['tail'], atHag);
      vis(M, ['owl'], step <= 1); vis(M, ['owlWing0', 'owlWing1'], step <= 1); vis(M, ['star'], step <= 0);
      vis(M, ['mole0', 'mole1', 'mole2'], step >= 0 && step <= 2); vis(M, ['coin0', 'coin1', 'coin2'], step >= 0 && step <= 2);
      vis(M, ['foal'], step === 2 || left(2)); vis(M, ['fWing0', 'fWing1'], step === 2 || left(2)); vis(M, ['duck'], step === 2 || left(2));
      const eg = step === 3 || left(3);
      vis(M, ['egg0', 'egg1', 'egg2'], eg); vis(M, ['shell0', 'shell1', 'shell2', 'shell3', 'shell4', 'shell5'], eg);
      vis(M, ['bdragon'], eg); vis(M, ['owlet'], eg); vis(M, ['turtle'], eg);
      M.drag.mesh.visible = step >= 4 && !(M.dragHappy.s > 0.001); M.dragHappy.mesh.visible = step >= 4 && M.dragHappy.s > 0.001;
      vis(M, ['ring'], step >= 4);
      eyes.visible = true; hearts.visible = nh > 0;
    },
    effects: {
      // Hagrid's demo: the ghost hand strokes the sleeping dog; he wakes, wags his tail and rolls onto his back (the dog's own
      // clock runs on after the effect: the next line talks over the roll)
      demo(M, t, quiet) {
        if (quiet) { dogT = 99; kit.hand(null); return false; }
        if (dogT < 0) dogT = 0;
        return t < 3.8;
      },
      // the owl hoots, flies the star down to the hero and comes back to its post (5 s)
      owlFly(M, t, quiet) {
        owlT = quiet ? 99 : t;
        if (!quiet) {
          if (owlSfx < 1) { owlSfx = 1; fun.sfx.hoot(); }
          if (owlSfx < 2 && t > 0.6) { owlSfx = 2; fun.sfx.whoosh(); }
          if (owlSfx < 3 && t > 2.85) { owlSfx = 3; kit.burst(hx(), 1.15, hz(), 14); fun.sfx.tune([784, 988, 1319], 0.1, 'sine'); }
          if (owlSfx < 4 && t > 4.4) { owlSfx = 4; fun.sfx.hoot(); }
        }
        return t < 5.0;
      },
      // the three coins rise and spin together with a chime, then fly to the hero (3.4 s)
      coinSpin(M, t, quiet) {
        coinT = quiet ? 99 : t;
        if (!quiet) {
          if (coinSfx < 1) { coinSfx = 1; fun.sfx.chime(); fun.sfx.tune([659, 784, 988, 1319], 0.1, 'triangle'); }
          if (coinSfx < 2 && t > 1.0) { coinSfx = 2; fun.sfx.chime(); }
          if (coinSfx < 3 && t > 2.75) { coinSfx = 3; kit.burst(hx(), 1.1, hz(), 14); fun.sfx.tune([1047, 1319, 1568], 0.08, 'sine'); }
        }
        return t < 3.4;
      },
      // the foal bows and stretches out a wing over the stream; a duckling walks across and peeps (5.4 s)
      foalBow(M, t, quiet) {
        foalT = quiet ? 99 : t;
        if (!quiet) {
          if (foalSfx < 1) { foalSfx = 1; fun.sfx.tune([523, 659, 784], 0.12, 'triangle'); }
          if (foalSfx < 2 && t > 0.6) { foalSfx = 2; fun.sfx.whoosh(); }
          if (foalSfx < 3 && t > 4.3) { foalSfx = 3; fun.sfx.tweet(); fun.sfx.tune([659, 784, 988], 0.1, 'triangle'); }
        }
        return t < 5.4;
      },
      // the three babies do a little bounce together (2.8 s)
      babyBounce(M, t, quiet) {
        babyT = quiet ? 99 : t;
        if (!quiet) {
          if (babySfx < 1) { babySfx = 1; fun.sfx.tune([523, 659, 784, 1047], 0.11, 'triangle'); }
          for (let j = 0; j < 3; j++) if (babySfx < 2 + j && t > 0.05 + j * 0.22) { babySfx = 2 + j; fun.sfx.boing(); kit.burst(CR.nests[j][0], 0.5, CR.nests[j][1], 6); }
        }
        return t < 2.8;
      },
      // the baby dragon puffs a heart-shaped smoke ring, hops to Hagrid's feet and curls up (6 s)
      dragonCurl(M, t, quiet) {
        dragT = quiet ? 99 : t;
        if (!quiet) {
          if (dragSfx < 1 && t > 0.3) { dragSfx = 1; fun.sfx.noise(0.5, 0.08, 0, 600, 0.7); fun.sfx.heart(); }
          if (dragSfx < 2 && t > 3.6) { dragSfx = 2; purr(); }
          if (dragSfx < 3 && t > 4.4) { dragSfx = 3; fun.sfx.tune([523, 659, 784, 1047], 0.14, 'sine'); }
        }
        return t < 6.0;
      },
    },
  };
}

// ---------------------------------------------------------------------------------------
// the runner
// ---------------------------------------------------------------------------------------
export function createSpells({ scene, camera, player, interiors, lessons, setTakeover, isModal, isTakeover, env = null, renderer = null }) {
  // hpSpells1: { <course>: { stars, plays, lv: { 2: { stars, plays }, 3: { stars, plays } } } }. stars / plays are
  // level 1 (as they always were: old saves need no migration); lv holds levels 2 and 3. Anything else is ignored.
  let save = {};
  try { save = JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { save = {}; }
  if (!isObj(save)) save = {};
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode */ } };
  const lvRec = (key, lv) => { const r = save[key]; if (!isObj(r)) return null; if (lv === 1) return r; return isObj(r.lv) && isObj(r.lv[lv]) ? r.lv[lv] : null; };
  const lvStars = (key, lv) => { const r = lvRec(key, lv); return r ? starsOf(r.stars) : 0; };
  const best = (key) => lvStars(key, 1);
  const hasLevel = (key, lv) => lv === 1 || !!(COURSES[key] && isObj(COURSES[key].levels) && isObj(COURSES[key].levels[lv]));
  // level 1 is won by finishing it (2-3 stars; 1 star is only the leave-early consolation); levels 2-3 give stars only on a finish
  const won = (key, lv) => lv === 1 ? lvStars(key, 1) >= 2 : lvStars(key, lv) >= 1;
  const unlocked = (key, lv) => lv === 1 || (hasLevel(key, lv) && won(key, lv - 1));

  // ---- DOM ----
  const css = document.createElement('style');
  css.textContent = `
  body.inSpell .pill,body.inSpell #quest,body.inSpell #mapBtn,body.inSpell #muteBtn,body.inSpell #timeBtn,body.inSpell #camctl,body.inSpell #bellBtn,body.inSpell #enterBtn,
  body.inSpell #exitBtn,body.inSpell #bubble,body.inSpell #wandBtn,body.inSpell #musicBtn,body.inSpell #funPrompt,body.inSpell #spPrompt,body.inSpell #joy,body.inSpell #joyKnob{display:none !important}
  #spPrompt{position:fixed;left:calc(50% - 128px);bottom:calc(120px + env(safe-area-inset-bottom));transform:translateX(-50%) scale(0);z-index:14;width:96px;height:96px;border-radius:50%;
    border:5px solid #fff;background:radial-gradient(circle at 40% 30%,#c9a6ff,#6a3ad0);font-size:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;
    box-shadow:0 0 26px rgba(190,140,255,.95);cursor:pointer;transition:transform .25s cubic-bezier(.3,1.7,.5,1);touch-action:manipulation;-webkit-tap-highlight-color:transparent;padding:0;line-height:1}
  #spPrompt .l{font:bold 15px 'Rubik',sans-serif;color:#fff;margin-top:2px;text-shadow:0 1px 0 #2a1060} #spPrompt.on{transform:translateX(-50%) scale(1)}
  body.modalOn #spPrompt,body.inMatch #spPrompt{display:none}
  #spOv{position:fixed;inset:0;z-index:12;display:none;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
  body.inSpell #spOv{display:block}
  #spTop{position:fixed;left:50%;top:calc(12px + env(safe-area-inset-top));transform:translateX(-50%);z-index:15;display:none;gap:8px;align-items:center;
    background:rgba(32,20,70,.82);border:3px solid #ffd76a;border-radius:30px;padding:5px 14px;direction:rtl;pointer-events:none}
  body.inSpell #spTop{display:flex}
  #spTop i{font-style:normal;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26px;background:rgba(255,255,255,.12);filter:grayscale(1) brightness(.75);transition:all .3s}
  #spTop i.on{filter:none;background:radial-gradient(circle,#ffe48a,#d8901a);box-shadow:0 0 12px #ffd76a}
  #spTop i.cur{filter:none;animation:spPip 1s ease-in-out infinite;background:rgba(255,215,106,.35)}
  @keyframes spPip{50%{transform:scale(1.18)}}
  #spX{right:calc(18px + env(safe-area-inset-right));top:calc(14px + env(safe-area-inset-top));width:64px;height:64px;font-size:28px;display:none;z-index:16}
  body.inSpell #spX{display:flex}
  #spBtn{right:calc(28px + env(safe-area-inset-right));bottom:calc(32px + env(safe-area-inset-bottom));width:124px;height:124px;font-size:62px;display:none;z-index:16;
    background:radial-gradient(circle at 50% 35%,rgba(210,170,255,.97),rgba(90,40,170,.9));touch-action:none}
  body.inSpell #spBtn.on{display:flex}
  #spBtn.hold{box-shadow:0 0 0 8px rgba(255,215,106,.6),0 0 36px #ffd76a}
  #spSay{position:fixed;left:50%;top:calc(80px + env(safe-area-inset-top));transform:translateX(-50%) scale(.7);z-index:15;opacity:0;pointer-events:none;transition:opacity .2s,transform .25s cubic-bezier(.3,1.7,.5,1);
    background:rgba(255,248,228,.97);border:4px solid #ffd76a;border-radius:22px;padding:8px 18px;color:#2a1a12;font:bold 28px 'Rubik',sans-serif;direction:rtl;white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis}
  #spSay.on{opacity:1;transform:translateX(-50%) scale(1)}
  #spHand{position:fixed;z-index:15;font-size:64px;pointer-events:none;display:none;margin:-10px 0 0 -26px;filter:drop-shadow(0 0 10px #fff)}
  #spHand.on{display:block;animation:spHand 1.5s ease-in-out infinite}
  #spHand.on.push{animation:spHandP 1.5s ease-in-out infinite}
  #spHand.on.tap{animation:spHandT 1.1s ease-in-out infinite}
  #spHand.on.stir{animation:spHandS 1.2s linear infinite}
  @keyframes spHandS{0%{transform:translate(44px,0)}25%{transform:translate(0,30px)}50%{transform:translate(-44px,0)}75%{transform:translate(0,-30px)}100%{transform:translate(44px,0)}}
  @keyframes spHandT{0%,100%{transform:translateY(18px) scale(1)}45%{transform:translateY(0) scale(.86)}60%{transform:translateY(0) scale(.86)}}
  @keyframes spHandP{0%{transform:translate(calc(var(--dx) * -40px),calc(var(--dy) * -40px));opacity:0}15%{opacity:1}70%{transform:translate(calc(var(--dx) * 130px),calc(var(--dy) * 130px));opacity:1}100%{transform:translate(calc(var(--dx) * 150px),calc(var(--dy) * 150px));opacity:0}}
  @keyframes spHand{0%{transform:translateY(40px);opacity:0}15%{opacity:1}70%{transform:translateY(-130px);opacity:1}100%{transform:translateY(-150px);opacity:0}}
  #spEnd{position:fixed;inset:0;z-index:48;display:none;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(40,24,90,.7),rgba(5,3,25,.92));font-family:'Rubik',sans-serif;direction:rtl}
  #spEnd.on{display:flex}
  #spEnd .p{background:rgba(32,20,70,.97);border:5px solid #ffd76a;border-radius:28px;padding:18px 26px 22px;text-align:center;color:#fff;width:min(90vw,520px);box-sizing:border-box}
  #spEnd .tr{font-size:110px;line-height:1.05} #spEnd .ti{font-size:44px;font-weight:bold;color:#ffd76a;text-shadow:0 3px 0 #7a3b00}
  #spEnd .sc{font-size:40px;font-weight:bold;margin:6px 0} #spEnd .st{font-size:54px;letter-spacing:6px}
  #spEnd .row{display:flex;gap:14px;justify-content:center;margin-top:14px}
  #spEnd button{min-width:150px;min-height:76px;border-radius:40px;border:4px solid #fff;font:bold 30px 'Rubik',sans-serif;cursor:pointer;touch-action:manipulation}
  #spEnd .again{background:linear-gradient(#ffe48a,#ffb020);color:#5a2b00} #spEnd .done{background:linear-gradient(#b5a0ff,#7a52d6);color:#fff}
  @media (max-height:520px){
    #spTop{padding:3px 10px;gap:5px} #spTop i{width:34px;height:34px;font-size:20px} #spSay{top:calc(58px + env(safe-area-inset-top));font-size:21px;padding:5px 14px}
    #spBtn{width:100px;height:100px;font-size:50px;bottom:calc(18px + env(safe-area-inset-bottom))} #spX{width:54px;height:54px;font-size:24px}
    #spPrompt{bottom:calc(104px + env(safe-area-inset-bottom));width:84px;height:84px;font-size:38px;left:calc(50% - 112px)}
    #spEnd .p{padding:8px 20px 10px} #spEnd .tr{font-size:56px} #spEnd .ti{font-size:30px} #spEnd .sc{font-size:26px;margin:2px 0} #spEnd .st{font-size:34px}
    #spEnd .row{margin-top:8px} #spEnd button{min-height:60px;min-width:130px;font-size:26px}
  }`;
  // levels: the chooser pips (lessons.js puts c.pips() on each course card), the level choice, the level 2-3 reward extras
  css.textContent += `
  .spCard .spLvp{display:flex;gap:5px;justify-content:center;align-items:center;height:18px;direction:rtl}
  .spLvp i{font-style:normal;width:17px;height:17px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;line-height:1;box-sizing:border-box;
    border:2px solid rgba(255,255,255,.55);color:transparent}
  .spLvp i.won{background:radial-gradient(circle at 40% 35%,#fff2a8,#f0a818);border-color:#fff3b0;color:#7a3b00;box-shadow:0 0 6px #ffd76a}
  .spLvp i.lk{border:none;font-size:12px;color:#fff;opacity:.75;filter:grayscale(.3)} .spLvp i.soon{opacity:.35}
  #spLv{position:fixed;inset:0;z-index:47;display:none;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(40,24,90,.75),rgba(5,3,25,.9));font-family:'Rubik',sans-serif;direction:rtl;touch-action:manipulation}
  #spLv.on{display:flex}
  #spLv .p{background:rgba(32,20,70,.97);border:5px solid #c9a6ff;border-radius:28px;padding:16px 20px 18px;text-align:center;color:#fff;width:min(94vw,780px);box-sizing:border-box;box-shadow:0 0 30px rgba(190,140,255,.5)}
  #spLv .t{font-size:32px;font-weight:bold;color:#ffd76a;margin-bottom:12px;text-shadow:0 2px 0 #3a1a00}
  #spLv .row{display:flex;gap:14px;justify-content:center}
  #spLv .lv{flex:1 1 0;min-width:0;min-height:230px;border-radius:24px;border:4px solid #fff;background:linear-gradient(#ffe48a,#ffb020);color:#5a2b00;display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:6px;font-family:inherit;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;padding:10px 6px;box-sizing:border-box}
  #spLv .lv:active{transform:scale(.95)} #spLv .lv .i{font-size:74px;line-height:1} #spLv .lv .n{font-size:32px;font-weight:bold} #spLv .lv .s{font-size:28px;letter-spacing:2px;min-height:32px}
  #spLv .lv.l2{background:linear-gradient(#d4e6ff,#5a8ef0);color:#0a2456} #spLv .lv.l3{background:linear-gradient(#ead8ff,#8a52e6);color:#26084e}
  #spLv .lv.lock{background:linear-gradient(#5e5876,#3a3452);color:#d8d0f0;border-color:#9a94b4;cursor:default} #spLv .lv.lock .i{opacity:.9}
  #spLv .lv .k{font-size:18px;font-weight:bold;line-height:1.15}
  #spLv .lv.no{animation:spNo .45s} @keyframes spNo{20%{transform:translateX(-10px)}40%{transform:translateX(10px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}
  #spLv .back{margin-top:14px;min-width:180px;min-height:66px;border-radius:40px;border:4px solid #fff;background:linear-gradient(#b5a0ff,#7a52d6);color:#fff;font:bold 27px 'Rubik',sans-serif;cursor:pointer;touch-action:manipulation}
  #spEnd .lvn{font-size:28px;font-weight:bold;color:#e2ccff;margin:2px 0}
  #spEnd .p.x3{border-color:#e2ccff;box-shadow:0 0 40px rgba(200,150,255,.9),0 0 0 6px rgba(255,215,106,.5)} #spEnd .p.x3 .ti{font-size:52px;color:#fff0a0}
  @media (max-height:520px){
    .spCard .spLvp{height:13px;gap:4px} .spLvp i{width:13px;height:13px;font-size:9px;border-width:1.5px}
    #spLv .p{padding:7px 14px 9px;border-width:4px} #spLv .t{font-size:21px;margin-bottom:6px} #spLv .row{gap:10px}
    #spLv .lv{min-height:0;padding:6px 4px;gap:2px;border-radius:18px;border-width:3px} #spLv .lv .i{font-size:46px} #spLv .lv .n{font-size:23px} #spLv .lv .s{font-size:20px;min-height:22px} #spLv .lv .k{font-size:14px}
    #spLv .back{margin-top:7px;min-height:50px;min-width:150px;font-size:21px;border-width:3px}
    #spEnd .lvn{font-size:20px;margin:0} #spEnd .p.x3 .ti{font-size:34px}
  }`;
  document.head.appendChild(css);
  const el = (tag, id, cls, html) => { const e = document.createElement(tag); e.id = id; if (cls) e.className = cls; if (html) e.innerHTML = html; document.body.appendChild(e); return e; };
  const promptB = el('button', 'spPrompt', '', '🪄<span class="l">אֶתְגָּר</span>'); promptB.setAttribute('aria-label', 'אֶתְגָּר');
  const ov = el('div', 'spOv'), top = el('div', 'spTop'), xB = el('button', 'spX', 'gamebtn', '✕'), spB = el('button', 'spBtn', 'gamebtn', '🪄');
  const sayEl = el('div', 'spSay'), hand = el('div', 'spHand', '', '👆'), endOv = el('div', 'spEnd');
  xB.setAttribute('aria-label', 'יציאה'); spB.setAttribute('aria-label', 'לחש');

  // Spoken Hebrew, as quidditch.js speak() does (no recorded voices in the HD repo, no audio files).
  function speak(text) {
    try {
      if (window.HP && window.HP.sfx && window.HP.sfx.isMuted && window.HP.sfx.isMuted()) return;
      if (!('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(text.replace(/[—!]/g, ' ')); u.lang = 'he-IL'; u.rate = 0.92; u.pitch = (S.C && S.C.pitch) || 1.35;   // Flitwick: a little higher
      const v = (speechSynthesis.getVoices() || []).find(x => /^(he|iw)/i.test(x.lang)); if (v) u.voice = v;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch { /* no speech here */ }
  }
  const hush = () => { try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch { /* ignore */ } };

  // ---- state ----
  const S = { on: false, key: null, C: null, phase: null, sub: null, step: 0, casts: 0, drops: 0, stars: 0, clock: 0, tCourse: 0, doneStations: 0,
    speed: 1, q: [], lifts: null, sel: null, hold: false, holdT: 0, idle: 0, walk: null, wantYaw: 0, fx: null, fxT: 0, sayT: 0, praise: 0, result: null,
    raise: 0, raiseK: 0, dim: 0, dimGoal: 0, profY: 0,
    // levels: S.stations = the course's stations (level 1: the very same array) merged with the level's per-station data
    level: 1, LV: null, stations: null, order: null, decoys: [], mistakes: 0, miss: 0, slips: 0, missT: -9, showI: -1, waits: 0, gateT: -9 };
  let K = null;                            // the built kit for the running course: { group, movers, lesson, stations, ... }
  let drag = null;
  const tmp = new Vector3(), tmp2 = new Vector3(), camPos = new Vector3(), camLook = new Vector3(), camPosGoal = new Vector3(), camLookGoal = new Vector3();
  const worldOff = new Vector3(), handAt = new Vector3();

  function at(sec, fn) { S.q.push({ t: S.clock + sec, fn }); }
  function runQueue() {
    for (let i = 0; i < S.q.length; i++) { const it = S.q[i]; if (it.t <= S.clock) { S.q.splice(i, 1); i--; it.fn(); if (!S.on) return; } }
  }
  function flushUntil(cond) {       // test hooks: fast-forward scripted waits
    for (let guard = 0; guard < 40 && !cond() && S.q.length; guard++) {
      let k = 0; for (let i = 1; i < S.q.length; i++) if (S.q[i].t < S.q[k].t) k = i;
      const it = S.q.splice(k, 1)[0]; S.clock = Math.max(S.clock, it.t); it.fn(); if (!S.on) return;
    }
  }

  // ---- the teacher ----
  function prof() { return lessons.figure ? lessons.figure(S.C.station) : null; }
  function pose(name) { if (lessons.pose) lessons.pose(S.C.station, name); }
  function line(text, sec = 3.2, profPose = 'talk') {
    const f = prof();
    // oneBubble courses: in the lesson only the bubble over the teacher (no copy in the top bar)
    const talk = S.phase === 'lesson' || S.phase === 'twist';   // (twist: a level 2/3 opening line, said like the lesson)
    if (!(S.C.oneBubble && f && talk)) { sayEl.textContent = (S.C.who || '🧙‍♂️') + ' ' + text; sayEl.classList.add('on'); S.sayT = sec; }
    speak(text);
    if (f && talk) { f.getWorldPosition(tmp);   // in the course the top speech bar is enough (a 3D bubble covered the rings on a phone)
      tmp.y += (innerHeight < 500 && S.C.bubbleYPhone != null ? S.C.bubbleYPhone : S.C.bubbleY) ?? (f.userData.labelY ? Math.min(2.4, f.userData.labelY) : 1.9); fun.say(tmp, text, sec, 'spell'); }   // bubbleY: a giant (Hagrid) talks from above his own head; on a short phone screen that is under the pips, so there it sits at his chest (bubbleYPhone)
    if (profPose === 'cast') { if (!(lessons.signature && lessons.signature(S.C.station))) hop(); if (S.C.verb === 'light') S.raise = sec; }
    else if (profPose) { pose(profPose); at(Math.max(1, sec - 0.6), () => pose(null)); }
  }
  let hopT = 0;
  function hop() { hopT = 0.6; }            // the chibi fallback's little flourish

  // ---- kit: build the course props into the room ----
  // the night factor of the outdoor light (an outdoor course gives its own props a little more light: see buildKit)
  const nightK = () => (!env || !env.time) ? 0 : env.time === 'night' ? 1 : env.time === 'dusk' ? 0.5 : 0;
  function buildKit(C, room) {
    const group = new Group(); group.name = 'spell-' + S.key;
    const solids = [], movers = {}, mats = [], geos = [], glowMats = [], texs = [];
    // outdoors (room null): the group stands on the terrain at the teacher's station; ground(x, z) = the terrain height
    // there, above the station's (0 in a room: the floor is y 0)
    const outdoor = !room;
    if (outdoor) { const st = lessons.stations[C.station]; group.position.set(st.x, player.heightAt(st.x, st.z), st.z); worldOff.copy(group.position); }
    const hAt = player.heightAt, ground = outdoor ? (x, z) => hAt.call(player, x + worldOff.x, z + worldOff.z) - worldOff.y : () => 0;
    const kit = {
      solid: (g) => solids.push(g),
      tex: (t) => { texs.push(t); return t; },
      burst: (x, y, z, n) => burst(x, y, z, n),
      hand: (x, y, z) => { if (x == null) S.handOn = false; else { S.handOn = true; handAt.set(x, y, z); } },   // the ghost hand strokes here (a teacher's demo), null = off
      ctx: { player, camera, worldOff, prof: () => prof(), ground, night: nightK },
      level: S.level,                       // 1, 2 or 3: a build adds its level-2/3 props (decoys, extra targets) only above 1
      mesh(name, geo, o = {}) {
        const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: DoubleSide, emissive: new Color(o.glowHex || 0xffd27a), emissiveIntensity: 0 });
        const m = new Mesh(geo, mat); m.name = 'spell-' + name; m.frustumCulled = false; m.raycast = () => {}; group.add(m);
        mats.push(mat); geos.push(geo); if (o.glow !== false) glowMats.push(mat);
        movers[name] = { name, mesh: m, geo, mat, scale: 1, s: 1, glows: o.glow !== false,
          pose(x, y, z, rx, ry, rz, s = 1) { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.setScalar(s); this.s = s; },
          poseS(x, y, z, rx, ry, rz, sx, sy, sz) { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); this.s = sy; },
          color(hex) { mat.color.setHex(hex); } };
        return movers[name];
      },
      inst(name, geo, n, colors, o = {}) {
        // o.basic: unlit (instance colour = brightness, above 1 blooms); o.additive + o.map: soft light quads
        const mat = o.basic ? new MeshBasicMaterial({ color: 0xffffff, map: o.map || null, transparent: !!o.additive, depthWrite: !o.additive, blending: o.additive ? AdditiveBlending : NormalBlending, side: DoubleSide, fog: false })
          : new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: DoubleSide, emissive: new Color(o.emissive || o.glowHex || 0xffd27a), emissiveIntensity: o.emissiveIntensity || 0 });
        const im = new InstancedMesh(geo, mat, n); im.name = 'spell-' + name; im.frustumCulled = false; im.raycast = () => {}; group.add(im);
        mats.push(mat); geos.push(geo); if (o.glow !== false) glowMats.push(mat);
        for (let i = 0; i < n; i++) {
          const s0 = (o.scales && o.scales[i]) || 1;
          im.setColorAt(i, _c.setHex(colors[i]));
          movers[name + i] = { name: name + i, mesh: im, geo, mat, scale: s0, s: 1, glows: o.glow !== false, lit: false,
            pose(x, y, z, rx, ry, rz, s = 1) { _m4.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.setScalar(s * s0)); im.setMatrixAt(i, _m4); im.instanceMatrix.needsUpdate = true; this.s = s; },
            poseS(x, y, z, rx, ry, rz, sx, sy, sz) { _m4.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx * s0, sy * s0, sz * s0)); im.setMatrixAt(i, _m4); im.instanceMatrix.needsUpdate = true; this.s = sy; },
            color(hex) { im.setColorAt(i, _c.setHex(hex)); im.instanceColor.needsUpdate = true; } };
        }
        return im;
      },
    };
    const B = C.build(kit);
    if (solids.length) {
      const g = mergeGeometries(solids.map(p => p.index ? p.toNonIndexed() : p)); solids.forEach(p => p.dispose());
      const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
      const m = new Mesh(g, mat); m.name = 'spell-props'; m.raycast = () => {}; group.add(m); mats.push(mat); geos.push(g);
    }
    // the outline where the thing belongs + the sparkles
    const ghostMat = new MeshBasicMaterial({ color: 0xffe58a, transparent: true, opacity: 0.35, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
    const ghost = new Mesh(new BoxGeometry(0.1, 0.1, 0.1), ghostMat); ghost.visible = false; ghost.frustumCulled = false; ghost.raycast = () => {}; ghost.renderOrder = 4; group.add(ghost);
    mats.push(ghostMat); geos.push(ghost.geometry);
    // Vera Verto: up to three glowing silhouettes of what each open thing will become (they share the ghost material)
    const ghosts = [];
    if (C.verb === 'change') for (let i = 0; i < 3; i++) { const gm = new Mesh(ghost.geometry, ghostMat); gm.visible = false; gm.frustumCulled = false; gm.raycast = () => {}; gm.renderOrder = 4; group.add(gm); ghosts.push(gm); }
    const NP = 64, pPos = new Float32Array(NP * 3), pGeo = new PlaneGeometry(1, 1);
    const cv = document.createElement('canvas'); cv.width = cv.height = 32; const g2 = cv.getContext('2d'), gr = g2.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.35, 'rgba(255,220,120,.85)'); gr.addColorStop(1, 'rgba(255,200,80,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, 32, 32);
    const pTex = new CanvasTexture(cv); pTex.colorSpace = SRGBColorSpace;
    // sparkles: camera-facing quads in ONE instanced mesh (PointsMaterial sizes are 1 px under WebGPURenderer)
    const pMat = new MeshBasicMaterial({ map: pTex, transparent: true, depthWrite: false, blending: AdditiveBlending, color: 0xffe9a0, side: DoubleSide });
    const sparks = new InstancedMesh(pGeo, pMat, NP); sparks.name = 'spell-sparkles'; sparks.frustumCulled = false; sparks.raycast = () => {}; sparks.renderOrder = 5; group.add(sparks);
    mats.push(pMat); geos.push(pGeo);
    const parts = []; for (let i = 0; i < NP; i++) parts.push({ mode: 0, a: Math.random() * 6.3, r: 0.25 + Math.random() * 0.2, sp: 1.5 + Math.random() * 2, y: Math.random(), vx: 0, vy: 0, vz: 0, x: 0, yy: 0, z: 0, life: 0 });
    // pre-sample every lift path (arc-length spaced), so update() only reads arrays
    // 'brew' (Potions) IS a change for every input / hold / tap / settle-back rule (CHANGE_*); only its look differs (poseBrew)
    const push = C.verb === 'push', light = C.verb === 'light', brew = C.verb === 'brew', pet = C.verb === 'pet', change = C.verb === 'change' || brew || pet, grow = C.verb === 'grow';
    const mkLift = (L, st) => {
      const mv = movers[L.m]; if (!mv) return null;
      const N = (light || change || grow) ? 2 : 48, arr = new Float32Array(N * 3);
      if (light || change || grow) { const y = L.path[0][1] + ground(L.path[0][0], L.path[0][2]); for (let i = 0; i < N; i++) { arr[i * 3] = L.path[0][0]; arr[i * 3 + 1] = y; arr[i * 3 + 2] = L.path[0][2]; } }   // a light target stays put: p = how lit
      else {
        const pts = L.path.map(p => new Vector3(p[0], p[1] + ground(p[0], p[2]), p[2]));
        const curve = new CatmullRomCurve3(pts, false, 'centripetal'), sp = curve.getSpacedPoints(N - 1);
        sp.forEach((v, i) => { arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z; });
      }
      const rings = (L.rings || []).map(n => { const r = movers[n]; return r ? { mv: r, u: 0, ringIdx: n } : null; }).filter(Boolean);
      return { spec: L, mv, N, arr, rot0: L.rot0 || [0, 0, 0], rot1: L.rot1 || [0, 0, 0], p: 0, peak: 0, hover: 0, done: false, snap: -1, ph: Math.random() * 6, moved: false, rings,
        push, light, change, brew, pet, grow, to: (change || grow) ? (movers[L.to] || null) : null, popT: -1,
        hov0: push ? PUSH_HOVER : light ? LIGHT_HOVER : pet ? PET_HOVER : change ? CHANGE_HOVER : grow ? GROW_HOVER : HOVER, fall: push ? PUSH_FALL : light ? LIGHT_FALL : pet ? PET_FALL : change ? CHANGE_FALL : grow ? GROW_FALL : FALL,
        inOrder: !!(st && st.inOrder), aimY: L.aimY || 0,
        // level 3 only: a glowing ring part-way up the path (hold = its centre, 0..1 of the path) to hold the thing in
        ring: (S.level === 3 && !light && !change && !grow && (L.hold ?? (st && st.hold)) != null)
          ? { uc: L.hold ?? st.hold, u0: (L.hold ?? st.hold) - RING_HALF, u1: (L.hold ?? st.hold) + RING_HALF, R: L.ringR || st.ringR || 0.4, fill: 0, ok: false, inside: false } : null,
        // levels 2-3 only: a timing gate (see GATE); hex0 = the thing's own glow colour (it glows green while ready)
        gate: (S.level > 1 && (L.gate || (st && st.gate))) ? { ...GATE, ...(L.gate || st.gate), t0: 0, pu: -1, hex0: mv.mat.emissive ? mv.mat.emissive.getHex() : 0 } : null, gateK: 0,
        flash: 0, shake: 0, slip: false };
    };
    const lesson = C.lesson.lifts.map(l => mkLift(l, null)).filter(Boolean);
    const stations = S.stations.map(st => st.lifts.map(l => mkLift(l, st)).filter(Boolean));
    if (outdoor) {
      scene.add(group); group.updateMatrixWorld(true);
      // the outdoor light changes with the day cycle: at dusk / night the course's own lit props catch more of it
      // (their base colour, never the world's lights; the time button is hidden while a course runs)
      const nk = nightK();
      if (nk > 0) for (const m of mats) if (m.isMeshStandardMaterial) m.color.multiplyScalar(1 + 1.6 * nk);
    } else {
      room.group.add(group);
      group.updateMatrixWorld(true); group.getWorldPosition(worldOff);
      group.userData.onTeardown = () => { if (S.on && K && K.group === group) leave(false, true); };   // the room is being disposed (mid-traverse: do not detach)
    }
    // levels 2-3: the stations' decoys (movers the build made: things that must NOT be cast on), the shown orders, the ring beads
    let decoys = null, orders = null, beads = null;
    if (S.level > 1) {
      decoys = S.stations.map(st => (st.decoys || []).map(d => movers[d.m] ? { decoy: true, spec: d, mv: movers[d.m], shake: 0, ph: Math.random() * 6 } : null).filter(Boolean));
      orders = S.stations.map((st, i) => st.order ? st.order.map(j => stations[i][j]).filter(Boolean) : null);
      for (const set of decoys) for (const D of set) D.mv.mesh.visible = false;   // shown per station (startStation): fewer draw calls
      if (S.level === 3 || stations.some(set => set.some(L => L.gate))) {   // the ring to hold a lifted thing in (and a timing gate's clock): 16 beads (one draw call)
        const bm = new MeshBasicMaterial({ color: 0xffffff, fog: false }), bg = new SphereGeometry(0.045, 8, 6);
        beads = new InstancedMesh(bg, bm, 16); beads.name = 'spell-ringhold'; beads.frustumCulled = false; beads.raycast = () => {}; beads.renderOrder = 5;
        for (let i = 0; i < 16; i++) { _m4.makeScale(0, 0, 0); beads.setMatrixAt(i, _m4); beads.setColorAt(i, _c.setHex(0xffffff)); }
        group.add(beads); mats.push(bm); geos.push(bg);
      }
    }
    const k = { group, movers, mats, geos, texs, B, ghost, ghosts, ghostMat, sparks, pPos, pGeo, parts, pTex, lesson, stations, ground, outdoor, decoys, orders, beads };
    k.glowMats = glowMats;
    resetKit(k, true);
    // ring params: how far along the feather's path each ring sits (the sample nearest its centre)
    for (const set of stations) for (const L of set) for (const r of L.rings) {
      const i = Number(r.ringIdx.replace(/\D/g, ''));
      r.mv.mesh.getMatrixAt(i, _m4); _v.setFromMatrixPosition(_m4);
      let bi = 0, bd = 1e9; for (let s = 0; s < L.N; s++) { const d = (L.arr[s * 3] - _v.x) ** 2 + (L.arr[s * 3 + 1] - _v.y) ** 2 + (L.arr[s * 3 + 2] - _v.z) ** 2; if (d < bd) { bd = d; bi = s; } }
      r.u = bi / (L.N - 1);
    }
    return k;
  }
  function resetLift(L) { L.p = 0; L.peak = 0; L.hover = 0; L.done = false; L.snap = -1; L.moved = false; L.popT = -1; for (const r of L.rings) r.mv.lit = false;
    L.flash = 0; L.shake = 0; L.slip = false; if (L.ring) { L.ring.fill = 0; L.ring.ok = false; L.ring.inside = false; }
    if (L.gate) { L.gate.t0 = 0; L.gate.pu = -1; L.gateK = 0; }
    poseLift(L, 0); }
  function resetKit(k, lessonToo) {
    k.B.reset(k.movers);
    if (lessonToo) for (const L of k.lesson) resetLift(L);
    for (const set of k.stations) for (const L of set) resetLift(L);
    if (k.decoys) for (const set of k.decoys) for (const D of set) { D.shake = 0; D.mv.pose(0, -50, 0, 0, 0, 0, 0); }   // a station's decoys appear when you get there
  }
  // a decoy sits where its level puts it (at, ry); a 'cat' breathes in its sleep; cast on it and it shakes its head
  // ('no') or rattles where it stands ('rattle': too heavy)
  function poseDecoy(D, t) {
    const a = D.spec.at, ry = D.spec.ry || 0, k = D.shake > 0 ? Math.min(1, D.shake / 0.4) : 0;
    const br = D.spec.breathe ? Math.sin(t * 1.7 + D.ph) * 0.025 : 0;
    if (D.spec.shakeMode === 'rattle') D.mv.poseS(a[0] + Math.sin(t * 47) * 0.03 * k, a[1] + Math.abs(Math.sin(t * 31)) * 0.03 * k, a[2], 0, ry, Math.sin(t * 39) * 0.06 * k, 1, 1 + br, 1);
    else D.mv.poseS(a[0], a[1], a[2], 0, ry + Math.sin(t * 22) * 0.38 * k, 0, 1, 1 + br, 1);
  }
  function disposeKit(inTeardown = false) {
    if (!K) return;
    const k = K; K = null;
    if (k.group.parent && !inTeardown) k.group.parent.remove(k.group);
    k.group.userData.onTeardown = null;
    k.group.traverse(o => { if (o.isInstancedMesh) { try { o.dispose(); } catch { /* backend quirk */ } } });
    for (const g of k.geos) { try { g.dispose(); } catch { /* backend quirk */ } }
    for (const m of k.mats) { try { m.dispose(); } catch { /* backend quirk */ } }
    try { k.pTex.dispose(); } catch { /* ignore */ }
    for (const t of k.texs) { try { t.dispose(); } catch { /* ignore */ } }
  }

  // ---- lifts ----
  function samplePath(L, p, out) {
    const f = Math.max(0, Math.min(1, p)) * (L.N - 1), i = Math.min(L.N - 2, f | 0), k = f - i, a = L.arr;
    return out.set(a[i * 3] + (a[i * 3 + 3] - a[i * 3]) * k, a[i * 3 + 1] + (a[i * 3 + 4] - a[i * 3 + 1]) * k, a[i * 3 + 2] + (a[i * 3 + 5] - a[i * 3 + 2]) * k);
  }
  // a change target stays put and wobbles harder as p fills; at the pop the before shape shrinks away and the
  // after shape springs up (only one of the two is ever drawn); a `free` after shape then belongs to the build
  function poseChange(L, t) {
    const a = L.arr, x = a[0], y = a[1], z = a[2], r0 = L.rot0, r1 = L.rot1;
    let sb = 1, sa = 0;
    if (L.done) { const u = L.popT < 0 ? 1 : Math.min(1, L.popT / POP); sb = Math.max(0, 1 - u / 0.45); const v = Math.max(0, (u - 0.45) / 0.55); sa = v <= 0 ? 0 : 1 + 2.7 * (v - 1) ** 3 + 1.7 * (v - 1) ** 2; }
    const w = L.done ? 1 : L.p, on = w > 0.01 ? 1 : 0;
    L.mv.pose(x, y + Math.abs(Math.sin(t * 9 + L.ph)) * 0.03 * w * on, z, r0[0], r0[1] + Math.sin(t * 7 + L.ph) * 0.2 * w * on, r0[2] + Math.sin(t * 16 + L.ph) * (0.03 + 0.12 * w) * on, sb * (1 + 0.1 * w * on));
    if (L.to && !(L.spec.free && L.done && L.popT >= POP)) L.to.pose(x, y, z, r1[0], r1[1], r1[2], sa);
  }
  // a brew target (a cauldron) stays put and only trembles a little as it fills (the ladle, the colour and the
  // bubbles are the course's own look, see buildPotions); at the snap it puffs (a squash and stretch), or, with
  // a `to` shape, pops into it exactly like a change
  function poseBrew(L, t) {
    if (L.to) { poseChange(L, t); return; }
    const a = L.arr, r0 = L.rot0, w = L.done ? 0 : L.p, on = w > 0.01 ? 1 : 0;
    const u = L.done && L.popT >= 0 ? Math.min(1, L.popT / POP) : 1, puff = Math.sin(u * Math.PI) * 0.16;
    L.mv.pose(a[0], a[1] + Math.abs(Math.sin(t * 13 + L.ph)) * 0.012 * w * on, a[2], r0[0] + Math.sin(t * 11 + L.ph) * 0.025 * w * on, r0[1], r0[2] + Math.sin(t * 9 + L.ph) * 0.025 * w * on, 1 + puff);
  }
  // a grow target (Herbology) stays put: the seedling (mv) wiggles as the finger pulls it and gives way (gone by a third)
  // to its plant (`to`), which rises from a sprig to full height with the progress (a little narrower while it stretches
  // up). At the snap the leaves pop (a squash and stretch), then the grown plant sways; a `free` plant then belongs to
  // the build.
  function poseGrow(L, t) {
    const a = L.arr, x = a[0], y = a[1], z = a[2], r0 = L.rot0, r1 = L.rot1;
    const w = L.done ? 1 : L.p, e = w * w * (3 - 2 * w), live = !L.done && w > 0.01 ? 1 : 0;
    L.mv.pose(x, y, z, r0[0], r0[1] + Math.sin(t * 5 + L.ph) * 0.3 * w * live, r0[2] + Math.sin(t * 13 + L.ph) * 0.14 * w * live, L.done ? 0 : Math.max(0, 1 - w / 0.3) * (1 + 0.3 * w));
    if (!L.to || (L.spec.free && L.done && L.popT >= POP)) return;
    let sx = 0, sy = 0;
    if (L.done) { const u = L.popT < 0 ? 1 : Math.min(1, L.popT / POP), b = Math.sin(u * Math.PI) * (1 - 0.4 * u); sy = 1 + 0.16 * b; sx = 1 + 0.28 * b; }
    else if (w > 0.01) { sy = 0.1 + 0.9 * e; sx = sy * (0.6 + 0.4 * e); }
    const sway = L.done ? Math.sin(t * 1.6 + L.ph) * 0.05 : Math.sin(t * 7 + L.ph) * 0.06 * live * (1 - e);
    L.to.poseS(x, y, z, r1[0], r1[1], r1[2] + sway, sx, sy, sx);
  }
  // a pet target (Creatures) stays put: as the progress rises it leans into the finger (a forward pitch toward its front),
  // sways and squashes softly, and wiggles faster while a finger is on it. Done: it sits still here and the course poses
  // its happy animation. With a `to` shape (an egg) it wobbles, then hatches exactly like a change.
  const _pe = new Euler(0, 0, 0, 'YXZ'), _pe2 = new Euler(), _pq = new Quaternion();
  function posePet(L, t) {
    if (L.to && L.done) { poseChange(L, t); return; }
    const a = L.arr, r0 = L.rot0, w = L.done ? 0 : L.p, on = w > 0.01 ? 1 : 0;
    const touch = !L.done && S.sel === L && (S.hold || (drag && drag.change)) ? 1 : 0;
    const lean = (0.16 + 0.06 * Math.sin(t * 3 + L.ph)) * w * on, wig = Math.sin(t * 15 + L.ph) * (0.04 + 0.08 * touch) * Math.max(w, touch * 0.3) * (on || touch), sq = Math.sin(t * 7 + L.ph) * 0.05 * w * on;
    _pe.set(r0[0] + lean, r0[1] + Math.sin(t * 2.2 + L.ph) * 0.12 * w * on, r0[2] + wig, 'YXZ'); _pq.setFromEuler(_pe); _pe2.setFromQuaternion(_pq, 'XYZ');
    L.mv.poseS(a[0], a[1] + Math.abs(Math.sin(t * 6 + L.ph)) * 0.025 * w * on, a[2], _pe2.x, _pe2.y, _pe2.z, 1 - sq * 0.5, 1 + sq, 1 - sq * 0.5);
    if (L.to) L.to.pose(a[0], a[1], a[2], 0, 0, 0, 0);
  }
  function poseLift(L, t) {
    if (L.pet) { posePet(L, t); return; }
    if (L.grow) { poseGrow(L, t); return; }
    if (L.brew) { poseBrew(L, t); return; }
    if (L.change) { poseChange(L, t); return; }
    const e = L.p * L.p * (3 - 2 * L.p);
    samplePath(L, L.p, tmp2);
    const live = L.p > 0.01 && !L.done && !L.push && !L.light, bob = (L.spec.bob || live) ? Math.sin(t * 2.4 + L.ph) * (L.done ? 0.025 : 0.04) : 0;
    const fl = L.spec.flutter ? Math.sin(t * 4 + L.ph) * 0.3 * Math.min(1, L.p * 3) : 0;
    const r0 = L.rot0, r1 = L.rot1;
    if (L.flash > 0 || L.shake > 0) {     // levels 2-3 only: shown in the order preview (a pop) / cast on out of turn (a shake)
      const pop = L.flash > 0 ? 1 + 0.35 * Math.sin(Math.min(1, L.flash / 0.75) * Math.PI) : 1, sh = L.shake > 0 ? Math.sin(t * 30) * 0.22 * Math.min(1, L.shake / 0.4) : 0;
      L.mv.pose(tmp2.x, tmp2.y + bob + (pop - 1) * 0.25, tmp2.z, r0[0] + (r1[0] - r0[0]) * e, r0[1] + (r1[1] - r0[1]) * e + sh, r0[2] + (r1[2] - r0[2]) * e + fl + sh * 0.5, pop);
      return;
    }
    L.mv.pose(tmp2.x, tmp2.y + bob, tmp2.z, r0[0] + (r1[0] - r0[0]) * e, r0[1] + (r1[1] - r0[1]) * e + (L.done && L.spec.flutter ? Math.sin(t * 0.8 + L.ph) * 0.3 : 0), r0[2] + (r1[2] - r0[2]) * e + fl);
  }
  const open = () => { if (!S.lifts) return null; for (const L of S.lifts) if (!L.done) return L; return null; };
  let twT = 0;
  function twinkle() {                       // the thing to light next sparkles (a hint, never a penalty)
    const L = open(); if (!L || S.clock - twT < 0.4) return;
    twT = S.clock; liftWorld(L, tmp); burst(tmp.x - worldOff.x, tmp.y - worldOff.y, tmp.z - worldOff.z, 10); fun.sfx.tink(3);
  }
  function select(L) { if (L && !L.done && S.sel !== L) { S.sel = L; fun.sfx.tink(2); setPips(); } }
  function liftWorld(L, out) { samplePath(L, L.p, out); out.y += L.aimY; return out.add(worldOff); }
  function pick(x, y) {
    if (!S.lifts) return null;
    const R = Math.max(80, Math.min(innerWidth, innerHeight) * 0.13);   // >= 160 px across on every screen
    let best = null, bd = R;
    const first = open();
    for (const L of S.lifts) {
      if (L.done || (L.inOrder && L !== first)) continue;
      liftWorld(L, tmp);
      // a big thing (spec.r metres) gets a hit circle at least as big as it looks on screen
      const rr = L.spec.r ? L.spec.r * 1.3 * innerHeight / (2 * Math.tan((camera.fov || 50) * Math.PI / 360) * Math.max(0.3, tmp.distanceTo(camera.position))) : 0;
      tmp.project(camera); if (tmp.z > 1) continue;
      const d = Math.hypot((tmp.x * 0.5 + 0.5) * innerWidth - x, (-tmp.y * 0.5 + 0.5) * innerHeight - y) - Math.max(0, rr - R);
      if (d < bd) { bd = d; best = L; }
    }
    if (S.level > 1) for (const D of S.decoys) {   // levels 2-3: the station's decoys can be touched too (and fizzle)
      const a = D.spec.at; tmp.set(a[0], a[1] + (D.spec.aimY || 0), a[2]).add(worldOff);
      const rr = D.spec.r ? D.spec.r * 1.3 * innerHeight / (2 * Math.tan((camera.fov || 50) * Math.PI / 360) * Math.max(0.3, tmp.distanceTo(camera.position))) : 0;
      tmp.project(camera); if (tmp.z > 1) continue;
      const d = Math.hypot((tmp.x * 0.5 + 0.5) * innerWidth - x, (-tmp.y * 0.5 + 0.5) * innerHeight - y) - Math.max(0, rr - R);
      if (d < bd) { bd = d; best = D; }
    }
    return best;
  }
  // ---- levels 2-3: decoys, the shown order, delayed hints, the ring hold ----
  const HINTS = { decoy: 'לֹא אֶת זֶה! הַקְשֵׁב מָה לְהָרִים!', order: 'לֹא בַּסֵּדֶר! מָה הִבְהִיק קֹדֶם?', again: 'הִנֵּה שׁוּב הַסֵּדֶר!', go: 'עַכְשָׁו אַתָּה!',
    slip: 'כִּמְעַט! עֲצֹר בְּתוֹךְ הַטַּבַּעַת!', slipMiss: 'לְאַט לְאַט... עֲצֹר בַּטַּבַּעַת!',
    gate: 'עוֹד לֹא! חַכֵּה לַיָּרֹק!', gateMiss: 'סַבְלָנוּת... חַכֵּה שֶׁיִּהְיֶה יָרֹק!' };
  const hint = (k) => (S.LV && S.LV.hints && S.LV.hints[k]) || (S.C.hints && S.C.hints[k]) || HINTS[k];
  const hintNeed = () => S.level === 2 ? 1 : 2;           // mistakes at a station before the hints come back
  const hintOK = () => S.level === 1 || S.miss >= hintNeed();
  const nextL = () => { if (S.order) { for (const L of S.order) if (!L.done) return L; return null; } return open(); };
  // a touch on a decoy, or on the wrong thing of a shown order: a fizzle, the teacher's hint, a counted mistake.
  // Returns the lift when the touch is fine.
  function gate(hit) {
    if (!hit || S.level === 1) return hit;
    if (hit.decoy) { mistake(hit.spec.say || hint('decoy'), hit); return null; }
    if (S.order && hit !== nextL()) { mistake(hint('order'), hit); return null; }
    if (hit.gate && hit.p < 0.05 && !gateOpen(hit)) { gateWait(hit); return null; }
    return hit;
  }
  // the timing gate (levels 2-3): where in its rhythm a gated thing is (0..period; ready while < open)
  const gateU = (L) => { const G = L.gate, P = G.period; return (((S.clock - G.t0) % P) + P) % P; };
  const gateOpen = (L) => !!L.gate && gateU(L) < L.gate.open;
  function gateWait(L) {                   // pushed while not ready: it wobbles, a soft fizzle; free twice per station, then a mistake
    L.shake = 0.6;
    if (S.clock - S.gateT < MISS_GAP) return;             // one fumbling finger = one wait
    S.gateT = S.clock; S.waits++;
    if (S.waits > 2) mistake(hint('gateMiss'), L);
    else { fun.sfx.soft(); line(hint('gate'), 1.8, null); }
  }
  // per frame: ease each gated thing's openness (L.gateK: a course's own look may follow it; it stays open while the thing
  // is being pushed or is done) and, for the one being shown, the tick-tick-ding as the window opens and a low tock as it closes
  function tickGates(dt, show) {
    if (!S.lifts) return;
    for (const L of S.lifts) {
      if (!L.gate) continue;
      const G = L.gate, u = gateU(L), want = (u < G.open || L.p > 0.02 || L.done) ? 1 : 0;
      L.gateK += (want - L.gateK) * Math.min(1, dt * 6);
      if (L === show && S.sub === 'cast' && !L.done && L.p < 0.05 && G.pu >= 0) {
        const pu = G.pu, P = G.period;
        if (u < pu) { fun.sfx.tone(1320, 0.12, 'triangle', 0.13); fun.sfx.tone(1760, 0.14, 'sine', 0.09, 0.09); }   // the window opens: ding-ding
        else {
          if (pu < P - 0.9 && u >= P - 0.9) fun.sfx.tone(1050, 0.05, 'sine', 0.07);   // tick
          if (pu < P - 0.45 && u >= P - 0.45) fun.sfx.tone(1050, 0.05, 'sine', 0.08);   // tick
          if (pu < G.open && u >= G.open) fun.sfx.tone(440, 0.09, 'sine', 0.05);        // closed again: a low soft tock
        }
      }
      G.pu = u;
    }
  }
  function mistake(text, obj) {
    if (obj) { obj.shake = 0.8; const a = obj.decoy ? obj.spec.at : null; if (a) burst(a[0], a[1] + (obj.spec.aimY || 0) + 0.2, a[2], 5); }
    fun.sfx.poof();
    if (S.clock - S.missT < MISS_GAP) return;             // one fumbling finger = one mistake
    S.missT = S.clock; S.mistakes++; S.miss++;
    line(text, 2.2, 'talk');
    if (S.miss === hintNeed() && S.order && S.order.some(L => !L.done)) at(1.8, () => { if (S.sub === 'cast') showOrder(true); });
  }
  // the order: each thing still to do lights up in turn (a pop, sparkles, a rising tink); no input meanwhile
  function showOrder(again) {
    const seq = S.order ? S.order.filter(L => !L.done) : []; if (!seq.length) return;
    S.sub = 'show'; S.sel = null; drag = null; hideHand();
    for (const L of seq) if (L.p > 0) { L.p = 0; L.peak = 0; L.hover = 0; L.moved = false; L.slip = false; if (L.ring) L.ring.fill = 0; }
    if (again) line(hint('again'), 1.8, 'talk');
    const t0 = again ? 1.3 : 0.5, gap = 0.95;
    seq.forEach((L, i) => at(t0 + i * gap, () => { S.showI = i; L.flash = 0.75; liftWorld(L, tmp); burst(tmp.x - worldOff.x, tmp.y - worldOff.y, tmp.z - worldOff.z, 14); fun.sfx.tone(880 * Math.pow(1.26, i), 0.28, 'sine', 0.13); }));
    at(t0 + seq.length * gap + 0.3, () => { S.showI = -1; if (!again) line(hint('go'), 1.6, 'talk'); S.sub = 'cast'; S.idle = 0; });
  }
  // level 3: a lifted thing slipped (pushed past its ring, or let go before it was held there): free twice per station
  function slipEvent() {
    S.slips++;
    if (S.slips > 2) mistake(hint('slipMiss'), null); else { line(hint('slip'), 1.8, null); fun.sfx.soft(); }
  }
  // level 3, per frame for a ring lift: fill while the finger holds it inside the window; full = it glides home.
  // Returns true when it moved the thing itself (gliding home / slipping back down).
  function ringStep(L, dt) {
    const R = L.ring;
    if (R.ok) { L.p = Math.min(1, L.p + dt * 1.1); if (L.p >= SNAP) snapLift(L); return true; }
    if (L.slip) { L.p -= dt * 0.55; if (L.p <= 0) { L.p = 0; L.slip = false; L.peak = 0; L.moved = false; } return true; }
    const held = !!(drag && S.sel === L), inside = L.p >= R.u0 && L.p <= R.u1;
    R.inside = inside && held;
    if (R.inside) {
      R.fill += dt / RING_HOLD;
      if (R.fill >= 1) { R.fill = 1; R.ok = true; drag = null; fun.sfx.chime(); fun.sfx.tune([784, 1047], 0.08, 'sine'); liftWorld(L, tmp); burst(tmp.x - worldOff.x, tmp.y - worldOff.y, tmp.z - worldOff.z, 16); }
    } else R.fill = Math.max(0, R.fill - dt / 1.2);
    if (L.p > R.u1 + RING_OVER) { L.slip = true; R.fill = 0; L.hover = 0; if (S.sel === L) drag = null; fun.sfx.whoosh(); slipEvent(); return true; }
    return false;
  }
  function nudge(L, v) {                     // set a lift's progress from a gesture
    if (!L || L.done || L.snap >= 0) return;
    if (L.ring && (L.ring.ok || L.slip)) return;   // level 3: gliding home / slipping back: the finger lets go of it
    if (!L.moved && v > 0.02) { L.moved = true; player.play('Wave'); if (L.light || L.change || L.grow) fun.sfx.sparkle(); else fun.sfx.whoosh(); if (L.grow) fun.sfx.tone(330, 0.6, 'sine', 0.07, 0, 660); }
    L.p = Math.max(0, Math.min(1, v)); L.hover = L.hov0; if (L.p > L.peak) L.peak = L.p;
    S.idle = 0;
  }
  function snapLift(L) { if (L.done || L.snap >= 0) return; L.snap = 0; L.p = Math.max(L.p, SNAP); fun.sfx.chime(); }
  function liftDone(L) {
    L.done = true; L.p = 1; L.snap = -1; L.peak = 0; poseLift(L, S.clock);
    for (const r of L.rings) if (!r.mv.lit) { r.mv.lit = true; r.mv.color(0xffe07a); }
    if (L.gate && L.mv.mat.emissive) L.mv.mat.emissive.setHex(L.gate.hex0);   // (levels 2-3: its own glow colour back)
    S.casts++; if (S.sel === L) S.sel = null;
    liftWorld(L, tmp); burst(tmp.x - worldOff.x, tmp.y - worldOff.y, tmp.z - worldOff.z, 20);
    if (L.pet) { L.popT = 0; fun.sfx.heart(); fun.sfx.giggle(true); }   // a happy creature (its heart puff is the course's own)
    else if (L.change) { L.popT = 0; fun.sfx.pop(); fun.sfx.poof(); }
    if (L.grow) { L.popT = 0; fun.sfx.pop(); burst(tmp.x - worldOff.x, tmp.y - worldOff.y + (L.spec.top || 0.4) * 0.85, tmp.z - worldOff.z, 16); }
    fun.sfx.sparkle(); fun.sfx.tune([1047, 1319, 1568], 0.09, 'sine');
    setPips();
    if (S.lifts.every(x => x.done)) setDone();
    else { line(S.C.praise[S.praise++ % S.C.praise.length], 1.8); }
  }
  function drop(L) {
    if (L.ring) { L.peak = 0; L.moved = false; slipEvent(); return; }   // level 3: a let-go is a slip (free twice per station)
    S.drops++; L.peak = 0; L.moved = false;
    line(S.C.oops, 1.8, null); fun.sfx.soft();
  }

  // ---- sparkles ----
  function burst(x, y, z, n) {
    let c = 0;
    for (const p of S.on && K ? K.parts : []) {
      if (p.mode === 1) continue;
      p.mode = 1; p.life = 0.7 + Math.random() * 0.5; p.x = x; p.yy = y; p.z = z;
      const a = Math.random() * 6.3, u = Math.random() * 2 - 1, sp = 1.2 + Math.random() * 1.6;
      p.vx = Math.cos(a) * Math.sqrt(1 - u * u) * sp; p.vy = Math.abs(u) * sp + 0.6; p.vz = Math.sin(a) * Math.sqrt(1 - u * u) * sp;
      if (++c >= n) break;
    }
  }
  function tickSparks(dt, t) {
    const k = K, pos = k.pPos;
    // orbiting sparkles: the not-yet-done lifts of the current set (the selected one gets most)
    let nOpen = 0; if (S.sub === 'cast' && S.lifts) for (const L of S.lifts) if (!L.done) nOpen++;
    let ordered = nOpen > 0 && S.lifts[0].inOrder;     // a follow-me set: only the next one twinkles
    let focus = null;                                  // levels 2-3: sparkles only round the touched one, or the next once hints are back
    if (S.level > 1 && nOpen) { focus = S.sel && !S.sel.done ? S.sel : hintOK() ? nextL() : null; nOpen = focus ? 1 : 0; ordered = true; }
    let oi = 0;
    for (let i = 0; i < k.parts.length; i++) {
      const p = k.parts[i];
      if (p.mode === 1) {
        p.life -= dt; p.vy -= dt * 2.2; p.x += p.vx * dt; p.yy += p.vy * dt; p.z += p.vz * dt;
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.yy; pos[i * 3 + 2] = p.z;
        if (p.life <= 0) p.mode = 0;
        continue;
      }
      if (nOpen && oi < 36) {
        // spread orbiters over the open lifts
        let target = null, j = oi % nOpen;
        if (focus) target = focus; else for (const L of S.lifts) { if (L.done) continue; if (ordered || j-- === 0) { target = L; break; } }
        if (S.sel && !S.sel.done && oi % 3 !== 0 && !ordered) target = S.sel;
        oi++;
        samplePath(target, target.p, tmp2);
        const cg = target.change ? target.p : 0;   // Vera Verto: the sparkles spiral in (tighter, faster) as the change fills
        const gh = target.grow ? (target.spec.top || 0.4) * target.p * 0.85 : 0;   // Herbivicus: they climb with the growing plant
        const a = p.a + t * p.sp * (1 + 2.2 * cg), r = p.r * (target === S.sel ? 1.25 : 1) * (target.mv.scale > 1.5 ? 1.6 : 1) * (target.change ? (target.spec.r || 0.3) / 0.3 * (1 - 0.55 * cg) : 1);
        pos[i * 3] = tmp2.x + Math.cos(a) * r; pos[i * 3 + 1] = tmp2.y + target.aimY * 0.6 + 0.1 + gh + ((p.y + t * 0.35) % 1) * 0.45; pos[i * 3 + 2] = tmp2.z + Math.sin(a) * r;
      } else { pos[i * 3] = 0; pos[i * 3 + 1] = -60; pos[i * 3 + 2] = 0; }
    }
    const q = camera.quaternion;
    for (let i = 0; i < k.parts.length; i++) {
      const hidden = pos[i * 3 + 1] < -50, p = k.parts[i];
      const sz = hidden ? 0 : p.mode === 1 ? 0.2 * Math.min(1, p.life * 2) : 0.13 + Math.sin(t * 6 + p.a * 3) * 0.04;
      _m4.compose(_v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]), q, _s.setScalar(sz)); k.sparks.setMatrixAt(i, _m4);
    }
    k.sparks.instanceMatrix.needsUpdate = true;
  }

  // ---- HUD ----
  let pipKey = '';
  function setPips() {
    if (!S.on) return;
    let html = '', key = S.phase + ':';
    if (S.phase === 'lesson') { const ls = K ? K.lesson : []; ls.forEach((L, i) => { const c = L.done ? 'on' : (open() === L ? 'cur' : ''); key += c + i; html += '<i class="' + c + '">' + (S.C.lesson.pip || '🪶') + '</i>'; }); }
    else { S.stations.forEach((st, i) => { const c = i < S.doneStations ? 'on' : i === S.step && S.phase === 'course' ? 'cur' : S.phase === 'reward' ? 'on' : ''; key += c + i; html += '<i class="' + c + '">' + st.icon + '</i>'; }); }
    if (key !== pipKey) { pipKey = key; top.innerHTML = html; }
  }
  function setBtn(on) { spB.classList.toggle('on', !!on); if (!on) { S.hold = false; spB.classList.remove('hold'); } }

  // ---- gestures ----
  const range = () => Math.max(110, Math.min(300, innerHeight * 0.3));
  const rangeOf = (L) => L && L.ring ? Math.max(range(), 220) : range();   // level 3: a longer swipe, so the ring window is >= ~55 px on a phone
  // the screen direction a swipe should go: up for a lift; for a push, along the thing's path
  // as the camera sees it (from where it is now toward its outline, or along spec.dir)
  const sdA = new Vector3(), sdB = new Vector3(), swipeDir = { x: 0, y: -1 };
  function dirOf(L) {
    swipeDir.x = 0; swipeDir.y = -1;
    if (!L || !L.push) return swipeDir;
    liftWorld(L, sdA);
    const d = L.spec.dir;
    if (d) sdB.set(sdA.x + d[0], sdA.y + d[1], sdA.z + d[2]);
    else { const a = L.arr, n = (L.N - 1) * 3; sdB.set(a[n], a[n + 1] + L.aimY, a[n + 2]).add(worldOff); }
    sdA.project(camera); sdB.project(camera);
    const x = (sdB.x - sdA.x) * innerWidth, y = -(sdB.y - sdA.y) * innerHeight, l = Math.hypot(x, y);
    if (l > 8) { swipeDir.x = x / l; swipeDir.y = y / l; }
    return swipeDir;
  }
  ov.addEventListener('pointerdown', e => {
    if (!S.on || S.sub !== 'cast') return;
    e.preventDefault(); S.idle = 0;
    // levels 2-3: only a touch ON the right thing casts (no forgiving 'anywhere'); a decoy / out-of-turn thing fizzles
    if (S.level > 1 && !gate(pick(e.clientX, e.clientY))) return;
    if (S.C.verb === 'light') {
      // Lumos: touch the glowing thing and it starts to light; keep the finger on it = brighter. A touch
      // anywhere else (or the wrong star lamp) only makes the right one twinkle again: no penalty.
      const hit = pick(e.clientX, e.clientY);
      if (hit) { select(hit); S.hold = true; S.holdT = 0; nudge(hit, hit.p + 0.08); }
      else twinkle();
      drag = { id: e.pointerId, t0: performance.now(), light: true, onTarget: !!hit };
      try { ov.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      return;
    }
    if (S.C.verb === 'change' || S.C.verb === 'brew' || S.C.verb === 'pet') {   // brew / pet: the same stir / hold / tap on a cauldron / a creature
      // Vera Verto: touch the glowing thing and stir / scribble round it (any direction: finger travel counts), or
      // keep the finger on it, or tap it. A touch beside it still stirs the current one (forgiving) and twinkles it.
      const hit = pick(e.clientX, e.clientY);
      if (hit) { select(hit); S.hold = true; S.holdT = 0; } else { if (!S.sel || S.sel.done) select(open()); twinkle(); }
      drag = { id: e.pointerId, change: true, x: e.clientX, y: e.clientY, travel: 0, t0: performance.now(), onTarget: !!hit };
      try { ov.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      return;
    }
    const hit = pick(e.clientX, e.clientY);
    if (hit) select(hit); else if (!S.sel || S.sel.done) select(open());
    const sd = dirOf(S.sel);
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, ux: sd.x, uy: sd.y, p0: S.sel ? S.sel.p : 0, t0: performance.now(), moved: false, onTarget: !!hit };
    try { ov.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  // How far the finger has swiped. Lift: pixels up. Push: ANY direction counts (the distance swiped):
  // the push direction on screen changes per station (sideways, away, even toward the viewer), and a
  // 7-year-old who swipes the 'wrong' way must still see the thing move (review finding).
  const swiped = (e) => (S.sel && S.sel.push) ? Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0)
    : (e.clientX - drag.x0) * drag.ux + (e.clientY - drag.y0) * drag.uy;
  ov.addEventListener('pointermove', e => {
    if (drag && drag.change && e.pointerId === drag.id) {
      const d = Math.hypot(e.clientX - drag.x, e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; drag.travel += d;
      const L = S.sel;
      if (L && !L.done && drag.travel > 12) { nudge(L, L.p + d / (range() * CHANGE_STIR)); if (L.p >= SNAP) snapLift(L); }
      return;
    }
    if (!drag || drag.light || e.pointerId !== drag.id || !S.sel) return;
    const dy = swiped(e);
    if (dy > 10 || drag.moved) { drag.moved = true; nudge(S.sel, drag.p0 + Math.max(0, dy - 10) / rangeOf(S.sel)); if (S.sel && S.sel.p >= SNAP && !S.sel.ring) snapLift(S.sel); }
  });
  const endDrag = (e) => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    if (drag.change) {
      const L = S.sel;
      if (drag.onTarget) { S.hold = false; if (L && !L.done && S.holdT < 0.25 && drag.travel < 20) nudge(L, L.p + CHANGE_TAP); }
      drag = null; return;
    }
    if (drag.light) {
      const L = S.sel;
      if (drag.onTarget) { S.hold = false; if (L && !L.done && S.holdT < 0.25) nudge(L, L.p + LIGHT_TAP); }
      drag = null; return;
    }
    const L = S.sel, dy = e ? swiped(e) : 0, quick = performance.now() - drag.t0 < (L && L.push ? 450 : 350);   // a push flick gets a little longer (a sweep, not a snap of the wrist)
    if (L && !L.done) {
      if (drag.moved && quick && dy > 50 && !L.ring) snapLift(L);                     // a quick flick up: the swish-and-flick
      else if (!drag.moved && drag.onTarget) nudge(L, L.p + (L.grow ? TAP : TAP * 0.6));   // a tap on the thing: a little hop up (a seedling: a third)
    }
    drag = null;
  };
  ov.addEventListener('pointerup', endDrag); ov.addEventListener('pointercancel', endDrag);
  spB.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    if (!S.on || S.sub !== 'cast') return;
    if (!S.sel || S.sel.done) select(open());
    S.hold = true; S.holdT = 0; S.idle = 0; spB.classList.add('hold');
    try { spB.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  const endHold = (e) => {
    if (e) e.stopPropagation();
    if (!S.hold) return;
    S.hold = false; spB.classList.remove('hold');
    if (S.holdT < 0.25 && S.sel) nudge(S.sel, S.sel.p + (S.sel.light ? LIGHT_TAP : S.sel.change ? CHANGE_TAP : TAP));   // a tap: a third of the way up
  };
  spB.addEventListener('pointerup', endHold); spB.addEventListener('pointercancel', endHold);
  xB.addEventListener('click', e => { e.stopPropagation(); quit(); });

  // ---- flow ----
  function placeHero(x, z, yaw) {
    player.pos.set(x + worldOff.x, worldOff.y + (K ? K.ground(x, z) : 0), z + worldOff.z); player.smoothY = player.pos.y; player._lastPos.copy(player.pos);
    player.yaw = yaw; S.wantYaw = yaw;
  }
  const yawTo = (x0, z0, x1, z1) => Math.atan2(x1 - x0, z1 - z0);
  function camTo(c) {                       // (outdoors the heights are above the terrain under each point)
    const g = K ? K.ground : () => 0;
    camPosGoal.set(c.pos[0], c.pos[1] + g(c.pos[0], c.pos[2]), c.pos[2]).add(worldOff); camLookGoal.set(c.look[0], c.look[1] + g(c.look[0], c.look[2]), c.look[2]).add(worldOff);
  }

  function startLesson() {
    const Ls = S.C.lesson;
    S.phase = 'lesson'; S.sub = 'intro'; S.step = 0; S.lifts = K.lesson; S.sel = null;
    placeHero(Ls.stand[0], Ls.stand[1], yawTo(Ls.stand[0], Ls.stand[1], Ls.face[0], Ls.face[1]));
    camTo(Ls.cam);
    setPips(); setBtn(false);
    let t = 0.4;
    for (const b of Ls.intro) {
      at(t, () => { line(b.line, b.t, b.pose); if (b.burst) { burst(b.burst[0], b.burst[1], b.burst[2], 18); fun.sfx.sparkle(); } if (b.fx && K.B.effects[b.fx]) { S.fx = K.B.effects[b.fx]; S.fxT = 0; } });
      t += b.t;
    }
    at(t, beginCast);
  }
  function beginCast() {
    if (S.level > 1) {                    // levels 2-3: nothing pre-selected, no big 🪄 button; an ordered station first shows its order
      S.handOn = false; S.sub = 'cast'; S.idle = 0; S.sel = null; setBtn(false); setPips();
      if (S.lifts) for (const L of S.lifts) if (L.gate) { L.gate.t0 = S.clock + L.gate.lead; L.gate.pu = -1; }   // timing gates: the rhythm starts now
      if (S.order && S.phase === 'course') showOrder(false);
      return;
    }
    S.handOn = false; S.sub = 'cast'; S.idle = 0; S.sel = null; select(open()); setBtn(true); setPips();
  }
  // levels 2-3 open without the lesson: the teacher says the twist (voice + bubble), then the course
  function startTwist() {
    const Ls = S.C.lesson;
    S.phase = 'twist'; S.sub = 'intro'; S.step = 0; S.lifts = null; S.sel = null;
    placeHero(Ls.stand[0], Ls.stand[1], yawTo(Ls.stand[0], Ls.stand[1], Ls.face[0], Ls.face[1]));
    camTo(Ls.cam); setPips(); setBtn(false);
    at(0.4, () => line(S.LV.twist, 3.8, 'talk'));
    at(4.4, () => startStation(0));
  }
  function setDone() {
    S.sub = 'after'; setBtn(false); hideHand(); S.sel = null;
    if (S.phase === 'lesson') {
      line(S.C.praise[0], 2.0); player.play('Cheer');
      at(2.2, () => { line(S.C.lesson.outro, 2.4); });
      at(4.4, () => startStation(0));
      return;
    }
    const st = S.stations[S.step];
    S.doneStations = S.step + 1; setPips();
    line(S.C.praise[S.praise++ % S.C.praise.length], 2.0);
    const fx = st.after && K.B.effects[st.after];
    if (st.afterCam) camTo(st.afterCam);
    if (fx) {
      S.fx = fx; S.fxT = 0;
      if (st.afterSfx) { if (fun.sfx[st.afterSfx]) fun.sfx[st.afterSfx](); if (st.afterConfetti) fun.confetti(st.afterConfetti, 18); }
      else if (st.after === 'chestOpen') { fun.sfx.tada(); fun.confetti(['⭐', '🪙', '✨', '💛'], 18); } else fun.sfx.hoot();
    }
    if (st.afterLine) at(st.afterLineT ?? 1.8, () => line(st.afterLine, 2.6, 'talk'));
    at(fx ? (st.afterT || 2.8) : 1.6, () => { S.fx = null; if (S.step + 1 < S.stations.length) startStation(S.step + 1); else finish(); });
  }
  function startStation(i) {
    const st = S.stations[i];
    if (S.phase !== 'course') { S.phase = 'course'; S.tCourse = 0; }
    S.step = i; S.sub = 'walk'; S.lifts = K.stations[i]; S.sel = null; S.fx = null; S.handOn = false;
    S.walk = { pts: st.walk, i: 0 };
    if (S.level > 1) {
      for (const D of S.decoys) D.mv.pose(0, -50, 0, 0, 0, 0, 0);
      S.order = K.orders[i]; S.decoys = K.decoys[i] || []; S.miss = 0; S.slips = 0; S.showI = -1; S.waits = 0; S.gateT = -9;
      const used = new Set(S.decoys.map(D => D.mv.mesh));   // only this station's decoy meshes are drawn
      for (const set of K.decoys) for (const D of set) D.mv.mesh.visible = used.has(D.mv.mesh);
      if (st.pre) for (const j of st.pre) { const L = S.lifts[j]; if (L && !L.done) { L.done = true; L.p = 1; L.popT = POP; } }   // already lit / done when the station starts
    }
    camTo(st.cam); setPips(); setBtn(false); hideHand();
  }
  function arrive() {
    const st = S.stations[S.step];
    S.walk = null; S.sub = 'intro';
    const p = st.walk[st.walk.length - 1]; S.wantYaw = yawTo(p[0], p[1], st.face[0], st.face[1]);
    line(st.say, 2.6, 'talk');
    at(1.4, beginCast);
  }
  function finish() {
    S.phase = 'reward'; S.sub = 'reward'; setBtn(false); hideHand(); setPips();
    const C = S.C;
    if (S.level > 1) {                    // levels 2-3: stars from mistakes (and a generous time): careful = 3, random tapping = 1
      const m = S.mistakes; S.stars = m <= 2 && S.tCourse <= (S.LV.star3 || 400) ? 3 : m <= 6 ? 2 : 1;
    } else { const three = S.tCourse <= C.course.star3 && S.drops <= 2; S.stars = three ? 3 : 2; }
    award(S.stars);
    line(C.finale, 2.6, 'cast'); player.play('Cheer');
    if (S.level === 3) {                  // the special one: a longer fanfare, two waves of confetti
      fun.sfx.fanfare(); fun.confetti(['🧙‍♂️', '⭐', '🌟', '✨', '💜', '🎉', C.spell.icon], 60);
      setTimeout(() => { if (S.on) { fun.sfx.tada(); fun.confetti(['⭐', '🌟', '✨', '💛', '🎊'], 44); } }, 1000);
      setTimeout(() => { if (S.on) fun.sfx.tune([784, 988, 1175, 1568, 0, 1568], 0.14); }, 1900);
    } else { fun.sfx.tada(); fun.confetti(C.confetti || ['🪶', '⭐', '✨', '🌟', '💜'], 34); }
    at(2.6, showReward);
  }
  function award(stars) {
    const rec = save[S.key] = isObj(save[S.key]) ? save[S.key] : { stars: 0, plays: 0 };   // (a garbage entry is replaced, never written into)
    const next = S.level + 1, wasOpen = unlocked(S.key, next);
    let pts;
    if (S.level > 1) {                    // levels 2-3 live in rec.lv; points scale like level 1's (3 stars = +40 / +50)
      if (!isObj(rec.lv)) rec.lv = {};
      const l = rec.lv[S.level] = isObj(rec.lv[S.level]) ? rec.lv[S.level] : { stars: 0, plays: 0 };
      l.stars = Math.max(starsOf(l.stars), stars); l.plays = (Math.floor(Number(l.plays)) || 0) + 1; persist();
      pts = Math.round(stars * LEVELS[S.level].pts / 3);
    } else {
      rec.stars = Math.max(rec.stars || 0, stars); rec.plays = (rec.plays || 0) + 1; persist();
      pts = stars * 10;
    }
    try { window.HPLessons.progress.bonus(pts); } catch { /* lessons not loaded */ }
    S.result = { stars, pts, t: Math.round(S.tCourse), drops: S.drops, casts: S.casts };
    if (S.level > 1) { S.result.level = S.level; S.result.mistakes = S.mistakes; S.result.opened = next <= 3 && !wasOpen && unlocked(S.key, next) ? next : 0; }
    return pts;
  }
  function showReward() {
    if (!S.on) return;
    const r = S.result, crest = CREST[fun.store.house] || CREST.gryf;
    if (S.level > 1) {                    // levels 2-3: the level's name; level 3 = the special 'expert wizard' screen; a newly opened level is shown
      const L3 = S.level === 3, nx = r.opened ? LEVELS[r.opened] : null;
      endOv.innerHTML = '<div class="p' + (L3 ? ' x3' : '') + '"><div class="tr">' + (L3 ? '🧙‍♂️' : (S.C.icon || S.C.spell.icon)) + '</div><div class="ti">' + (L3 ? 'קוֹסֵם מֻמְחֶה!' : r.stars >= 3 ? 'כָּל הַכָּבוֹד!' : 'יָפֶה מְאֹד!') + '</div>'
        + '<div class="lvn">' + LEVELS[S.level].icon + ' ' + LEVELS[S.level].he + '</div>'
        + '<div class="st">' + '⭐'.repeat(r.stars) + '☆'.repeat(3 - r.stars) + '</div><div class="sc">' + crest + ' <span dir="ltr">+' + r.pts + '</span></div>'
        + (nx ? '<div class="lvn">🔓 ' + nx.icon + ' ' + nx.he + '</div>' : '')
        + '<div class="row"><button class="again">🔁 שׁוּב</button><button class="done">✅ סִיּוּם</button></div></div>';
    } else
    endOv.innerHTML = '<div class="p"><div class="tr">' + (S.C.icon || S.C.spell.icon) + '</div><div class="ti">' + (r.stars >= 3 ? 'כָּל הַכָּבוֹד!' : 'יָפֶה מְאֹד!') + '</div>'
      + '<div class="st">' + '⭐'.repeat(r.stars) + '☆'.repeat(3 - r.stars) + '</div><div class="sc">' + crest + ' <span dir="ltr">+' + r.pts + '</span></div>'
      + '<div class="row"><button class="again">🔁 שׁוּב</button><button class="done">✅ סִיּוּם</button></div></div>';
    endOv.querySelector('.again').addEventListener('click', e => { e.stopPropagation(); again(); });
    endOv.querySelector('.done').addEventListener('click', e => { e.stopPropagation(); leave(true); });
    endOv.classList.add('on'); speak(S.level === 3 ? 'קוֹסֵם מֻמְחֶה! כָּל הַכָּבוֹד!' : r.stars >= 3 ? 'כָּל הַכָּבוֹד! שְׁלוֹשָׁה כּוֹכָבִים!' : 'יָפֶה מְאֹד!');
  }
  function again() {
    if (!S.on) return;
    endOv.classList.remove('on'); S.q.length = 0;
    resetKit(K, false); S.drops = 0; S.casts = 0; S.doneStations = 0; S.praise = 0; S.result = null; S.stars = 0; S.phase = 'course'; S.tCourse = 0;
    S.mistakes = 0; S.miss = 0; S.slips = 0; S.missT = -9;
    startStation(0);
    // straight to station 1 (a little sparkle hop), not the long walk back via the lesson spot
    const st = S.stations[0], p = st.walk[st.walk.length - 1];
    placeHero(p[0], p[1], yawTo(p[0], p[1], st.face[0], st.face[1]));
    burst(p[0], 1.0, p[1], 16); fun.sfx.sparkle();
    arrive();
  }

  // ---- the room dim (Lumos) ----
  // ONE reversible factor d (0 = the room as built, 1 = dimmed) scales what lights the room: tone-mapping
  // exposure a little, the indoor ambient / hemisphere / key sun / IBL a lot, the room's emissives (torch
  // flames, ceiling stars, the night-sky ceiling) and its baked light-pool mesh. The base values are
  // captured once at start and written back EXACTLY by dimRestore() (leave, ✕, room exit, mid-fade too).
  // The course's own lights (spell-* group), the hero and the teacher are never dimmed.
  let DIM = null;
  function dimCapture() {
    if (DIM || !interiors.room) return;
    const mats = [], pools = [], seen = new Set(), skip = new Set();
    if (K) K.group.traverse(o => skip.add(o));
    const f = prof(); if (f) f.traverse(o => skip.add(o));
    interiors.room.group.traverse(o => {
      if (!o.isMesh || skip.has(o)) return;
      for (const m of [].concat(o.material)) {
        if (!m || seen.has(m)) continue; seen.add(m);
        if (o.name === 'lightPools') pools.push([m, m.opacity]);
        else if (m.emissive && m.emissiveIntensity > 0 && (m.emissive.r + m.emissive.g + m.emissive.b) > 0) mats.push([m, m.emissiveIntensity]);
      }
    });
    DIM = { exp: renderer ? renderer.toneMappingExposure : null, envI: scene.environmentIntensity,
      amb: env && env.amb ? env.amb.intensity : null, hemi: env && env.hemi ? env.hemi.intensity : null, sun: env && env.sun ? env.sun.intensity : null, mats, pools };
  }
  function dimApply(d) {
    if (!DIM) return;
    const e = d * d * (3 - 2 * d);
    if (renderer && DIM.exp != null) renderer.toneMappingExposure = DIM.exp * (1 - 0.22 * e);
    if (DIM.envI != null) scene.environmentIntensity = DIM.envI * (1 - 0.75 * e);
    if (DIM.amb != null) env.amb.intensity = DIM.amb * (1 - 0.68 * e);
    if (DIM.hemi != null) env.hemi.intensity = DIM.hemi * (1 - 0.68 * e);
    if (DIM.sun != null) env.sun.intensity = DIM.sun * (1 - 0.6 * e);
    for (const [m, v] of DIM.mats) m.emissiveIntensity = v * (1 - 0.8 * e);
    for (const [m, v] of DIM.pools) m.opacity = v * (1 - 0.85 * e);
  }
  function dimRestore() {
    if (!DIM) return;
    dimApply(0);                             // e = 0: every value is exactly its captured base
    DIM = null; S.dim = 0; S.dimGoal = 0;
  }

  // ---- start / leave ----
  const takeover = { spell: true, update };
  function start(key = 'charms', level = 1) {
    const C = COURSES[key];
    if (!C || S.on || isModal() || isTakeover()) return false;
    if (C.room ? (interiors.active !== C.room || !interiors.room) : !!interiors.active) return false;   // a room course in its room; an outdoor one outside
    level = level === 2 || level === 3 ? level : 1;
    if (level > 1 && !unlocked(key, level)) return false;   // a locked (or not yet built) level cannot start
    S.key = key; S.C = C;
    // level 1: S.stations IS the course's own array (nothing merged, nothing changed)
    S.level = level; S.LV = level > 1 ? C.levels[level] : null;
    S.stations = S.LV ? C.course.stations.map(st => { const o = (S.LV.stations && S.LV.stations[st.id]) || {}; return Object.assign({}, st, o, (innerHeight < 500 && o.phone) || {}); }) : C.course.stations;
    Object.assign(S, { order: null, decoys: [], mistakes: 0, miss: 0, slips: 0, missT: -9, showI: -1, waits: 0, gateT: -9 });
    Object.assign(S, { on: true, speed: 1, phase: null, sub: null, step: 0, casts: 0, drops: 0, stars: 0, clock: 0, tCourse: 0, doneStations: 0, sel: null, hold: false, idle: 0, walk: null, fx: null, praise: 0, result: null,
      raise: 0, raiseK: 0, dim: 0, dimGoal: C.dim ? 1 : 0, handOn: false });
    S.q.length = 0; pipKey = '';
    try { K = buildKit(C, C.room ? interiors.room : null); } catch (e) { console.warn('[spells] course props failed -', e && e.message || e); K = null; S.on = false; return false; }
    setTakeover(takeover);
    document.body.classList.add('inSpell'); promptB.classList.remove('on');
    // things that follow you or roam the room hold still / hide while the course owns the frame
    S.hid = []; for (const n of ['pip', 'trevor', 'peeves']) { const o = scene.getObjectByName(n); if (o && o.visible) { o.visible = false; S.hid.push(o); } }
    player._applyFade && player._applyFade(1);
    if (!C.room && lessons.hold) lessons.hold(C.station, true);   // the station's own little critters (the paddock) step out of the course
    const f0 = prof(); S.profY = f0 ? f0.position.y : 0;   // the chibi teacher hops from here (outdoors: the terrain)
    camPos.copy(camera.position); camera.getWorldDirection(tmp); camLook.copy(camera.position).addScaledVector(tmp, 6);
    fun.sfx.sparkle();
    if (C.dim) dimCapture();
    if (S.level > 1) startTwist(); else startLesson();
    return true;
  }
  function leave(restore, inTeardown = false) {
    if (!S.on) return;
    const C = S.C;
    S.on = false; S.q.length = 0; drag = null; S.hold = false; S.walk = null; S.fx = null; S.handOn = false;
    if (!C.room && lessons.hold) lessons.hold(C.station, false);
    hush(); hideHand(); setBtn(false);
    try { dimRestore(); } catch (e) { console.warn('[spells] dim restore -', e && e.message || e); DIM = null; }
    if (S.hid) { for (const o of S.hid) o.visible = true; S.hid = null; }   // Peeves' visibility is only set on spawn: put back what start() hid
    endOv.classList.remove('on'); sayEl.classList.remove('on');
    document.body.classList.remove('inSpell');
    try { pose(null); } catch { /* lessons gone */ }
    const f = prof(); if (f && f.userData.rig) f.position.y = S.profY || 0;
    disposeKit(inTeardown);
    setTakeover(null);
    if (restore && (interiors.active || null) === C.room) {
      const st = lessons.stations && lessons.stations[C.station];
      if (st && C.room) { player.yaw = Math.PI; player.teleport(st.x + worldOff.x, st.z + 3.1 + worldOff.z); player.pos.y = worldOff.y; player.smoothY = worldOff.y; }
      else if (st) { player.yaw = Math.PI; player.teleport(st.x, st.z + (C.back || 3.2)); if (player.cam && player.cam.reset) player.cam.reset(player.yaw); }   // outdoors: where the 🔔 drops you (lessons.go)
    }
  }
  function quit() {
    if (!S.on) return false;
    // left early after at least two stations: still a star (forgiving)
    if (S.level === 1 && S.phase === 'course' && S.doneStations >= 2 && !S.result) { const pts = award(1); fun.toast('⭐', '+' + pts, 1800); }   // (levels 2-3: stars only for a finish)
    leave(true);
    return true;
  }

  // level 3: the ring of beads round the window centre of the lift in hand (or the only / hinted one), square to the
  // camera; beads light up round it as it is held inside, all bright when it is done
  const _rx = new Vector3(), _ry = new Vector3();
  function tickRing(t) {
    const B = K.beads; if (!B) return null;
    let L = null, G = null;
    if (S.sub === 'cast' && S.lifts) {
      const nx = nextL(), shown = (x) => x && (hintOK() || (!S.order && S.lifts.length === 1));
      if (S.sel && !S.sel.done && S.sel.ring) L = S.sel;
      else if (nx && nx.ring && shown(nx)) L = nx;
      else if (S.sel && !S.sel.done && S.sel.gate) G = S.sel;
      else if (nx && nx.gate && shown(nx)) G = nx;
    }
    if (G) { tickClock(B, G, t); return G; }
    if (!L) { if (B.visible) { B.visible = false; } return null; }
    B.visible = true;
    const R = L.ring, sv = L.p; L.p = R.uc; liftWorld(L, tmp); L.p = sv; tmp.sub(worldOff);
    _rx.set(1, 0, 0).applyQuaternion(camera.quaternion); _ry.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const n = 16, lit = Math.round(R.fill * n), pulse = R.inside ? 1.25 + Math.sin(t * 14) * 0.12 : 1;
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 - i / n * Math.PI * 2, r = R.R * (R.inside ? 1 + Math.sin(t * 10) * 0.03 : 1);
      _v.copy(tmp).addScaledVector(_rx, Math.cos(a) * r).addScaledVector(_ry, Math.sin(a) * r);
      _m4.compose(_v, camera.quaternion, _s.setScalar((i < lit || R.ok ? 1.35 : 1) * pulse));
      B.setMatrixAt(i, _m4);
      if (R.ok || i < lit) B.setColorAt(i, _c.setRGB(1.6, 1.25, 0.45)); else B.setColorAt(i, _c.setRGB(0.75, 0.8, 1.0).multiplyScalar(0.7 + 0.25 * Math.sin(t * 4 + i * 0.4)));
    }
    B.instanceMatrix.needsUpdate = true; if (B.instanceColor) B.instanceColor.needsUpdate = true;
  }

  // levels 2-3: a timing gate's clock, the same 16 beads round the thing: while it waits they fill one by one in amber (the
  // last ones as the ticks play); ready = all green and bigger, going out one by one as the window runs out
  function tickClock(B, L, t) {
    B.visible = true;
    const G = L.gate, u = gateU(L), open = u < G.open || L.p > 0.02, n = 16;
    const lit = open ? Math.ceil((L.p > 0.02 ? 1 : 1 - u / G.open) * n) : Math.floor((u - G.open) / (G.period - G.open) * n);
    liftWorld(L, tmp).sub(worldOff);
    _rx.set(1, 0, 0).applyQuaternion(camera.quaternion); _ry.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const r = G.R * (open ? 1.08 + Math.sin(t * 9) * 0.03 : 1);
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 - i / n * Math.PI * 2;
      _v.copy(tmp).addScaledVector(_rx, Math.cos(a) * r).addScaledVector(_ry, Math.sin(a) * r);
      _m4.compose(_v, camera.quaternion, _s.setScalar(open ? (i < lit ? 1.5 : 0.9) : (i < lit ? 1.2 : 0.9)));
      B.setMatrixAt(i, _m4);
      if (open) B.setColorAt(i, i < lit ? _c.setRGB(0.45, 1.75, 0.55) : _c.setRGB(0.2, 0.55, 0.25));
      else B.setColorAt(i, i < lit ? _c.setRGB(1.5, 0.95, 0.3) : _c.setRGB(0.55, 0.55, 0.7));
    }
    B.instanceMatrix.needsUpdate = true; if (B.instanceColor) B.instanceColor.needsUpdate = true;
  }

  // ---- per frame (main.js takeover slot) ----
  function hideHand() { hand.classList.remove('on'); }
  function update(dt) {
    if (!S.on) return;
    if (!K || (interiors.active || null) !== S.C.room || !K.group.parent) { leave(false); return; }
    if (K.outdoor && Math.hypot(player.pos.x - worldOff.x, player.pos.z - worldOff.z) > 60) { leave(false); return; }   // moved far away (a teleport)
    dt *= S.speed;                         // 1 in play; tests on a slow software renderer may raise it
    S.clock += dt; const t = S.clock;
    if (S.phase === 'course' && S.sub !== 'reward') S.tCourse += dt;
    runQueue(); if (!S.on) return;
    if (DIM) {                              // the room dim eases toward the goal the course sets (DIM_T s end to end)
      const g = S.phase === 'reward' ? 0 : S.dimGoal, st = dt / DIM_T;
      S.dim = S.dim < g ? Math.min(g, S.dim + st) : Math.max(g, S.dim - st);
      dimApply(S.dim);
    }
    if (S.sayT > 0) { S.sayT -= dt; if (S.sayT <= 0) sayEl.classList.remove('on'); }

    // hero: auto-walk between stations, else turn to the work
    let moving = false;
    if (S.walk) {
      const w = S.walk, p = w.pts[w.i], tx = p[0] + worldOff.x, tz = p[1] + worldOff.z, dx = tx - player.pos.x, dz = tz - player.pos.z, d = Math.hypot(dx, dz), step = WALK * dt;
      if (d <= step) { player.pos.x = tx; player.pos.z = tz; if (++w.i >= w.pts.length) arrive(); }
      else { player.pos.x += dx / d * step; player.pos.z += dz / d * step; S.wantYaw = Math.atan2(dx, dz); moving = true; }
    }
    let dy = S.wantYaw - player.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); player.yaw += dy * Math.min(1, dt * (moving ? 10 : 5));
    player._moving = moving;
    if (K.outdoor) { player.pos.y = player.heightAt(player.pos.x, player.pos.z); player.smoothY = player.pos.y; }   // outdoors the walk follows the terrain
    player.animate(dt, { moving, running: false }, moving ? WALK : 0);
    player.model.position.copy(player.pos); player.model.rotation.y = player.yaw;
    player._lastPos.copy(player.pos);

    // the teacher turns to the child; GLB clips keep playing (lessons.anim), the chibi breathes
    const f = prof();
    if (f) {
      const ud = f.userData;
      if (!ud.casting) { f.getWorldPosition(tmp); let fy = Math.atan2(player.pos.x - tmp.x, player.pos.z - tmp.z) - f.rotation.y; fy = Math.atan2(Math.sin(fy), Math.cos(fy)); f.rotation.y += fy * Math.min(1, dt * 3); }
      if (ud.rig) { animateChibi(ud.rig, dt, { moving: false }); if (hopT > 0) { hopT -= dt; f.position.y = S.profY + Math.sin((1 - hopT / 0.6) * Math.PI) * 0.35; } else f.position.y = S.profY; }
      // Lumos: the chibi teacher raises her wand arm high while she casts (eased up and down)
      if (S.raise > 0) S.raise -= dt;
      S.raiseK += ((S.raise > 0 ? 1 : 0) - S.raiseK) * Math.min(1, dt * 6);
      if (ud.rig && S.raiseK > 0.01) ud.rig.armR.rotation.x += (-2.6 - ud.rig.armR.rotation.x) * S.raiseK;
    }
    if (lessons.anim) lessons.anim(dt);

    // lifts
    if (S.hold) S.holdT += dt;
    if (S.sub === 'cast') {
      S.idle += dt;
      if (S.level === 1 && S.hold && (!S.sel || S.sel.done)) { const nx = open(); if (nx) { S.sel = nx; S.holdT = 0.25; setPips(); } }   // finger still down: carry on with the next object
      if (S.hold && S.sel && !S.sel.done && S.holdT >= 0.25) { nudge(S.sel, S.sel.p + dt / (S.sel.light ? LIGHT_HOLD : S.sel.change ? CHANGE_HOLD : S.sel.grow ? GROW_HOLD : HOLD)); if (S.sel.p >= SNAP) snapLift(S.sel); }
    }
    for (let s = -1; s < K.stations.length; s++) {
      const set = s < 0 ? K.lesson : K.stations[s];
      for (let j = 0; j < set.length; j++) {
        const L = set[j];
        if (L.done && L.popT >= 0 && L.popT < POP) L.popT += dt;
        if (L.flash > 0) L.flash -= dt; if (L.shake > 0) L.shake -= dt;
        if (!L.done && L.snap >= 0) { L.snap += dt; L.p = Math.min(1, L.p + dt * 2.4); if (L.p >= 1 || L.snap > 0.4) { liftDone(L); if (!S.on) return; continue; } }
        else if (L.ring && !L.done && S.lifts === set && ringStep(L, dt)) { /* level 3: gliding home or slipping back down */ }
        else if (!L.done && L.p > 0 && !(drag && S.sel === L) && !(S.hold && S.sel === L)) {
          if (L.p >= SNAP && !L.ring) snapLift(L);
          else { L.hover -= dt; if (L.hover <= 0) { L.p -= dt * L.fall; if (L.p <= 0) { L.p = 0; if (L.peak >= 0.3 && !L.light && !L.change && !L.grow) drop(L); else L.peak = 0; L.moved = false; } } }
        }
        // rings light as the feather passes them (and stay lit)
        for (const r of L.rings) if (!r.mv.lit && L.p >= r.u) { r.mv.lit = true; r.mv.color(0xffe07a); fun.sfx.tink(3); }
        poseLift(L, t);
      }
    }
    if (S.level > 1) for (const D of S.decoys) { if (D.shake > 0) D.shake -= dt; poseDecoy(D, t); }
    K.B.tick(K.movers, t, S, K, dt);
    if (S.fx) { S.fxT += dt; if (!S.fx(K.movers, S.fxT)) S.fx = null; }

    // glow, outline, ghost hand
    const pulse = 0.3 + Math.sin(t * 5) * 0.15;   // gentle: at 0.9 the red book and coloured blocks washed out to white
    for (const m of K.glowMats) m.emissiveIntensity = 0;
    const cur = S.level > 1 ? (S.sub === 'cast' ? (S.sel && !S.sel.done ? S.sel : hintOK() ? nextL() : null) : null)   // levels 2-3: outline / hand only for the touched one, or once hints are back
      : S.sub === 'cast' ? (S.sel && !S.sel.done ? S.sel : open()) : null;
    if (S.sub === 'cast' && S.lifts) for (const L of S.lifts) if (!L.done && L.mv.glows) L.mv.mat.emissiveIntensity = pulse;
    if (S.level > 1) {                    // the decoys glow like the real things (the glow must not give the answer away); the order preview flashes
      if (S.sub === 'cast') for (const D of S.decoys) if (D.mv.glows) D.mv.mat.emissiveIntensity = pulse * 0.6;   // (the same pulse; dark iron reads cream at full strength)
      if (S.lifts) for (const L of S.lifts) if (L.flash > 0 && L.mv.glows && !L.mv.mesh.isInstancedMesh) L.mv.mat.emissiveIntensity = 1.1;
      const gl = tickRing(t);              // (returns the gated thing whose clock is shown, if any)
      tickGates(dt, gl);
      if (S.sub === 'cast' && S.lifts) for (const L of S.lifts) {   // a gated thing glows green while ready, its own soft glow while waiting
        if (!L.gate || L.done || !L.mv.glows || !L.mv.mat.emissive || L.mv.mesh.isInstancedMesh) continue;   // (an instanced thing shares its material: its clock / course look shows it)
        const on = gateOpen(L) || L.p > 0.02;
        L.mv.mat.emissive.setHex(on ? GATE_GREEN : L.gate.hex0); L.mv.mat.emissiveIntensity = on ? 0.6 + Math.sin(t * 9) * 0.15 : pulse * 0.5;
      }
    }
    if (K.ghosts.length) {
      // Vera Verto: the glowing silhouette of each open thing's after shape floats above it (no outline box)
      let gi = 0;
      if (S.sub === 'cast' && S.lifts) for (const L of S.lifts) {
        if (gi >= K.ghosts.length) break;
        if (L.done || !L.to) continue;
        const g = K.ghosts[gi++], a = L.arr, r1 = L.rot1; if (g.geometry !== L.to.geo) g.geometry = L.to.geo;
        g.position.set(a[0], a[1] + (L.spec.hint ?? 0.8) + Math.sin(t * 2 + L.ph) * 0.04, a[2]); g.rotation.set(r1[0], r1[1] + Math.sin(t * 0.9 + L.ph) * 0.35, r1[2]);
        g.scale.setScalar(L.to.scale * (L.spec.hs || 1) * (1 + 0.04 * Math.sin(t * 4)) * (1 - 0.35 * L.p)); g.visible = true;
      }
      for (; gi < K.ghosts.length; gi++) K.ghosts[gi].visible = false;
      K.ghostMat.opacity = 0.42 + Math.sin(t * 4) * 0.16; K.ghost.visible = false;
    } else if (cur && cur.grow) {          // Herbivicus: the full-grown plant glows faintly where the seedling stands (fading as it grows)
      const g = K.ghost, src = cur.to || cur.mv; if (g.geometry !== src.geo) g.geometry = src.geo;
      const a = cur.arr, r1 = cur.rot1;
      g.position.set(a[0], a[1], a[2]); g.rotation.set(r1[0], r1[1], r1[2]); g.scale.setScalar(src.scale * 1.03);
      K.ghostMat.opacity = (0.24 + Math.sin(t * 4) * 0.09) * (1 - 0.6 * cur.p); g.visible = true;
    } else if (cur && !cur.brew && !cur.pet) {   // (a cauldron needs no outline: its colour shows the progress; a creature neither)
      const g = K.ghost; if (g.geometry !== cur.mv.geo) g.geometry = cur.mv.geo;
      const a = cur.arr, n = (cur.N - 1) * 3, r1 = cur.rot1;
      g.position.set(a[n], a[n + 1], a[n + 2]); g.rotation.set(r1[0], r1[1], r1[2]); g.scale.setScalar(cur.mv.scale * (cur.light ? 1.7 : 1.06));
      K.ghostMat.opacity = 0.42 + Math.sin(t * 4) * 0.16; g.visible = true;
    } else K.ghost.visible = false;
    if (S.handOn) {                       // a teacher's demo: the ghost hand strokes where the course says (kit.hand)
      tmp.copy(handAt).add(worldOff).project(camera);
      hand.style.left = ((tmp.x * 0.5 + 0.5) * innerWidth) + 'px'; hand.style.top = ((-tmp.y * 0.5 + 0.5) * innerHeight) + 'px';
      if (!hand.classList.contains('on')) { hand.classList.remove('push', 'tap'); hand.classList.add('stir', 'on'); }
    } else if (cur && S.idle > (S.level > 1 ? 2.5 : HINT_AFTER) && cur.p < 0.05) {
      liftWorld(cur, tmp).project(camera);
      hand.style.left = ((tmp.x * 0.5 + 0.5) * innerWidth) + 'px'; hand.style.top = ((-tmp.y * 0.5 + 0.5) * innerHeight) + 'px';
      if (!hand.classList.contains('on')) {
        const sd = dirOf(cur), pushy = !!cur.push;
        hand.classList.toggle('push', pushy); hand.classList.toggle('tap', !!cur.light); hand.classList.toggle('stir', !!cur.change);
        if (pushy) { hand.style.setProperty('--dx', sd.x.toFixed(2)); hand.style.setProperty('--dy', sd.y.toFixed(2)); }
        hand.classList.add('on');
      }
    } else if (hand.classList.contains('on')) hideHand();
    tickSparks(dt, t);

    // a gentle camera: eased toward the station's framing, never a cut, never a shake
    const kc = 1 - Math.exp(-dt * 1.8);
    camPos.lerp(camPosGoal, kc); camLook.lerp(camLookGoal, kc);
    camera.position.copy(camPos); camera.lookAt(camLook);
  }

  // ---- outside the course: the 🪄 challenge prompt next to the lesson ▶ ----
  // (the 🪄 prompt: level 1 with its lesson as always, unless a higher level is open: then the level choice)
  promptB.addEventListener('click', e => { e.stopPropagation(); fun.sfx.squeak(); const k = promptB.dataset.k; if (!k) return; if (unlocked(k, 2)) openLevels(k, 'prompt'); else start(k); });

  // ---- the level choice: three big buttons (icon, name, stars or a lock) + back ----
  const lvOv = el('div', 'spLv');
  lvOv.addEventListener('pointerdown', ev => { if (ev.target === lvOv) { ev.stopPropagation(); closeLevels(); } });   // a tap beside the panel closes it
  let lvFrom = null;
  function lvSetModal(v) { try { if (window.__game && window.__game.setModal) window.__game.setModal(v); } catch { /* ignore */ } }
  function openLevels(key, from) {
    const C = COURSES[key]; if (!C || S.on) return false;
    lvFrom = from;
    let html = '<div class="p"><div class="t">' + (C.icon || C.spell.icon) + ' ' + C.name + '</div><div class="row">';
    for (let n = 1; n <= 3; n++) {
      const L = LEVELS[n], open = unlocked(key, n), st = lvStars(key, n);
      html += '<button type="button" class="lv l' + n + (open ? '' : ' lock') + '" data-lv="' + n + '">'
        + '<div class="i">' + (open ? L.icon : '🔒') + '</div><div class="n">' + L.he + '</div>'
        + (open ? '<div class="s">' + '⭐'.repeat(st) + '☆'.repeat(3 - st) + '</div>' : '<div class="k">' + (hasLevel(key, n) ? 'נַצֵּחַ בַּשָּׁלָב הַקּוֹדֵם' : 'בְּקָרוֹב...') + '</div>') + '</button>';
    }
    html += '</div><button type="button" class="back">↩️ חֲזָרָה</button></div>';
    lvOv.innerHTML = html;
    lvOv.querySelectorAll('.lv').forEach(b => b.addEventListener('click', ev => {
      ev.stopPropagation(); const n = +b.dataset.lv;
      if (!unlocked(key, n)) { fun.sfx.soft(); b.classList.remove('no'); void b.offsetWidth; b.classList.add('no'); return; }
      fun.sfx.squeak(); closeLevels();
      if (lvFrom === 'prompt') start(key, n);
      else (async () => { await lessons.go(C.station); setTimeout(() => start(key, n), 500); })();
    }));
    lvOv.querySelector('.back').addEventListener('click', ev => {
      ev.stopPropagation(); const from = lvFrom; closeLevels(); fun.sfx.pop();
      if (from === 'picker') setTimeout(() => {   // back to the 🏆 chooser (the 🔔 picker, then its challenges card)
        const bell = document.getElementById('bellBtn'); if (!bell || (window.__game && window.__game.modal)) return;
        bell.click(); const all = document.querySelector('#pickOv .spCard[data-sp="all"]'); if (all) all.click();
      }, 60);
    });
    lvOv.classList.add('on'); lvSetModal(true); fun.sfx.flip();
    return true;
  }
  function closeLevels() { if (!lvOv.classList.contains('on')) return; lvOv.classList.remove('on'); lvSetModal(false); }
  let promptOn = false;
  function idle() {
    let k = null;
    if (!S.on && !isModal() && !isTakeover()) {   // (outdoors too: a course with room null by its outdoor station)
      const near = lessons.near && lessons.near(), here = interiors.active || null;
      if (near && fun.promptId() === 'lesson:' + near) for (const key in COURSES) if (COURSES[key].station === near && COURSES[key].room === here) { k = key; break; }
    }
    if (!!k !== promptOn || (k && promptB.dataset.k !== k)) { promptOn = !!k; promptB.classList.toggle('on', promptOn); if (k) promptB.dataset.k = k; }
  }

  // ---- the 🔔 picker card ----
  function pickerCard(key) {
    const C = COURSES[key];
    return {
      key, icon: C.icon || C.spell.icon, name: C.name, best: () => best(key),
      // levels: three pips (won = gold, open = a ring, locked = 🔒; not built yet = a faint lock), stars of all levels out of 9
      max: 9, got: () => lvStars(key, 1) + lvStars(key, 2) + lvStars(key, 3),
      pips: () => { let h = '<div class="spLvp">'; for (let n = 1; n <= 3; n++) h += unlocked(key, n) ? '<i class="' + (won(key, n) ? 'won' : '') + '">★</i>' : '<i class="lk' + (hasLevel(key, n) ? '' : ' soon') + '">🔒</i>'; return h + '</div>'; },
      fn: async () => {
        if (S.on) return;
        if (hasLevel(key, 2)) { openLevels(key, 'picker'); return; }   // a course with levels: the level choice first
        await lessons.go(C.station);
        setTimeout(() => start(key), 500);
      },
    };
  }

  // test hooks answer only with ?debug=1 or when a test sets window.__game.test = true
  const testOK = () => /[?&]debug=1/.test(location.search) || !!(window.__game && window.__game.test === true);
  const api = {
    courses: COURSES, start, quit, idle, pickerCard, best, openLevels, closeLevels,
    levelStars: (key, lv) => lvStars(key, lv), unlocked: (key, lv) => unlocked(key, lv), hasLevel: (key, lv) => hasLevel(key, lv),
    state() {
      return { on: S.on, key: S.key, phase: S.on ? S.phase : null, sub: S.on ? S.sub : null, step: S.step, casts: S.casts, drops: S.drops, stars: S.stars,
        best: S.key ? best(S.key) : 0, t: Math.round(S.tCourse * 10) / 10, doneStations: S.doneStations, result: S.result,
        lifts: S.lifts ? S.lifts.map(L => ({ p: Math.round(L.p * 100) / 100, done: L.done })) : null, prompt: promptOn,
        dim: Math.round(S.dim * 1000) / 1000, dimmed: !!DIM, raise: S.raise > 0,
        // levels
        level: S.on ? S.level : null, mistakes: S.mistakes, miss: S.miss, slips: S.slips, hint: S.on ? hintOK() : false, showing: S.showI,
        order: S.on && S.order ? S.order.map(L => S.lifts.indexOf(L)) : null, next: S.on && S.lifts && nextL() ? S.lifts.indexOf(nextL()) : -1,
        decoys: S.on ? S.decoys.length : 0, btn: spB.classList.contains('on'), choice: lvOv.classList.contains('on'),
        ring: S.on && S.lifts ? S.lifts.map(L => L.ring ? { uc: L.ring.uc, fill: Math.round(L.ring.fill * 100) / 100, ok: L.ring.ok, inside: L.ring.inside, slip: L.slip } : null) : null,
        gate: S.on && S.lifts ? S.lifts.map(L => L.gate ? { open: gateOpen(L), u: Math.round(gateU(L) * 100) / 100, k: Math.round(L.gateK * 100) / 100, period: L.gate.period, win: L.gate.open } : null) : null,
        waits: S.waits };
    },
    // test hooks
    _cast() {
      if (!testOK()) return false;
      if (!S.on || S.phase === 'reward') return false;
      if (S.sub === 'walk' && S.walk) { const w = S.walk, p = w.pts[w.pts.length - 1]; player.pos.x = p[0] + worldOff.x; player.pos.z = p[1] + worldOff.z; arrive(); }
      flushUntil(() => S.sub === 'cast');
      const L = S.level > 1 ? nextL() : (S.sel && !S.sel.done) ? S.sel : open(); if (!L) return false;
      L.moved = true; liftDone(L); return true;
    },
    _drop() {
      if (!testOK()) return false;
      if (!S.on || S.sub !== 'cast') return false;
      const L = (S.sel && !S.sel.done) ? S.sel : open(); if (!L) return false;
      L.p = 0; drop(L); return true;
    },
    _skipTo(step) {
      if (!testOK()) return false;
      if (!S.on || !K) return false;
      S.q.length = 0; endOv.classList.remove('on');
      for (const L of K.lesson) if (!L.done) { L.done = true; L.p = 1; L.popT = POP; }
      for (const b of S.C.lesson.intro) if (b.fx && K.B.effects[b.fx]) K.B.effects[b.fx](K.movers, 99, true);
      const n = S.stations.length;
      for (let i = 0; i < Math.min(step, n); i++) { const fx = S.stations[i].after && K.B.effects[S.stations[i].after]; if (fx) fx(K.movers, 99, true); }
      for (let i = 0; i < Math.min(step, n); i++) for (const L of K.stations[i]) { L.done = true; L.p = 1; L.popT = POP; for (const r of L.rings) { r.mv.lit = true; r.mv.color(0xffe07a); } }
      if (S.phase !== 'course') { S.phase = 'course'; S.tCourse = 0; }
      S.doneStations = Math.min(step, n);
      if (step >= n) { finish(); return true; }
      startStation(step); return true;
    },
    _flush() { if (testOK()) flushUntil(() => false); },
    _speed(k) { if (!testOK()) return 1; S.speed = Math.max(0.1, Math.min(8, +k || 1)); return S.speed; },   // reset to 1 on every start()
    _target() {                            // screen point of the thing to lift now (for real-touch tests)
      if (!testOK() || !S.on || !S.lifts) return null;
      const L = S.level > 1 ? nextL() : (S.sel && !S.sel.done) ? S.sel : open(); if (!L) return null;
      const sd = dirOf(L);
      liftWorld(L, tmp).project(camera);
      return { x: (tmp.x * 0.5 + 0.5) * innerWidth, y: (-tmp.y * 0.5 + 0.5) * innerHeight, p: L.p, dx: sd.x, dy: sd.y };
    },
    get _kit() { return testOK() ? K : null; },
    _targets() {                           // screen points of every open thing and decoy of the station (levels tests)
      if (!testOK() || !S.on || !S.lifts) return null;
      const scr = (v) => { v.project(camera); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, front: v.z <= 1 }; };
      const out = S.lifts.map((L, i) => ({ kind: 'lift', i, done: L.done, next: L === nextL(), ...scr(liftWorld(L, tmp)) }));
      S.decoys.forEach((D, i) => { const a = D.spec.at; out.push({ kind: 'decoy', i, m: D.spec.m, ...scr(tmp.set(a[0], a[1] + (D.spec.aimY || 0), a[2]).add(worldOff)) }); });
      return out;
    },
    _unlock(key, level) {                  // test only: open a level without playing (the level below it counts as won)
      if (!testOK() || !COURSES[key]) return false;
      const r = save[key] = isObj(save[key]) ? save[key] : { stars: 0, plays: 0 };
      if (level >= 2) r.stars = Math.max(starsOf(r.stars), 2);
      if (level >= 3) { if (!isObj(r.lv)) r.lv = {}; const l = r.lv[2] = isObj(r.lv[2]) ? r.lv[2] : { stars: 0, plays: 0 }; l.stars = Math.max(starsOf(l.stars), 1); }
      persist(); return unlocked(key, level);
    },
    _reload() { if (!testOK()) return false; try { save = JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { save = {}; } if (!isObj(save)) save = {}; return true; },
  };
  fun.mods.spells = api;
  return api;
}
