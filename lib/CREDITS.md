# Credits & asset licensing

## Castle interior — procedural, no third-party art

The walkable castle interior added to `hogwarts-explorer` (Entrance Hall with a
grand marble staircase, the Great Hall with four long house tables under an
enchanted night-sky ceiling and floating candles, moving staircases, a portrait
corridor, a library and a common room) is **100% original procedural code**
(`hogwarts-explorer/interior/*.js`). Every surface is a three.js primitive; all
stone, marble, oak, banner, stained-glass, book-spine and portrait textures are
**drawn at runtime on a `<canvas>`** (`interior/textures.js`) — nothing is
downloaded. The portrait figures are *generic* stylised busts built from meshes
that wave and wink; they are **not** film stills, promotional images, or ripped
game/book art. The layout follows the well-known Hogwarts look (great hall, four
house tables, floating candles, enchanted ceiling, grand staircases, gothic
arches, torchlit corridors, portraits, library) recreated from scratch as a
personal, non-commercial homage — no copyrighted Harry Potter assets are used.
No CC0/CC-BY third-party assets were vendored for the interior.

## Guest characters — procedural, no third-party art

The cameo "guest" friends (a tousled bespectacled young wizard, a ginger
freckled friend, a bushy-haired bookworm, a bearded gentle giant) and the
explorable-world hero are **100% procedurally generated** in three.js from
primitive meshes (`HP.makeChibi` in `lib/common.js`). **No franchise art, no
ripped/fan-extracted models, and no copyrighted textures are used.** Every
character is a *generic* chibi student / gentle giant, individualised only by
original proportions, hair shapes, house-scarf colours and props.

### Properly-licensed packs evaluated (not vendored)

Before redesigning, these free, properly-licensed low-poly character packs were
evaluated as drop-in alternatives. Licenses re-verified **November 2026**:

| Pack | Author | License | Notes |
|------|--------|---------|-------|
| [Ultimate Modular Men](https://poly.pizza/bundle/Ultimate-Modular-Men-Pack-ZiH8muWqwQ) / [Women](https://poly.pizza/bundle/Ultimate-Modular-Women-Pack-aCBDXDdTNN) | Quaternius | **CC0** (public domain) | Rigged, modular (swappable parts), GLB/FBX/OBJ, 24 anims. |
| [Ultimate Monsters Bundle](https://poly.pizza/bundle/Ultimate-Monsters-Bundle-5oyGWAmOB6) (incl. a wizard) | Quaternius | **CC0** | Rigged GLB with animations. |
| [Mini Characters](https://kenney.nl/assets/mini-characters) | Kenney | **CC0** | 12 chars, 32 anims. Credit requested, not required. |
| [Blocky Characters](https://kenney.nl/assets/blocky-characters) | Kenney | **CC0** | 18 chars, 27 anims. |
| [LowPoly RPG Characters](https://opengameart.org/content/lowpoly-rpg-characters) (incl. a rigged wizard) | Quaternius / OpenGameArt | **CC0** | FBX/OBJ/Blend, rigged + animated. |
| [Wizard Creation](https://opengameart.org/content/wizard-creation) | OpenGameArt uploader | **CC0** | Single rigged wizard + one sample anim. |

> ⚠️ Not every "wizard" asset on poly.pizza is public domain: the *Evil Wizard*
> character is CC0, but *Wizard Shop* and *Wizard Hat* are **CC-BY** (attribution
> required) and are static props, not rigged characters. If anything from
> poly.pizza is ever vendored, confirm the per-asset license first.

**Why we kept procedural instead of vendoring one of the above:**

1. The app ships a single bundled core build (`three.js r149`, UMD) with **no
   `GLTFLoader` and no asset-loading pipeline** — every game builds its scene
   synchronously from primitives. Vendoring a GLB would mean adding a loader and
   making character creation async across five games.
2. The cameos need **deep per-character customisation** (robes, round glasses, a
   faint lightning scar, hair colour, a beard, house-scarf colours) layered onto
   a *chibi* silhouette (big head, small body). Re-skinning a rigged realistic
   humanoid into that look is harder and less controllable than authoring the
   chibi directly.
3. The characters are tightly integrated with a hand-written cameo system
   (`HP.animateChibi` idle↔cheer blend, `HP.makeCameo` spring pop-in). Procedural
   meshes let that stay simple and stay fast when several pop in at once on iPad.

So the procedural chibis were **redesigned** rather than replaced. Should a
vendored model ever be wanted, the CC0 packs above are the recommended source and
each only needs attribution as noted (CC0 requires none; Kenney requests a
"Kenney.nl" credit).

### Redesign notes (Nov 2026)

The previous build's hair sat as a low "helmet" whose front edge cut across the
eyes, giving every kid a dark mask/raccoon band and burying the glasses and scar.
The redesign in `HP.makeChibi`:

- **Raised the hairline** well above the eyes (soft rounded lumps, no sharp cones)
  so the forehead shows and the faces read open and friendly; the scar, round
  glasses and freckles now read clearly.
- **Per-character silhouettes:** tousled black fringe + scar + glasses + glowing
  wand (Harry), side-swept ginger fringe + freckles (Ron), bushy fringe with long
  waves past the shoulders (Hermione), shaggy mane + big soft beard over a smile
  (Hagrid), neat fringe + gold-trim robe (the explorable-world "you" hero).
- **Fixed Hagrid's belt**, which previously hid inside the robe cone leaving a
  stray buckle; it now wraps the coat with the buckle sitting proud.

Idle↔cheer animation (`HP.animateChibi`) and the spring pop-in cameo controller
(`HP.makeCameo`) are unchanged and still drive all five games and the explorer.

## three.js

[three.js](https://threejs.org/) r149 — MIT License, © 2010–2023 three.js authors
(`lib/three.min.js`).
