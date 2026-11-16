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
//   verbs          a course's `verb` picks the gesture: 'lift' (Charms) or 'push' (Defence). A push
//                  swipes along the thing's path as seen on screen (away from the hero), the ghost
//                  hand shows that direction; hold / tap / quick flick work the same for both.
//   the gesture    Wingardium Leviosa = "swish and flick": touch a glowing thing (or the big
//                  🪄 button) and swipe UP; or hold the 🪄 button; or tap it a few times. The
//                  thing rises along a path to a glowing outline and snaps when close. Let go
//                  too early and it hovers, then floats gently back down beside you: no fail.
//   reward         1-3 stars, house points through HPLessons.progress.bonus (the same pool the
//                  Entrance Hall hourglasses show), best stars saved in localStorage hpSpells1.
//
// Budget: everything a course draws is ~11 draw calls (one merged vertex-coloured static mesh,
// instanced feathers / blocks / rings, a handful of single movers, one outline, one sparkle
// instanced quad set with a 32 px canvas texture), built on start and disposed on leave or room exit.
// No per-frame allocations in update(): temp vectors and pre-sampled paths only.
import {
  Group, Mesh, InstancedMesh, BoxGeometry, CylinderGeometry, SphereGeometry, TorusGeometry, ConeGeometry, ShapeGeometry, Shape, PlaneGeometry,
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
const HINT_AFTER = 4;                     // seconds of no input before the ghost hand shows
const WALK = 2.2;                         // auto-walk speed between stations (m/s)
const CREST = { gryf: '🦁', slyt: '🐍', rave: '🦅', huff: '🦡' };

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
const bulbLift = (i) => ({ m: 'bulb' + i, path: [ASTRO.bulbs[i].slice(0, 3)] });

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
          walk: [[3.0, -0.6], [0, 1.6]], face: [0, -4],
          cam: { pos: [0, 1.7, 4.6], look: [0, 8.0, -4.2] },
          lifts: [10, 11, 12, 13, 14].map(bulbLift), after: 'catShine', afterT: 2.6, afterSfx: 'none' },
        { id: 'telescope', icon: '🔭', say: 'הַדְלֵק אֶת הַמְּנוֹרָה הַגְּדוֹלָה!',
          walk: [[2.2, 0.2], [3.4, -1.2]], face: [6.0, -3.2],
          cam: { pos: [0.8, 2.3, 0.9], look: [5.4, 1.9, -3.6] },
          afterCam: { pos: [0.6, 1.8, 4.4], look: [0.8, 8.6, -3.8] },
          lifts: [bulbLift(15)], after: 'skyFill', afterT: 4.2, afterSfx: 'tada', afterConfetti: ['🌟', '⭐', '✨', '🔭'] },
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
  for (const [y, gap] of [[0.745, false], [1.405, true]]) {
    for (let z = SZ - 0.68; z < SZ + 0.66;) {
      const t = 0.07 + ((k * 37) % 5) * 0.012, h = 0.26 + ((k * 53) % 4) * 0.03;
      if (gap && z + t > SZ - 0.13 && z < SZ + 0.13) { z = SZ + 0.13; continue; }
      solid(paint(place(new BoxGeometry(0.24, h, t), SX + 0.03, y + h / 2, z + t / 2), BOOKS[k % BOOKS.length])); z += t + 0.006; k++;
    }
  }
  kit.mesh('book', merge([paint(new BoxGeometry(0.26, 0.34, 0.14), 0xb3262a), paint(place(new BoxGeometry(0.24, 0.32, 0.144), 0.016), 0xf0e4c0), paint(place(new BoxGeometry(0.02, 0.35, 0.15), -0.12), 0xd8a940)]), { glowHex: 0xff6a5a });
  // 2 a toy bridge with three holes; the owl waits on the west tower
  for (const x of [-13.2, -10.4]) solid(paint(place(new BoxGeometry(0.5, 1.0, 0.62), x, 0.5, 4.3), STONE, STONE2));
  for (const dz of [-0.27, 0.27]) solid(paint(place(new BoxGeometry(2.3, 0.05, 0.05), -11.8, 0.975, 4.3 + dz), DARK));
  for (const [x0, x1] of [[-12.95, -12.61], [-12.19, -12.01], [-11.59, -11.41], [-10.99, -10.65]]) solid(paint(place(new BoxGeometry(x1 - x0, 0.1, 0.5), (x0 + x1) / 2, 0.95, 4.3), 0x8a6a40));
  kit.inst('block', paint(new BoxGeometry(0.4, 0.4, 0.5), 0xffffff, 0xd8d0c0), 3, [0xe8473a, 0x3a7ae8, 0xf2c230], { glowHex: 0xffd27a });
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

  const owlA = [-13.2, 1.0, 4.3], owlB = [-10.4, 1.0, 4.3];
  return {
    reset(M) {
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
  for (const z of [3.55, 5.25]) solid(paint(place(new BoxGeometry(1.2, 0.5, 0.6), 9.0, 0.25, z), 0x9a7030, 0xc89a48));
  for (let z = 3.3; z <= 5.71; z += 0.8) solid(paint(place(new BoxGeometry(0.1, 0.6, 0.1), 6.45, 0.3, z), DARK));
  solid(paint(place(new BoxGeometry(0.06, 0.08, 2.4), 6.45, 0.45, 4.5), WOOD));
  kit.inst('barrel', merge([paint(place(new CylinderGeometry(0.3, 0.3, 0.62, 14), 0, 0, 0, Math.PI / 2), 0xffffff, 0xd8d0c0, 'z'),
    paint(place(new CylinderGeometry(0.255, 0.255, 0.63, 14), 0, 0, 0, Math.PI / 2), 0x8a5a2e),
    ...[-0.2, 0.2].map(z => paint(place(new TorusGeometry(0.3, 0.018, 4, 18), 0, 0, z), 0x2e2b30))]), 3, [0xa8743e, 0x9a6a36, 0xb07c40], { glowHex: 0xffc070 });
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
    },
    // once the row has fallen the first book (a lift: the runner re-poses it every frame) rests too
    tick(M) { if (fell >= 6) M.domino0.pose(DX(0), 0, 7.6, 0, 0, -REST[0]); },
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
  const BL = ASTRO.bulbs, NB = BL.length, WAND = 16, ORB = 17, PROF = 18, TELE = 15;
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
  for (let i = 3; i < 6; i++) {
    const [x, y, z] = BL[i];
    solid(paint(place(new BoxGeometry(0.26, 0.05, 0.05), x - 0.11, y - 0.2, z), DARK));
    solid(paint(place(new CylinderGeometry(0.13, 0.06, 0.12, 10, 1, true), x, y - 0.13, z), BRASS, GOLD));
    solid(paint(place(new CylinderGeometry(0.06, 0.06, 0.02, 10), x, y - 0.19, z), BRASS));
  }
  // 2 three star lamps on brass posts along the north wall
  for (let i = 6; i < 9; i++) {
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
  const NPOOL = Q.length;
  for (let i = 0; i < NB; i++) Q.push({ b: i, k: 'halo', p: [0, 0, 0], r: i >= 10 && i < 15 ? 0.75 : i === TELE ? 1.5 : i >= WAND ? (i === ORB ? 0.75 : 0.42) : 0.42, a: 1, c: i >= 10 && i < 15 ? COOL : WARM });
  const RIM = Q.length; Q.push({ b: -3, k: 'halo', p: [0, 0, 0], r: 1.25, a: 1, c: COOL });            // moonlight behind the hero (a rim round his silhouette)
  const HPOOL = Q.length; Q.push({ b: -3, k: 'floor', p: [0, 0.03, 0], r: 1.3, a: 1, c: WARM });          // the wand's pool at his feet
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
    reset() {
      pathK = 0; flare = 0; awake = 0; keyK = 0; faceK = 0; skyK = 0; orbT = -1; orbCool = 0; pb = 0; hooted = 0; lastP.clear();
      poseOwl(0, 0); poseKey(0, 0);
      for (const s of segs) s.k = 0;
    },
    tick(M, t, st, K, dt = 0.016) {
      if (!K) return;
      const { player, camera, worldOff } = ctx;
      if (!liftOf) { liftOf = new Array(NB).fill(null); for (const L of [...K.lesson, ...K.stations.flat()]) { L.bi = Number(L.mv.name.slice(4)); liftOf[L.bi] = L; } }
      // levels: a done thing is fully lit; the one being lit follows its p
      let rising = null, done = 0;
      for (let i = 0; i <= TELE; i++) {
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
      for (let i = 0; i <= TELE; i++) {
        const L = liftOf[i], b = BL[i], l = lev[i], star = i >= 10 && i < 15;
        const open = L && !L.done && st.sub === 'cast' && st.lifts && st.lifts.includes(L) && (!L.inOrder || L === cur);
        const tw = open ? 0.3 + 0.22 * Math.sin(t * 6 + i) : 0;
        const k = 0.5 + 2.6 * l + (i >= 6 && i < 9 ? flare : 0) + (i === TELE ? skyK * 1.5 : 0);
        const base = star ? 0.25 : 0.2, cr = star ? 0.85 : 1, cg = star ? 0.9 : 0.8, cb = star ? 1 : 0.46;
        if (l > 0.02) setBulb(i, b[0], b[1], b[2], 1 + 0.12 * l + (star ? Math.sin(t * 3 + i) * 0.06 * l : 0), cr * k, cg * k, cb * k);
        else setBulb(i, b[0], b[1], b[2], 1 + tw * 0.25, base + tw * cr, base * 0.85 + tw * cg, base * 0.6 + tw * cb * 0.7);
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
        else {
          a = q.b === WAND ? wandK * 0.8 : q.b === ORB ? orbL * 0.9 : q.b === PROF ? profK : lev[q.b] * 0.55 + (q.b === TELE ? skyK * 0.4 : 0);
          const open = liftOf[q.b] && !liftOf[q.b].done && cur && (cur === liftOf[q.b] || (!cur.inOrder && st.lifts.includes(liftOf[q.b])));
          if (open && lev[q.b] < 0.3) a += 0.18 + 0.12 * Math.sin(t * 6 + q.b);   // the unlit target twinkles
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
        if (!quiet && t < 0.05 && !hooted) { hooted = 1; fun.sfx.tune([1047, 1319, 1568, 2093], 0.12, 'sine'); for (let i = 6; i < 9; i++) kit.burst(BL[i][0], BL[i][1], BL[i][2], 8); }
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

// ---------------------------------------------------------------------------------------
// the runner
// ---------------------------------------------------------------------------------------
export function createSpells({ scene, camera, player, interiors, lessons, setTakeover, isModal, isTakeover, env = null, renderer = null }) {
  let save = {};
  try { save = JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { save = {}; }
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode */ } };
  const best = (key) => (save[key] && save[key].stars) || 0;

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
    raise: 0, raiseK: 0, dim: 0, dimGoal: 0 };
  let K = null;                            // the built kit for the running course: { group, movers, lesson, stations, ... }
  let drag = null;
  const tmp = new Vector3(), tmp2 = new Vector3(), camPos = new Vector3(), camLook = new Vector3(), camPosGoal = new Vector3(), camLookGoal = new Vector3();
  const worldOff = new Vector3();

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
    if (!(S.C.oneBubble && f && S.phase === 'lesson')) { sayEl.textContent = (S.C.who || '🧙‍♂️') + ' ' + text; sayEl.classList.add('on'); S.sayT = sec; }
    speak(text);
    if (f && S.phase === 'lesson') { f.getWorldPosition(tmp);   // in the course the top speech bar is enough (a 3D bubble covered the rings on a phone)
      tmp.y += f.userData.labelY ? Math.min(2.4, f.userData.labelY) : 1.9; fun.say(tmp, text, sec, 'spell'); }
    if (profPose === 'cast') { if (!(lessons.signature && lessons.signature(S.C.station))) hop(); if (S.C.verb === 'light') S.raise = sec; }
    else if (profPose) { pose(profPose); at(Math.max(1, sec - 0.6), () => pose(null)); }
  }
  let hopT = 0;
  function hop() { hopT = 0.6; }            // the chibi fallback's little flourish

  // ---- kit: build the course props into the room ----
  function buildKit(C, room) {
    const group = new Group(); group.name = 'spell-' + S.key;
    const solids = [], movers = {}, mats = [], geos = [], glowMats = [], texs = [];
    const kit = {
      solid: (g) => solids.push(g),
      tex: (t) => { texs.push(t); return t; },
      burst: (x, y, z, n) => burst(x, y, z, n),
      ctx: { player, camera, worldOff, prof: () => prof() },
      mesh(name, geo, o = {}) {
        const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: DoubleSide, emissive: new Color(o.glowHex || 0xffd27a), emissiveIntensity: 0 });
        const m = new Mesh(geo, mat); m.name = 'spell-' + name; m.frustumCulled = false; m.raycast = () => {}; group.add(m);
        mats.push(mat); geos.push(geo); if (o.glow !== false) glowMats.push(mat);
        movers[name] = { name, mesh: m, geo, mat, scale: 1, glows: o.glow !== false,
          pose(x, y, z, rx, ry, rz, s = 1) { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.setScalar(s); },
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
          movers[name + i] = { name: name + i, mesh: im, geo, mat, scale: s0, glows: o.glow !== false, lit: false,
            pose(x, y, z, rx, ry, rz, s = 1) { _m4.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.setScalar(s * s0)); im.setMatrixAt(i, _m4); im.instanceMatrix.needsUpdate = true; },
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
    const push = C.verb === 'push', light = C.verb === 'light';
    const mkLift = (L, st) => {
      const mv = movers[L.m]; if (!mv) return null;
      const N = light ? 2 : 48, arr = new Float32Array(N * 3);
      if (light) { for (let i = 0; i < N; i++) { arr[i * 3] = L.path[0][0]; arr[i * 3 + 1] = L.path[0][1]; arr[i * 3 + 2] = L.path[0][2]; } }   // a light target stays put: p = how lit
      else {
        const pts = L.path.map(p => new Vector3(p[0], p[1], p[2]));
        const curve = new CatmullRomCurve3(pts, false, 'centripetal'), sp = curve.getSpacedPoints(N - 1);
        sp.forEach((v, i) => { arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z; });
      }
      const rings = (L.rings || []).map(n => { const r = movers[n]; return r ? { mv: r, u: 0, ringIdx: n } : null; }).filter(Boolean);
      return { spec: L, mv, N, arr, rot0: L.rot0 || [0, 0, 0], rot1: L.rot1 || [0, 0, 0], p: 0, peak: 0, hover: 0, done: false, snap: -1, ph: Math.random() * 6, moved: false, rings,
        push, light, hov0: push ? PUSH_HOVER : light ? LIGHT_HOVER : HOVER, fall: push ? PUSH_FALL : light ? LIGHT_FALL : FALL, inOrder: !!(st && st.inOrder), aimY: L.aimY || 0 };
    };
    const lesson = C.lesson.lifts.map(l => mkLift(l, null)).filter(Boolean);
    const stations = C.course.stations.map(st => st.lifts.map(l => mkLift(l, st)).filter(Boolean));
    room.group.add(group);
    group.updateMatrixWorld(true); group.getWorldPosition(worldOff);
    group.userData.onTeardown = () => { if (S.on && K && K.group === group) leave(false, true); };   // the room is being disposed (mid-traverse: do not detach)
    const k = { group, movers, mats, geos, texs, B, ghost, ghostMat, sparks, pPos, pGeo, parts, pTex, lesson, stations };
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
  function resetLift(L) { L.p = 0; L.peak = 0; L.hover = 0; L.done = false; L.snap = -1; L.moved = false; for (const r of L.rings) r.mv.lit = false; poseLift(L, 0); }
  function resetKit(k, lessonToo) {
    k.B.reset(k.movers);
    if (lessonToo) for (const L of k.lesson) resetLift(L);
    for (const set of k.stations) for (const L of set) resetLift(L);
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
  function poseLift(L, t) {
    const e = L.p * L.p * (3 - 2 * L.p);
    samplePath(L, L.p, tmp2);
    const live = L.p > 0.01 && !L.done && !L.push && !L.light, bob = (L.spec.bob || live) ? Math.sin(t * 2.4 + L.ph) * (L.done ? 0.025 : 0.04) : 0;
    const fl = L.spec.flutter ? Math.sin(t * 4 + L.ph) * 0.3 * Math.min(1, L.p * 3) : 0;
    const r0 = L.rot0, r1 = L.rot1;
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
      liftWorld(L, tmp).project(camera); if (tmp.z > 1) continue;
      const d = Math.hypot((tmp.x * 0.5 + 0.5) * innerWidth - x, (-tmp.y * 0.5 + 0.5) * innerHeight - y);
      if (d < bd) { bd = d; best = L; }
    }
    return best;
  }
  function nudge(L, v) {                     // set a lift's progress from a gesture
    if (!L || L.done || L.snap >= 0) return;
    if (!L.moved && v > 0.02) { L.moved = true; player.play('Wave'); if (L.light) fun.sfx.sparkle(); else fun.sfx.whoosh(); }
    L.p = Math.max(0, Math.min(1, v)); L.hover = L.hov0; if (L.p > L.peak) L.peak = L.p;
    S.idle = 0;
  }
  function snapLift(L) { if (L.done || L.snap >= 0) return; L.snap = 0; L.p = Math.max(L.p, SNAP); fun.sfx.chime(); }
  function liftDone(L) {
    L.done = true; L.p = 1; L.snap = -1; L.peak = 0; poseLift(L, S.clock);
    for (const r of L.rings) if (!r.mv.lit) { r.mv.lit = true; r.mv.color(0xffe07a); }
    S.casts++; if (S.sel === L) S.sel = null;
    liftWorld(L, tmp); burst(tmp.x - worldOff.x, tmp.y - worldOff.y, tmp.z - worldOff.z, 20);
    fun.sfx.sparkle(); fun.sfx.tune([1047, 1319, 1568], 0.09, 'sine');
    setPips();
    if (S.lifts.every(x => x.done)) setDone();
    else { line(S.C.praise[S.praise++ % S.C.praise.length], 1.8); }
  }
  function drop(L) {
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
    const ordered = nOpen > 0 && S.lifts[0].inOrder;     // a follow-me set: only the next one twinkles
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
        for (const L of S.lifts) { if (L.done) continue; if (ordered || j-- === 0) { target = L; break; } }
        if (S.sel && !S.sel.done && oi % 3 !== 0 && !ordered) target = S.sel;
        oi++;
        samplePath(target, target.p, tmp2);
        const a = p.a + t * p.sp, r = p.r * (target === S.sel ? 1.25 : 1) * (target.mv.scale > 1.5 ? 1.6 : 1);
        pos[i * 3] = tmp2.x + Math.cos(a) * r; pos[i * 3 + 1] = tmp2.y + target.aimY * 0.6 + 0.1 + ((p.y + t * 0.35) % 1) * 0.45; pos[i * 3 + 2] = tmp2.z + Math.sin(a) * r;
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
    else { S.C.course.stations.forEach((st, i) => { const c = i < S.doneStations ? 'on' : i === S.step && S.phase === 'course' ? 'cur' : S.phase === 'reward' ? 'on' : ''; key += c + i; html += '<i class="' + c + '">' + st.icon + '</i>'; }); }
    if (key !== pipKey) { pipKey = key; top.innerHTML = html; }
  }
  function setBtn(on) { spB.classList.toggle('on', !!on); if (!on) { S.hold = false; spB.classList.remove('hold'); } }

  // ---- gestures ----
  const range = () => Math.max(110, Math.min(300, innerHeight * 0.3));
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
    if (!drag || drag.light || e.pointerId !== drag.id || !S.sel) return;
    const dy = swiped(e);
    if (dy > 10 || drag.moved) { drag.moved = true; nudge(S.sel, drag.p0 + Math.max(0, dy - 10) / range()); if (S.sel && S.sel.p >= SNAP) snapLift(S.sel); }
  });
  const endDrag = (e) => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    if (drag.light) {
      const L = S.sel;
      if (drag.onTarget) { S.hold = false; if (L && !L.done && S.holdT < 0.25) nudge(L, L.p + LIGHT_TAP); }
      drag = null; return;
    }
    const L = S.sel, dy = e ? swiped(e) : 0, quick = performance.now() - drag.t0 < (L && L.push ? 450 : 350);   // a push flick gets a little longer (a sweep, not a snap of the wrist)
    if (L && !L.done) {
      if (drag.moved && quick && dy > 50) snapLift(L);                     // a quick flick up: the swish-and-flick
      else if (!drag.moved && drag.onTarget) nudge(L, L.p + TAP * 0.6);   // a tap on the thing: a little hop up
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
    if (S.holdT < 0.25 && S.sel) nudge(S.sel, S.sel.p + (S.sel.light ? LIGHT_TAP : TAP));   // a tap: a third of the way up
  };
  spB.addEventListener('pointerup', endHold); spB.addEventListener('pointercancel', endHold);
  xB.addEventListener('click', e => { e.stopPropagation(); quit(); });

  // ---- flow ----
  function placeHero(x, z, yaw) {
    player.pos.set(x + worldOff.x, worldOff.y, z + worldOff.z); player.smoothY = player.pos.y; player._lastPos.copy(player.pos);
    player.yaw = yaw; S.wantYaw = yaw;
  }
  const yawTo = (x0, z0, x1, z1) => Math.atan2(x1 - x0, z1 - z0);
  function camTo(c) { camPosGoal.set(c.pos[0], c.pos[1], c.pos[2]).add(worldOff); camLookGoal.set(c.look[0], c.look[1], c.look[2]).add(worldOff); }

  function startLesson() {
    const Ls = S.C.lesson;
    S.phase = 'lesson'; S.sub = 'intro'; S.step = 0; S.lifts = K.lesson; S.sel = null;
    placeHero(Ls.stand[0], Ls.stand[1], yawTo(Ls.stand[0], Ls.stand[1], Ls.face[0], Ls.face[1]));
    camTo(Ls.cam);
    setPips(); setBtn(false);
    let t = 0.4;
    for (const b of Ls.intro) {
      at(t, () => { line(b.line, b.t, b.pose); if (b.burst) { burst(b.burst[0], b.burst[1], b.burst[2], 18); fun.sfx.sparkle(); } });
      t += b.t;
    }
    at(t, beginCast);
  }
  function beginCast() { S.sub = 'cast'; S.idle = 0; S.sel = null; select(open()); setBtn(true); setPips(); }
  function setDone() {
    S.sub = 'after'; setBtn(false); hideHand(); S.sel = null;
    if (S.phase === 'lesson') {
      line(S.C.praise[0], 2.0); player.play('Cheer');
      at(2.2, () => { line(S.C.lesson.outro, 2.4); });
      at(4.4, () => startStation(0));
      return;
    }
    const st = S.C.course.stations[S.step];
    S.doneStations = S.step + 1; setPips();
    line(S.C.praise[S.praise++ % S.C.praise.length], 2.0);
    const fx = st.after && K.B.effects[st.after];
    if (st.afterCam) camTo(st.afterCam);
    if (fx) {
      S.fx = fx; S.fxT = 0;
      if (st.afterSfx) { if (fun.sfx[st.afterSfx]) fun.sfx[st.afterSfx](); if (st.afterConfetti) fun.confetti(st.afterConfetti, 18); }
      else if (st.after === 'chestOpen') { fun.sfx.tada(); fun.confetti(['⭐', '🪙', '✨', '💛'], 18); } else fun.sfx.hoot();
    }
    at(fx ? (st.afterT || 2.8) : 1.6, () => { S.fx = null; if (S.step + 1 < S.C.course.stations.length) startStation(S.step + 1); else finish(); });
  }
  function startStation(i) {
    const st = S.C.course.stations[i];
    if (S.phase !== 'course') { S.phase = 'course'; S.tCourse = 0; }
    S.step = i; S.sub = 'walk'; S.lifts = K.stations[i]; S.sel = null; S.fx = null;
    S.walk = { pts: st.walk, i: 0 };
    camTo(st.cam); setPips(); setBtn(false); hideHand();
  }
  function arrive() {
    const st = S.C.course.stations[S.step];
    S.walk = null; S.sub = 'intro';
    const p = st.walk[st.walk.length - 1]; S.wantYaw = yawTo(p[0], p[1], st.face[0], st.face[1]);
    line(st.say, 2.6, 'talk');
    at(1.4, beginCast);
  }
  function finish() {
    S.phase = 'reward'; S.sub = 'reward'; setBtn(false); hideHand(); setPips();
    const C = S.C, three = S.tCourse <= C.course.star3 && S.drops <= 2;
    S.stars = three ? 3 : 2;
    award(S.stars);
    line(C.finale, 2.6, 'cast'); player.play('Cheer');
    fun.sfx.tada(); fun.confetti(C.confetti || ['🪶', '⭐', '✨', '🌟', '💜'], 34);
    at(2.6, showReward);
  }
  function award(stars) {
    const rec = save[S.key] = save[S.key] || { stars: 0, plays: 0 };
    rec.stars = Math.max(rec.stars || 0, stars); rec.plays = (rec.plays || 0) + 1; persist();
    const pts = stars * 10;
    try { window.HPLessons.progress.bonus(pts); } catch { /* lessons not loaded */ }
    S.result = { stars, pts, t: Math.round(S.tCourse), drops: S.drops, casts: S.casts };
    return pts;
  }
  function showReward() {
    if (!S.on) return;
    const r = S.result, crest = CREST[fun.store.house] || CREST.gryf;
    endOv.innerHTML = '<div class="p"><div class="tr">' + S.C.spell.icon + '</div><div class="ti">' + (r.stars >= 3 ? 'כָּל הַכָּבוֹד!' : 'יָפֶה מְאֹד!') + '</div>'
      + '<div class="st">' + '⭐'.repeat(r.stars) + '☆'.repeat(3 - r.stars) + '</div><div class="sc">' + crest + ' <span dir="ltr">+' + r.pts + '</span></div>'
      + '<div class="row"><button class="again">🔁 שׁוּב</button><button class="done">✅ סִיּוּם</button></div></div>';
    endOv.querySelector('.again').addEventListener('click', e => { e.stopPropagation(); again(); });
    endOv.querySelector('.done').addEventListener('click', e => { e.stopPropagation(); leave(true); });
    endOv.classList.add('on'); speak(r.stars >= 3 ? 'כָּל הַכָּבוֹד! שְׁלוֹשָׁה כּוֹכָבִים!' : 'יָפֶה מְאֹד!');
  }
  function again() {
    if (!S.on) return;
    endOv.classList.remove('on'); S.q.length = 0;
    resetKit(K, false); S.drops = 0; S.casts = 0; S.doneStations = 0; S.praise = 0; S.result = null; S.stars = 0; S.phase = 'course'; S.tCourse = 0;
    startStation(0);
    // straight to station 1 (a little sparkle hop), not the long walk back via the lesson spot
    const st = S.C.course.stations[0], p = st.walk[st.walk.length - 1];
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
  function start(key = 'charms') {
    const C = COURSES[key];
    if (!C || S.on || isModal() || isTakeover()) return false;
    if (interiors.active !== C.room || !interiors.room) return false;
    S.key = key; S.C = C;
    Object.assign(S, { on: true, speed: 1, phase: null, sub: null, step: 0, casts: 0, drops: 0, stars: 0, clock: 0, tCourse: 0, doneStations: 0, sel: null, hold: false, idle: 0, walk: null, fx: null, praise: 0, result: null,
      raise: 0, raiseK: 0, dim: 0, dimGoal: C.dim ? 1 : 0 });
    S.q.length = 0; pipKey = '';
    try { K = buildKit(C, interiors.room); } catch (e) { console.warn('[spells] course props failed -', e && e.message || e); K = null; S.on = false; return false; }
    setTakeover(takeover);
    document.body.classList.add('inSpell'); promptB.classList.remove('on');
    // things that follow you or roam the room hold still / hide while the course owns the frame
    S.hid = []; for (const n of ['pip', 'trevor', 'peeves']) { const o = scene.getObjectByName(n); if (o && o.visible) { o.visible = false; S.hid.push(o); } }
    player._applyFade && player._applyFade(1);
    camPos.copy(camera.position); camera.getWorldDirection(tmp); camLook.copy(camera.position).addScaledVector(tmp, 6);
    fun.sfx.sparkle();
    if (C.dim) dimCapture();
    startLesson();
    return true;
  }
  function leave(restore, inTeardown = false) {
    if (!S.on) return;
    const C = S.C;
    S.on = false; S.q.length = 0; drag = null; S.hold = false; S.walk = null; S.fx = null;
    hush(); hideHand(); setBtn(false);
    try { dimRestore(); } catch (e) { console.warn('[spells] dim restore -', e && e.message || e); DIM = null; }
    if (S.hid) { for (const o of S.hid) o.visible = true; S.hid = null; }   // Peeves' visibility is only set on spawn: put back what start() hid
    endOv.classList.remove('on'); sayEl.classList.remove('on');
    document.body.classList.remove('inSpell');
    try { pose(null); } catch { /* lessons gone */ }
    const f = prof(); if (f && f.userData.rig) f.position.y = 0;
    disposeKit(inTeardown);
    setTakeover(null);
    if (restore && interiors.active === C.room) {
      const st = lessons.stations && lessons.stations[C.station];
      if (st) { player.yaw = Math.PI; player.teleport(st.x + worldOff.x, st.z + 3.1 + worldOff.z); player.pos.y = worldOff.y; player.smoothY = worldOff.y; }
    }
  }
  function quit() {
    if (!S.on) return false;
    // left early after at least two stations: still a star (forgiving)
    if (S.phase === 'course' && S.doneStations >= 2 && !S.result) { const pts = award(1); fun.toast('⭐', '+' + pts, 1800); }
    leave(true);
    return true;
  }

  // ---- per frame (main.js takeover slot) ----
  function hideHand() { hand.classList.remove('on'); }
  function update(dt) {
    if (!S.on) return;
    if (!K || interiors.active !== S.C.room || !K.group.parent) { leave(false); return; }
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
    player.animate(dt, { moving, running: false }, moving ? WALK : 0);
    player.model.position.copy(player.pos); player.model.rotation.y = player.yaw;
    player._lastPos.copy(player.pos);

    // the teacher turns to the child; GLB clips keep playing (lessons.anim), the chibi breathes
    const f = prof();
    if (f) {
      const ud = f.userData;
      if (!ud.casting) { f.getWorldPosition(tmp); let fy = Math.atan2(player.pos.x - tmp.x, player.pos.z - tmp.z) - f.rotation.y; fy = Math.atan2(Math.sin(fy), Math.cos(fy)); f.rotation.y += fy * Math.min(1, dt * 3); }
      if (ud.rig) { animateChibi(ud.rig, dt, { moving: false }); if (hopT > 0) { hopT -= dt; f.position.y = Math.sin((1 - hopT / 0.6) * Math.PI) * 0.35; } else f.position.y = 0; }
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
      if (S.hold && (!S.sel || S.sel.done)) { const nx = open(); if (nx) { S.sel = nx; S.holdT = 0.25; setPips(); } }   // finger still down: carry on with the next object
      if (S.hold && S.sel && !S.sel.done && S.holdT >= 0.25) { nudge(S.sel, S.sel.p + dt / (S.sel.light ? LIGHT_HOLD : HOLD)); if (S.sel.p >= SNAP) snapLift(S.sel); }
    }
    for (let s = -1; s < K.stations.length; s++) {
      const set = s < 0 ? K.lesson : K.stations[s];
      for (let j = 0; j < set.length; j++) {
        const L = set[j];
        if (!L.done && L.snap >= 0) { L.snap += dt; L.p = Math.min(1, L.p + dt * 2.4); if (L.p >= 1 || L.snap > 0.4) { liftDone(L); if (!S.on) return; continue; } }
        else if (!L.done && L.p > 0 && !(drag && S.sel === L) && !(S.hold && S.sel === L)) {
          if (L.p >= SNAP) snapLift(L);
          else { L.hover -= dt; if (L.hover <= 0) { L.p -= dt * L.fall; if (L.p <= 0) { L.p = 0; if (L.peak >= 0.3 && !L.light) drop(L); else L.peak = 0; L.moved = false; } } }
        }
        // rings light as the feather passes them (and stay lit)
        for (const r of L.rings) if (!r.mv.lit && L.p >= r.u) { r.mv.lit = true; r.mv.color(0xffe07a); fun.sfx.tink(3); }
        poseLift(L, t);
      }
    }
    K.B.tick(K.movers, t, S, K, dt);
    if (S.fx) { S.fxT += dt; if (!S.fx(K.movers, S.fxT)) S.fx = null; }

    // glow, outline, ghost hand
    const pulse = 0.3 + Math.sin(t * 5) * 0.15;   // gentle: at 0.9 the red book and coloured blocks washed out to white
    for (const m of K.glowMats) m.emissiveIntensity = 0;
    const cur = S.sub === 'cast' ? (S.sel && !S.sel.done ? S.sel : open()) : null;
    if (S.sub === 'cast' && S.lifts) for (const L of S.lifts) if (!L.done && L.mv.glows) L.mv.mat.emissiveIntensity = pulse;
    if (cur) {
      const g = K.ghost; if (g.geometry !== cur.mv.geo) g.geometry = cur.mv.geo;
      const a = cur.arr, n = (cur.N - 1) * 3, r1 = cur.rot1;
      g.position.set(a[n], a[n + 1], a[n + 2]); g.rotation.set(r1[0], r1[1], r1[2]); g.scale.setScalar(cur.mv.scale * (cur.light ? 1.7 : 1.06));
      K.ghostMat.opacity = 0.42 + Math.sin(t * 4) * 0.16; g.visible = true;
    } else K.ghost.visible = false;
    if (cur && S.idle > HINT_AFTER && cur.p < 0.05) {
      liftWorld(cur, tmp).project(camera);
      hand.style.left = ((tmp.x * 0.5 + 0.5) * innerWidth) + 'px'; hand.style.top = ((-tmp.y * 0.5 + 0.5) * innerHeight) + 'px';
      if (!hand.classList.contains('on')) {
        const sd = dirOf(cur), pushy = !!cur.push;
        hand.classList.toggle('push', pushy); hand.classList.toggle('tap', !!cur.light);
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
  promptB.addEventListener('click', e => { e.stopPropagation(); fun.sfx.squeak(); const k = promptB.dataset.k; if (k) start(k); });
  let promptOn = false;
  function idle() {
    let k = null;
    if (!S.on && !isModal() && !isTakeover() && interiors.active) {
      const near = lessons.near && lessons.near();
      if (near && fun.promptId() === 'lesson:' + near) for (const key in COURSES) if (COURSES[key].station === near && COURSES[key].room === interiors.active) { k = key; break; }
    }
    if (!!k !== promptOn || (k && promptB.dataset.k !== k)) { promptOn = !!k; promptB.classList.toggle('on', promptOn); if (k) promptB.dataset.k = k; }
  }

  // ---- the 🔔 picker card ----
  function pickerCard(key) {
    const C = COURSES[key];
    return {
      key, icon: C.spell.icon, name: C.name, best: () => best(key),
      fn: async () => {
        if (S.on) return;
        await lessons.go(C.station);
        setTimeout(() => start(key), 500);
      },
    };
  }

  // test hooks answer only with ?debug=1 or when a test sets window.__game.test = true
  const testOK = () => /[?&]debug=1/.test(location.search) || !!(window.__game && window.__game.test === true);
  const api = {
    courses: COURSES, start, quit, idle, pickerCard, best,
    state() {
      return { on: S.on, key: S.key, phase: S.on ? S.phase : null, sub: S.on ? S.sub : null, step: S.step, casts: S.casts, drops: S.drops, stars: S.stars,
        best: S.key ? best(S.key) : 0, t: Math.round(S.tCourse * 10) / 10, doneStations: S.doneStations, result: S.result,
        lifts: S.lifts ? S.lifts.map(L => ({ p: Math.round(L.p * 100) / 100, done: L.done })) : null, prompt: promptOn,
        dim: Math.round(S.dim * 1000) / 1000, dimmed: !!DIM, raise: S.raise > 0 };
    },
    // test hooks
    _cast() {
      if (!testOK()) return false;
      if (!S.on || S.phase === 'reward') return false;
      if (S.sub === 'walk' && S.walk) { const w = S.walk, p = w.pts[w.pts.length - 1]; player.pos.x = p[0] + worldOff.x; player.pos.z = p[1] + worldOff.z; arrive(); }
      flushUntil(() => S.sub === 'cast');
      const L = (S.sel && !S.sel.done) ? S.sel : open(); if (!L) return false;
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
      for (const L of K.lesson) if (!L.done) { L.done = true; L.p = 1; }
      const n = S.C.course.stations.length;
      for (let i = 0; i < Math.min(step, n); i++) { const fx = S.C.course.stations[i].after && K.B.effects[S.C.course.stations[i].after]; if (fx) fx(K.movers, 99, true); }
      for (let i = 0; i < Math.min(step, n); i++) for (const L of K.stations[i]) { L.done = true; L.p = 1; for (const r of L.rings) { r.mv.lit = true; r.mv.color(0xffe07a); } }
      if (S.phase !== 'course') { S.phase = 'course'; S.tCourse = 0; }
      S.doneStations = Math.min(step, n);
      if (step >= n) { finish(); return true; }
      startStation(step); return true;
    },
    _flush() { if (testOK()) flushUntil(() => false); },
    _speed(k) { if (!testOK()) return 1; S.speed = Math.max(0.1, Math.min(8, +k || 1)); return S.speed; },   // reset to 1 on every start()
    _target() {                            // screen point of the thing to lift now (for real-touch tests)
      if (!testOK() || !S.on || !S.lifts) return null;
      const L = (S.sel && !S.sel.done) ? S.sel : open(); if (!L) return null;
      const sd = dirOf(L);
      liftWorld(L, tmp).project(camera);
      return { x: (tmp.x * 0.5 + 0.5) * innerWidth, y: (-tmp.y * 0.5 + 0.5) * innerHeight, p: L.p, dx: sd.x, dy: sd.y };
    },
    get _kit() { return testOK() ? K : null; },
  };
  fun.mods.spells = api;
  return api;
}
