// Emscripten JS library: browser glue for the OpenChaos web build.
// See new_game/src/engine/platform/oc_web.h for the C side.

addToLibrary({
  oc_web_wait_frame__async: true,
  oc_web_wait_frame: function () {
    return Asyncify.handleAsync(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
  },

  oc_web_fetch_asset__async: true,
  oc_web_fetch_asset: function (pathPtr, outPtr, outSize) {
    let p = UTF8ToString(pathPtr).replace(/\\/g, '/');
    const root = Module.ocGameRoot;
    if (p.startsWith(root + '/')) p = p.substring(root.length + 1);
    else if (p.startsWith('/')) return 0;
    const parts = [];
    for (const c of p.split('/')) {
      if (c === '' || c === '.') continue;
      if (c === '..') parts.pop(); else parts.push(c);
    }
    const real = Module.ocManifest.get(parts.join('/').toLowerCase());
    if (real === undefined) return 0;
    const full = root + '/' + real;
    stringToUTF8(full, outPtr, outSize);
    // While Asyncify rewinds it re-enters this import and expects handleAsync
    // to hand back the stored result, even though the file is loaded by now.
    if (Module.ocLoaded.has(real) && Asyncify.state === Asyncify.State.Normal) return 1;
    return Asyncify.handleAsync(async () => {
      if (Module.ocLoaded.has(real)) return 1;
      let data;
      try {
        data = await Module.ocFetchAsset(real);
      } catch (e) {
        // Missing on the server: drop the placeholder so the game treats the
        // file as absent (e.g. skips a sound) instead of stalling.
        console.warn('Asset unavailable:', real, e);
        try { FS.unlink(full); } catch (_) {}
        Module.ocManifest.delete(parts.join('/').toLowerCase());
        return 0;
      }
      const dir = full.substring(0, full.lastIndexOf('/'));
      FS.mkdirTree(dir);
      FS.writeFile(full, data);
      Module.ocLoaded.add(real);
      return 1;
    });
  },

  oc_web_play_video__async: true,
  oc_web_play_video: function (pathPtr, allowSkip) {
    const path = UTF8ToString(pathPtr).replace(/\\/g, '/');
    return Asyncify.handleAsync(() => Module.ocPlayVideo ? Module.ocPlayVideo(path, !!allowSkip) : 0);
  },

  oc_web_sync_saves: function () {
    if (Module.ocSyncSaves) Module.ocSyncSaves();
  },
});
