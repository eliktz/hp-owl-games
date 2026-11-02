# 🏰 Hogwarts Explorer HD

> **Disclaimer.** This world uses **fan-made 3D models from [Sketchfab](https://sketchfab.com)**
> (Hedwig, Ron, Hermione, Hagrid's hut, the Great Hall, Dumbledore's office and some props).
> It is an **unofficial** personal project for **personal, non-commercial family use only —
> not for any commercial use**. All *Harry Potter* names, characters and related intellectual
> property belong to **Warner Bros. Entertainment Inc. and J.K. Rowling**; this project is not
> affiliated with, endorsed by, or sponsored by them. Every model's title, author, Sketchfab
> URL and licence (CC-BY authors are credited as required) is listed in
> **[MODELS-CREDITS.md](MODELS-CREDITS.md)**. If you are a rights holder or a model's author
> and would like something removed, it will be **removed on request**.

A gentle, higher-fidelity (WebGPU, with a WebGL fallback) 3D Hogwarts to wander — built for
one child, in Hebrew (RTL). Walk a little wizard around the castle grounds, meet friendly
characters, visit magical interiors, collect stars ✨ and deliver letters 💌. No fail states.

## Run
Static, no build step. Serve the repo root and open `hogwarts-explorer-hd/index.html`
(ES-module import map + WebGPU need `http(s)://`, not `file://`). Add `?webgl=1` to force the
WebGL backend.

## What's inside
- **World** — rolling terrain, a reflective lake, a procedural castle, day/dusk/night sky.
- **Scenery & characters** — fan models (above) placed on the terrain, plus code-drawn
  Harry and Hagrid, each with idle animation and friendly Hebrew lines.
- **Interiors** — Great Hall, grand staircase, library and a cosy common room, reached from
  the map (and streamed in only when entered, for memory).
- **Map / fast-travel** — a Hebrew map screen to jump between landmarks and interiors.
- **Gentle quests** — collect stars and deliver letters, with a child-friendly HUD.
- **iPad-first performance** — quality tiers, a triangle/memory budget (≤300 MB target), and
  area streaming so only what you can see is loaded.
- **Audio** — soft ambience, footsteps and chimes (mutable).

## Credits & licences
Engine, CC0 textures/HDRIs and procedural art: **[CREDITS.md](CREDITS.md)**.
Fan Sketchfab models (attribution + disclaimer): **[MODELS-CREDITS.md](MODELS-CREDITS.md)**.

## Tooling
- `tools/fetch-assets.mjs` — fetch the committed CC0 Poly Haven textures/HDRIs.
- `tools/sketchfab-fetch.mjs` — (local only) download the raw Sketchfab models; needs a
  `SKETCHFAB_TOKEN` env var, which is **never committed**.
- `tools/optimize/optimize.mjs` — optimise the raw models (Meshopt + 1024 WebP) into the
  committed `assets/models/*.glb`.
