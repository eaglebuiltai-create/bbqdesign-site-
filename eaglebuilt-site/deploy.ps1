# One command to ship the site, because the three ways a deploy silently
# fails have all happened:
#   - run from the repo root, where wrangler finds no assets and errors
#   - run before committing, so the change is not in the uploaded file
#   - believed to have run when it did not
# This script cannot be run from the wrong directory, refuses to deploy a
# failing build, and checks the live site afterwards rather than trusting
# the upload log.
#
# Usage:  .\deploy.ps1            test, push, deploy, verify
#         .\deploy.ps1 -NoPush    skip the git push
#         .\deploy.ps1 -SkipTests deploy without running the suite

[CmdletBinding()]
param(
  [switch]$NoPush,
  [switch]$SkipTests
)

$ErrorActionPreference = 'Stop'
$site = $PSScriptRoot                     # always eaglebuilt-site, however it is invoked
$repo = Split-Path $site -Parent

if (-not (Test-Path (Join-Path $site 'wrangler.toml'))) {
  throw "No wrangler.toml in $site - this script is not where it thinks it is."
}

function Step($n) { ""; "=== $n ===" }

# ---------------------------------------------------------------- tests
if ($SkipTests) {
  Step "tests (skipped)"
} else {
  Step "tests"
  Push-Location $site
  try {
    $out = & npm test 2>&1 | Out-String
    # Not anchored to the leading glyph: node prints "i tests 296" with a
    # character the console re-encodes into mojibake, which ate the match.
    foreach ($k in 'tests', 'pass', 'fail') {
      if ($out -match "(?m)\b$k\s+(\d+)\s*$") { "  $k : $($Matches[1])" }
    }
    if ($out -match '(?m)\bfail\s+([1-9]\d*)\s*$') {
      throw "Tests failed - not deploying. Run 'npm test' in $site to see which."
    }
  } finally { Pop-Location }
}

# ---------------------------------------------------------------- push
Step "git"
Push-Location $repo
try {
  $dirty = & git status --porcelain
  if ($dirty) {
    "  uncommitted changes - these will NOT be deployed unless you commit first:"
    $dirty | ForEach-Object { "    $_" }
  }
  $counts = (& git rev-list --left-right --count master...origin/master) -split '\s+'
  "  local master is $($counts[0]) ahead, $($counts[1]) behind origin"
  if ($NoPush) {
    "  push skipped (-NoPush)"
  } elseif ([int]$counts[0] -gt 0) {
    & git push origin master
    if (-not $?) { throw "git push failed." }
  } else {
    "  nothing to push"
  }
} finally { Pop-Location }

# ---------------------------------------------------------------- deploy
Step "deploy"
Push-Location $site
try {
  $log = & npx.cmd --yes wrangler deploy | Out-String
  $log -split "`n" | Where-Object { $_ -match '^\s*[+\-]\s*/|Uploaded|Current Version ID|ERROR' } |
    ForEach-Object { "  $($_.Trim())" }
  if ($log -match 'Current Version ID:\s*(\S+)') {
    $version = $Matches[1]
  } else {
    throw "Wrangler did not report a version - the deploy did not complete."
  }
} finally { Pop-Location }

# ---------------------------------------------------------------- verify
Step "verify against the live site"

# Check the Worker's own hostname first, then eaglebuilt.ai separately, so a
# file that never shipped reads differently from one that shipped and is still
# cached at the edge. The custom domain once returned CF-Cache-Status: HIT on
# 814 stale pages while this script printed "Deployed and verified".
#
# The Worker hostname is NOT an uncached origin - it answers HIT too. It is
# only the less-cached of the two, so both fetches carry a cache-buster. A
# stale copy can therefore cost a false DIFFERS, never a false MATCH: a cached
# body that hashes equal to the local file is the content we wanted anyway.
$ORIGIN = 'https://fragrant-butterfly-5c92.eaglebuilt.workers.dev'
$PUBLIC = 'https://eaglebuilt.ai'

