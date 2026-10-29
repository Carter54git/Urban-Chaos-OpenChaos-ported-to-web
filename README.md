<div align="center">

# URBAN CHAOS · WEB

**Urban Chaos (Mucky Foot, 1999) running right in your browser.**
The [OpenChaos](https://github.com/UltimaBeaR/OpenChaos) engine compiled to WebAssembly: WebGL2, WebAudio, cutscenes, browser saves,
keyboard & mouse, gamepads and on-screen touch controls. English and Russian versions behind one launcher.

[Project page](docs/index.html) · [Build from scratch](#building-from-scratch) · [Where to put the game files](#where-to-put-the-game-files) · [Hosting](#deploying-to-a-web-host)

</div>

---

> **This repository contains no game files.** Textures, levels, audio, videos and text belong to their rights holders.
> To play you need **your own legal copy** of Urban Chaos: CD, Steam or GOG.

## What's inside

```
engine/            OpenChaos (C++), adapted to build with Emscripten
  new_game/          engine sources; web changes are wrapped in #ifdef __EMSCRIPTEN__
  libDualsense/      OpenChaos dependency (needed to build)
web/
  launcher.html      launcher: pick the English or Russian version  -> index.html
  game.html          game page (?lang=en | ?lang=ru)
  touch.js           on-screen touch controls (exposed to the game as a virtual gamepad)
  oc_web_lib.js      engine <-> browser glue: frames, file streaming, video, saves
  htaccess           Apache settings                                -> .htaccess
  build.ps1 / build.sh   build the engine into web/dist
  tools/prepare.js   builds a ready-to-upload site from your copy of the game
  tools/serve.js     local test server
docs/index.html    project page (GitHub Pages)
```

## Quick start: prebuilt engine

If [Releases](../../releases) has `openchaos.js` and `openchaos.wasm`, put them into `web/dist/` and go straight to step 2 below. No engine build needed.

## Where to put the game files

### 1. Prepare the game folder

You need an **installed** game: the folder containing `clumps/`, `levels/`, `server/`, `talk2/`, `text/`, `Textures/`, `data/`, `bink/` and so on.

| Source | What to do |
|---|---|
| **Steam** | `C:\Program Files (x86)\Steam\steamapps\common\Urban Chaos\` |
| **GOG** | the GOG install folder |
| **CD / ISO** | install the game from the disc and use the install folder (e.g. `C:\Program Files\Eidos Interactive\Urban Chaos\`). If you can't install it, unpack `data1.cab` with [unshield](https://github.com/twogood/unshield): `unshield -d out x data1.cab`, then merge `out/Global_Media`, `out/Local_Media_-_English` and the `talk2`, `clumps`, `bink`, `data` folders from the disc into one folder |

Executables (`.exe`, `.dll`) are not needed; the script skips them.

**Russian version (optional):** a separate folder with the Russian translation, laid out like the game folder (`text/`, `talk2/`, `clumps/`, `levels/`, `Textures/`, `Data/`, `bink/`). It is layered on top of the English data, so only the files that differ are uploaded.

**Launcher art (optional):** put any 616×353 image at `web/capsule.jpg`. Without it the launcher shows a text logo.

### 2. Build the site

Requires [Node.js](https://nodejs.org) 18+ and, for cutscenes, [FFmpeg](https://ffmpeg.org) on `PATH`. Bink videos are transcoded to MP4. Without FFmpeg the game still works, cutscenes are just skipped.

```bash
node web/tools/prepare.js --game "C:/Games/Urban Chaos" --rus "C:/Games/UC_rus" --out site
```

Leave out `--rus` if you don't have the translation; the "Русская" button will then not work.

Result:

```
site/
  index.html          launcher
  game.html           game
  touch.js            touch controls
  openchaos.js        engine
  openchaos.wasm
  manifest_en.json    file list of the English version
  manifest_ru.json    file list of the Russian version
  capsule.jpg
  .htaccess
  data/en/...         game files (~450 MB)
  data/ru/...         translation files only (~260 MB)
```

### 3. Test locally

```bash
node web/tools/serve.js site 8080
```

Open <http://localhost:8080/>. The game will not start from `file://`; it needs a web server.

## Deploying to a web host

Upload the **contents** of `site/` to the site root or any subfolder. Any static host works: Apache, nginx, S3, Cloudflare R2, etc.

- `.wasm` must be served as `application/wasm`. For Apache, `.htaccess` handles it. For nginx: `types { application/wasm wasm; }`.
- The server must support Range requests for `.mp4` (almost all do).
- Game files are streamed on demand: only what the current menu or level needs is downloaded, then the browser cache serves it.

## Building from scratch

### Requirements

- [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) (tested with 4.x):
  ```bash
  git clone https://github.com/emscripten-core/emsdk.git
  cd emsdk && ./emsdk install latest && ./emsdk activate latest
  ```
- CMake 3.25+
- Windows: GNU make (`choco install make` or the one from Git for Windows). Linux/macOS: Ninja.

SDL3 and OpenAL come from Emscripten ports, FFmpeg is not needed by the engine (the browser plays the videos), and `nlohmann/json` is bundled in `web/third_party`.

### Windows

Put `emsdk` next to the repository folder or set the `EMSDK` environment variable:

```powershell
powershell -ExecutionPolicy Bypass -File web\build.ps1
```

### Linux / macOS

```bash
source /path/to/emsdk/emsdk_env.sh
./web/build.sh
```

Output: `web/dist/openchaos.js` and `web/dist/openchaos.wasm`. Then run step 2.

## Controls

**Keyboard & mouse:** `W` `A` `S` `D` move, mouse looks, left click punches, right click kicks, `Space` jump, `Shift` run, `F` use, `C` sneak, `E` aim (siren in a car), `1`–`4` weapons, `Tab` inventory, `Esc` pause / skip cutscene, `F11` fullscreen. In a car: `W` gas, `S` reverse, `Space` brake.

**Gamepad** (Xbox, PlayStation, generic, via the browser Gamepad API): left stick move, right stick camera, A jump, B run, X use, Y sneak, RT punch / gas, RB kick, LB aim / brake, LT reverse, R3 next weapon, D-pad weapons, Start pause. Browsers only report a pad after its first button press. A DualSense is handled as a regular pad, since the browser has no HID access for the native DualSense library.

**Touch screen:** phones and tablets get on-screen controls automatically; touch laptops get them on the first touch. They are fed to the engine as a virtual standard gamepad, so menus, on-foot play and driving work exactly like with a real pad:

- left half: floating analog stick (touch anywhere, drag);
- right half: drag to look around;
- action buttons on the right (JUMP, RUN, USE, HIDE, PUNCH, KICK, AIM, REV, GUN); you can slide a finger between them;
- D-pad (weapons, menu navigation), pause, TAB and fullscreen at the top;
- the buttons scale to the screen size, a "rotate your device" hint appears in portrait mode, tap a cutscene to skip it;
- plugging in a real gamepad hides the on-screen controls.

## How it works

- **Graphics.** The OpenGL 4.1 renderer runs on WebGL2. GLSL 4.10 shaders are translated to GLSL ES 3.00 at load time; BGRA textures and swizzles are emulated (`engine/.../glad/include/glad/oc_webgl.h`).
- **Main loop.** The game's blocking loop runs under Asyncify: on every frame present the engine yields to the browser until the next `requestAnimationFrame`.
- **Files.** The game opens files as usual; `oc_web_fetch_asset` downloads each file on first access. Name case doesn't matter, lookups go through the manifest.
- **Video.** `.bik` files are transcoded to MP4 ahead of time and played by a `<video>` element over the game. Skip with Esc, Enter, Space, a click or a tap.
- **Russian fonts.** The translation draws Cyrillic letters into the accented-letter slots of the game's fonts and ships a patched `Fallen.exe` with matching character tables. The web build carries the same tables (`FONT2D_punct_ru`, `frontend_fonttable_ru`) and switches to them for `?lang=ru`.
- **Saves and settings** are stored in the browser's IndexedDB.

## Credits and rights

- **Urban Chaos** © 1999 Mucky Foot Productions / Eidos Interactive.
- The game source code is open under MIT: [dizzy2003/MuckyFoot-UrbanChaos](https://github.com/dizzy2003/MuckyFoot-UrbanChaos).
- **OpenChaos**, the modernised engine: [UltimaBeaR/OpenChaos](https://github.com/UltimaBeaR/OpenChaos), MIT. Licences: `engine/LICENSE`, `engine/THIRD_PARTY_LICENSES.md`.
- Web port: MIT, see [`LICENSE`](LICENSE). The licence does not cover the game files.
- Web port author: [github.com/Carter54git](https://github.com/Carter54git) · Telegram: [t.me/gamebase54](https://t.me/gamebase54)
