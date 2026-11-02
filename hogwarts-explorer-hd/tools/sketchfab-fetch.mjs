#!/usr/bin/env node
// PRIVATE fan models from Sketchfab — for Elik's personal, non-commercial use with
// his son ONLY. Everything lands in ../private-assets/ which is GITIGNORED (public
// repo!). The game runs fully without these (procedural/CC0 fallback); they are
// strictly optional. Needs SKETCHFAB_TOKEN in the env — it is NEVER printed/committed.
//
// Usage:  SKETCHFAB_TOKEN=... node tools/sketchfab-fetch.mjs [slot ...]
//   (no args = fetch every slot; pass slot names to fetch a subset)
import { mkdir, writeFile, rm, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const pexec = promisify(execFile);
const __dir = dirname(fileURLToPath(import.meta.url));
const PRIV = join(__dir, '..', 'private-assets');

const TOKEN = process.env.SKETCHFAB_TOKEN;
if (!TOKEN) { console.error('SKETCHFAB_TOKEN not set — aborting (nothing printed).'); process.exit(1); }

// slot -> search query + per-model iPad triangle budget (faceCount cap) + a floor to
// skip near-empty placeholders. Keep each model well under ~100k tris for Safari.
const TARGETS = [
  { slot: 'castle',     q: 'hogwarts castle',     max: 150000, min: 2000 },
  { slot: 'great-hall', q: 'hogwarts great hall', max: 120000, min: 2000 },
  { slot: 'owl',        q: 'hedwig owl',          max: 90000,  min: 300 },
  { slot: 'harry',      q: 'harry potter',        max: 100000, min: 500 },
  { slot: 'hagrid',     q: 'hagrid',              max: 100000, min: 500 },
  { slot: 'hermione',   q: 'hermione',            max: 100000, min: 500 },
  { slot: 'ron',        q: 'ron weasley',         max: 100000, min: 500 },
  { slot: 'quidditch',  q: 'quidditch',           max: 120000, min: 500 },
  { slot: 'hut',        q: 'hagrid hut',          max: 120000, min: 500 },
];

const SEARCH = 'https://api.sketchfab.com/v3/search?type=models&downloadable=true&count=24&q=';

async function api(url, auth = false) {
  const headers = { 'User-Agent': 'hp-owl-games-hd/1.0 (private, personal use)' };
  if (auth) headers.Authorization = `Token ${TOKEN}`;   // header only, never logged
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r;
}

// Pick the best model under the triangle budget: real geometry, prefer popular /
// staff-picked, prefer the biggest model that still fits (more detail, still safe).
function pick(results, { max, min }) {
  const ok = results.filter(r =>
    r.isDownloadable && !r.isAgeRestricted &&
    typeof r.faceCount === 'number' && r.faceCount >= min && r.faceCount <= max);
  if (!ok.length) return null;
  ok.sort((a, b) => score(b) - score(a));
  return ok[0];
}
function score(r) {
  return (r.staffpickedAt ? 1e6 : 0) + (r.likeCount || 0) * 10 + (r.viewCount || 0) / 50;
}

// Find the glTF/GLB entry file inside an unzipped model folder (Sketchfab nests freely).
async function findEntry(dir, base = dir) {
  let entry = null, glb = null;
  for (const name of await readdir(dir)) {
    const full = join(dir, name);
    const s = await stat(full);
    if (s.isDirectory()) { const sub = await findEntry(full, base); if (sub) entry = entry || sub; continue; }
    if (/\.gltf$/i.test(name)) return relative(base, full);
    if (/\.glb$/i.test(name)) glb = relative(base, full);
  }
  return entry || glb;
}

async function fetchSlot(t) {
  const res = (await (await api(SEARCH + encodeURIComponent(t.q))).json()).results || [];
  const m = pick(res, t);
  if (!m) { console.log(`· ${t.slot}: no model within ${t.max} tris for "${t.q}"`); return null; }

  // Ask for download links (gltf zip preferred; glb is a single-file fallback).
  const dl = await (await api(`https://api.sketchfab.com/v3/models/${m.uid}/download`, true)).json();
  const archive = dl.gltf || dl.glb;
  if (!archive || !archive.url) { console.log(`· ${t.slot}: ${m.uid} has no gltf/glb download`); return null; }

  const dest = join(PRIV, t.slot);
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  const buf = Buffer.from(await (await fetch(archive.url)).arrayBuffer());  // signed URL, no token
  const zip = join(dest, '_dl.zip');
  await writeFile(zip, buf);
  try { await pexec('unzip', ['-o', '-q', zip, '-d', dest]); }
  catch (e) { console.log(`· ${t.slot}: unzip failed (${e.message})`); await rm(dest, { recursive: true, force: true }); return null; }
  await rm(zip, { force: true });

  const entry = await findEntry(dest);
  if (!entry) { console.log(`· ${t.slot}: no .gltf/.glb after unzip`); await rm(dest, { recursive: true, force: true }); return null; }
  console.log(`✓ ${t.slot}: "${m.name}" by ${m.user?.username} — ${m.faceCount} tris — ${entry} (${(buf.length / 1e6).toFixed(1)}MB)`);
  return {
    slot: t.slot, file: `${t.slot}/${entry.split(/[\\/]/).join('/')}`,
    name: m.name, uid: m.uid, faceCount: m.faceCount,
    author: m.user?.username, authorUrl: m.user?.profileUrl,
    license: m.license?.label || 'unknown', viewerUrl: m.viewerUrl,
  };
}

async function writeDocs(items) {
  const slots = {};
  for (const it of items) slots[it.slot] = { file: it.file, faceCount: it.faceCount };
  // index.json: the loader reads this to know which optional models are present.
  await writeFile(join(PRIV, 'index.json'),
    JSON.stringify({ _note: 'Auto-generated by tools/sketchfab-fetch.mjs. LOCAL ONLY — gitignored.', slots }, null, 2) + '\n');

  const rows = items.map(it =>
    `| ${it.slot} | ${it.name} | ${it.uid} | ${it.author} | ${it.license} | ${it.faceCount} | ${it.viewerUrl} |`).join('\n');
  const md = `# Private Sketchfab assets (LOCAL ONLY — gitignored, NEVER committed)

The repo is **public**. This file and every model in \`private-assets/\` are listed in
\`.gitignore\` and exist only on Elik's machine, for **private, non-commercial use with
his son**. Respect each model's license below; do not redistribute.

Regenerate with: \`SKETCHFAB_TOKEN=… node tools/sketchfab-fetch.mjs\`

## Downloaded models
| Slot | Name | UID | Author | License | Tris | Sketchfab URL |
|---|---|---|---|---|---|---|
${rows || '| _(none)_ | | | | | | |'}
`;
  await writeFile(join(PRIV, 'PRIVATE-ASSETS.md'), md);
}

async function main() {
  await mkdir(PRIV, { recursive: true });
  const only = process.argv.slice(2);
  const todo = only.length ? TARGETS.filter(t => only.includes(t.slot)) : TARGETS;
  const got = [];
  for (const t of todo) {
    try { const r = await fetchSlot(t); if (r) got.push(r); }
    catch (e) { console.log(`· ${t.slot}: ${e.message}`); }
  }
  await writeDocs(got);
  console.log(`\nDone: ${got.length}/${todo.length} slots in private-assets/ (gitignored). Token never written.`);
}

main().catch(e => { console.error('fatal:', e.message); process.exit(1); });
