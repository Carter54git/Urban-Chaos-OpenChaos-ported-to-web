#!/usr/bin/env node
// Assembles a ready-to-host folder of the Urban Chaos web version.
//
//   node web/tools/prepare.js --game <installed game dir> [--rus <russifier dir>] --out <folder>
//
// --game  Urban Chaos installed from CD, Steam or GOG (the folder with clumps/, levels/, ...).
// --rus   Optional: a russifier folder laid out like the game folder. Only its files are
//         uploaded (data/ru/); the Russian version reads everything else from data/en/.
// --out   Output folder: launcher, engine and game data, ready to upload as is.
//
// Bink videos (.bik) are transcoded to MP4 with ffmpeg (must be on PATH); without
// ffmpeg the game still works, videos are just skipped.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

const gameDir = arg('game');
const rusDir = arg('rus');
const outDir = arg('out');
if (!gameDir || !outDir) {
  console.error('Usage: node prepare.js --game <game dir> [--rus <russifier dir>] --out <output dir>');
  process.exit(1);
}

const WEB = path.resolve(__dirname, '..');
const ENGINE_FILES = ['openchaos.js', 'openchaos.wasm'];
const SITE_FILES = { 'launcher.html': 'index.html', 'game.html': 'game.html', 'touch.js': 'touch.js', 'capsule.jpg': 'capsule.jpg', 'htaccess': '.htaccess' };
// Windows binaries, installer leftovers and bonus folders the web build never reads.
const SKIP_EXT = new Set(['.exe', '.dll', '.m3d', '.tsk', '.isu', '.rtf', '.url', '.bik']);
const SKIP_DIRS = new Set(['internet', 'mplayer', 'backup']);

function hasFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Copies the game files of `src` into `dst`; returns [relative path, size] pairs.
function copyTree(src, dst) {
  const files = [];
  (function walk(dir, rel) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name.toLowerCase())) walk(p, r);
        continue;
      }
      if (SKIP_EXT.has(path.extname(e.name).toLowerCase())) continue;
      const target = path.join(dst, r);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(p, target);
      files.push([r, fs.statSync(p).size]);
    }
  })(src, '');
  return files;
}

// Transcodes every bink/*.bik of `src` into `dst`/bink_web/*.mp4.
function convertVideos(src, dst) {
  const files = [];
  const binkDir = fs.readdirSync(src).find((n) => n.toLowerCase() === 'bink');
  if (!binkDir) return files;
  for (const name of fs.readdirSync(path.join(src, binkDir))) {
    if (path.extname(name).toLowerCase() !== '.bik') continue;
    const rel = 'bink_web/' + path.basename(name, path.extname(name)) + '.mp4';
    const target = path.join(dst, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target)) {
      console.log('  video: ' + name);
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', path.join(src, binkDir, name),
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', target], { stdio: 'inherit' });
    }
    files.push([rel, fs.statSync(target).size]);
  }
  return files;
}

// Manifest entry: [path inside the game folder, size, URL relative to data/].
function writeManifest(name, entries) {
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(entries));
  console.log(`${name}: ${entries.length} files`);
}

const ffmpeg = hasFfmpeg();
if (!ffmpeg) console.warn('ffmpeg not found: videos will be skipped in the game.');

fs.mkdirSync(outDir, { recursive: true });
for (const f of ENGINE_FILES) {
  const src = path.join(WEB, 'dist', f);
  if (!fs.existsSync(src)) {
    console.error(`Missing ${src}: build the engine first (web/build.ps1 or web/build.sh).`);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(outDir, f));
}
for (const [src, dst] of Object.entries(SITE_FILES)) {
  // capsule.jpg (launcher art) is optional: the launcher falls back to a text logo.
  if (fs.existsSync(path.join(WEB, src))) fs.copyFileSync(path.join(WEB, src), path.join(outDir, dst));
}

console.log('English data...');
const enDir = path.join(outDir, 'data', 'en');
const en = copyTree(gameDir, enDir);
if (ffmpeg) en.push(...convertVideos(gameDir, enDir));
const enEntries = en.map(([p, s]) => [p, s, 'en/' + p]);
writeManifest('manifest_en.json', enEntries);

if (rusDir) {
  console.log('Russian data...');
  const ruDir = path.join(outDir, 'data', 'ru');
  const ru = copyTree(rusDir, ruDir);
  if (ffmpeg) ru.push(...convertVideos(rusDir, ruDir));
  // Russian files replace English ones case-insensitively; the in-game path keeps
  // the English spelling so directory listings stay consistent.
  const merged = new Map(enEntries.map((e) => [e[0].toLowerCase(), e]));
  for (const [p, s] of ru) {
    const key = p.toLowerCase();
    const fsPath = merged.has(key) ? merged.get(key)[0] : p;
    merged.set(key, [fsPath, s, 'ru/' + p]);
  }
  writeManifest('manifest_ru.json', [...merged.values()]);
}

console.log('Done: ' + path.resolve(outDir));
