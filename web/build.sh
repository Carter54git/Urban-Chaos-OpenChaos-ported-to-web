#!/usr/bin/env bash
# Builds the WebAssembly engine (OpenChaos -> web/dist/openchaos.js + openchaos.wasm).
# Requires an activated Emscripten SDK (source <emsdk>/emsdk_env.sh), CMake and Ninja.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$ROOT/build-web"

if [ ! -f "$BUILD/build.ninja" ]; then
  emcmake cmake -S "$ROOT/engine/new_game" -B "$BUILD" -G Ninja -DCMAKE_BUILD_TYPE=Release
fi
cmake --build "$BUILD"

mkdir -p "$ROOT/web/dist"
cp "$BUILD/Release/openchaos.js" "$BUILD/Release/openchaos.wasm" "$ROOT/web/dist/"
echo "Engine built: $ROOT/web/dist"
