#!/usr/bin/env bash
# Draws the pictures for the designer's sample islands (EB_SAMPLES in
# site/design/app/index.html) into site/design/app/samples/, using the
# designer's own 3D view. Needs the local site running on :8080
# (the "site" entry in .claude/launch.json, or: npx serve site -l 8080).
# Run from eaglebuilt-site:  bash tools/sample-shots.sh
set -e
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
OUT="C:/Users/johns/Eaglebuilt AI. Claude/eaglebuilt-site/site/design/app/samples"
mkdir -p "$OUT"
for k in "${@:-straight ell yu}"; do
  for key in $k; do
    "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
      --virtual-time-budget=6000 --window-size=1200,800 \
      --screenshot="$OUT/$key.png" "http://localhost:8080/design/app/?shot=$key" >/dev/null 2>&1
    echo "  site/design/app/samples/$key.png"
  done
done
