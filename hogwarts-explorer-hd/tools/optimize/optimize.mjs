// One-off: optimise the fan Sketchfab models for PUBLIC committing.
// prune/dedup/weld → resize textures to <=1024 + WebP → Meshopt geometry compression,
// writing one self-contained .glb per model to ../../assets/models/. Keeps each file
// small (<25MB) and the total well under budget. Run: `node optimize.mjs`.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  prune, dedup, weld, resample, textureCompress, meshopt, simplify, flatten, join,
} from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { readdir, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dir, '..', '..', 'private-assets');
const OUT = join(__dir, '..', '..', 'assets', 'models');

// Slots to publish. `hagrid` is an exact duplicate of `hut`, and `great-hall` is a
// 42MB lone window frame — both dropped as the least useful (see MODELS-CREDITS.md).
// `simplify` = target fraction of triangles kept: the heavy scenery/interior props are
// decimated hard so the whole scene stays under the iPad triangle budget (config.js);
// the two low-poly character models (hermione/ron) are left alone.
const KEEP = {
  castle: 0.22, harry: 0.3, hut: 0.18, owl: 0.28, quidditch: 0.18, hermione: 1, ron: 1,
};

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
await mkdir(OUT, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
});

for (const [slot, ratio] of Object.entries(KEEP)) {
  const gltf = join(SRC, slot, 'scene.gltf');
  try { await stat(gltf); } catch { console.warn('skip (missing):', slot); continue; }
  const doc = await io.read(gltf);
  // flatten + join merge primitives that share a material into one mesh → far fewer draw
  // calls (the fan character models ship with dozens of sub-meshes).
  const steps = [dedup(), flatten(), join(), weld(), prune()];
  if (ratio < 1) steps.push(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.004 }));
  steps.push(
    resample(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  await doc.transform(...steps);
  const outFile = join(OUT, slot + '.glb');
  await io.write(outFile, doc);
  const kb = Math.round((await stat(outFile)).size / 1024);
  console.log(`${slot.padEnd(12)} -> ${(kb / 1024).toFixed(2)} MB`);
}
console.log('done ->', OUT);
