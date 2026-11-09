# 🏰 Hogwarts Explorer — Design

A gentle, open-world third-person wander around a storybook Hogwarts, for a 7-year-old.
No winning, no losing, no scary bits — just explore, collect sparkly things, say hi to
friends, and fly with Hedwig. Fifth game in the Owl Post set; same house style and tech.

## Feel & art direction
The four existing games share one look, and that *is* the brand — I keep it rather than
invent a new one: deep night-to-dusk gradient skies, gold (`#ffd76a`) rimmed dark-violet
(`rgba(40,25,90,.75)`) glass panels, chunky emoji, the `Rubik` Hebrew face, everything
low-poly and hand-built from three.js primitives (no downloaded art/sound). The one place
I spend boldness: the **world itself** reads as a tiny diorama you can walk inside — warm
floating candles, a glowing lake, fireflies at the forest edge, chimney smoke over
Hagrid's hut. The HUD stays quiet so the world is the hero.

## World (one connected ground, fog-bounded)
- **Castle** on a low rise to the north: towers, a **great-hall** block, a **stone bridge**
  over a dip, and a **walkable courtyard** ringed by low walls, arches and floating candles.
- **Grounds**: procedural rolling terrain (analytic height field — also used for walking,
  so no per-frame raycast), flattened into a central play area so landmarks sit level.
- **Lake** to the west with a softly animated glowing surface.
- **Hagrid's hut** (round, thatched cone roof) to the east with a chimney puffing smoke.
- **Quidditch pitch**: an oval with six hoops.
- **Forest edge** (friendly, not dark) along the back with instanced trees + drifting fireflies.
- **Greenhouse**: a glass box with glowing plants near the courtyard.
- **Day→dusk cycle**: sky, fog and light colours ease back and forth between warm daylight
  and golden dusk (~90 s round trip); stars and candles fade up as it gets dark.

## Player & camera
- A **chibi young wizard** (purple robe, gold trim, pointed hat) — reuses `HP.makeChibi`
  with a new `player` palette so he's clearly not one of the four NPCs.
- **Third-person** follow camera with smooth orbit.
- **Walk** on the terrain; **jump** with a forgiving arc.
- **Fly**: a big button summons **Hedwig** (`HP.makeOwl`); the wizard rides and steers in
  gentle short hops — hold Up to climb, release to glide down. Tap again to land. No crashes.

## Controls (touch-first, desktop too)
- **Touch**: dynamic **virtual joystick** (left half — ring appears under the thumb) to move;
  **drag-to-look** (right half) to orbit; big buttons for 🦉 fly and ⬆️ jump/climb.
- **Desktop**: WASD/arrows to move, mouse-drag to look, Space to jump, F to fly.

## Gentle quests (almost no text)
- **Collect** glowing golden **snitches** ✨ and **chocolate frogs** 🐸 scattered around;
  walking into one chimes, sparkles, and bumps the counter.
- **NPCs** Harry / Ron / Hermione / Hagrid stand around the grounds. Walk up → a **speech
  bubble** with one short Hebrew line + icons asks you to *bring N of X*. A floating icon
  over their head shows the request + progress. Bring enough → they cheer and you earn a
  **sticker/badge**.
- **Badges screen**: a 🎖️ button opens a grid of stickers — earned ones in colour, the rest
  gently locked. That's the only "progress" surface; no menus of text.

## Performance (iPad is the target)
Capped DPR 2 (via `HP.setup`), fog to bound draw distance, **instanced** trees/candles,
fireflies as additive `Points`, **no shadow maps**, low-poly everything, and the shared
`HP.perf` auto-scaler thins fireflies/particles and view distance if FPS dips.

## Audio
Procedural WebAudio only: `HP.sfx.music` music-box bed + occasional owl hoots and a soft
wind pad, collect chimes, a whoosh on take-off. The existing 🔇 button mutes everything.

## Testing
Playwright headless with swiftshader, iPad Pro 11 **portrait + landscape**: assert no
console errors and that a simulated **touch-drag on the joystick actually moves the player**,
then capture screenshots and iterate on the look.

## Castle interior, lessons and delight (the "fable" pass)
The castle is the heart of the game now, so this pass spent its boldness there.

- **Light you can feel.** Every flame "bakes" a warm pool on the floor and a wash on its wall
  (all pools live in ONE additive mesh, clipped against the nav walls so light never leaks
  next door); stained glass throws coloured patches; characters get soft blob shadows; a
  candle-lit vignette frames the screen indoors. No extra real lights, no shadow maps.
- **Room culling** (`interior/cull.js`). Objects are bucketed per room; only the room you
  are in, doorway-adjacent rooms and near second-ring rooms are drawn. Adjacency is derived
  from the nav walls. Indoor draw calls fell from ~1,500–2,700 to ~450–1,200.
- **Touch feel.** The joystick ring follows the thumb (instant reversing), radial dead-zone
  + response curve, look-drag is queued and eased per frame with a little flick inertia,
  HUD touches never steer, fingers are released when an overlay opens.
- **Delight systems** (`delight/*.js`, each self-contained, all persisted in `hpFun1`):
  the 🪄 wand (enchant armour, ghosts, candles, books, cauldrons, portraits, friends…),
  the Sorting Hat ceremony + four house hourglasses fed by lesson points, wearable hats
  (wardrobe in the sticker screen), Pip the owlet (follows + hints), Peeves the prankster,
  every-flavour beans (silly temporary spells), Trevor hide-and-seek, the Mirror of Wishes,
  a secret book passage Library ⇄ Common Room, a gramophone + wizard chess, daily owl post.
- **Lessons.** Seven subjects, always open from the 🔔 picker. Difficulty is a per-subject
  skill rating (1–8) that moves with how each lesson actually went, plus the in-lesson
  streak ramp; combos, professors who react in character, ranks, a level bar and little
  prizes on the reward. New: Care of Magical Creatures (a listen-and-repeat memory game).
- **Rules kept.** No timetable, nothing locked, no fail states that end play, every spot
  reachable on foot (`_test/reachability.js` checks every delight point too).
