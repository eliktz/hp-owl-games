# Credits & asset licensing

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
evaluated as drop-in alternatives:

| Pack | Author | License | Notes |
|------|--------|---------|-------|
| [Ultimate Modular Men / Women](https://poly.pizza/bundle/Ultimate-Modular-Men-Pack-ZiH8muWqwQ) | Quaternius | **CC0** (public domain) | Rigged, modular, GLB/FBX. |
| [Ultimate Monsters Bundle](https://poly.pizza/bundle/Ultimate-Monsters-Bundle-5oyGWAmOB6) (incl. a wizard) | Quaternius | **CC0** | Rigged GLB with animations. |
| [Mini Characters](https://kenney.nl/assets/mini-characters) | Kenney | **CC0** | 12 chars, 32 anims. Credit requested, not required. |
| [Blocky Characters](https://kenney.nl/assets/blocky-characters) | Kenney | **CC0** | 18 chars, 27 anims. |

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

So the procedural chibis were **redesigned** (better proportions, friendlier
eyes, smoother hair, a much-improved gentle giant) rather than replaced. Should
a vendored model ever be wanted, the CC0 packs above are the recommended source
and each only needs attribution as noted (CC0 requires none; Kenney requests a
"Kenney.nl" credit).

## three.js

[three.js](https://threejs.org/) r149 — MIT License, © 2010–2023 three.js authors
(`lib/three.min.js`).
