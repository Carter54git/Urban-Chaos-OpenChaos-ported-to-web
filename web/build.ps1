# Builds the WebAssembly engine (OpenChaos -> openchaos.js / openchaos.wasm in web/dist).
# Then assemble a site with: node web/tools/prepare.js --game <game dir> [--rus <dir>] --out <dir>
# Run: powershell -ExecutionPolicy Bypass -File web\build.ps1
$root = Split-Path -Parent $PSScriptRoot
$engine = Join-Path $root 'engine'
if (-not (Test-Path $engine)) { $engine = Join-Path $root 'OpenChaos-main' }
$emsdk = if ($env:EMSDK) { $env:EMSDK } else { Join-Path (Split-Path -Parent $root) 'emsdk' }
& (Join-Path $emsdk 'emsdk_env.ps1') *> $null

$build = Join-Path $root 'build-web'
if (-not (Test-Path (Join-Path $build 'Makefile'))) {
    emcmake cmake -S (Join-Path $engine 'new_game') -B $build -G 'MinGW Makefiles' -DCMAKE_MAKE_PROGRAM=make -DCMAKE_BUILD_TYPE=Release
}
make -C $build -j16
if ($LASTEXITCODE -ne 0) { throw 'build failed' }

$dist = Join-Path $PSScriptRoot 'dist'
New-Item -ItemType Directory -Force $dist | Out-Null
Copy-Item (Join-Path $build 'Release/openchaos.js'), (Join-Path $build 'Release/openchaos.wasm') $dist -Force
Write-Host "Engine built: $dist"
