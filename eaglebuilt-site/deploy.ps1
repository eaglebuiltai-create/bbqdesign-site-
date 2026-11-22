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
$checks = @(
  @{ path = 'site/design/app/index.html'; url = 'https://eaglebuilt.ai/design/app/' },
  @{ path = 'site/assets/eagle-engine.js'; url = 'https://eaglebuilt.ai/assets/eagle-engine.js' }
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
foreach ($c in $checks) {
  $local = Join-Path $site $c.path
  if (-not (Test-Path $local)) { continue }
  $tmp = [System.IO.Path]::GetTempFileName()
  try {
    $u = $c.url + '?cb=' + [guid]::NewGuid().ToString('N')
    (New-Object System.Net.WebClient).DownloadFile($u, $tmp)
    $l = Get-Body $local
    $v = Get-Body $tmp
    if ($l.hash -eq $v.hash) {
      "  MATCH    $($c.path)  ($($l.len) chars)"
    } else {
      "  DIFFERS  $($c.path)  local $($l.len) chars, live $($v.len)"
      "           the deploy did not ship this file - do not trust the upload log"
      $bad++
    }
  } finally { Remove-Item $tmp -ErrorAction SilentlyContinue }
}

""
if ($bad -eq 0) {
  "Deployed and verified. Version $version"
} else {
  "Version $version deployed, but $bad file(s) do not match the live site."
  exit 1
}
