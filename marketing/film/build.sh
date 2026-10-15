#!/bin/sh
# Renders the Waqt product film end to end. macOS only (uses AVFoundation and
# afconvert), plus Node and Google Chrome. See README.md.
set -e
cd "$(dirname "$0")"

[ -d node_modules ] || npm install

echo "▸ building the app the film records"
(cd ../.. && npx vite build --outDir marketing/film/.app --emptyOutDir >/dev/null)

if [ "$1" != "--audio-only" ]; then
  echo "▸ rendering frames"
  rm -rf frames
  node render.mjs
fi

echo "▸ mixing sound"
node audio.mjs

echo "▸ encoding"
mkdir -p work
swiftc -O encode.swift -o work/encode
./work/encode frames work/mix.wav ../waqt-film-master.mp4 1920 1080 10000000
./work/encode frames work/mix.wav ../../public/landing/waqt-demo.mp4 1600 900 1400000

# poster: the three displays paused, mid-adhan
sips -s format jpeg -s formatOptions 82 -Z 1600 frames/f00900.jpg --out ../../public/landing/waqt-demo-poster.jpg >/dev/null
echo "✓ marketing/waqt-film-master.mp4 and public/landing/waqt-demo.mp4"
