// Checks that every file listed in the manifests is reachable on a deployed site.
// Usage: node check-remote.js <local site dir> <site url>
'use strict';
const fs = require('fs');
const path = require('path');

const [dir, base] = process.argv.slice(2);
if (!dir || !base) {
  console.error('Usage: node check-remote.js <local site dir> <site url>');
  process.exit(1);
}
const root = base.replace(/\/?$/, '/');
const urls = new Set(['index.html', 'game.html', 'touch.js', 'openchaos.js', 'openchaos.wasm', 'manifest_en.json', 'manifest_ru.json']);
for (const lang of ['en', 'ru']) {
  const file = path.join(dir, `manifest_${lang}.json`);
  if (!fs.existsSync(file)) continue;
  for (const [, , url] of JSON.parse(fs.readFileSync(file, 'utf8'))) urls.add('data/' + url);
}

(async () => {
  const list = [...urls];
  const missing = [];
  let next = 0;
  async function worker() {
    while (next < list.length) {
      const u = list[next++];
      const href = root + u.split('/').map(encodeURIComponent).join('/');
      let status = 0;
      for (let i = 0; i < 3 && status !== 200; i++) {
        try { status = (await fetch(href, { method: 'HEAD' })).status; } catch { status = -1; }
      }
      if (status !== 200) missing.push(`${status} ${u}`);
    }
  }
  await Promise.all(Array.from({ length: 16 }, worker));
  console.log(`checked ${list.length}, missing ${missing.length}`);
  for (const m of missing.sort()) console.log(m);
})();
