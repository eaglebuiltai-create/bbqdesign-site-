#!/usr/bin/env bash
# Renders the home-screen icons into site/assets/app/ with headless Chrome.
# Run from eaglebuilt-site:  bash tools/app-icons.sh
set -e
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
BASE="file:///C:/Users/johns/Eaglebuilt%20AI.%20Claude/eaglebuilt-site/tools/app-icon.html"
OUT="C:/Users/johns/Eaglebuilt AI. Claude/eaglebuilt-site/site/assets/app"
mkdir -p "$OUT"
render () { # file size emblem-width
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --virtual-time-budget=2000 --window-size="$2,$2" \
    --screenshot="$OUT/$1" "$BASE?w=$3" >/dev/null 2>&1
  echo "  site/assets/app/$1  (${2}x$2)"
}
render icon-192.png 192 0.78
render icon-512.png 512 0.78
render icon-maskable-512.png 512 0.6
render apple-touch-icon.png 180 0.78
