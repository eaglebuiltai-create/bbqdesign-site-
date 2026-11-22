/* Cutout reference pages: the generated HTML must never say more than the
   data does. Run tools/build-cutouts.mjs first (CI-free repo: the pages are
   committed, so this checks the committed output against data/cutouts.json). */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(ROOT, "site");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data/cutouts.json"), "utf8"));
const BRAND_SLUG = { "Yoder Smokers": "yoder", "Diablo Grills": "diablo-grills" };
const BRAND = Object.fromEntries([...new Set(DATA.map(r => r.brand))].map(b => [b, BRAND_SLUG[b] || b.toLowerCase().replace(/[^a-z0-9]+/g, "-")]));
const slug = s => s.toLowerCase().replace(/[()]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const pageOf = r => path.join(SITE, "dimensions/cutouts", BRAND[r.brand], slug(r.model), "index.html");
const retired = new Set(DATA.filter(r => r.model === "BLZ-26-PZOVN" || (r.discontinued && r.replaced_by && !r.cutout_in)).map(r => r.model));
const live = DATA.filter(r => !retired.has(r.model));
const read = f => fs.readFileSync(f, "utf8");
const ld = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
const pages = () => [
  path.join(SITE, "dimensions/cutouts/index.html"),
  ...Object.values(BRAND).map(b => path.join(SITE, "dimensions/cutouts", b, "index.html")),
  ...live.map(pageOf),
];

test("one page per live model, titled '<Brand> <Model> Cutout Dimensions | EagleBuilt'", () => {
  for (const r of live) {
    const html = read(pageOf(r));
    const t = html.match(/<title>([^<]+)<\/title>/)[1];
    assert.ok(t.startsWith(r.brand + " ") && t.endsWith(" Cutout Dimensions | EagleBuilt"), t);
    assert.ok(t.includes(r.model.split(" ")[0]), t);
    assert.match(html, /<link rel="canonical" href="https:\/\/eaglebuilt\.ai\/dimensions\/cutouts\//);
    assert.match(html, /Always confirm with the manufacturer's spec sheet before cutting/);
    assert.match(html, /Design an island with this/);
    assert.match(html, /\(916\) 359-9692/);
  }
});

test("no prices, ratings or reviews on any cutout page", () => {
  for (const f of pages()) {
    const html = read(f);
    assert.doesNotMatch(html, /\$\s?\d/, f);
    const json = JSON.stringify(ld(html));
    assert.doesNotMatch(json, /"(offers|price|priceCurrency|aggregateRating|review)"/, f);
  }
});

test("JSON-LD parses and dimensions match the data exactly", () => {
  for (const r of live) {
    const graph = ld(read(pageOf(r)))[0]["@graph"];
    const p = graph.find(n => n["@type"] === "Product");
    assert.equal(p.model, r.model);
    const prop = n => { const x = p.additionalProperty.find(y => y.name === n) || {}; return x.value ?? x.minValue; };
    const c = r.cutout_in || {};
    assert.equal(prop("Cutout width") ?? null, c.w ?? null);
    assert.equal(prop("Cutout height") ?? null, c.h ?? null);
    assert.equal(prop("Cutout depth") ?? null, c.d ?? null);
  }
});

test("a missing dimension says 'check spec sheet', never a guess", () => {
  for (const r of live) {
    const html = read(pageOf(r));
    const big = html.match(/<div class="co coBig"[\s\S]*?<\/div>\s*<\/div>/)[0];
    const nulls = ["w", "h", "d"].filter(k => !r.cutout_in || r.cutout_in[k] == null).length;
    assert.equal((big.match(/coDim miss/g) || []).length, nulls, r.model);
    if (r.status !== "verified") assert.match(html, /Not fully verified/, r.model);
    else assert.match(html, /Verified Nov 21, 2026/, r.model);
  }
});

test("discontinued BLZ-26-PZOVN is not listed; BLZ-LTE3OVN answers for it", () => {
  assert.ok(!fs.existsSync(path.join(SITE, "dimensions/cutouts/blaze/blz-26-pzovn")));
  const hub = read(path.join(SITE, "dimensions/cutouts/index.html"));
  assert.doesNotMatch(hub, /class="coModel"[^>]*>BLZ-26-PZOVN/);
  assert.match(read(pageOf(live.find(r => r.model === "BLZ-LTE3OVN"))), /Replaces:<\/b> BLZ-26-PZOVN/);
});

test("sitemap lists the hub, brand pages and every model page", () => {
  const xml = read(path.join(SITE, "sitemap.xml"));
  assert.ok(xml.includes("https://eaglebuilt.ai/dimensions/cutouts/</loc>"));
  for (const b of Object.values(BRAND)) assert.ok(xml.includes(`https://eaglebuilt.ai/dimensions/cutouts/${b}/</loc>`), b);
  for (const r of live) assert.ok(xml.includes(`/dimensions/cutouts/${BRAND[r.brand]}/${slug(r.model)}/</loc>`), r.model);
});

test("every record names its source and check date", () => {
  for (const r of DATA) {
    assert.ok(r.source_url || r.spec_sheet_url, r.model);
    assert.match(r.verified_date, /^\d{4}-\d{2}-\d{2}$/, r.model);
    if (r.status === "verified") assert.ok(r.spec_sheet_url, r.model + " verified without a spec sheet");
    for (const k of ["w", "h", "d"]) if (r.cutout_in && r.cutout_in[k] != null) assert.ok(r.cutout_in[k] > 0 && r.cutout_in[k] < 80, r.model + " " + k);
  }
});

test("manufacturer ranges print as a range, not one number", () => {
  for (const r of live.filter(x => x.cutout_max_in && x.cutout_max_in.w && x.cutout_max_in.w !== x.cutout_in.w)) {
    const big = read(pageOf(r)).match(/<div class="co coBig"[\s\S]*?<\/div>\s*<\/div>/)[0];
    assert.match(big, /\d\u2013\d/, r.model);
  }
});

test("hub carries every live model in its index and a most-searched list", () => {
  const hub = read(path.join(SITE, "dimensions/cutouts/index.html"));
  const data = JSON.parse(hub.match(/<script type="application\/json" id="coData">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.r.length, live.length);
  assert.match(hub, /Most searched cutouts/);
  assert.ok(hub.length < 400000, "hub should stay light: " + hub.length);
});
