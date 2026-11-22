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
const BRAND = { "Blaze": "blaze", "Hestan": "hestan", "Yoder Smokers": "yoder" };
const slug = s => s.toLowerCase().replace(/[()]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const pageOf = r => path.join(SITE, "dimensions/cutouts", BRAND[r.brand], slug(r.model), "index.html");
const live = DATA.filter(r => r.model !== "BLZ-26-PZOVN");
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
    assert.match(t, /^(Blaze|Hestan|Yoder Smokers) .+ Cutout Dimensions \| EagleBuilt$/, t);
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
    const prop = n => (p.additionalProperty.find(x => x.name === n) || {}).value;
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
