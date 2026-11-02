# Hogwarts Explorer HD — Design & Art Bible

A more realistic-looking sibling of `../hogwarts-explorer/` (v1). v1 is **never** modified.
This is a private, non-commercial project for Elik and his son. No copyrighted
Harry Potter / Warner Bros. assets are committed — the committed world is CC0 + procedural.

## Stack
- **three.js r187**, vendored locally in `lib/` (no build step, no CDN, no npm install to run).
  `WebGPURenderer` with **automatic WebGL2 fallback**; `?webgl=1` forces WebGL2.
- Plain ES modules + an **import map** (`three`, `three/webgpu`, `three/tsl`, `three/addons/`).
  Served as-is by GitHub Pages.
- Hebrew RTL HUD (`lang=he dir=rtl`), iPad-first (`viewport-fit=cover`, safe-area insets,
  touch joystick + drag-look, pinch/double-tap-zoom blocked).

## Art bible (the contract every asset follows)
- **Scale:** 1 world unit = 1 metre. Character origin at the feet. Camera is third-person.
- **Triangle budget:** ≤ **300k** visible triangles (iPad). Currently ~150k.
- **Draw calls:** ≤ **150**. The whole castle is **merged per material** → ~3 draw calls;
  total scene ~30. Never add geometry as many small meshes — merge or instance.
- **Textures:** ≤ **150 MB** GPU. Source maps ≤ **1K** for normal surfaces, 2K only for a
  hero surface. Committed CC0 set is ~7.5 MB (see `CREDITS.md`).
- **Bloom / albedo rule:** keep bright, non-emissive albedo ≤ **0.84** so only true light
  sources bloom. Window glow is **emissive**, never bright white albedo. Bloom threshold 0.9
  (post-processing is build-plan step 6; tone mapping is ACES, already on).
- **iPad memory:** Safari kills a WebGPU tab near a **~300 MB** GPU process. Budget textures
  ≤150 MB, cap DPR 1.5–2, one shadow-casting light (the sun), shadow map 1–2K.
- **Lights are pre-created once** and only re-parameterised (sun/hemi/ambient). Never add a
  light at runtime (it recompiles every shader → stall on iPad). Candles later = emissive+bloom.
- **NaN-guard post-processing** (the known iPhone black-flicker came from a NaN pixel).

## Quality tiers (auto, with FPS downgrade)
- **High:** DPR≤2, shadows, (post later). **Medium:** DPR≤1.5, shadows. **Low:** DPR 1, no
  shadows. Chosen by FPS sampling after a ~3 s warm-up; only ever downgrades. Manual override
  via `window.__game.setQuality('high'|'medium'|'low')`.

## World (exterior — build-plan step 5, done)
- Rolling heightfield terrain with a flat castle plateau + a carved lake basin (`heightAt`).
- Reflective **Black Lake** (`WaterMesh`, TSL reflector; falls back to a glassy plane).
- Procedural castle: round towers with crenellations + conical **slate** spires, crenellated
  curtain walls, a gabled **Great Hall**, a tall central keep. PBR **stone**/slate/wood.
- Fog + **day / dusk / night** toggle (🌓 button), each with its own HDRI + sun + fog preset.
- Third-person wizard with capsule/box collision against the castle; camera pulls in so walls
  never fill the lens; stays inside the grounds.

## Graceful asset strategy
- Real CC0 maps live in `assets/` and are listed in `assets/manifest.json`. The game consults
  the manifest **before** fetching, so a missing asset never 404s — it falls back to the
  procedural canvas textures / gradient sky. The game is fully playable with zero downloaded
  assets.
- **Private / fan-made HP-named models** (optional, non-CC0) may only live in
  `private-assets/` which is **gitignored** (the repo is public). Loaded optionally with a
  silent fallback to the CC0/procedural look. Never committed. See `PRIVATE-ASSETS.md` (local).

## Test hooks (`window.__game`)
`ready`, `backend`, `teleport(id)`, `setTime('day'|'dusk'|'night')`, `setQuality(tier)`,
`spots()`, `stats()` → `{fps, backend, tier, drawCalls, triangles, textures, geometries}`.
Headless Playwright harness in `_test/` (gitignored) runs Chrome with WebGPU swiftshader flags,
emulates iPad landscape+portrait, two backends (WebGPU + `?webgl=1`), checks console errors +
budgets + RTL, and saves screenshots.

## Build-plan status (see ../../realistic-engine-research.md §6)
Done: **2** scaffold, **3** assets, **4** renderer core + harness, **5** exterior.
Next: 6 post-processing (bloom/GTAO/FXAA + NaN clamp), 7 refined player, 8 area streaming + map,
9–13 interiors/grounds/characters/polish.