# Cloudflare may ignore a query string when it builds a cache key for static
# assets, so this is a nudge rather than a guarantee - which is exactly why
# the DIFFERS message says to check what wrangler uploaded rather than
# asserting the deploy failed.
function Add-CacheBuster([string]$url) {
  $sep = if ($url.Contains('?')) { '&' } else { '?' }
  return $url + $sep + 'cb=' + [guid]::NewGuid().ToString('N')
}

# A cutout page is in the list because those 814 generated files are the
# largest block of output and the easiest to leave stale: they are rebuilt
# from the designer catalogue, so a catalogue edit silently invalidates them.
$checks = @(
  @{ path = 'site/design/app/index.html';                              route = '/design/app/' },
  @{ path = 'site/assets/eagle-engine.js';                             route = '/assets/eagle-engine.js' },
  @{ path = 'site/dimensions/cutouts/alfresco/agbc-14/index.html';     route = '/dimensions/cutouts/alfresco/agbc-14/' },
  @{ path = 'site/dimensions/cutouts/index.html';                      route = '/dimensions/cutouts/' }
)
# Cloudflare Web Analytics injects a beacon script into HTML responses, so
# the bytes on the wire are legitimately not the bytes on disk. Strip that
# one line before comparing, or every HTML check reports a false DIFFERS.
function Get-Body([string]$path) {
  $t = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
  $t = [regex]::Replace($t, '(?m)^[^\r\n]*cloudflareinsights\.com[^\r\n]*\r?\n?', '')
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $h = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($t))
    return @{ hash = [BitConverter]::ToString($h).Replace('-', ''); len = $t.Length }
  } finally { $sha.Dispose() }
}

$bad = 0
$stale = 0
foreach ($c in $checks) {
  $local = Join-Path $site $c.path
  if (-not (Test-Path $local)) { "  SKIP     $($c.path) (not on disk)"; continue }
  $tmp = [System.IO.Path]::GetTempFileName()
  try {
    (New-Object System.Net.WebClient).DownloadFile((Add-CacheBuster ($ORIGIN + $c.route)), $tmp)
    $l = Get-Body $local
    $v = Get-Body $tmp
    if ($l.hash -eq $v.hash) {
      "  MATCH    $($c.path)  ($($l.len) chars)"
    } else {
      "  DIFFERS  $($c.path)  local $($l.len) chars, origin $($v.len)"
      "           the deploy did not ship this file - do not trust the upload log"
      $bad++
      continue
    }

    # Shipped correctly. Now ask whether the public domain is still serving an
    # older copy from cache - a separate problem with a separate fix, and one
    # that reads as "working fine" from the origin's point of view.
    try {
      $req = [System.Net.HttpWebRequest]::Create((Add-CacheBuster ($PUBLIC + $c.route)))
      $req.Method = 'GET'
      $req.Timeout = 60000
      $res = $req.GetResponse()
      try {
        $cf = $res.Headers['CF-Cache-Status']
        $sr = New-Object System.IO.StreamReader($res.GetResponseStream())
        $txt = $sr.ReadToEnd(); $sr.Close()
        $txt = [regex]::Replace($txt, '(?m)^[^\r\n]*cloudflareinsights\.com[^\r\n]*\r?\n?', '')
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try { $ph = [BitConverter]::ToString($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($txt))).Replace('-', '') }
        finally { $sha.Dispose() }
        if ($ph -ne $l.hash) {
          "           ...but eaglebuilt.ai is serving an older copy (CF-Cache-Status: $cf)"
          $stale++
        }
      } finally { $res.Close() }
    } catch {
      "           (could not check the public domain: $($_.Exception.Message))"
    }
  } finally { Remove-Item $tmp -ErrorAction SilentlyContinue }
}

""
if ($bad -gt 0) {
  "Version $version deployed, but $bad file(s) never reached the origin."
  "Do not trust the upload log - look at what wrangler actually uploaded."
  exit 1
} elseif ($stale -gt 0) {
  "Version $version is live at the origin, but $stale file(s) are still"
  "cached at eaglebuilt.ai. The deploy worked; the edge has not caught up."
  "Purge it: Cloudflare dashboard -> Caching -> Configuration -> Purge Everything."
  exit 2
} else {
  "Deployed and verified, origin and eaglebuilt.ai agree. Version $version"
}
