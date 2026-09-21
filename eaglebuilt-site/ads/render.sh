#!/usr/bin/env bash
# Renders every concept x size to out/*.png with headless Chrome.
# Exact pixel sizes, no upscaling — what comes out is what you upload.
set -e
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
BASE="file:///C:/Users/johns/Eaglebuilt%20AI.%20Claude/eaglebuilt-site/ads/ad.html"
OUT="C:/Users/johns/Eaglebuilt AI. Claude/eaglebuilt-site/ads/out"

render () { # concept size w h
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --virtual-time-budget=4000 --window-size="$3,$4" \
    --screenshot="$OUT/eaglebuilt-$1-$2.png" "$BASE?c=$1&s=$2" >/dev/null 2>&1
  echo "  out/eaglebuilt-$1-$2.png  ($3x$4)"
}

for c in "${@:-tool craft cost firepit fireplace}"; do
  render "$c" square   1080 1080
  render "$c" portrait 1080 1350
  render "$c" story    1080 1920
done
