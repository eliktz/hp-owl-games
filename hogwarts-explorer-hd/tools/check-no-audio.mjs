#!/usr/bin/env node
// Guard: the games must never ship, bundle or fetch an audio file. All in-game sound is
// synthesised with WebAudio, and background music is DEVICE-LOCAL only (the family picks a
// file on each device; it lives in that browser's IndexedDB, never in this repository).
//
// There is no build or dist step in this project: GitHub Pages serves the static files of the
// repository as they are, so the repository working tree IS what gets published.
//
// Usage:
//   node hogwarts-explorer-hd/tools/check-no-audio.mjs          check the repo (tree + git ls-files)
//   node hogwarts-explorer-hd/tools/check-no-audio.mjs <dir>    check any folder (e.g. an export copy)
// Fails (exit 1, listing the paths) if any file has an audio extension or starts with audio
// magic bytes, or if HD source text contains an http(s) URL to an audio file.
// Plain Node, no dependencies.
import { readdirSync, lstatSync, openSync, readSync, closeSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const EXT = ['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac', 'aif', 'aiff', 'wma', 'mid', 'midi', 'weba', 'caf', 'amr'];
const EXT_SET = new Set(EXT.map(e => '.' + e));
const SKIP_DIRS = new Set(['.git', 'node_modules', '_test']);   // _test folders are gitignored
const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.html', '.htm', '.css', '.json', '.webmanifest', '.md', '.txt', '.svg', '.xml']);
const URL_RE = new RegExp(`https?://[^\\s'"\`()<>]+\\.(?:${EXT.join('|')})(?=[?#'"\`\\s)<>]|$)`, 'gi');

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const argDir = process.argv[2] ? resolve(process.argv[2]) : null;
const root = argDir || repoRoot;
if (!existsSync(root)) { console.error('no such directory: ' + root); process.exit(2); }

function magic(file) {
  let fd; const b = Buffer.alloc(16);
  try { fd = openSync(file, 'r'); const n = readSync(fd, b, 0, 16, 0); if (n < 4) return null; }
  catch { return null; } finally { if (fd !== undefined) closeSync(fd); }
  const a = (o, s) => b.toString('latin1', o, o + s.length) === s;
  if (a(0, 'ID3')) return 'ID3 (mp3)';
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0) return 'MPEG audio frame';
  if (a(0, 'fLaC')) return 'fLaC';
  if (a(0, 'OggS')) return 'OggS';
  if (a(0, 'RIFF') && a(8, 'WAVE')) return 'RIFF WAVE';
  if (a(0, 'FORM') && (a(8, 'AIFF') || a(8, 'AIFC'))) return 'FORM AIFF';
  if (a(0, 'MThd')) return 'MThd (midi)';
  if (a(4, 'ftyp') && (a(8, 'M4A ') || a(8, 'M4B ') || a(8, 'M4P '))) return 'ftyp M4A';
  if (a(0, '#!AMR')) return 'AMR';
  if (a(0, 'caff')) return 'CAF';
  return null;
}

const bad = [];
function checkFile(abs, rel) {
  const ext = extname(abs).toLowerCase();
  if (EXT_SET.has(ext)) bad.push(`${rel}  (audio extension ${ext})`);
  const m = magic(abs); if (m) bad.push(`${rel}  (audio magic bytes: ${m})`);
  // audio URLs in HD source text (and any text file when checking a given folder)
  const scanText = TEXT_EXT.has(ext) && (argDir || rel.startsWith('hogwarts-explorer-hd/'));
  if (scanText && rel !== 'hogwarts-explorer-hd/tools/check-no-audio.mjs') {
    let txt = ''; try { txt = readFileSync(abs, 'utf8'); } catch { return; }
    const hits = txt.match(URL_RE); if (hits) for (const h of new Set(hits)) bad.push(`${rel}  (audio URL ${h})`);
  }
}

let walked = 0;
function walk(dir) {
  let names; try { names = readdirSync(dir); } catch { return; }
  for (const n of names) {
    const abs = join(dir, n); let st; try { st = lstatSync(abs); } catch { continue; }
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) { if (!SKIP_DIRS.has(n)) walk(abs); continue; }
    if (!st.isFile()) continue;
    walked++; checkFile(abs, relative(root, abs).split('\\').join('/'));
  }
}
walk(root);

// Also everything git tracks (catches a tracked file inside a skipped folder).
let tracked = 0;
if (!argDir) {
  try {
    const out = execFileSync('git', ['-C', repoRoot, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 << 20 });
    for (const rel of out.split('\0').filter(Boolean)) {
      tracked++;
      const abs = join(repoRoot, rel);
      if (rel.split('/').some(p => SKIP_DIRS.has(p))) checkFile(abs, rel);
      else if (EXT_SET.has(extname(rel).toLowerCase()) && !existsSync(abs)) bad.push(`${rel}  (tracked audio extension, missing in tree)`);
    }
  } catch (e) { console.error('git ls-files failed: ' + (e.message || e)); process.exit(2); }
}

const uniq = [...new Set(bad)];
if (uniq.length) {
  console.error(`check-no-audio: FAIL in ${root}\n  ` + uniq.join('\n  '));
  process.exit(1);
}
console.log(`check-no-audio: OK (${walked} files walked${argDir ? '' : `, ${tracked} tracked by git`}) in ${root}`);
