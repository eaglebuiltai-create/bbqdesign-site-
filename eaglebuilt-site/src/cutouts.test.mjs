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
    /* The label varies by page: a model the designer carries reads "Design
       an island with this" and drops straight in, one it does not reads
       "Open the designer". What every page owes the reader is a way into
       the designer and a way into Design Eagle, so assert the routes rather
       than the wording. Design Eagle used to appear only in the fallback
       prose, which left the best-qualified pages never mentioning it. */
    assert.match(html, /href="\/design\/app\//);
    assert.match(html, /href="\/design-eagle\/"/);
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

test("hub carries every live model in its index and a popular-models list", () => {
  const hub = read(path.join(SITE, "dimensions/cutouts/index.html"));
  const data = JSON.parse(hub.match(/<script type="application\/json" id="coData">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.r.length, live.length);
  assert.match(hub, /Popular models/);
  assert.doesNotMatch(hub, /most searched|most-searched|look up most/i);
  assert.ok(hub.length < 400000, "hub should stay light: " + hub.length);
});

test("batch 4: DCS and Hestan records cite the manufacturer's own documents", () => {
  const hosts = { DCS: ["dam.fisherpaykel.com"], Hestan: ["cdn.brandfolder.io", "hestanappliances.com"] };
  for (const [brand, ok] of Object.entries(hosts)) {
    const rs = live.filter(r => r.brand === brand);
    assert.ok(rs.length >= (brand === "DCS" ? 25 : 50), `${brand} has ${rs.length} records`);
    for (const r of rs) {
      if (!r.source_url) continue;
      assert.ok(ok.includes(new URL(r.source_url).host), `${r.model} source ${r.source_url}`);
      assert.ok(fs.existsSync(pageOf(r)), `${r.model} page`);
    }
  }
  const be36 = live.find(r => r.model === "BE1-36RC");
  assert.deepEqual(be36.cutout_in, { w: 34.5, h: 10.125, d: 22.75 });
  assert.equal(be36.designer_key, "BE1-36RC-N");
});

test("batch 5: refrigeration, Napoleon and Blaze jackets cite manufacturer documents", () => {
  const hosts = { "Perlick": ["api.perlick.com"], "True Residential": ["true-caliber.com"], "U-Line": ["www.u-line.com"], "Napoleon": ["www.napoleon.com", "www.napoleonproducts.com"], "Blaze": ["www.blazegrills.com"] };
  for (const [brand, ok] of Object.entries(hosts)) {
    for (const r of live.filter(x => x.brand === brand && x.source_url)) {
      assert.ok(ok.includes(new URL(r.source_url).host), `${r.model} source ${r.source_url}`);
    }
  }
  for (const m of ["GABR30", "GABR36", "GABR42"]) {
    const r = live.find(x => x.model === m);
    assert.match(r.source_url, /cdn\.brandfolder\.io\/W2HABDQZ\/.*008980_RevG\.pdf$/);
  }
  const ore = live.find(r => r.model === "ORE124");
  assert.deepEqual(ore.cutout_in, { w: 24.25, h: 34.125, d: 24 });
  assert.equal(ore.cutout_max_in.h, 35.125);
  assert.ok(live.filter(r => r.brand === "Napoleon").length >= 16);
});

test("flange: every record with a flange is well-formed, sourced and bigger than its cutout", () => {
  for (const r of live.filter(x => x.flange)) {
    const f = r.flange, c = r.cutout_in || {};
    assert.ok(["face", "rim", "none"].includes(f.kind), `${r.model} kind ${f.kind}`);
    assert.ok(f.source && f.source.length > 10, `${r.model} flange source`);
    if (f.kind === "none") { assert.ok(f.w == null && f.h == null && f.d == null, `${r.model} none has no dims`); continue; }
    const other = f.kind === "face" ? f.h : f.d;
    assert.ok(f.w != null || f.overlap != null || f.overlap_lr != null, `${r.model} flange has a width or an overlap`);
    if (f.overlap_lr != null) assert.ok(f.overlap == null && f.overlap_tb > 0 && f.overlap_tb < 4 && f.overlap_lr < 4, `${r.model} side overlaps`);
    if (f.kind === "face") assert.equal(f.d, undefined, `${r.model} face flange has no depth`);
    if (f.kind === "rim") assert.equal(f.h, undefined, `${r.model} rim flange has no height`);
    if (f.w != null && c.w != null) assert.ok(f.w >= c.w, `${r.model} flange W ${f.w} < cutout W ${c.w}`);
    const cOther = f.kind === "face" ? c.h : c.d;
    if (other != null && cOther != null && f.kind === "face") assert.ok(other >= cOther, `${r.model} flange H ${other} < cutout H ${cOther}`);
    if (f.overlap != null) assert.ok(f.overlap > 0 && f.overlap < 4, `${r.model} overlap ${f.overlap}`);
  }
});

test("flange shows under the cutout on every model page, in JSON-LD, and in the hub index", () => {
  const inch = v => { if (Math.abs(v * 16 - Math.round(v * 16)) > 1e-6) return (+v.toFixed(3)) + '"'; const s = Math.round(v * 16), w = Math.floor(s / 16), q = s % 16; if (!q) return w + '"'; const g = q % 8 === 0 ? 8 : q % 4 === 0 ? 4 : q % 2 === 0 ? 2 : 1; return (w ? w + " " : "") + q / g + "/" + 16 / g + '"'; };
  for (const r of live) {
    const html = read(pageOf(r));
    const big = html.match(/<div class="co coBig"[\s\S]*?<div class="coMeta">/)[0];
    const dimsAt = big.indexOf('class="coDims"'), flAt = big.indexOf('class="coOverall coFlange"');
    assert.ok(flAt > dimsAt && dimsAt > 0, `${r.model}: flange line right under the cutout`);
    const line = big.slice(flAt, big.indexOf("</div>", flAt));
    const f = r.flange;
    if (!f) assert.match(line, /Flange: <i>check spec sheet<\/i>/, r.model);
    else if (f.w == null && f.kind !== "none") assert.match(line, /per side|each side|check spec sheet/, r.model);
    else if (f.kind === "none") assert.match(line, /Flange: none/, r.model);
    else if (f.w != null) assert.ok(line.includes(`Flange: ${inch(f.w).replace(/"/g, "&quot;")}`) || line.includes(`Flange: ${inch(f.w)}`), `${r.model}: ${line}`);
    const p = ld(html)[0]["@graph"].find(n => n["@type"] === "Product");
    const prop = n => (p.additionalProperty.find(y => y.name === n) || {}).value;
    if (f && f.kind !== "none") {
      assert.equal(prop("Flange width") ?? null, f.w ?? null, r.model);
      assert.equal(prop(f.kind === "rim" ? "Flange depth (top footprint)" : "Flange height") ?? null, (f.kind === "rim" ? f.d : f.h) ?? null, r.model);
    } else assert.equal(prop("Flange width"), undefined, r.model);
  }
  const hub = read(path.join(SITE, "dimensions/cutouts/index.html"));
  const data = JSON.parse(hub.match(/<script type="application\/json" id="coData">([\s\S]*?)<\/script>/)[1]);
  const byUrl = Object.fromEntries(data.r.map(x => [x[3], x]));
  for (const r of live) {
    const row = byUrl[`/dimensions/cutouts/${BRAND[r.brand]}/${slug(r.model)}/`];
    assert.ok(row, r.model);
    const f = r.flange;
    if (!f) assert.equal(row[18], null, r.model);
    else assert.deepEqual(row[18], [f.kind === "none" ? 0 : f.kind === "rim" ? 2 : 1, f.w ?? null, (f.kind === "rim" ? f.d : f.h) ?? null, f.overlap ?? null].concat(f.overlap_lr != null ? [f.overlap_lr, f.overlap_tb] : []), r.model);
  }
  assert.match(hub, /function fl\(f\)/);
});

test("flange spot values match the manufacturer documents", () => {
  const get = (b, m) => live.find(r => r.brand === b && r.model === m).flange;
  assert.deepEqual([get("RCS", "VDD1").w, get("RCS", "VDD1").h], [33, 22]);
  assert.deepEqual([get("RCS", "VIC2").w, get("RCS", "VIC2").d], [24.125, 18.1875]);
  assert.deepEqual([get("Lynx", "LDR30T-4").w, get("Lynx", "LDR30T-4").h], [29.6875, 23]);
  assert.equal(get("Blaze", "BLZ-4LTE3").kind, "rim");
  assert.equal(get("Perlick", live.find(r => r.brand === "Perlick").model).kind, "none");
});
