// One-off: optimise the fan Sketchfab models for PUBLIC committing.
// prune/dedup/weld → resize textures to <=1024 + WebP → Meshopt geometry compression,
// writing one self-contained .glb per model to ../../assets/models/. Keeps each file
// small (<25MB) and the total well under budget. Run: `node optimize.mjs`.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  prune, dedup, weld, resample, textureCompress, meshopt,
} from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { readdir, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dir, '..', '..', 'private-assets');
const OUT = join(__dir, '..', '..', 'assets', 'models');

// Slots to publish. `hagrid` is an exact duplicate of `hut`, and `great-hall` is a
// 42MB lone window frame — both dropped as the least useful (see MODELS-CREDITS.md).
const KEEP = ['castle', 'harry', 'hut', 'owl', 'quidditch', 'hermione', 'ron'];

await MeshoptEncoder.ready;
await mkdir(OUT, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
});

for (const slot of KEEP) {
  const gltf = join(SRC, slot, 'scene.gltf');
  try { await stat(gltf); } catch { console.warn('skip (missing):', slot); continue; }
  const doc = await io.read(gltf);
  await doc.transform(
    dedup(),
    prune(),
    weld(),
    resample(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  const outFile = join(OUT, slot + '.glb');
  await io.write(outFile, doc);
  const kb = Math.round((await stat(outFile)).size / 1024);
  console.log(`${slot.padEnd(12)} -> ${(kb / 1024).toFixed(2)} MB`);
}
console.log('done ->', OUT);
